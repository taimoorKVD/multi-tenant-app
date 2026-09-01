import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MasterAccess } from '../../common/decorators';
import { BillingService } from './billing.service';
import {
  CancelSubscriptionDto,
  ChangePlanDto,
  CreatePlanDto,
  CreateSubscriptionDto,
  QueryInvoiceDto,
  QuerySubscriptionDto,
  UpdatePlanDto,
} from './dto';
import { BulkDeleteDto } from '../../common/dto';
import { BulkDeleteSwagger } from '../../common/swagger';
import { BillingSwagger } from './swagger';

@ApiTags('Plan Management')
@ApiBearerAuth('access-token')
@Controller('master/plans')
export class PlansController {
  constructor(private readonly billingService: BillingService) {}

  @Get('modules')
  @MasterAccess('view-plan')
  @ApiOperation({
    summary: 'List tenant modules that can be enabled on a plan',
  })
  listModules() {
    return this.billingService.listAvailableModules();
  }

  @Get()
  @MasterAccess('view-plan')
  @BillingSwagger.ListPlans()
  listPlans() {
    return this.billingService.listPlans();
  }

  @Post()
  @MasterAccess('create-plan')
  @ApiOperation({ summary: 'Create a subscription plan and sync it to Stripe' })
  createPlan(@Body() dto: CreatePlanDto) {
    return this.billingService.createPlan(dto);
  }

  @Get(':id')
  @MasterAccess('view-plan')
  getPlan(@Param('id', ParseIntPipe) id: number) {
    return this.billingService.getPlan(id);
  }

  @Put(':id')
  @MasterAccess('edit-plan')
  updatePlan(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePlanDto) {
    return this.billingService.updatePlan(id, dto);
  }

  @Delete('bulk')
  @MasterAccess('delete-plan')
  @BulkDeleteSwagger('plans')
  bulkDeletePlans(@Body() dto: BulkDeleteDto) {
    return this.billingService.bulkDeletePlans(dto.ids);
  }

  @Delete(':id')
  @MasterAccess('delete-plan')
  deletePlan(@Param('id', ParseIntPipe) id: number) {
    return this.billingService.deletePlan(id);
  }
}

@ApiTags('Subscriptions')
@ApiBearerAuth('access-token')
@Controller('master/subscriptions')
export class SubscriptionsController {
  constructor(private readonly billingService: BillingService) {}

  @Get('stats')
  @MasterAccess('view-subscription')
  @BillingSwagger.SubscriptionStats()
  subscriptionStats() {
    return this.billingService.getSubscriptionStats();
  }

  @Get()
  @MasterAccess('view-subscription')
  @BillingSwagger.ListSubscriptions()
  listSubscriptions(@Query() query: QuerySubscriptionDto) {
    return this.billingService.listSubscriptions(query);
  }

  @Post()
  @MasterAccess('create-subscription')
  createSubscription(@Body() dto: CreateSubscriptionDto) {
    return this.billingService.createSubscription(dto);
  }

  @Get(':id')
  @MasterAccess('view-subscription')
  getSubscription(@Param('id', ParseIntPipe) id: number) {
    return this.billingService.getSubscription(id);
  }

  @Put(':id/change-plan')
  @MasterAccess('edit-subscription')
  changePlan(@Param('id', ParseIntPipe) id: number, @Body() dto: ChangePlanDto) {
    return this.billingService.changePlan(id, dto);
  }

  @Post(':id/cancel')
  @MasterAccess('edit-subscription')
  cancel(@Param('id', ParseIntPipe) id: number, @Body() dto: CancelSubscriptionDto) {
    return this.billingService.cancelSubscription(id, dto);
  }
}

@ApiTags('Billing & Invoices')
@ApiBearerAuth('access-token')
@Controller('master/invoices')
export class InvoicesController {
  constructor(private readonly billingService: BillingService) {}

  @Get('stats')
  @MasterAccess('view-invoice')
  @BillingSwagger.InvoiceStats()
  invoiceStats() {
    return this.billingService.getInvoiceStats();
  }

  @Get()
  @MasterAccess('view-invoice')
  @BillingSwagger.ListInvoices()
  listInvoices(@Query() query: QueryInvoiceDto) {
    return this.billingService.listInvoices(query);
  }

  @Get(':id')
  @MasterAccess('view-invoice')
  getInvoice(@Param('id', ParseIntPipe) id: number) {
    return this.billingService.getInvoice(id);
  }
}
