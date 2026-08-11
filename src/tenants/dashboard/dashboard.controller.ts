import { Controller, Get, Req } from '@nestjs/common';
import { TenantAccess } from '../../common/decorators/tenant-access.decorator';
import { DashboardService } from './dashboard.service';
import { TenantDashboardSwagger } from './swagger';

@TenantDashboardSwagger.Tags()
@TenantDashboardSwagger.Auth()
@Controller(['dashboard', 'tenant/:tenantId/dashboard'])
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @TenantAccess()
  @TenantDashboardSwagger.Get()
  getDashboard(@Req() req: any) {
    return this.dashboardService.getDashboard(req);
  }
}
