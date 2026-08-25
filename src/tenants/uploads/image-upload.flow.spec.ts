import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { DynamicFieldsService } from '../form-builder/services/dynamic-fields.service';
import { FormsService } from '../form-builder/services/forms.service';
import {
  DynamicModule,
  EntityDynamicData,
  Form,
  FormStatus,
  FormVersion,
} from '../form-builder/entities';
import { UploadsService } from './uploads.service';

/**
 * End-to-end unit coverage for the image upload flow:
 * 1) seed/reference logo
 * 2) upload purpose=reference
 * 3) save schema with referenceImages[]
 * 4) upload purpose=answer (multiple)
 * 5) answer payload array + required presence checks
 */
describe('Image upload complete flow', () => {
  let uploadDir: string;
  let uploadsService: UploadsService;
  let dynamicFields: DynamicFieldsService;
  let formsService: FormsService;

  const previousUploadDir = process.env.UPLOAD_DIR;
  const previousApiBase = process.env.API_BASE_URL;

  function pngFile(name: string): Express.Multer.File {
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);
    return {
      fieldname: 'file',
      originalname: name,
      encoding: '7bit',
      mimetype: 'image/png',
      size: buffer.length,
      buffer,
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
    };
  }

  function createReq(formRepo: any) {
    return {
      tenantId: 'acme',
      protocol: 'http',
      headers: { host: 'localhost:3000' },
      get: (header: string) => (header === 'host' ? 'localhost:3000' : undefined),
      user: { id: 1 },
      tenantConnection: {
        getRepository: jest.fn().mockImplementation((entity: any) => {
          if (entity === Form) return formRepo;
          if (entity === EntityDynamicData) {
            return {
              find: jest.fn().mockResolvedValue([]),
              save: jest.fn(),
            };
          }
          if (entity === DynamicModule) {
            return {
              find: jest.fn().mockResolvedValue([]),
              findOne: jest.fn(),
            };
          }
          if (entity === FormVersion) {
            return {
              findOne: jest.fn().mockResolvedValue(null),
              find: jest.fn().mockResolvedValue([]),
              save: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            };
          }
          throw new Error(`Unexpected entity ${entity?.name}`);
        }),
        manager: {
          transaction: jest.fn().mockImplementation(async (cb: Function) =>
            cb({
              getRepository: jest.fn().mockImplementation((entity: any) => {
                if (entity === Form) return formRepo;
                if (entity === FormVersion) {
                  return {
                    findOne: jest.fn().mockResolvedValue(null),
                    save: jest.fn(),
                    create: jest.fn((e) => e),
                    update: jest.fn(),
                  };
                }
                throw new Error(`Unexpected tx entity ${entity?.name}`);
              }),
            }),
          ),
        },
      },
    };
  }

  beforeEach(() => {
    uploadDir = mkdtempSync(join(tmpdir(), 'image-flow-'));
    process.env.UPLOAD_DIR = uploadDir;
    process.env.API_BASE_URL = 'http://localhost:3000';

    uploadsService = new UploadsService();
    dynamicFields = new DynamicFieldsService();
    formsService = new FormsService(
      null as any,
      { log: jest.fn().mockResolvedValue(undefined) } as any,
      dynamicFields,
      uploadsService,
    );
  });

  afterEach(() => {
    rmSync(uploadDir, { recursive: true, force: true });
    if (previousUploadDir === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = previousUploadDir;
    if (previousApiBase === undefined) delete process.env.API_BASE_URL;
    else process.env.API_BASE_URL = previousApiBase;
  });

  it('runs reference upload → schema save → multi answer upload → presence checks', async () => {
    // 1) Bundled logo as local reference seed
    const logo = uploadsService.ensureBundledLogoReference('acme', 'http://localhost:3000');
    expect(logo.purpose).toBe('reference');
    expect(logo.fileName).toBe('eusocial-logo.png');
    expect(existsSync(join(uploadDir, logo.key))).toBe(true);
    expect(readFileSync(join(uploadDir, logo.key)).length).toBeGreaterThan(0);

    // 2) Builder uploads an extra reference image (API service = POST /uploads/images?purpose=reference)
    const referenceUpload = await uploadsService.saveImage(pngFile('example-2.png'), {
      tenantSlug: 'acme',
      purpose: 'reference',
      requestOrigin: 'http://localhost:3000',
    });
    expect(referenceUpload.purpose).toBe('reference');
    expect(referenceUpload.url).toContain('/uploads/acme/reference/');
    expect(existsSync(join(uploadDir, referenceUpload.key))).toBe(true);

    const referenceImages = [logo, referenceUpload];

    // 3) Save schema with referenceImages + multiple config
    const formEntity: any = {
      id: 10,
      name: 'Items Form',
      status: FormStatus.DRAFT,
      moduleId: 2,
      module: { id: 2, slug: 'items', name: 'Items' },
      autosaveSchema: { fields: [] },
    };
    const formRepo = {
      findOne: jest.fn().mockResolvedValue(formEntity),
      save: jest.fn().mockImplementation(async (entity: any) => {
        Object.assign(formEntity, entity);
        return formEntity;
      }),
    };
    const req = createReq(formRepo);

    const saveResult = await formsService.saveSchema(req, 10, {
      markAsDraft: true,
      schema: {
        fields: [
          {
            id: 'fld_image_upload_seed',
            type: 'image',
            fieldTypeName: 'image',
            label: 'Upload Images',
            name: 'image_upload',
            fieldKey: 'image_upload',
            referenceImages,
            multiple: true,
            minFiles: 1,
            maxFiles: 5,
            required: true,
            isShow: true,
            isReadonly: false,
            isEditable: true,
            validations: {},
            width: 12,
            order: 10,
          },
        ],
      },
    });

    expect(saveResult.success).toBe(true);
    const savedField = formEntity.autosaveSchema.fields.find(
      (field: any) => field.name === 'image_upload' || field.id === 'fld_image_upload_seed',
    );
    expect(savedField).toBeDefined();
    expect(savedField.type).toBe('image');
    expect(savedField.fieldTypeName).toBe('image');
    expect(savedField.multiple).toBe(true);
    expect(savedField.maxFiles).toBe(5);
    expect(Array.isArray(savedField.referenceImages)).toBe(true);
    expect(savedField.referenceImages).toHaveLength(2);
    expect(savedField.referenceImages[0].fileName).toBe('eusocial-logo.png');
    expect(savedField.referenceImages[1].fileName).toBe('example-2.png');

    // 4) Fill form: upload multiple answer images (POST /uploads/images?purpose=answer)
    const answer1 = await uploadsService.saveImage(pngFile('image-1.png'), {
      tenantSlug: 'acme',
      purpose: 'answer',
      requestOrigin: 'http://localhost:3000',
    });
    const answer2 = await uploadsService.saveImage(pngFile('image-2.png'), {
      tenantSlug: 'acme',
      purpose: 'answer',
      requestOrigin: 'http://localhost:3000',
    });

    expect(answer1.purpose).toBe('answer');
    expect(answer2.purpose).toBe('answer');
    expect(answer1.key).toContain('acme/answer/');
    expect(answer2.key).toContain('acme/answer/');

    const answerPayload = {
      fld_image_upload_seed: [answer1, answer2],
    };

    // 5) Required / presence checks for multi-image answers
    expect(dynamicFields.hasPresentValue(answerPayload.fld_image_upload_seed)).toBe(true);
    expect(dynamicFields.hasPresentValue([])).toBe(false);
    expect(dynamicFields.hasPresentValue({ url: null })).toBe(false);
    expect(dynamicFields.hasPresentValue(answer1)).toBe(true);

    expect(answerPayload.fld_image_upload_seed.length).toBeGreaterThanOrEqual(savedField.minFiles);
    expect(answerPayload.fld_image_upload_seed.length).toBeLessThanOrEqual(savedField.maxFiles);
  });

  it('rejects invalid upload purpose and non-image files', async () => {
    await expect(
      uploadsService.saveImage(pngFile('x.png'), {
        tenantSlug: 'acme',
        purpose: 'compare',
      }),
    ).rejects.toThrow(/purpose/i);

    await expect(
      uploadsService.saveImage(
        { ...pngFile('doc.pdf'), mimetype: 'application/pdf', originalname: 'doc.pdf' },
        { tenantSlug: 'acme', purpose: 'answer' },
      ),
    ).rejects.toThrow(/JPEG|PNG|GIF|WebP/i);
  });
});
