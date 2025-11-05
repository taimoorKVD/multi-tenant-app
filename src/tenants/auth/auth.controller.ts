import {
  Body,
  Controller,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { TenantAuthService } from './auth.service';
import { LoginDto } from './dto';

@Controller('tenant/:tenantId/auth')
export class TenantAuthController {
  constructor(private readonly authService: TenantAuthService) {}

  @Post('login')
  async login(@Req() req, @Body() dto: LoginDto) {
    const result = await this.authService.login(req, dto);
    if (!result) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return result;
  }
}
