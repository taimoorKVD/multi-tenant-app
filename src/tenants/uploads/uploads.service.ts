import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { dirname, extname, join, normalize, relative, resolve, sep } from 'path';

export type ImageUploadPurpose = 'reference' | 'answer';

export type UploadedImageMeta = {
  url: string;
  path: string;
  key: string;
  fileName: string;
  mimeType: string;
  size: number;
  purpose: ImageUploadPurpose;
};

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

const MAX_IMAGE_BYTES = Number(process.env.UPLOAD_IMAGE_MAX_BYTES || 5 * 1024 * 1024);

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  getUploadsRoot(): string {
    const configured = process.env.UPLOAD_DIR?.trim();
    if (configured) return configured;
    return join(process.cwd(), 'uploads');
  }

  resolvePurpose(raw?: string | null): ImageUploadPurpose {
    const value = String(raw || 'answer').trim().toLowerCase();
    if (value === 'reference' || value === 'example') return 'reference';
    if (value === 'answer' || value === 'submission' || value === 'fill') return 'answer';
    throw new BadRequestException(
      'purpose must be "reference" (builder example image) or "answer" (user upload)',
    );
  }

  async saveImage(
    file: Express.Multer.File | undefined,
    options: {
      tenantSlug: string;
      purpose?: string | null;
      requestOrigin?: string | null;
    },
  ): Promise<UploadedImageMeta> {
    if (!file) {
      throw new BadRequestException('file is required (multipart field name: "file")');
    }

    const mimeType = String(file.mimetype || '').trim().toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new BadRequestException(
        'Only JPEG, PNG, GIF, and WebP images are allowed',
      );
    }

    const size = Number(file.size || file.buffer?.length || 0);
    if (!size) {
      throw new BadRequestException('Uploaded file is empty');
    }
    if (size > MAX_IMAGE_BYTES) {
      throw new BadRequestException(
        `Image exceeds max size of ${Math.floor(MAX_IMAGE_BYTES / (1024 * 1024))}MB`,
      );
    }

    const tenantSlug = this.sanitizeSegment(options.tenantSlug, 'tenant');
    const purpose = this.resolvePurpose(options.purpose);
    const extension = this.resolveExtension(file.originalname, mimeType);
    const storedName = `${randomUUID()}${extension}`;
    const relativeKey = `${tenantSlug}/${purpose}/${storedName}`;
    const absolutePath = join(this.getUploadsRoot(), tenantSlug, purpose, storedName);

    mkdirSync(dirname(absolutePath), { recursive: true });

    if (file.buffer?.length) {
      writeFileSync(absolutePath, file.buffer);
    } else if (file.path && existsSync(file.path)) {
      copyFileSync(file.path, absolutePath);
      try {
        unlinkSync(file.path);
      } catch {
        // ignore temp cleanup failures
      }
    } else {
      throw new BadRequestException('Uploaded file content is missing');
    }

    const publicPath = `/uploads/${relativeKey}`;
    const url = `${this.getApiBaseUrl(options.requestOrigin)}${publicPath}`;

    this.logger.debug(`Saved image ${relativeKey} (${size} bytes)`);

    return {
      url,
      path: publicPath,
      key: relativeKey,
      fileName: String(file.originalname || storedName).trim() || storedName,
      mimeType,
      size,
      purpose,
    };
  }

  /**
   * Deletes an uploaded image from local storage. `key` must belong to the
   * active tenant (path traversal / cross-tenant deletes are rejected).
   */
  deleteImage(options: {
    tenantSlug: string;
    key?: string | null;
    path?: string | null;
  }): { key: string; deleted: true } {
    const tenantSlug = this.sanitizeSegment(options.tenantSlug, 'tenant');
    const key = this.normalizeStorageKey(options.key || options.path || '');
    if (!key) {
      throw new BadRequestException('key is required (use data.key from upload response)');
    }

    if (!key.startsWith(`${tenantSlug}/`)) {
      throw new BadRequestException('Image key does not belong to the active tenant');
    }

    const absolutePath = this.resolveSafeAbsolutePath(key);
    if (!existsSync(absolutePath)) {
      throw new NotFoundException('Image not found on storage');
    }

    unlinkSync(absolutePath);
    this.logger.debug(`Deleted image ${key}`);

    return { key, deleted: true };
  }

  /**
   * Copies the bundled eusocial logo into tenant uploads as a reference image
   * for local form-builder verification.
   */
  ensureBundledLogoReference(
    tenantSlug: string,
    requestOrigin?: string | null,
  ): UploadedImageMeta {
    const source = this.resolveBundledLogoPath();
    if (!source) {
      throw new BadRequestException(
        'Bundled logo not found (expected src/mail/assets/eusocial-logo.png)',
      );
    }

    const slug = this.sanitizeSegment(tenantSlug, 'tenant');
    const storedName = 'eusocial-logo.png';
    const relativeKey = `${slug}/reference/${storedName}`;
    const absolutePath = join(this.getUploadsRoot(), slug, 'reference', storedName);

    mkdirSync(dirname(absolutePath), { recursive: true });
    if (!existsSync(absolutePath)) {
      copyFileSync(source, absolutePath);
      this.logger.log(`Seeded reference logo at ${relativeKey}`);
    }

    const { size } = statSync(absolutePath);
    const publicPath = `/uploads/${relativeKey}`;

    return {
      url: `${this.getApiBaseUrl(requestOrigin)}${publicPath}`,
      path: publicPath,
      key: relativeKey,
      fileName: storedName,
      mimeType: 'image/png',
      size,
      purpose: 'reference',
    };
  }

  private normalizeStorageKey(raw: string): string {
    let value = String(raw || '').trim().replace(/\\/g, '/');
    if (!value) return '';

    // Accept full URL or /uploads/... path and reduce to storage key.
    const uploadsIdx = value.indexOf('/uploads/');
    if (uploadsIdx >= 0) {
      value = value.slice(uploadsIdx + '/uploads/'.length);
    } else if (value.startsWith('uploads/')) {
      value = value.slice('uploads/'.length);
    }

    value = value.replace(/^\/+/, '');
    if (!value || value.includes('..') || value.includes('\\')) {
      throw new BadRequestException('Invalid image key');
    }

    return value;
  }

  private resolveSafeAbsolutePath(key: string): string {
    const root = resolve(this.getUploadsRoot());
    const absolute = resolve(join(root, ...key.split('/')));
    const rel = relative(root, absolute);
    if (!rel || rel.startsWith('..') || normalize(rel).split(sep).includes('..')) {
      throw new BadRequestException('Invalid image key');
    }
    return absolute;
  }

  private sanitizeSegment(value: string, fallback: string): string {
    const cleaned = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return cleaned || fallback;
  }

  private resolveExtension(originalName: string, mimeType: string): string {
    const fromName = extname(String(originalName || '')).toLowerCase();
    if (ALLOWED_EXTENSIONS.has(fromName)) {
      return fromName === '.jpeg' ? '.jpg' : fromName;
    }

    switch (mimeType) {
      case 'image/png':
        return '.png';
      case 'image/gif':
        return '.gif';
      case 'image/webp':
        return '.webp';
      default:
        return '.jpg';
    }
  }

  private getApiBaseUrl(requestOrigin?: string | null): string {
    const configured = [
      process.env.API_BASE_URL,
      process.env.PUBLIC_API_URL,
      process.env.BACKEND_URL,
      process.env.APP_URL,
    ]
      .map((value) => String(value || '').trim().replace(/\/+$/, ''))
      .find(Boolean);

    if (configured) return configured;

    const fromRequest = String(requestOrigin || '').trim().replace(/\/+$/, '');
    if (fromRequest) return fromRequest;

    const port = process.env.PORT || '3000';
    return `http://localhost:${port}`;
  }

  private resolveBundledLogoPath(): string | null {
    const candidates = [
      join(__dirname, '..', '..', '..', 'mail', 'assets', 'eusocial-logo.png'),
      join(process.cwd(), 'src', 'mail', 'assets', 'eusocial-logo.png'),
      join(process.cwd(), 'dist', 'mail', 'assets', 'eusocial-logo.png'),
      join(process.cwd(), 'dist', 'src', 'mail', 'assets', 'eusocial-logo.png'),
    ];
    return candidates.find((path) => existsSync(path)) || null;
  }
}
