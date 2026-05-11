import {Body, Controller, Get, Post, Req, UseGuards} from '@nestjs/common';
import {MasterAuthService} from './auth.service';
import {ForgotPasswordDto, LoginDto, RefreshTokenDto, ResetPasswordDto, VerifyEmailDto, VerifyResetTokenDto} from './dto';
import {MasterAuthGuard} from './guards';
import {Request} from 'express';
import {
  MasterAuthEmailVerificationDocs,
  MasterAuthForgotPasswordDocs,
  MasterAuthGetUserDocs,
  MasterAuthLoginDocs,
  MasterAuthRefreshTokenDocs,
  MasterAuthResetPasswordDocs,
  MasterAuthVerifyResetTokenDocs,
} from './swagger';
import {ApiTags} from "@nestjs/swagger";
import {createRateLimitGuard} from '../../common/guards/rate-limit.guard';

const MasterSensitiveRateLimitGuard = createRateLimitGuard(5, 15 * 60 * 1000);

@ApiTags('Authentication')
@Controller('master')
export class MasterAuthController {
  constructor(private readonly authService: MasterAuthService) {
  }

  @Post('login')
  @MasterAuthLoginDocs()
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    return this.authService.login(loginDto, req);
  }

  @Post('forgot-password')
  @UseGuards(MasterSensitiveRateLimitGuard)
  @MasterAuthForgotPasswordDocs()
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    return this.authService.forgotPassword(dto, req);
  }

  @Post('verify-reset-token')
  @UseGuards(MasterSensitiveRateLimitGuard)
  @MasterAuthVerifyResetTokenDocs()
  async verifyResetToken(@Body() dto: VerifyResetTokenDto) {
    return this.authService.verifyResetToken(dto);
  }

  @Post('reset-password')
  @UseGuards(MasterSensitiveRateLimitGuard)
  @MasterAuthResetPasswordDocs()
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('send-email-verification')
  @UseGuards(MasterSensitiveRateLimitGuard)
  @MasterAuthEmailVerificationDocs('send')
  async sendEmailVerification(@Body() dto: ForgotPasswordDto) {
    return this.authService.sendEmailVerification(dto);
  }

  @Post('verify-email')
  @UseGuards(MasterSensitiveRateLimitGuard)
  @MasterAuthEmailVerificationDocs('verify')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Post('refresh-token')
  @UseGuards(MasterSensitiveRateLimitGuard)
  @MasterAuthRefreshTokenDocs()
  async refreshToken(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refreshToken(dto, req);
  }

  @UseGuards(MasterAuthGuard)
  @Get('auth/user')
  @MasterAuthGetUserDocs()
  async getUser(@Req() req: Request) {
    const user = req.user as { id: number; email: string; role: string };
    return this.authService.getProfile(user.id);
  }
}
