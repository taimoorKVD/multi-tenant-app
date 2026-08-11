import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Not } from 'typeorm';
import { User } from '../users/entities';
import { Item } from '../items/entities';
import { Vendor } from '../vendors/entities';
import { Form, FormAuditLog } from '../form-builder/entities';
import { DataCollectionTemplate } from '../data-collection/entities';
import { ReportingGroup } from '../reporting-groups/entities';
@Injectable()
export class DashboardService {
  private formatRelativeTime(date: Date): string {
    const now = Date.now();
    const then = new Date(date).getTime();
    const seconds = Math.max(0, Math.floor((now - then) / 1000));

    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
    const months = Math.floor(days / 30);
    return `${months} month${months === 1 ? '' : 's'} ago`;
  }

  private humanizeAction(action: string, entityType: string): { title: string; description: string } {
    const entity = String(entityType || 'record').replace(/_/g, ' ');
    const act = String(action || 'updated').toLowerCase();

    const titles: Record<string, string> = {
      create: `${entity} created`,
      created: `${entity} created`,
      update: `${entity} updated`,
      updated: `${entity} updated`,
      delete: `${entity} deleted`,
      deleted: `${entity} deleted`,
      publish: `${entity} published`,
      published: `${entity} published`,
      assign: 'Form assigned',
      assigned: 'Form assigned',
    };

    return {
      title: titles[act] || `${entity} ${act}`,
      description: `${entity} was ${act}`,
    };
  }

  async getDashboard(req: any) {
    try {
      const connection = req.tenantConnection;
      if (!connection) {
        throw new InternalServerErrorException('Missing tenant connection');
      }

      const userRepo = connection.getRepository(User);
      const itemRepo = connection.getRepository(Item);
      const vendorRepo = connection.getRepository(Vendor);
      const formRepo = connection.getRepository(Form);
      const dcTemplateRepo = connection.getRepository(DataCollectionTemplate);
      const reportingGroupRepo = connection.getRepository(ReportingGroup);

      const [totalUsers, totalItems, totalVendors, totalBuilderForms, totalDcTemplates] =
        await Promise.all([
          userRepo.count({ where: { isSystem: Not(true) } as any }),
          itemRepo.count(),
          vendorRepo.count(),
          formRepo.count(),
          dcTemplateRepo.count(),
        ]);

      const totalForms = totalBuilderForms + totalDcTemplates;

      let recentActivity: Array<{
        id: number;
        title: string;
        description: string;
        createdAt: Date;
        relativeTime: string;
        entityType: string;
        action: string;
      }> = [];

      try {
        const auditRepo = connection.getRepository(FormAuditLog);
        const logs = await auditRepo.find({
          order: { createdAt: 'DESC' },
          take: 10,
        });
        recentActivity = logs.map((log) => {
          const { title, description } = this.humanizeAction(log.action, log.entityType);
          return {
            id: log.id,
            title,
            description,
            createdAt: log.createdAt,
            relativeTime: this.formatRelativeTime(log.createdAt),
            entityType: log.entityType,
            action: log.action,
          };
        });
      } catch {
        recentActivity = [];
      }

      const reportingGroups = await reportingGroupRepo.find({
        where: { isActive: true } as any,
        relations: ['reportingCategories'],
        order: { id: 'ASC' },
      });

      const reportingGroupsOverview = reportingGroups.map((group) => {
        const categories = (group.reportingCategories || []).map((c) => ({
          id: c.id,
          name: c.name,
        }));
        return {
          id: group.id,
          name: group.name,
          description: group.description,
          categories,
          categoryNames: categories.map((c) => c.name),
          // Item↔category relation is not live yet — keep 0 until stock/reporting links exist.
          itemCount: 0,
        };
      });

      return {
        success: true,
        tenant: connection.options.database,
        tenant_slug: req.tenantId || null,
        data: {
          overview: {
            totalUsers,
            totalItems,
            totalVendors,
            totalForms,
            labels: {
              totalUsers: 'Active kitchen & floor staff',
              totalItems: 'Inventory catalog',
              totalVendors: 'Suppliers & services',
              totalForms: 'Ops & compliance forms',
            },
            breakdown: {
              formBuilderForms: totalBuilderForms,
              dataCollectionTemplates: totalDcTemplates,
            },
          },
          inventory: {
            totalItems,
            // Stock / PAR / order metrics are not modeled on Item yet.
            lowStock: 0,
            belowPar: 0,
            orderRequired: 0,
            available: false,
          },
          recentActivity,
          reportingGroups: reportingGroupsOverview,
        },
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) throw error;
      console.error('Tenant dashboard failed:', error);
      throw new InternalServerErrorException('Failed to load tenant dashboard');
    }
  }
}
