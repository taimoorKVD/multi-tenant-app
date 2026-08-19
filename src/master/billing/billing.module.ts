import { Module, forwardRef } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../tenants/entities';
import { Invoice, Plan, Subscription, WebsiteSignup } from './entities';
import { BillingService } from './billing.service';
import { StripeService } from './stripe.service';
import {
  InvoicesController,
  PlansController,
  SubscriptionsController,
} from './billing.controller';
import { StripeWebhookController } from './stripe-webhook.controller';
import { MasterAuthModule } from '../auth/auth.module';
import { PlanModulesGuard } from '../../common/guards/plan-modules.guard';
import { PublicSignupModule } from './public-signup/public-signup.module';

@Module({
  imports: [
    MasterAuthModule,
    TypeOrmModule.forFeature([Plan, Subscription, Invoice, Tenant, WebsiteSignup]),
    forwardRef(() => PublicSignupModule),
  ],
  controllers: [
    PlansController,
    SubscriptionsController,
    InvoicesController,
    StripeWebhookController,
  ],
  providers: [
    BillingService,
    StripeService,
    PlanModulesGuard,
    {
      provide: APP_GUARD,
      useClass: PlanModulesGuard,
    },
  ],
  exports: [BillingService, StripeService, PlanModulesGuard],
})
export class BillingModule {}
