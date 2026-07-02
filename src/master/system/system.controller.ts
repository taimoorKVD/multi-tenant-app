import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { TenantResetService } from 'src/tenant-reset/tenant-reset.service';

@Controller('master/system')
export class SystemController {
  constructor(
    private readonly tenantResetService: TenantResetService,
  ) {}
   @Post('reset-demo')
  @HttpCode(HttpStatus.OK)
  async resetDemo() {
    await this.tenantResetService.reset();
    return {
      success: true,
      message: 'Demo tenants reset successfully.',
    };
  }
}
