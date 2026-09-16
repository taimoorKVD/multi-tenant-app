import { AuditLogService } from './audit-log.service';
import { FormAuditLog } from '../entities';

describe('AuditLogService', () => {
  let service: AuditLogService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuditLogService(null as any);
  });

  function createReq(overrides?: any) {
    const repo = {
      create: jest.fn().mockImplementation((e: any) => e),
      save: jest.fn().mockResolvedValue(undefined),
    };
    return {
      tenantConnection: {
        getRepository: jest.fn().mockReturnValue(repo),
      },
      ip: '127.0.0.1',
      headers: {},
      user: { id: 1 },
      ...overrides,
      _repo: repo,
    } as any;
  }

  describe('log', () => {
    it('creates and saves an audit log record', async () => {
      const req = createReq();
      await service.log(req, {
        entityType: 'form',
        entityId: 1,
        action: 'create',
        newValue: { name: 'Test' },
        createdBy: 1,
      });

      expect(req._repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'form',
          entityId: 1,
          action: 'create',
          newValue: { name: 'Test' },
          createdBy: 1,
          updatedBy: 1,
        }),
      );
      expect(req._repo.save).toHaveBeenCalled();
    });

    it('extracts IP from x-forwarded-for header', async () => {
      const req = createReq({
        ip: null,
        headers: { 'x-forwarded-for': '10.0.0.1, 10.0.0.2' },
      });

      await service.log(req, {
        entityType: 'form',
        entityId: 1,
        action: 'update',
        createdBy: 1,
      });

      expect(req._repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ ipAddress: '10.0.0.1' }),
      );
    });

    it('extracts IP from connection.remoteAddress', async () => {
      const req = createReq({
        ip: null,
        headers: {},
        connection: { remoteAddress: '192.168.1.1' },
      });

      await service.log(req, {
        entityType: 'form',
        entityId: 1,
        action: 'update',
        createdBy: 1,
      });

      expect(req._repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ ipAddress: '192.168.1.1' }),
      );
    });

    it('returns early when tenantConnection is missing', async () => {
      const req = createReq({ tenantConnection: null });
      await expect(
        service.log(req, { entityType: 'form', entityId: 1, action: 'create' }),
      ).resolves.toBeUndefined();
    });

    it('sets null oldValue/newValue when not provided', async () => {
      const req = createReq();
      await service.log(req, {
        entityType: 'form',
        entityId: 1,
        action: 'publish',
        createdBy: 1,
      });

      expect(req._repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ oldValue: null, newValue: null }),
      );
    });

    it('extracts user id from req.user.id', async () => {
      const req = createReq({ user: { id: 42 } });
      await service.log(req, {
        entityType: 'form',
        entityId: 1,
        action: 'create',
        createdBy: 42,
      });

      expect(req._repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ createdBy: 42, updatedBy: 42 }),
      );
    });

    it('extracts user id from req.user.sub fallback', async () => {
      const req = createReq({ user: { sub: 99 } });
      await service.log(req, {
        entityType: 'form',
        entityId: 1,
        action: 'create',
        createdBy: 99,
      });

      expect(req._repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ createdBy: 99, updatedBy: 99 }),
      );
    });
  });
});
