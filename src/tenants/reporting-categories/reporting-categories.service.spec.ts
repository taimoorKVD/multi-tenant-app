import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { Item } from '../items/entities';
import { ReportingGroup } from '../reporting-groups/entities';
import { ReportingCategory } from './entities';
import { ReportingCategoriesService } from './reporting-categories.service';

describe('ReportingCategoriesService', () => {
  let service: ReportingCategoriesService;

  const baseRepoForCtor = { target: ReportingCategory };

  const dataSourceMock = {
    getRepository: jest.fn().mockReturnValue(baseRepoForCtor),
  } as unknown as DataSource;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReportingCategoriesService(dataSourceMock);
  });

  function buildReq(repos: Map<any, any>) {
    return {
      tenantId: 'kingdomvision',
      tenantConnection: {
        options: { database: 'tenant_kingdomvision' },
        getRepository: jest.fn().mockImplementation((entity: any) => {
          const repo = repos.get(entity);
          if (!repo) {
            throw new Error(`Unexpected repository request: ${entity?.name || String(entity)}`);
          }
          return repo;
        }),
      },
    } as any;
  }

  describe('create', () => {
    it('creates a category under an existing reporting group', async () => {
      const groupRepo = {
        findOneBy: jest.fn().mockResolvedValue({ id: 1, name: 'Product Specific' }),
      };
      const categoryRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation((payload) => ({ ...payload })),
        save: jest.fn().mockImplementation(async (payload) => ({ id: 10, ...payload })),
      };

      const req = buildReq(
        new Map<any, any>([
          [ReportingCategory, categoryRepo],
          [ReportingGroup, groupRepo],
        ]),
      );

      const result = await service.create(req, {
        reportingGroupId: 1,
        name: 'Produce',
        description: 'Fresh produce',
      });

      expect(groupRepo.findOneBy).toHaveBeenCalledWith({ id: 1 });
      expect(categoryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          reportingGroupId: 1,
          name: 'Produce',
          description: 'Fresh produce',
          isActive: true,
        }),
      );
      expect(result.success).toBe(true);
      expect(result.data.id).toBe(10);
      expect(result.data.name).toBe('Produce');
    });

    it('rejects create when reporting group does not exist', async () => {
      const groupRepo = {
        findOneBy: jest.fn().mockResolvedValue(null),
      };
      const categoryRepo = {
        findOne: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
      };

      const req = buildReq(
        new Map<any, any>([
          [ReportingCategory, categoryRepo],
          [ReportingGroup, groupRepo],
        ]),
      );

      await expect(
        service.create(req, { reportingGroupId: 99, name: 'Produce' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(categoryRepo.save).not.toHaveBeenCalled();
    });

    it('rejects create when category name already exists', async () => {
      const groupRepo = {
        findOneBy: jest.fn().mockResolvedValue({ id: 1, name: 'Product Specific' }),
      };
      const categoryRepo = {
        findOne: jest.fn().mockResolvedValue({ id: 2, name: 'Produce' }),
        create: jest.fn(),
        save: jest.fn(),
      };

      const req = buildReq(
        new Map<any, any>([
          [ReportingCategory, categoryRepo],
          [ReportingGroup, groupRepo],
        ]),
      );

      await expect(
        service.create(req, { reportingGroupId: 1, name: 'Produce' }),
      ).rejects.toThrow('A reporting category with this name already exists.');
      expect(categoryRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('assignItems', () => {
    it('assigns existing items to a category and skips already-linked ones', async () => {
      const existingItem = { id: 3, itemName: 'Item 3' };
      const newItem = { id: 4, itemName: 'Item 4' };
      const category = {
        id: 10,
        name: 'Produce',
        items: [existingItem],
      };

      const categoryRepo = {
        findOne: jest.fn().mockResolvedValue(category),
        save: jest.fn().mockImplementation(async (entity) => entity),
      };
      const itemRepo = {
        findBy: jest.fn().mockResolvedValue([existingItem, newItem]),
      };

      const req = buildReq(
        new Map<any, any>([
          [ReportingCategory, categoryRepo],
          [Item, itemRepo],
        ]),
      );

      const result = await service.assignItems(req, 10, { itemIds: [3, 4] });

      expect(categoryRepo.findOne).toHaveBeenCalledWith({
        where: { id: 10 },
        relations: ['items'],
      });
      expect(itemRepo.findBy).toHaveBeenCalledWith({ id: In([3, 4]) });
      expect(categoryRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [existingItem, newItem],
        }),
      );
      expect(result.success).toBe(true);
      expect(result.data.assignedCount).toBe(1);
      expect(result.data.items).toEqual([
        { id: 3, itemName: 'Item 3' },
        { id: 4, itemName: 'Item 4' },
      ]);
    });

    it('throws NotFoundException when category does not exist', async () => {
      const categoryRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        save: jest.fn(),
      };
      const itemRepo = {
        findBy: jest.fn(),
      };

      const req = buildReq(
        new Map<any, any>([
          [ReportingCategory, categoryRepo],
          [Item, itemRepo],
        ]),
      );

      await expect(service.assignItems(req, 999, { itemIds: [1] })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(itemRepo.findBy).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when one or more items are missing', async () => {
      const categoryRepo = {
        findOne: jest.fn().mockResolvedValue({ id: 10, name: 'Produce', items: [] }),
        save: jest.fn(),
      };
      const itemRepo = {
        findBy: jest.fn().mockResolvedValue([{ id: 3, itemName: 'Item 3' }]),
      };

      const req = buildReq(
        new Map<any, any>([
          [ReportingCategory, categoryRepo],
          [Item, itemRepo],
        ]),
      );

      await expect(service.assignItems(req, 10, { itemIds: [3, 99] })).rejects.toThrow(
        'Item(s) not found: 99',
      );
      expect(categoryRepo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when itemIds are empty/invalid', async () => {
      const categoryRepo = {
        findOne: jest.fn().mockResolvedValue({ id: 10, name: 'Produce', items: [] }),
        save: jest.fn(),
      };
      const itemRepo = {
        findBy: jest.fn(),
      };

      const req = buildReq(
        new Map<any, any>([
          [ReportingCategory, categoryRepo],
          [Item, itemRepo],
        ]),
      );

      await expect(service.assignItems(req, 10, { itemIds: [NaN as any] })).rejects.toThrow(
        'At least one valid item ID is required',
      );
      expect(itemRepo.findBy).not.toHaveBeenCalled();
    });
  });

  describe('removeItems', () => {
    it('unlinks items from a category without deleting them', async () => {
      const item3 = { id: 3, itemName: 'Item 3' };
      const item4 = { id: 4, itemName: 'Item 4' };
      const category = {
        id: 10,
        name: 'Produce',
        items: [item3, item4],
      };

      const categoryRepo = {
        findOne: jest.fn().mockResolvedValue(category),
        save: jest.fn().mockImplementation(async (entity) => entity),
      };

      const req = buildReq(new Map<any, any>([[ReportingCategory, categoryRepo]]));

      const result = await service.removeItems(req, 10, { itemIds: [3] });

      expect(categoryRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [item4],
        }),
      );
      expect(result.success).toBe(true);
      expect(result.data.removedCount).toBe(1);
      expect(result.data.items).toEqual([{ id: 4, itemName: 'Item 4' }]);
    });

    it('throws NotFoundException when category does not exist', async () => {
      const categoryRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        save: jest.fn(),
      };

      const req = buildReq(new Map<any, any>([[ReportingCategory, categoryRepo]]));

      await expect(service.removeItems(req, 999, { itemIds: [1] })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws BadRequestException when none of the items are assigned', async () => {
      const categoryRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: 10,
          name: 'Produce',
          items: [{ id: 4, itemName: 'Item 4' }],
        }),
        save: jest.fn(),
      };

      const req = buildReq(new Map<any, any>([[ReportingCategory, categoryRepo]]));

      await expect(service.removeItems(req, 10, { itemIds: [3] })).rejects.toThrow(
        'None of the provided items are assigned to this category',
      );
      expect(categoryRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('loads reporting group and assigned items', async () => {
      const categoryRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: 10,
          name: 'Produce',
          reportingGroup: { id: 1, name: 'Product Specific' },
          items: [
            { id: 3, itemName: 'Item 3' },
            { id: 4, itemName: 'Item 4' },
          ],
        }),
      };

      const req = buildReq(new Map<any, any>([[ReportingCategory, categoryRepo]]));

      const result = await service.findOne(req, 10);

      expect(categoryRepo.findOne).toHaveBeenCalledWith({
        where: { id: 10 },
        relations: ['reportingGroup', 'items'],
      });
      expect(result.success).toBe(true);
      expect(result.data.items).toHaveLength(2);
      expect(result.data.reportingGroup.name).toBe('Product Specific');
    });
  });

  describe('paginate', () => {
    it('defaults to reportingGroup and items relations', async () => {
      const categoryRepo = {
        findAndCount: jest.fn().mockResolvedValue([
          [
            {
              id: 10,
              name: 'Produce',
              reportingGroup: { id: 1, name: 'Product Specific' },
              items: [{ id: 3, itemName: 'Item 3' }],
            },
          ],
          1,
        ]),
      };

      const req = buildReq(new Map<any, any>([[ReportingCategory, categoryRepo]]));

      const result = await service.paginate(req, 1, [], 15);

      expect(categoryRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: ['reportingGroup', 'items'],
          take: 15,
          skip: 0,
        }),
      );
      expect(result.success).toBe(true);
      expect(result.data[0].items).toHaveLength(1);
    });
  });
});
