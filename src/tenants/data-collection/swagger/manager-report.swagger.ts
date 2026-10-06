import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  AddToCartDto,
  CheckoutCartDto,
  MarkOrderContactDto,
  ReceiveOrderDto,
} from '../dto/manager-report/manager-report.dto';
import { ManagerOrderStatus, ManagerRequestKind, ManagerRequestStatus } from '../entities/enums';

const requestLineExample = {
  id: 12,
  kind: 'purchase',
  status: 'open',
  requestNo: null,
  submissionId: 40,
  assignmentId: 22,
  templateId: 8,
  templateVersionId: 15,
  ruleClientId: 'logic_numeric_or',
  actionClientId: 'a_pr',
  requestedByUserId: 9,
  requesterName: 'Peter Johan',
  itemId: 2,
  vendorId: null,
  itemLabel: 'Apple',
  note: 'Green Apple Use for Pie',
  quantity: '12',
  quotedPrice: '20',
  answersSnapshot: { fld_002: 2, fld_qty: 12, fld_notes: 'Green Apple Use for Pie' },
  createdAt: '2026-10-06T12:00:00.000Z',
};

const cartExample = {
  id: 3,
  userId: 1,
  kind: 'purchase',
  status: 'open',
  items: [
    {
      id: 7,
      cartId: 3,
      requestId: 12,
      itemId: 2,
      vendorId: 5,
      quantity: '12',
      unitCost: '20',
      size: '1kg',
      itemNumber: '002',
      itemLabel: 'Apple',
    },
  ],
};

const orderExample = {
  id: 4,
  kind: 'purchase',
  orderNo: 'Purchase No 001',
  vendorId: 5,
  status: 'pending',
  createdByUserId: 1,
  contactedWebsite: false,
  contactedPhone: false,
  contactedEmail: false,
  vendorSnapshot: {
    id: 5,
    name: 'ABC Company',
    vendor_name: 'ABC Company',
    email: 'orders@abc.com',
    phone: '718-795-5864',
    website: 'https://abc.com',
    min_order: 1,
  },
  emailedAt: '2026-10-06T12:05:00.000Z',
  emailTo: 'orders@abc.com',
  emailStatus: 'sent',
  items: [
    {
      id: 9,
      orderId: 4,
      requestId: 12,
      itemId: 2,
      itemLabel: 'Apple',
      qty: '12',
      quotedPrice: '20',
      received: false,
      actualPrice: null,
      size: '1kg',
      itemNumber: '002',
    },
  ],
  createdAt: '2026-10-06T12:05:00.000Z',
};

export const TenantDataCollectionManagerReportSwagger = {
  Tags: () => ApiTags('Data Collection - Manager Report'),
  Auth: () => ApiBearerAuth('access-token'),

  ListRequests: () =>
    applyDecorators(
      ApiOperation({
        summary: 'List Manager Portal request / notification lines',
        description:
          'Filter by `kind`: `purchase` (Purchase tab), `maintenance` (Maintenance tab), or `notification` (Notification tab). ' +
          'Rows are created when a submission matches `schema.conditionalRules` actions `purchaseRequest`, `maintenanceRequest`, or `sendNotification`. Requires `review-dc-submission`.',
      }),
      ApiQuery({ name: 'kind', required: false, enum: ManagerRequestKind, example: ManagerRequestKind.PURCHASE }),
      ApiQuery({
        name: 'status',
        required: false,
        enum: ManagerRequestStatus,
        example: ManagerRequestStatus.OPEN,
        description: 'Defaults to `open` (active tab items). Use `received` for acknowledged notifications.',
      }),
      ApiQuery({ name: 'page', required: false, type: Number, example: 1 }),
      ApiQuery({ name: 'limit', required: false, type: Number, example: 15 }),
      ApiResponse({
        status: 200,
        description: 'Request / notification lines fetched.',
        schema: {
          example: {
            success: true,
            meta: { total: 1, page: 1, lastPage: 1 },
            data: [requestLineExample],
          },
        },
      }),
    ),

  DismissNotification: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Acknowledge / dismiss a Notification-tab item',
        description:
          'Only `kind=notification` rows. Sets status to `received` so the item leaves the default open Notification list.',
      }),
      ApiParam({ name: 'id', type: Number, example: 15 }),
      ApiResponse({
        status: 201,
        description: 'Notification acknowledged.',
        schema: {
          example: {
            success: true,
            message: 'Notification acknowledged',
            data: {
              id: 15,
              kind: 'notification',
              status: 'received',
              note: 'Current Quantity < Item Par',
              requesterName: 'Peter Johan',
            },
          },
        },
      }),
      ApiResponse({ status: 400, description: 'Not a notification kind, or already acknowledged.' }),
      ApiResponse({ status: 404, description: 'Request not found.' }),
    ),

  GetCart: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Get the open manager cart',
        description: 'One open cart per manager user per kind (`purchase` | `maintenance`). Created on first access.',
      }),
      ApiQuery({ name: 'kind', required: false, enum: ManagerRequestKind, example: ManagerRequestKind.PURCHASE }),
      ApiResponse({
        status: 200,
        description: 'Open cart with line items.',
        schema: { example: { success: true, data: cartExample } },
      }),
    ),

  AddToCart: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Add selected requests and/or catalog items to the cart',
        description:
          'Copies Request-tab lines (`requestIds`) and optional vendor catalog rows onto the open cart. Request lines move to `in_cart`.',
      }),
      ApiBody({
        type: AddToCartDto,
        examples: {
          fromRequestsAndCatalog: {
            summary: 'Requests + catalog item',
            value: {
              kind: 'purchase',
              requestIds: [12],
              catalogItems: [
                {
                  itemId: 2,
                  vendorId: 5,
                  quantity: 3,
                  unitCost: 20,
                  size: '1kg',
                  itemNumber: '002',
                  itemLabel: 'Apple',
                },
              ],
            },
          },
        },
      }),
      ApiResponse({
        status: 201,
        description: 'Updated open cart.',
        schema: { example: { success: true, data: cartExample } },
      }),
      ApiResponse({ status: 400, description: 'Nothing selected, or a request is not open for cart.' }),
    ),

  RemoveCartItem: () =>
    applyDecorators(
      ApiOperation({ summary: 'Remove a cart line' }),
      ApiParam({ name: 'id', type: Number, example: 7 }),
      ApiResponse({
        status: 200,
        description: 'Updated open cart. Linked requests return to `open` if they have no remaining cart lines.',
        schema: { example: { success: true, data: { ...cartExample, items: [] } } },
      }),
      ApiResponse({ status: 404, description: 'Cart item not found.' }),
    ),

  Checkout: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Check out cart',
        description:
          'Groups cart lines by `vendorId` into pending orders (`Purchase No 001` / `Maintenance No 001`), snapshots vendor contact fields, emails each vendor, and marks requests `ordered`. Every line must have a vendor. `kind=notification` is not supported.',
      }),
      ApiBody({
        type: CheckoutCartDto,
        examples: { purchase: { summary: 'Checkout purchase cart', value: { kind: 'purchase' } } },
      }),
      ApiResponse({
        status: 201,
        description: 'Orders created; vendor email attempted per vendor.',
        schema: {
          example: {
            success: true,
            message: 'Checked out',
            data: [orderExample],
          },
        },
      }),
      ApiResponse({ status: 400, description: 'Cart empty or a line is missing vendorId.' }),
    ),

  ListOrders: () =>
    applyDecorators(
      ApiOperation({
        summary: 'List pending or completed vendor orders',
        description:
          '`tab=pending` (default) is Pending Purchases (`pending` + `contacted`). `tab=done` is Purchases Done.',
      }),
      ApiQuery({ name: 'kind', required: false, enum: ManagerRequestKind, example: ManagerRequestKind.PURCHASE }),
      ApiQuery({ name: 'tab', required: false, enum: ['pending', 'done'], example: 'pending' }),
      ApiQuery({ name: 'status', required: false, enum: ManagerOrderStatus }),
      ApiQuery({ name: 'page', required: false, type: Number, example: 1 }),
      ApiQuery({ name: 'limit', required: false, type: Number, example: 15 }),
      ApiResponse({
        status: 200,
        description: 'Vendor orders with line items.',
        schema: {
          example: {
            success: true,
            meta: { total: 1, page: 1, lastPage: 1 },
            data: [orderExample],
          },
        },
      }),
    ),

  MarkContact: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Mark Website / Phone / Email on a pending order (Done)',
        description:
          'Updates contact checkboxes. When `email` is true, sends SMTP to the vendor email from `vendor_snapshot` / `entity_dynamic_data`.',
      }),
      ApiParam({ name: 'id', type: Number, example: 4 }),
      ApiBody({
        type: MarkOrderContactDto,
        examples: {
          emailDone: {
            summary: 'Email + Done',
            value: { website: false, phone: false, email: true },
          },
        },
      }),
      ApiResponse({
        status: 200,
        description: 'Contact recorded; order status becomes `contacted`.',
        schema: {
          example: {
            success: true,
            message: 'Contact recorded',
            data: { ...orderExample, status: 'contacted', contactedEmail: true },
          },
        },
      }),
      ApiResponse({ status: 404, description: 'Order not found.' }),
    ),

  Receive: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Update received flags and actual prices (Purchases Done)',
      }),
      ApiParam({ name: 'id', type: Number, example: 4 }),
      ApiBody({
        type: ReceiveOrderDto,
        examples: {
          receiveApple: {
            summary: 'Mark item received',
            value: { items: [{ id: 9, received: true, actualPrice: 12 }] },
          },
        },
      }),
      ApiResponse({
        status: 200,
        description: 'Order items updated.',
        schema: {
          example: {
            success: true,
            data: {
              ...orderExample,
              items: [{ ...orderExample.items[0], received: true, actualPrice: '12' }],
            },
          },
        },
      }),
    ),

  Complete: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Complete a received order',
        description:
          'Every line must be `received`. Sets order `done`, linked requests `received`, and emails the vendor a completion notice.',
      }),
      ApiParam({ name: 'id', type: Number, example: 4 }),
      ApiResponse({
        status: 201,
        description: 'Order completed.',
        schema: {
          example: {
            success: true,
            message: 'Order completed',
            data: {
              ...orderExample,
              status: 'done',
              items: [{ ...orderExample.items[0], received: true, actualPrice: '12' }],
              vendorEmail: { status: 'sent', to: 'orders@abc.com', detail: 'messageId=abc' },
            },
          },
        },
      }),
      ApiResponse({ status: 400, description: 'Not every item is marked received.' }),
    ),
};
