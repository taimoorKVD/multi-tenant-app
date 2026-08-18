import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ReportingGroup } from './entities';
import { ReportingGroupsService } from './reporting-groups.service';

describe('ReportingGroupsService', () => {
  let service: ReportingGroupsService;

  const baseRepoForCtor = { target: ReportingGroup };

  const dataSourceMock = {
    getRepository: jest.fn().mockReturnValue(baseRepoForCtor),
  } as unknown as DataSource;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReportingGroupsService(dataSourceMock);
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
    it('creates a reporting group', async () => {
      const groupRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation((payload) => ({ ...payload })),
        save: jest.fn().mockImplementation(async (payload) => ({ id: 1, ...payload })),
      };

      const req = buildReq(new Map<any, any>([[ReportingGroup, groupRepo]]));

      const result = await service.create(req, {
        name: 'Product Specific',
        description: 'Products mapped by inventory class',
      });

      expect(groupRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Product Specific',
          description: 'Products mapped by inventory class',
          isActive: true,
        }),
      );
      expect(result.success).toBe(true);
      expect(result.data.id).toBe(1);
    });

    it('rejects duplicate group names', async () => {
      const groupRepo = {
        findOne: jest.fn().mockResolvedValue({ id: 1, name: 'Product Specific' }),
        create: jest.fn(),
        save: jest.fn(),
      };

      const req = buildReq(new Map<any, any>([[ReportingGroup, groupRepo]]));

      await expect(service.create(req, { name: 'Product Specific' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(groupRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('paginate', () => {
    it('defaults to nested categories and items relations', async () => {
      const tree = [
        {
          id: 1,
          name: 'Product Specific',
          reportingCategories: [
            {
              id: 10,
              name: 'Produce',
              items: [
                { id: 3, itemName: 'Item 3' },
                { id: 4, itemName: 'Item 4' },
              ],
            },
          ],
        },
      ];

      const groupRepo = {
        findAndCount: jest.fn().mockResolvedValue([tree, 1]),
      };

      const req = buildReq(new Map<any, any>([[ReportingGroup, groupRepo]]));

      const result = await service.paginate(req, 1, [], 15);

      expect(groupRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: ['reportingCategories', 'reportingCategories.items'],
          take: 15,
          skip: 0,
        }),
      );
      expect(result.success).toBe(true);
      expect(result.data[0].reportingCategories[0].items).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('loads group → categories → items tree', async () => {
      const groupRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: 1,
          name: 'General Items',
          reportingCategories: [
            {
              id: 11,
              name: 'Cleaning Supply',
              items: [{ id: 5, itemName: 'Item 5' }],
            },
          ],
        }),
      };

      const req = buildReq(new Map<any, any>([[ReportingGroup, groupRepo]]));

      const result = await service.findOne(req, 1);

      expect(groupRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['reportingCategories', 'reportingCategories.items'],
      });
      expect(result.success).toBe(true);
      expect(result.data.reportingCategories[0].items[0].itemName).toBe('Item 5');
    });

    it('throws NotFoundException when group is missing', async () => {
      const groupRepo = {
        findOne: jest.fn().mockResolvedValue(null),
      };

      const req = buildReq(new Map<any, any>([[ReportingGroup, groupRepo]]));

      await expect(service.findOne(req, 999)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('search', () => {
    it('searches with nested category and item joins', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([
          [
            {
              id: 1,
              name: 'Product Specific',
              reportingCategories: [{ id: 10, name: 'Produce', items: [] }],
            },
          ],
          1,
        ]),
      };

      const groupRepo = {
        createQueryBuilder: jest.fn().mockReturnValue(qb),
      };

      const req = buildReq(new Map<any, any>([[ReportingGroup, groupRepo]]));

      const result = await service.search(req, 15, { name: 'Product' });

      expect(groupRepo.createQueryBuilder).toHaveBeenCalledWith('group');
      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('group.reportingCategories', 'category');
      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('category.items', 'items');
      expect(qb.andWhere).toHaveBeenCalledWith('group.name ILIKE :name', { name: '%Product%' });
      expect(result.success).toBe(true);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('update', () => {
    it('updates group fields', async () => {
      const entity = {
        id: 1,
        name: 'Product Specific',
        description: 'Old',
        isActive: true,
        createdBy: null,
        updatedBy: null,
      };
      const groupRepo = {
        findOneBy: jest.fn().mockResolvedValue(entity),
        save: jest.fn().mockImplementation(async (payload) => payload),
      };

      const req = buildReq(new Map<any, any>([[ReportingGroup, groupRepo]]));

      const result = await service.update(req, 1, {
        name: 'General Items',
        description: 'Updated',
      });

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('General Items');
      expect(result.data.description).toBe('Updated');
    });

    it('throws NotFoundException when updating a missing group', async () => {
      const groupRepo = {
        findOneBy: jest.fn().mockResolvedValue(null),
        save: jest.fn(),
      };

      const req = buildReq(new Map<any, any>([[ReportingGroup, groupRepo]]));

      await expect(service.update(req, 999, { name: 'X' })).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
