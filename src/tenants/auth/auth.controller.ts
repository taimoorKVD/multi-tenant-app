import {
  Body,
  Controller,
  Post,
  Req,
  UnauthorizedException,
  Param,
} from '@nestjs/common';
import { TenantAuthService } from './auth.service';
import { LoginDto } from './dto';
import { ApiTags, ApiParam } from '@nestjs/swagger';
import { TenantAuthLoginDocs } from './swagger/auth.swagger';

@ApiTags('Authentication')
@Controller()
export class TenantAuthController {
  constructor(private readonly authService: TenantAuthService) {}

  // ✅ Default login (auto tenant)
  @Post('login')
  @Post('tenant/login')
  @TenantAuthLoginDocs()
  async loginDefault(@Req() req, @Body() dto: LoginDto) {
    const result = await this.authService.login(req, dto);
    if (!result) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return result;
  }

  // ✅ Tenant-specific login (FIXED SWAGGER)
  @Post('tenant/:tenantId/login')
  @Post(':tenantId/login')
  @ApiParam({
    name: 'tenantId',
    required: true,
    example: 'kingdomvision',
    description: 'Tenant slug',
  })
  @TenantAuthLoginDocs()
  async loginWithTenant(
    @Param('tenantId') tenantId: string,
    @Req() req,
    @Body() dto: LoginDto,
  ) {
    // optional: attach tenantId to req if needed
    req.tenantId = tenantId;

    const result = await this.authService.login(req, dto);
    if (!result) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return result;
  }
}
