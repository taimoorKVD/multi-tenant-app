import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThanOrEqual, Repository } from 'typeorm';
import { Tenant } from '../tenants/entities';
import { User } from '../users/entities';
import { ActivityLog } from '../activity-logs/entities';
import { EmailLog, GlobalMailSetting } from '../mail/entities';
import { EMAIL_LOG_STATUS } from '../../mail/constants/mail.constants';
import { getTenantDataSource } from '../../database/datasource';

type KpiChangeType = 'count' | 'percent';

export interface DashboardKpi {
  value: number;
  change: number;
  changeType: KpiChangeType;
  changeLabel: string;
  trend: number[];
  available: boolean;
  currency?: string;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(ActivityLog)
    private readonly activityLogRepo: Repository<ActivityLog>,
    @InjectRepository(EmailLog)
    private readonly emailLogRepo: Repository<EmailLog>,
    @InjectRepository(GlobalMailSetting)
    private readonly mailSettingRepo: Repository<GlobalMailSetting>,
  ) {}

  private startOfDay(date = new Date()): Date {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  private startOfMonth(date = new Date()): Date {
    const next = new Date(date.getFullYear(), date.getMonth(), 1);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  private addMonths(date: Date, months: number): Date {
    return new Date(date.getFullYear(), date.getMonth() + months, 1);
  }

  private formatMonthKey(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${date.getFullYear()}-${month}`;
  }

  private formatDayKey(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }

  private daysInMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  private formatCountChange(change: number): string {
    const sign = change > 0 ? '+' : '';
    return `${sign}${change} this month`;
  }

  private formatPercentChange(change: number): string {
    const sign = change > 0 ? '+' : '';
    return `${sign}${change.toFixed(1)}% this month`;
  }

  private kpi(params: {
    value: number;
    change: number;
    changeType?: KpiChangeType;
    trend: number[];
    available?: boolean;
    currency?: string;
  }): DashboardKpi {
    const changeType = params.changeType || 'count';
    return {
      value: params.value,
      change: params.change,
      changeType,
      changeLabel:
        changeType === 'percent'
          ? this.formatPercentChange(params.change)
          : this.formatCountChange(params.change),
      trend: params.trend,
      available: params.available !== false,
      ...(params.currency ? { currency: params.currency } : {}),
    };
  }

  private platformHost(): string {
    const explicit = process.env.PLATFORM_DOMAIN?.trim();
    if (explicit) return explicit.replace(/^\./, '');

    const frontendUrl = process.env.FRONTEND_URL?.trim() || process.env.APP_FRONTEND_URL?.trim();
    if (frontendUrl) {
      try {
        return new URL(frontendUrl).hostname.replace(/^www\./, '');
      } catch {
        return 'localhost';
      }
    }

    return 'localhost';
  }

  private tenantDomain(tenant: Tenant): string {
    const custom = tenant.customDomain?.trim();
    if (custom) return custom;
    return `${tenant.subdomain}.${this.platformHost()}`;
  }

  private fillSeries(
    keys: string[],
    rows: Array<{ key: string; count: number }>,
  ): Array<{ date: string; count: number }> {
    const map = new Map(rows.map((row) => [row.key, Number(row.count) || 0]));
    return keys.map((date) => ({ date, count: map.get(date) || 0 }));
  }

  private lastMonthKeys(count: number, from = new Date()): string[] {
    const start = this.addMonths(this.startOfMonth(from), -(count - 1));
    return Array.from({ length: count }, (_, index) =>
      this.formatMonthKey(this.addMonths(start, index)),
    );
  }

  private thisMonthDayKeys(from = new Date()): string[] {
    const start = this.startOfMonth(from);
    const days = this.daysInMonth(from);
    return Array.from({ length: days }, (_, index) => {
      const day = new Date(start);
      day.setDate(index + 1);
      return this.formatDayKey(day);
    });
  }

  private async groupedCounts(
    repo: Repository<Tenant> | Repository<User>,
    alias: string,
    trunc: 'month' | 'day',
    start: Date,
  ): Promise<Array<{ key: string; count: number }>> {
    const format = trunc === 'month' ? 'YYYY-MM' : 'YYYY-MM-DD';
    const rows = await repo
      .createQueryBuilder(alias)
      .select(`to_char(date_trunc('${trunc}', ${alias}.created_at), '${format}')`, 'key')
      .addSelect('COUNT(*)', 'count')
      .where(`${alias}.created_at >= :start`, { start })
      .groupBy('key')
      .orderBy('key', 'ASC')
      .getRawMany<{ key: string; count: string }>();

    return rows.map((row) => ({ key: row.key, count: Number(row.count) || 0 }));
  }

  private async countTenantUsers(dbName: string): Promise<number | null> {
    try {
      const connection = await getTenantDataSource(dbName);
      const rows = await connection.query(
        `SELECT COUNT(*)::int AS count FROM users WHERE COALESCE(is_system, false) = false`,
      );
      return Number(rows?.[0]?.count ?? 0);
    } catch {
      return null;
    }
  }

  private async buildEmailHealth(dayStart: Date) {
    const empty = {
      status: 'unknown' as const,
      label: 'Email status unavailable',
      available: false,
      sentToday: 0,
      failedToday: 0,
      pending: 0,
    };

    try {
      const [smtp, sentToday, failedToday, pending] = await Promise.all([
        this.mailSettingRepo.findOne({ where: { isActive: true } }),
        this.emailLogRepo.count({
          where: { status: EMAIL_LOG_STATUS.SENT, createdAt: MoreThanOrEqual(dayStart) },
        }),
        this.emailLogRepo.count({
          where: { status: EMAIL_LOG_STATUS.FAILED, createdAt: MoreThanOrEqual(dayStart) },
        }),
        this.emailLogRepo.count({ where: { status: EMAIL_LOG_STATUS.PENDING } }),
      ]);

      if (!smtp) {
        return {
          status: 'degraded' as const,
          label: 'Email is not configured',
          available: true,
          sentToday,
          failedToday,
          pending,
        };
      }

      if (failedToday > 0) {
        return {
          status: 'degraded' as const,
          label: `${failedToday} email${failedToday === 1 ? '' : 's'} failed today`,
          available: true,
          sentToday,
          failedToday,
          pending,
        };
      }

      return {
        status: 'healthy' as const,
        label: pending > 0 ? `${pending} email${pending === 1 ? '' : 's'} queued` : 'All emails delivered',
        available: true,
        sentToday,
        failedToday,
        pending,
      };
    } catch {
      return empty;
    }
  }

  private async buildApiHealth(dayStart: Date) {
    try {
      const stats = await this.activityLogRepo
        .createQueryBuilder('log')
        .select('COALESCE(AVG(log.duration_ms), 0)', 'avgMs')
        .addSelect('COUNT(*)', 'total')
        .addSelect(
          `SUM(CASE WHEN log.status = 'failed' OR log.status_code >= 500 THEN 1 ELSE 0 END)`,
          'failed',
        )
        .where('log.created_at >= :dayStart', { dayStart })
        .getRawOne<{ avgMs: string; total: string; failed: string }>();

      const avgLatencyMs = Math.round(Number(stats?.avgMs) || 0);
      const failed = Number(stats?.failed) || 0;
      let status: 'healthy' | 'degraded' | 'down' = 'healthy';
      if (failed > 0 || avgLatencyMs >= 1000) status = 'degraded';
      if (avgLatencyMs >= 3000) status = 'down';

      return {
        status,
        label: `Response time: ${avgLatencyMs}ms`,
        avgLatencyMs,
        failedToday: failed,
        available: true,
      };
    } catch {
      return {
        status: 'unknown' as const,
        label: 'API status unavailable',
        avgLatencyMs: 0,
        failedToday: 0,
        available: false,
      };
    }
  }

  async getDashboard() {
    try {
      const now = new Date();
      const monthStart = this.startOfMonth(now);
      const dayStart = this.startOfDay(now);
      const trendStart = this.addMonths(monthStart, -11);
      const monthKeys = this.lastMonthKeys(12, now);
      const dayKeys = this.thisMonthDayKeys(now);
      const zeroTrend = monthKeys.map(() => 0);

      const [
        totalTenants,
        tenantsThisMonth,
        tenantsBeforeMonth,
        totalUsers,
        usersThisMonth,
        recentTenants,
        tenantMonthRows,
        tenantDayRows,
        userMonthRows,
      ] = await Promise.all([
        this.tenantRepo.count(),
        this.tenantRepo.count({ where: { createdAt: MoreThanOrEqual(monthStart) } }),
        this.tenantRepo.count({ where: { createdAt: LessThan(monthStart) } }),
        this.userRepo.count(),
        this.userRepo.count({ where: { createdAt: MoreThanOrEqual(monthStart) } }),
        this.tenantRepo.find({
          order: { createdAt: 'DESC' },
          take: 8,
        }),
        this.groupedCounts(this.tenantRepo, 'tenant', 'month', trendStart),
        this.groupedCounts(this.tenantRepo, 'tenant', 'day', monthStart),
        this.groupedCounts(this.userRepo, 'user', 'month', trendStart),
      ]);

      const tenantTrend = this.fillSeries(monthKeys, tenantMonthRows).map((row) => row.count);
      const userTrend = this.fillSeries(monthKeys, userMonthRows).map((row) => row.count);
      const newTenantsSeries = this.fillSeries(dayKeys, tenantDayRows);

      let runningActive = tenantsBeforeMonth;
      const activeTenantsSeries = newTenantsSeries.map((point) => {
        runningActive += point.count;
        return { date: point.date, count: runningActive };
      });

      const recentTenantsWithUsers = await Promise.all(
        recentTenants.map(async (tenant) => ({
          id: tenant.id,
          name: tenant.name,
          domain: this.tenantDomain(tenant),
          subdomain: tenant.subdomain,
          customDomain: tenant.customDomain ?? null,
          plan: null as string | null,
          status: 'Active',
          users: await this.countTenantUsers(tenant.dbName),
          joinedOn: tenant.createdAt,
        })),
      );

      const [emailHealth, apiHealth] = await Promise.all([
        this.buildEmailHealth(dayStart),
        this.buildApiHealth(dayStart),
      ]);

      let databaseHealth: {
        status: 'healthy' | 'down';
        label: string;
        available: boolean;
      } = {
        status: 'healthy',
        label: 'All systems operational',
        available: true,
      };
      try {
        await this.tenantRepo.query('SELECT 1');
      } catch {
        databaseHealth = {
          status: 'down',
          label: 'Database unreachable',
          available: true,
        };
      }

      return {
        success: true,
        user_type: 'master',
        data: {
          kpis: {
            totalTenants: this.kpi({
              value: totalTenants,
              change: tenantsThisMonth,
              trend: tenantTrend,
            }),
            activeTenants: this.kpi({
              value: totalTenants,
              change: tenantsThisMonth,
              trend: tenantTrend,
            }),
            totalUsers: this.kpi({
              value: totalUsers,
              change: usersThisMonth,
              trend: userTrend,
            }),
            mrr: this.kpi({
              value: 0,
              change: 0,
              changeType: 'percent',
              trend: zeroTrend,
              available: false,
              currency: 'EUR',
            }),
            activeSubscriptions: this.kpi({
              value: 0,
              change: 0,
              trend: zeroTrend,
              available: false,
            }),
            platformRevenue: this.kpi({
              value: 0,
              change: 0,
              changeType: 'percent',
              trend: zeroTrend,
              available: false,
              currency: 'EUR',
            }),
          },
          tenantsOverview: {
            period: 'this_month',
            series: {
              newTenants: newTenantsSeries,
              activeTenants: activeTenantsSeries,
            },
            summary: {
              newTenants: tenantsThisMonth,
              upgraded: 0,
              downgraded: 0,
              cancelled: 0,
            },
          },
          planDistribution: {
            available: false,
            total: totalTenants,
            segments: [
              {
                key: 'unassigned',
                name: 'Unassigned',
                count: totalTenants,
                percentage: totalTenants ? 100 : 0,
              },
            ],
          },
          recentTenants: recentTenantsWithUsers,
          systemHealth: {
            database: databaseHealth,
            storage: {
              status: 'unknown',
              label: 'Storage is not monitored',
              usedPercent: null,
              usedGb: null,
              totalGb: null,
              available: false,
            },
            email: emailHealth,
            api: apiHealth,
          },
        },
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) throw error;
      console.error('Super Admin dashboard failed:', error);
      throw new InternalServerErrorException('Failed to load Super Admin dashboard');
    }
  }
}
