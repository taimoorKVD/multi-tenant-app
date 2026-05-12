import {
  Body,
  Controller,
  Post,
  Req,
  UnauthorizedException,
  Param,
  UseGuards,
} from '@nestjs/common';
import { TenantAuthService } from './auth.service';
import {
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  ResetPasswordDto,
  VerifyEmailDto,
  VerifyResetTokenDto,
} from './dto';
import { ApiTags, ApiParam } from '@nestjs/swagger';
import {
  TenantAuthEmailVerificationDocs,
  TenantAuthForgotPasswordDocs,
  TenantAuthLoginDocs,
  TenantAuthRefreshTokenDocs,
  TenantAuthResetPasswordDocs,
  TenantAuthVerifyResetTokenDocs,
} from './swagger/auth.swagger';
import { createRateLimitGuard } from '../../common/guards/rate-limit.guard';

const TenantSensitiveRateLimitGuard = createRateLimitGuard(5, 15 * 60 * 1000);

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

  @Post('forgot-password')
  @Post('tenant/forgot-password')
  @Post('tenant/:tenantId/forgot-password')
  @Post(':tenantId/forgot-password')
  @UseGuards(TenantSensitiveRateLimitGuard)
  @TenantAuthForgotPasswordDocs()
  async forgotPassword(@Req() req, @Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(req, dto, 'tenant');
  }

  @Post('verify-reset-token')
  @Post('tenant/verify-reset-token')
  @Post('tenant/:tenantId/verify-reset-token')
  @Post(':tenantId/verify-reset-token')
  @UseGuards(TenantSensitiveRateLimitGuard)
  @TenantAuthVerifyResetTokenDocs()
  async verifyResetToken(@Req() req, @Body() dto: VerifyResetTokenDto) {
    return this.authService.verifyResetToken(req, dto);
  }

  @Post('reset-password')
  @Post('tenant/reset-password')
  @Post('tenant/:tenantId/reset-password')
  @Post(':tenantId/reset-password')
  @UseGuards(TenantSensitiveRateLimitGuard)
  @TenantAuthResetPasswordDocs()
  async resetPassword(@Req() req, @Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(req, dto);
  }

  @Post('send-email-verification')
  @Post('tenant/send-email-verification')
  @Post('tenant/:tenantId/send-email-verification')
  @Post(':tenantId/send-email-verification')
  @UseGuards(TenantSensitiveRateLimitGuard)
  @TenantAuthEmailVerificationDocs('send')
  async sendEmailVerification(@Req() req, @Body() dto: ForgotPasswordDto) {
    return this.authService.sendEmailVerification(req, dto, 'tenant');
  }

  @Post('verify-email')
  @Post('tenant/verify-email')
  @Post('tenant/:tenantId/verify-email')
  @Post(':tenantId/verify-email')
  @UseGuards(TenantSensitiveRateLimitGuard)
  @TenantAuthEmailVerificationDocs('verify')
  async verifyEmail(@Req() req, @Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(req, dto);
  }

  @Post('refresh-token')
  @Post('tenant/refresh-token')
  @Post('tenant/:tenantId/refresh-token')
  @Post(':tenantId/refresh-token')
  @UseGuards(TenantSensitiveRateLimitGuard)
  @TenantAuthRefreshTokenDocs()
  async refreshToken(@Req() req, @Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(req, dto);
  }
}
