import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { MasterAuthService } from './auth.service';
import { LoginDto } from './dto';
import { MasterAuthGuard } from './guards';
import { Request } from 'express';

@Controller('master')
export class MasterAuthController {
  constructor(private readonly authService: MasterAuthService) {}

  // @Post('login')
  // async login(@Body() dto: LoginDto) {
  //   return this.authService.login(dto);
  // }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @UseGuards(MasterAuthGuard)
  @Get('auth/user')
  async getUser(@Req() req: Request) {
    const user = req.user as { id: number; email: string; role: string }; // cast for type safety
    return this.authService.getProfile(user.id);
  }
}
