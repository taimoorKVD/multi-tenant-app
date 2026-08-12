import { Controller, Get } from '@nestjs/common';
import { MasterAccess } from '../../common/decorators';
import { DashboardService } from './dashboard.service';
import { MasterDashboardSwagger } from './swagger';

@MasterDashboardSwagger.Tags()
@MasterDashboardSwagger.Auth()
@Controller('master/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @MasterAccess()
  @MasterDashboardSwagger.Get()
  getDashboard() {
    return this.dashboardService.getDashboard();
  }
}
