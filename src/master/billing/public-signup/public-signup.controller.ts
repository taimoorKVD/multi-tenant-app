import { Body, Controller, Get, HttpCode, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PublicSignupService } from './public-signup.service';
import { StartWebsiteSignupDto } from './dto/start-website-signup.dto';
import { SignupHandoffDto } from './dto/signup-handoff.dto';
import { createRateLimitGuard } from '../../../common/guards/rate-limit.guard';
import { WebsiteSignupSwagger } from '../swagger';

const WebsiteSignupRateLimitGuard = createRateLimitGuard(8, 15 * 60 * 1000);

@ApiTags('Website Signup')
@Controller('public')
export class PublicSignupController {
  constructor(private readonly publicSignupService: PublicSignupService) {}

  @Get('plans')
  @WebsiteSignupSwagger.ListPlans()
  listPlans() {
    return this.publicSignupService.listPlans();
  }

  @Post('signup/checkout')
  @HttpCode(201)
  @UseGuards(WebsiteSignupRateLimitGuard)
  @WebsiteSignupSwagger.StartCheckout()
  startCheckout(@Body() dto: StartWebsiteSignupDto) {
    return this.publicSignupService.startCheckout(dto);
  }

  @Get('signup/status')
  @WebsiteSignupSwagger.SignupStatus()
  getStatus(@Query('session_id') sessionId: string) {
    return this.publicSignupService.getStatus(sessionId);
  }

  @Post('signup/handoff')
  @HttpCode(200)
  @UseGuards(WebsiteSignupRateLimitGuard)
  @WebsiteSignupSwagger.Handoff()
  handoff(@Body() dto: SignupHandoffDto, @Req() req: any) {
    return this.publicSignupService.completeHandoff(dto.token, req);
  }
}
