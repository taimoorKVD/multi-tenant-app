import {Body, Controller, Get, Post, Req, UseGuards} from '@nestjs/common';
import {MasterAuthService} from './auth.service';
import {LoginDto} from './dto';
import {MasterAuthGuard} from './guards';
import {Request} from 'express';
import {MasterAuthGetUserDocs, MasterAuthLoginDocs,} from './swagger';
import {ApiTags} from "@nestjs/swagger";

@ApiTags('Authentication')
@Controller('master')
export class MasterAuthController {
  constructor(private readonly authService: MasterAuthService) {
  }

  @Post('login')
  @MasterAuthLoginDocs()
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @UseGuards(MasterAuthGuard)
  @Get('auth/user')
  @MasterAuthGetUserDocs()
  async getUser(@Req() req: Request) {
    const user = req.user as { id: number; email: string; role: string };
    return this.authService.getProfile(user.id);
  }
}
