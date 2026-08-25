import { DynamicFieldsService } from './dynamic-fields.service';
import { DynamicModule, EntityDynamicData, Form, FormVersion } from '../entities';
import { In } from 'typeorm';

describe('DynamicFieldsService', () => {
  let service: DynamicFieldsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DynamicFieldsService();
  });

  describe('normalizeFieldAlias', () => {
    it('lowercases and replaces non-alphanumeric with underscores', () => {
      expect(service.normalizeFieldAlias('Hello World!')).toBe('hello_world');
    });

    it('trims leading/trailing underscores', () => {
      expect(service.normalizeFieldAlias('__foo__')).toBe('foo');
    });

    it('handles empty string', () => {
      expect(service.normalizeFieldAlias('')).toBe('');
    });

    it('handles null/undefined', () => {
      expect(service.normalizeFieldAlias(null as any)).toBe('');
      expect(service.normalizeFieldAlias(undefined as any)).toBe('');
    });
  });

  describe('hasPresentValue', () => {
    it('returns false for null/undefined', () => {
      expect(service.hasPresentValue(null)).toBe(false);
      expect(service.hasPresentValue(undefined)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(service.hasPresentValue('')).toBe(false);
      expect(service.hasPresentValue('  ')).toBe(false);
    });

    it('returns true for non-empty strings', () => {
      expect(service.hasPresentValue('hello')).toBe(true);
    });

    it('returns true for non-empty arrays', () => {
      expect(service.hasPresentValue([1])).toBe(true);
    });

    it('returns false for empty arrays', () => {
      expect(service.hasPresentValue([])).toBe(false);
    });

    it('returns true for numbers', () => {
      expect(service.hasPresentValue(0)).toBe(true);
    });

    it('returns false for empty objects', () => {
      expect(service.hasPresentValue({})).toBe(false);
    });

    it('returns true for non-empty non-image objects', () => {
      expect(service.hasPresentValue({ label: 'x' })).toBe(true);
    });

    it('treats image upload meta without url/path/key as empty', () => {
      expect(service.hasPresentValue({ url: null })).toBe(false);
      expect(service.hasPresentValue({ url: '' })).toBe(false);
      expect(service.hasPresentValue({ url: '/uploads/a.png' })).toBe(true);
    });
  });

  describe('backfillMissingFieldIds', () => {
    it('returns fields unchanged when all have ids', () => {
      const fields = [{ id: 'fld_1', fieldKey: 'name' }];
      const result = service.backfillMissingFieldIds(fields, 'users');
      expect(result.changed).toBe(false);
      expect(result.fields[0].id).toBe('fld_1');
    });

    it('assigns seed id for known field key', () => {
      const fields = [{ fieldKey: 'name', name: 'name' }];
      const result = service.backfillMissingFieldIds(fields, 'users');
      expect(result.changed).toBe(true);
      expect(result.fields[0].id).toBeDefined();
      expect(result.fields[0].id).toMatch(/^fld_/);
    });

    it('generates a new id for custom fields', () => {
      const fields = [{ fieldKey: 'custom_field', name: 'custom_field' }];
      const result = service.backfillMissingFieldIds(fields, 'unknown_module');
      expect(result.changed).toBe(true);
      expect(result.fields[0].id).toMatch(/^fld_/);
    });

    it('returns empty array for empty input', () => {
      const result = service.backfillMissingFieldIds([], 'users');
      expect(result.changed).toBe(false);
      expect(result.fields).toEqual([]);
    });
  });

  describe('splitPayload', () => {
    it('splits into static and dynamic based on system field keys', () => {
      const payload = { name: 'John', age: 30, custom: 'value' };
      const systemFieldKeys = new Set(['name']);

      const result = service.splitPayload(payload, systemFieldKeys);

      expect(result.staticPayload).toEqual({ name: 'John' });
      expect(result.dynamicPayload).toEqual({ age: 30, custom: 'value' });
    });

    it('ignores keys in ignoredKeys set', () => {
      const payload = { name: 'John', ignored: 'skip' };
      const systemFieldKeys = new Set(['name']);
      const ignoredKeys = new Set(['ignored']);

      const result = service.splitPayload(payload, systemFieldKeys, ignoredKeys);

      expect(result.staticPayload).toEqual({ name: 'John' });
      expect(result.dynamicPayload).toEqual({});
    });

    it('returns empty objects for empty payload', () => {
      const result = service.splitPayload({}, new Set());
      expect(result.staticPayload).toEqual({});
      expect(result.dynamicPayload).toEqual({});
    });
  });

  describe('resolveFieldIdForDataKey', () => {
    it('returns the key itself if it is a valid field id', () => {
      const context = {
        fieldIdSet: new Set(['fld_123']),
        identityKeyOwner: new Map(),
        fieldIdByAnyKey: new Map(),
      } as any;

      expect(service.resolveFieldIdForDataKey(context, 'fld_123')).toBe('fld_123');
    });

    it('returns field id from identityKeyOwner', () => {
      const context = {
        fieldIdSet: new Set(['fld_123']),
        identityKeyOwner: new Map([['name', 'fld_123']]),
        fieldIdByAnyKey: new Map(),
      } as any;

      expect(service.resolveFieldIdForDataKey(context, 'name')).toBe('fld_123');
    });

    it('returns field id from fieldIdByAnyKey fallback', () => {
      const context = {
        fieldIdSet: new Set(),
        identityKeyOwner: new Map(),
        fieldIdByAnyKey: new Map([['name', 'fld_456']]),
      } as any;

      expect(service.resolveFieldIdForDataKey(context, 'name')).toBe('fld_456');
    });

    it('returns null for empty key', () => {
      const context = { fieldIdSet: new Set(), identityKeyOwner: new Map(), fieldIdByAnyKey: new Map() } as any;
      expect(service.resolveFieldIdForDataKey(context, '')).toBeNull();
    });

    it('returns null when key not found', () => {
      const context = { fieldIdSet: new Set(), identityKeyOwner: new Map(), fieldIdByAnyKey: new Map() } as any;
      expect(service.resolveFieldIdForDataKey(context, 'nonexistent')).toBeNull();
    });
  });

  describe('resolveCanonicalKey', () => {
    it('resolves a key to its canonical form', () => {
      const context = {
        aliasToCanonicalMap: new Map([['name', 'item_name']]),
        fieldIdByAnyKey: new Map(),
        fieldIdSet: new Set(),
        identityKeyOwner: new Map(),
        schemaFields: [],
      } as any;

      expect(service.resolveCanonicalKey(context, 'name')).toBe('item_name');
    });

    it('returns the key itself when no mapping exists', () => {
      const context = {
        aliasToCanonicalMap: new Map(),
        fieldIdByAnyKey: new Map(),
        fieldIdSet: new Set(),
        identityKeyOwner: new Map(),
        schemaFields: [],
      } as any;

      expect(service.resolveCanonicalKey(context, 'unknown')).toBe('unknown');
    });
  });

  describe('resolvePayloadAliases', () => {
    it('normalizes payload keys to canonical keys', () => {
      const aliasMap = new Map([['name', 'item_name'], ['Name', 'item_name']]);
      const payload = { Name: 'Test' };

      const result = service.resolvePayloadAliases(payload, aliasMap);
      expect(result).toEqual({ item_name: 'Test' });
    });

    it('keeps existing canonical key value when present value exists', () => {
      const aliasMap = new Map([['name', 'item_name']]);
      const payload = { item_name: 'Original', name: 'Alias' };

      const result = service.resolvePayloadAliases(payload, aliasMap);
      expect(result.item_name).toBe('Original');
    });

    it('prefers present value over empty value', () => {
      const aliasMap = new Map([['name', 'item_name']]);
      const payload = { item_name: '', name: 'Has Value' };

      const result = service.resolvePayloadAliases(payload, aliasMap);
      expect(result.item_name).toBe('Has Value');
    });
  });

  describe('normalizeDynamicDataToFieldIds', () => {
    it('maps alias keys to field ids', () => {
      const context = {
        fieldIdSet: new Set(['fld_1']),
        identityKeyOwner: new Map([['name', 'fld_1']]),
        fieldIdByAnyKey: new Map([['name', 'fld_1']]),
      } as any;

      const result = service.normalizeDynamicDataToFieldIds({ name: 'John' }, context);
      expect(result.fld_1).toBe('John');
    });

    it('preserves keys that cannot be resolved', () => {
      const context = {
        fieldIdSet: new Set(),
        identityKeyOwner: new Map(),
        fieldIdByAnyKey: new Map(),
      } as any;

      const result = service.normalizeDynamicDataToFieldIds({ unknown: 'value' }, context);
      expect(result.unknown).toBe('value');
    });
  });

  describe('migrateDynamicDataKeysOnSchemaChange', () => {
    it('does nothing when moduleId is null', async () => {
      const req = { tenantConnection: { getRepository: jest.fn() } };
      await service.migrateDynamicDataKeysOnSchemaChange(req, null, [], []);
      expect(req.tenantConnection.getRepository).not.toHaveBeenCalled();
    });

    it('does nothing when renames is empty', async () => {
      const req = {
        tenantConnection: {
          getRepository: jest.fn().mockReturnValue({ find: jest.fn().mockResolvedValue([]) }),
        },
      };
      await service.migrateDynamicDataKeysOnSchemaChange(req, 1, [], []);
      // find not called because renames is empty
    });

    it('migrates legacy keys to field ids', async () => {
      const dynamicRepo = {
        find: jest.fn().mockResolvedValue([{ entityId: 1, data: { old_key: 'value' } }]),
        save: jest.fn().mockResolvedValue(undefined),
      };
      const req = {
        tenantConnection: {
          getRepository: jest.fn().mockReturnValue(dynamicRepo),
        },
      };

      const oldFields = [{ id: 'fld_1', fieldKey: 'old_key' }];
      const newFields = [{ id: 'fld_1', fieldKey: 'new_key' }];

      await service.migrateDynamicDataKeysOnSchemaChange(req, 1, oldFields, newFields);

      expect(dynamicRepo.save).toHaveBeenCalled();
      const savedData = dynamicRepo.save.mock.calls[0][0];
      expect(savedData.data.fld_1).toBe('value');
      expect(savedData.data.old_key).toBeUndefined();
    });
  });

  describe('buildResponse', () => {
    it('returns merged dynamic + system + meta when no fieldIdByCanonicalKey', () => {
      const context = {
        fieldIdByCanonicalKey: new Map(),
        systemFieldKeys: new Set(),
        aliasToCanonicalMap: new Map(),
        schemaFields: [],
        fieldIdSet: new Set(),
        identityKeyOwner: new Map(),
      } as any;

      const result = service.buildResponse(
        context,
        { name: 'John' },
        { custom: 'value' },
        { id: 1 },
      );

      expect(result).toEqual({ custom: 'value', name: 'John', id: 1 });
    });

    it('builds id-keyed response when fieldIdByCanonicalKey is populated', () => {
      const context = {
        fieldIdByCanonicalKey: new Map([['name', 'fld_1']]),
        systemFieldKeys: new Set(['name']),
        aliasToCanonicalMap: new Map(),
        schemaFields: [{ id: 'fld_1', fieldKey: 'name', canonicalKey: 'name', name: 'name', isSystemField: true, dataKeys: [] }],
        fieldIdSet: new Set(['fld_1']),
        identityKeyOwner: new Map(),
      } as any;

      const result = service.buildResponse(context, { name: 'John' }, {}, { id: 1 });

      expect(result.fld_1).toBe('John');
      expect(result.id).toBe(1);
    });
  });

  describe('loadDynamicRows', () => {
    it('returns empty map when moduleId is null', async () => {
      const req = { tenantConnection: { getRepository: jest.fn() } };
      const result = await service.loadDynamicRows(req, null, [1, 2]);
      expect(result.size).toBe(0);
    });

    it('returns empty map when entityIds is empty', async () => {
      const req = { tenantConnection: { getRepository: jest.fn() } };
      const result = await service.loadDynamicRows(req, 1, []);
      expect(result.size).toBe(0);
    });

    it('returns data keyed by entityId', async () => {
      const dynamicRepo = {
        find: jest.fn().mockResolvedValue([
          { entityId: 1, data: { color: 'red' } },
          { entityId: 2, data: { color: 'blue' } },
        ]),
      };
      const req = { tenantConnection: { getRepository: jest.fn().mockReturnValue(dynamicRepo) } };

      const result = await service.loadDynamicRows(req, 1, [1, 2]);

      expect(result.get(1)).toEqual({ color: 'red' });
      expect(result.get(2)).toEqual({ color: 'blue' });
    });
  });

  describe('loadDynamicRow', () => {
    it('returns empty object when moduleId is null', async () => {
      const req = { tenantConnection: { getRepository: jest.fn() } };
      const result = await service.loadDynamicRow(req, null, 1);
      expect(result).toEqual({});
    });

    it('returns dynamic data for an entity', async () => {
      const dynamicRepo = {
        findOne: jest.fn().mockResolvedValue({ entityId: 1, data: { color: 'green' } }),
      };
      const req = { tenantConnection: { getRepository: jest.fn().mockReturnValue(dynamicRepo) } };

      const result = await service.loadDynamicRow(req, 1, 1);
      expect(result).toEqual({ color: 'green' });
    });

    it('returns empty object when row not found', async () => {
      const dynamicRepo = { findOne: jest.fn().mockResolvedValue(null) };
      const req = { tenantConnection: { getRepository: jest.fn().mockReturnValue(dynamicRepo) } };

      const result = await service.loadDynamicRow(req, 1, 999);
      expect(result).toEqual({});
    });
  });

  describe('upsertDynamicRow', () => {
    it('does nothing when moduleId is null', async () => {
      const req = { tenantConnection: { getRepository: jest.fn() } };
      await service.upsertDynamicRow(req, null, 1, 1, {}, 1);
      expect(req.tenantConnection.getRepository).not.toHaveBeenCalled();
    });

    it('creates a new row when none exists', async () => {
      const dynamicRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation((e: any) => e),
        save: jest.fn().mockResolvedValue(undefined),
      };
      const req = { tenantConnection: { getRepository: jest.fn().mockReturnValue(dynamicRepo) } };

      await service.upsertDynamicRow(req, 1, 1, 1, { color: 'red' }, 1);

      expect(dynamicRepo.create).toHaveBeenCalled();
      expect(dynamicRepo.save).toHaveBeenCalled();
    });

    it('updates an existing row', async () => {
      const existing: any = { id: 1, moduleId: 1, entityId: 1, data: { old: 'data' } };
      const dynamicRepo = {
        findOne: jest.fn().mockResolvedValue(existing),
        save: jest.fn().mockResolvedValue(undefined),
      };
      const req = { tenantConnection: { getRepository: jest.fn().mockReturnValue(dynamicRepo) } };

      await service.upsertDynamicRow(req, 1, 1, 2, { color: 'blue' }, 1);

      expect(existing.data).toEqual({ color: 'blue' });
      expect(existing.formVersionId).toBe(2);
      expect(dynamicRepo.save).toHaveBeenCalled();
    });
  });

  describe('deleteDynamicRow', () => {
    it('does nothing when moduleId is null', async () => {
      const req = { tenantConnection: { getRepository: jest.fn() } };
      await service.deleteDynamicRow(req, null, 1);
      expect(req.tenantConnection.getRepository).not.toHaveBeenCalled();
    });

    it('deletes a row', async () => {
      const dynamicRepo = { delete: jest.fn().mockResolvedValue(undefined) };
      const req = { tenantConnection: { getRepository: jest.fn().mockReturnValue(dynamicRepo) } };

      await service.deleteDynamicRow(req, 1, 1);

      expect(dynamicRepo.delete).toHaveBeenCalledWith({ moduleId: 1, entityId: 1 });
    });
  });

  describe('getSchemaContext', () => {
    it('returns empty context when module not found', async () => {
      const moduleRepo = { findOne: jest.fn().mockResolvedValue(null) };
      const req = { tenantConnection: { getRepository: jest.fn().mockReturnValue(moduleRepo) } };

      const result = await service.getSchemaContext(req, 'nonexistent');

      expect(result.moduleId).toBeNull();
      expect(result.formId).toBeNull();
    });

    it('returns empty context when form not found', async () => {
      const moduleRepo = { findOne: jest.fn().mockResolvedValue({ id: 1, slug: 'users' }) };
      const formRepo = { findOne: jest.fn().mockResolvedValue(null), save: jest.fn() };
      const req = {
        tenantConnection: {
          getRepository: jest.fn().mockImplementation((entity: any) => {
            if (entity === DynamicModule) return moduleRepo;
            if (entity === Form) return formRepo;
            return {};
          }),
        },
      };

      const result = await service.getSchemaContext(req, 'users');

      expect(result.moduleId).toBe(1);
      expect(result.formId).toBeNull();
    });
  });
});
