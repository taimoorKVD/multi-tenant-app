import {Body, Controller, Post, Req} from '@nestjs/common';
import { MasterAuthService } from './auth.service';
import {LoginDto} from "../../tenants/auth/dto";

@Controller('master/auth')
export class MasterAuthController {
    constructor(private readonly authService: MasterAuthService) {}

    @Post('login')
    async login(@Req() req, @Body() dto: LoginDto) {
        return this.authService.login(dto);
    }
}
