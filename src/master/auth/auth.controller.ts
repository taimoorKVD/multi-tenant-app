import { Body, Controller, Post } from '@nestjs/common';
import { MasterAuthService } from './auth.service';
import { LoginDto } from './dto';

@Controller('master/auth')
export class MasterAuthController {
  constructor(private readonly authService: MasterAuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
