import { BadRequestException } from '@nestjs/common';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { UploadsService } from './uploads.service';

describe('UploadsService', () => {
  let service: UploadsService;
  let uploadDir: string;
  const previousUploadDir = process.env.UPLOAD_DIR;
  const previousApiBase = process.env.API_BASE_URL;

  beforeEach(() => {
    service = new UploadsService();
    uploadDir = mkdtempSync(join(tmpdir(), 'uploads-test-'));
    process.env.UPLOAD_DIR = uploadDir;
    process.env.API_BASE_URL = 'http://localhost:3000';
  });

  afterEach(() => {
    rmSync(uploadDir, { recursive: true, force: true });
    if (previousUploadDir === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = previousUploadDir;
    if (previousApiBase === undefined) delete process.env.API_BASE_URL;
    else process.env.API_BASE_URL = previousApiBase;
  });

  function makeFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    return {
      fieldname: 'file',
      originalname: 'example.png',
      encoding: '7bit',
      mimetype: 'image/png',
      size: buffer.length,
      buffer,
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
      ...overrides,
    };
  }

  it('saves a reference image under tenant/reference', async () => {
    const result = await service.saveImage(makeFile(), {
      tenantSlug: 'Acme Corp',
      purpose: 'reference',
    });

    expect(result.purpose).toBe('reference');
    expect(result.mimeType).toBe('image/png');
    expect(result.path).toMatch(/^\/uploads\/acme-corp\/reference\/.+\.png$/);
    expect(result.url).toBe(`http://localhost:3000${result.path}`);
    expect(existsSync(join(uploadDir, result.key))).toBe(true);
    expect(readFileSync(join(uploadDir, result.key)).length).toBeGreaterThan(0);
  });

  it('defaults purpose to answer', async () => {
    const result = await service.saveImage(makeFile(), {
      tenantSlug: 'demo',
    });
    expect(result.purpose).toBe('answer');
    expect(result.key).toContain('demo/answer/');
  });

  it('seeds bundled logo as reference', () => {
    const result = service.ensureBundledLogoReference('demo');
    expect(result.fileName).toBe('eusocial-logo.png');
    expect(result.purpose).toBe('reference');
    expect(existsSync(join(uploadDir, result.key))).toBe(true);
  });

  it('rejects non-image mime types', async () => {
    await expect(
      service.saveImage(makeFile({ mimetype: 'application/pdf', originalname: 'a.pdf' }), {
        tenantSlug: 'demo',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects missing file', async () => {
    await expect(
      service.saveImage(undefined, { tenantSlug: 'demo' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid purpose', () => {
    expect(() => service.resolvePurpose('compare')).toThrow(BadRequestException);
  });

  it('deletes an uploaded image from storage', async () => {
    const saved = await service.saveImage(makeFile(), {
      tenantSlug: 'demo',
      purpose: 'answer',
    });
    expect(existsSync(join(uploadDir, saved.key))).toBe(true);

    const deleted = service.deleteImage({
      tenantSlug: 'demo',
      key: saved.key,
    });
    expect(deleted).toEqual({ key: saved.key, deleted: true });
    expect(existsSync(join(uploadDir, saved.key))).toBe(false);
  });

  it('rejects delete for another tenant key', async () => {
    const saved = await service.saveImage(makeFile(), {
      tenantSlug: 'demo',
      purpose: 'answer',
    });

    expect(() =>
      service.deleteImage({
        tenantSlug: 'other',
        key: saved.key,
      }),
    ).toThrow(BadRequestException);
  });
});
