import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { TenantAccess } from '../../../common/decorators/tenant-access.decorator';
import { ManagerReportService } from '../services/manager-report.service';
import {
  AddToCartDto,
  CheckoutCartDto,
  MarkOrderContactDto,
  QueryManagerCartDto,
  QueryManagerOrdersDto,
  QueryManagerRequestsDto,
  ReceiveOrderDto,
} from '../dto/manager-report/manager-report.dto';
import { ManagerRequestKind } from '../entities/enums';
import { TenantDataCollectionManagerReportSwagger } from '../swagger/manager-report.swagger';

@TenantDataCollectionManagerReportSwagger.Tags()
@TenantDataCollectionManagerReportSwagger.Auth()
@Controller(['data-collection/manager-report', 'tenant/:tenantId/data-collection/manager-report'])
export class ManagerReportController {
  constructor(private readonly managerReport: ManagerReportService) {}

  @Get('requests')
  @TenantAccess('review-dc-submission')
  @TenantDataCollectionManagerReportSwagger.ListRequests()
  listRequests(@Req() req: any, @Query() query: QueryManagerRequestsDto) {
    return this.managerReport.listRequests(req, query);
  }

  @Post('requests/:id/dismiss')
  @TenantAccess('review-dc-submission')
  @TenantDataCollectionManagerReportSwagger.DismissNotification()
  dismissNotification(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.managerReport.dismissNotification(req, id);
  }

  @Get('cart')
  @TenantAccess('review-dc-submission')
  @TenantDataCollectionManagerReportSwagger.GetCart()
  getCart(@Req() req: any, @Query() query: QueryManagerCartDto) {
    return this.managerReport.getOpenCart(req, query.kind || ManagerRequestKind.PURCHASE);
  }

  @Post('cart')
  @TenantAccess('review-dc-submission')
  @TenantDataCollectionManagerReportSwagger.AddToCart()
  addToCart(@Req() req: any, @Body() dto: AddToCartDto) {
    return this.managerReport.addToCart(req, dto);
  }

  @Delete('cart/items/:id')
  @TenantAccess('review-dc-submission')
  @TenantDataCollectionManagerReportSwagger.RemoveCartItem()
  removeCartItem(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.managerReport.removeCartItem(req, id);
  }

  @Post('cart/checkout')
  @TenantAccess('review-dc-submission')
  @TenantDataCollectionManagerReportSwagger.Checkout()
  checkout(@Req() req: any, @Body() dto: CheckoutCartDto) {
    return this.managerReport.checkout(req, dto.kind);
  }

  @Get('orders')
  @TenantAccess('review-dc-submission')
  @TenantDataCollectionManagerReportSwagger.ListOrders()
  listOrders(@Req() req: any, @Query() query: QueryManagerOrdersDto) {
    return this.managerReport.listOrders(req, query);
  }

  @Patch('orders/:id/contact')
  @TenantAccess('review-dc-submission')
  @TenantDataCollectionManagerReportSwagger.MarkContact()
  markContact(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MarkOrderContactDto,
  ) {
    return this.managerReport.markContacted(req, id, dto);
  }

  @Patch('orders/:id/receive')
  @TenantAccess('review-dc-submission')
  @TenantDataCollectionManagerReportSwagger.Receive()
  receive(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReceiveOrderDto,
  ) {
    return this.managerReport.receiveItems(req, id, dto);
  }

  @Post('orders/:id/complete')
  @TenantAccess('review-dc-submission')
  @TenantDataCollectionManagerReportSwagger.Complete()
  complete(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.managerReport.completeOrder(req, id);
  }
}
