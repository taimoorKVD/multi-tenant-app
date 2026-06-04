import { CanActivate, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TenantAuthGuard } from '../../auth/guards';
import { FormsController } from './forms.controller';
import { SubmissionsController } from './submissions.controller';
import { VersionsController } from './versions.controller';
import { PermissionsGuard } from '../guards';
import {
  FormsService,
  SubmissionsService,
  VersionsService,
} from '../services';

describe('Form Builder APIs', () => {
  let app: INestApplication;
  let authGuardSpy: jest.SpyInstance;
  let permissionsGuardSpy: jest.SpyInstance;

  const authGuardMock: CanActivate = { canActivate: jest.fn().mockReturnValue(true) };
  const permissionsGuardMock: CanActivate = { canActivate: jest.fn().mockReturnValue(true) };

  const formsServiceMock = {
    getModules: jest.fn(),
    bootstrapByModuleSlug: jest.fn(),
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    autosave: jest.fn(),
    saveSchema: jest.fn(),
    updateLayout: jest.fn(),
    publish: jest.fn(),
    getRuntimeSchema: jest.fn(),
    createSection: jest.fn(),
    updateSection: jest.fn(),
    deleteSection: jest.fn(),
  };

  const submissionsServiceMock = {
    submit: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
  };

  const versionsServiceMock = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    restore: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    authGuardSpy = jest
      .spyOn(TenantAuthGuard.prototype, 'canActivate')
      .mockImplementation(() => true as any);
    permissionsGuardSpy = jest
      .spyOn(PermissionsGuard.prototype, 'canActivate')
      .mockImplementation(() => true as any);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [
        FormsController,
        SubmissionsController,
        VersionsController,
      ],
      providers: [
        { provide: FormsService, useValue: formsServiceMock },
        { provide: SubmissionsService, useValue: submissionsServiceMock },
        { provide: VersionsService, useValue: versionsServiceMock },
        { provide: TenantAuthGuard, useValue: authGuardMock },
        { provide: PermissionsGuard, useValue: permissionsGuardMock },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    authGuardSpy.mockRestore();
    permissionsGuardSpy.mockRestore();
    await app.close();
  });

  describe('FormsController', () => {
    it('GET /modules returns module list', async () => {
      const response = { success: true, count: 1, data: [{ id: 1, slug: 'users' }] };
      formsServiceMock.getModules.mockResolvedValue(response);

      await request(app.getHttpServer()).get('/modules').expect(200).expect(response);
      expect(formsServiceMock.getModules).toHaveBeenCalledTimes(1);
    });

    it('GET /tenant/:tenantId/modules returns module list', async () => {
      const response = { success: true, count: 0, data: [] };
      formsServiceMock.getModules.mockResolvedValue(response);

      await request(app.getHttpServer()).get('/tenant/acme/modules').expect(200).expect(response);
      expect(formsServiceMock.getModules).toHaveBeenCalledTimes(1);
    });

    it('GET /forms/modules/:moduleSlug bootstraps schema', async () => {
      const response = { success: true, data: { form: { id: 1, moduleSlug: 'users' } } };
      formsServiceMock.bootstrapByModuleSlug.mockResolvedValue(response);

      await request(app.getHttpServer()).get('/forms/modules/users').expect(200).expect(response);
      expect(formsServiceMock.bootstrapByModuleSlug).toHaveBeenCalledWith(expect.any(Object), 'users');
    });

    it('POST /forms creates form', async () => {
      const dto = { moduleId: 1, name: 'Users Form' };
      const response = { success: true, message: 'Form created successfully', data: { id: 1 } };
      formsServiceMock.create.mockResolvedValue(response);

      await request(app.getHttpServer()).post('/forms').send(dto).expect(201).expect(response);
      expect(formsServiceMock.create).toHaveBeenCalledWith(expect.any(Object), dto);
    });

    it('GET /forms returns all forms', async () => {
      const response = { success: true, count: 1, data: [{ id: 1 }] };
      formsServiceMock.findAll.mockResolvedValue(response);

      await request(app.getHttpServer()).get('/forms').expect(200).expect(response);
      expect(formsServiceMock.findAll).toHaveBeenCalledTimes(1);
    });

    it('GET /forms/:id returns one form', async () => {
      const response = { success: true, data: { id: 2 } };
      formsServiceMock.findOne.mockResolvedValue(response);

      await request(app.getHttpServer()).get('/forms/2').expect(200).expect(response);
      expect(formsServiceMock.findOne).toHaveBeenCalledWith(expect.any(Object), 2);
    });

    it('PUT /forms/:id updates form', async () => {
      const dto = { name: 'Updated Users Form' };
      const response = { success: true, message: 'Form updated successfully', data: { id: 2 } };
      formsServiceMock.update.mockResolvedValue(response);

      await request(app.getHttpServer()).put('/forms/2').send(dto).expect(200).expect(response);
      expect(formsServiceMock.update).toHaveBeenCalledWith(expect.any(Object), 2, dto);
    });

    it('DELETE /forms/:id soft-deletes form', async () => {
      const response = { success: true, message: 'Form deleted successfully', deletedId: 2 };
      formsServiceMock.remove.mockResolvedValue(response);

      await request(app.getHttpServer()).delete('/forms/2').expect(200).expect(response);
      expect(formsServiceMock.remove).toHaveBeenCalledWith(expect.any(Object), 2);
    });

    it('PUT /forms/:id/autosave autosaves schema', async () => {
      const dto = { schema: { sections: [], fields: [] } };
      const response = { success: true, message: 'Form autosaved', data: { id: 2 } };
      formsServiceMock.autosave.mockResolvedValue(response);

      await request(app.getHttpServer()).put('/forms/2/autosave').send(dto).expect(200).expect(response);
      expect(formsServiceMock.autosave).toHaveBeenCalledWith(expect.any(Object), 2, dto);
    });

    it('PUT /forms/:id/schema saves full schema', async () => {
      const dto = {
        schema: {
          sections: [{ title: 'Contact', position: 0 }],
          fields: [{ fieldKey: 'name', label: 'Name' }],
          conditionalRules: [],
        },
      };
      const response = { success: true, message: 'Schema saved successfully', data: { id: 2 } };
      formsServiceMock.saveSchema.mockResolvedValue(response);

      await request(app.getHttpServer()).put('/forms/2/schema').send(dto).expect(200).expect(response);
      expect(formsServiceMock.saveSchema).toHaveBeenCalledWith(expect.any(Object), 2, dto);
    });

    it('PUT /forms/:id/layout updates layout', async () => {
      const dto = {
        fields: [
          {
            fieldId: 10,
            sectionId: 1,
            sortOrder: 0,
            gridWidthDesktop: 6,
            gridWidthMobile: 12,
          },
        ],
      };
      const response = { success: true, message: 'Layout updated successfully' };
      formsServiceMock.updateLayout.mockResolvedValue(response);

      await request(app.getHttpServer()).put('/forms/2/layout').send(dto).expect(200).expect(response);
      expect(formsServiceMock.updateLayout).toHaveBeenCalledWith(expect.any(Object), 2, dto);
    });

    it('POST /forms/:id/publish publishes form', async () => {
      const response = { success: true, message: 'Form published successfully', data: { version: 2 } };
      formsServiceMock.publish.mockResolvedValue(response);

      await request(app.getHttpServer()).post('/forms/2/publish').expect(201).expect(response);
      expect(formsServiceMock.publish).toHaveBeenCalledWith(expect.any(Object), 2);
    });

    it('GET /forms/:id/runtime-schema returns runtime schema', async () => {
      const response = { success: true, data: { form: { id: 2 }, fields: [] } };
      formsServiceMock.getRuntimeSchema.mockResolvedValue(response);

      await request(app.getHttpServer()).get('/forms/2/runtime-schema').expect(200).expect(response);
      expect(formsServiceMock.getRuntimeSchema).toHaveBeenCalledWith(expect.any(Object), 2);
    });

    it('POST /forms/:id/sections creates section', async () => {
      const dto = { title: 'Contact Info', position: 0 };
      const response = { success: true, message: 'Section created successfully', data: { id: 7 } };
      formsServiceMock.createSection.mockResolvedValue(response);

      await request(app.getHttpServer()).post('/forms/2/sections').send(dto).expect(201).expect(response);
      expect(formsServiceMock.createSection).toHaveBeenCalledWith(expect.any(Object), 2, dto);
    });

    it('PUT /sections/:id updates section', async () => {
      const dto = { title: 'Updated Contact Info' };
      const response = { success: true, message: 'Section updated successfully', data: { id: 7 } };
      formsServiceMock.updateSection.mockResolvedValue(response);

      await request(app.getHttpServer()).put('/sections/7').send(dto).expect(200).expect(response);
      expect(formsServiceMock.updateSection).toHaveBeenCalledWith(expect.any(Object), 7, dto);
    });

    it('DELETE /sections/:id deletes section', async () => {
      const response = { success: true, message: 'Section deleted successfully', deletedId: 7 };
      formsServiceMock.deleteSection.mockResolvedValue(response);

      await request(app.getHttpServer()).delete('/sections/7').expect(200).expect(response);
      expect(formsServiceMock.deleteSection).toHaveBeenCalledWith(expect.any(Object), 7);
    });

    it('GET /forms/:id rejects non-numeric id', async () => {
      await request(app.getHttpServer()).get('/forms/not-a-number').expect(400);
    });
  });

  describe('SubmissionsController', () => {
    it('POST /forms/:id/submit creates a submission', async () => {
      const dto = { data: { name: 'John Doe', email: 'john@doe.com' } };
      const response = { success: true, message: 'Submission saved successfully', data: { id: 1 } };
      submissionsServiceMock.submit.mockResolvedValue(response);

      await request(app.getHttpServer()).post('/forms/3/submit').send(dto).expect(201).expect(response);
      expect(submissionsServiceMock.submit).toHaveBeenCalledWith(expect.any(Object), 3, dto);
    });

    it('GET /forms/:id/submissions returns submission list', async () => {
      const response = { success: true, count: 1, data: [{ id: 1 }] };
      submissionsServiceMock.findAll.mockResolvedValue(response);

      await request(app.getHttpServer()).get('/forms/3/submissions').expect(200).expect(response);
      expect(submissionsServiceMock.findAll).toHaveBeenCalledWith(expect.any(Object), 3);
    });

    it('GET /submissions/:id returns one submission', async () => {
      const response = { success: true, data: { id: 1, formId: 3 } };
      submissionsServiceMock.findOne.mockResolvedValue(response);

      await request(app.getHttpServer()).get('/submissions/1').expect(200).expect(response);
      expect(submissionsServiceMock.findOne).toHaveBeenCalledWith(expect.any(Object), 1);
    });
  });

  describe('VersionsController', () => {
    it('GET /forms/:id/versions returns versions', async () => {
      const response = { success: true, count: 2, data: [{ version: 1 }, { version: 2 }] };
      versionsServiceMock.findAll.mockResolvedValue(response);

      await request(app.getHttpServer()).get('/forms/5/versions').expect(200).expect(response);
      expect(versionsServiceMock.findAll).toHaveBeenCalledWith(expect.any(Object), 5);
    });

    it('GET /forms/:id/versions/:version returns version details', async () => {
      const response = { success: true, data: { version: 2, schemaSnapshot: {} } };
      versionsServiceMock.findOne.mockResolvedValue(response);

      await request(app.getHttpServer()).get('/forms/5/versions/2').expect(200).expect(response);
      expect(versionsServiceMock.findOne).toHaveBeenCalledWith(expect.any(Object), 5, 2);
    });

    it('POST /forms/:id/versions/restore/:version restores version', async () => {
      const response = { success: true, message: 'Version restored successfully' };
      versionsServiceMock.restore.mockResolvedValue(response);

      await request(app.getHttpServer())
        .post('/forms/5/versions/restore/2')
        .expect(201)
        .expect(response);
      expect(versionsServiceMock.restore).toHaveBeenCalledWith(expect.any(Object), 5, 2);
    });
  });
});
