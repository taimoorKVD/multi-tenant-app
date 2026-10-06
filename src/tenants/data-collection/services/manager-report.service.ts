import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { In } from 'typeorm';
import { Item } from '../../items/entities';
import { DC_PAGINATION_DEFAULT, DC_PAGINATION_MAX } from '../config/data-collection.constants';
import {
  DcManagerCart,
  DcManagerCartItem,
  DcManagerOrder,
  DcManagerOrderItem,
  DcManagerOrderMessage,
  DcManagerRequest,
} from '../entities';
import {
  ManagerCartStatus,
  ManagerOrderChannel,
  ManagerOrderStatus,
  ManagerRequestKind,
  ManagerRequestStatus,
} from '../entities/enums';
import {
  AddToCartDto,
  MarkOrderContactDto,
  QueryManagerOrdersDto,
  QueryManagerRequestsDto,
  ReceiveOrderDto,
} from '../dto/manager-report/manager-report.dto';
import { findValueByKeyHint } from '../utils/workflow-operators.util';
import { WorkflowActionsService } from './workflow-actions.service';
import { WorkflowRuleEngineService } from './workflow-rule-engine.service';

@Injectable()
export class ManagerReportService {
  private readonly logger = new Logger(ManagerReportService.name);

  constructor(
    private readonly workflowActions: WorkflowActionsService,
    private readonly ruleEngine: WorkflowRuleEngineService,
  ) {}

  private getActorId(req: any): number {
    const candidate = req?.user?.id ?? req?.user?.sub ?? req?.user?.userId ?? null;
    const actorId = Number(candidate);
    if (!Number.isFinite(actorId) || actorId <= 0) {
      throw new BadRequestException('Authenticated user is required');
    }
    return actorId;
  }

  private pageLimit(query: { page?: number; limit?: number }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(Math.max(1, query.limit ?? DC_PAGINATION_DEFAULT), DC_PAGINATION_MAX);
    return { page, limit, skip: (page - 1) * limit };
  }

  async listRequests(req: any, query: QueryManagerRequestsDto) {
    const repo = req.tenantConnection.getRepository(DcManagerRequest);
    const { page, limit, skip } = this.pageLimit(query);
    const where: Record<string, any> = {};
    if (query.kind) where.kind = query.kind;
    where.status = query.status || ManagerRequestStatus.OPEN;

    const [data, total] = await repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      success: true,
      meta: { total, page, lastPage: Math.max(1, Math.ceil(total / limit)) },
      data,
    };
  }

  async getOpenCart(req: any, kind: ManagerRequestKind = ManagerRequestKind.PURCHASE) {
    if (kind === ManagerRequestKind.NOTIFICATION) {
      throw new BadRequestException(
        'Notification kind has no cart. List Notification tab via GET /requests?kind=notification.',
      );
    }
    const cart = await this.ensureOpenCart(req, kind, this.getActorId(req));
    const itemRepo = req.tenantConnection.getRepository(DcManagerCartItem);
    const items = await itemRepo.find({ where: { cartId: cart.id }, order: { id: 'ASC' } });
    return { success: true, data: { ...cart, items } };
  }

  /**
   * Acknowledge / dismiss a Notification-tab item (kind=notification).
   * Sets status to `received` so it drops out of the default open list.
   */
  async dismissNotification(req: any, requestId: number) {
    this.getActorId(req);
    const repo = req.tenantConnection.getRepository(DcManagerRequest);
    const row = await repo.findOne({ where: { id: requestId } });
    if (!row) throw new NotFoundException(`Request ${requestId} not found`);
    if (row.kind !== ManagerRequestKind.NOTIFICATION) {
      throw new BadRequestException('Only notification kind items can be dismissed this way');
    }
    if (row.status !== ManagerRequestStatus.OPEN) {
      throw new BadRequestException(`Notification ${requestId} is already ${row.status}`);
    }
    row.status = ManagerRequestStatus.RECEIVED;
    await repo.save(row);
    return { success: true, message: 'Notification acknowledged', data: row };
  }

  async addToCart(req: any, dto: AddToCartDto) {
    if (dto.kind === ManagerRequestKind.NOTIFICATION) {
      throw new BadRequestException(
        'Notification items cannot be added to cart. Use the Notification tab and dismiss/acknowledge them instead.',
      );
    }
    const actorId = this.getActorId(req);
    const requestIds = dto.requestIds || [];
    const catalogItems = dto.catalogItems || [];
    if (!requestIds.length && !catalogItems.length) {
      throw new BadRequestException('Select at least one request or catalog item');
    }

    const cart = await this.ensureOpenCart(req, dto.kind, actorId);
    const requestRepo = req.tenantConnection.getRepository(DcManagerRequest);
    const cartItemRepo = req.tenantConnection.getRepository(DcManagerCartItem);
    const itemRepo = req.tenantConnection.getRepository(Item);

    if (requestIds.length) {
      const requests: DcManagerRequest[] = await requestRepo.find({
        where: { id: In(requestIds), kind: dto.kind },
      });
      if (requests.length !== requestIds.length) {
        throw new NotFoundException('One or more requests were not found for this kind');
      }
      for (const request of requests) {
        if (request.status !== ManagerRequestStatus.OPEN && request.status !== ManagerRequestStatus.IN_CART) {
          throw new BadRequestException(`Request ${request.id} is not open for cart`);
        }
        await cartItemRepo.save(
          cartItemRepo.create({
            cartId: cart.id,
            requestId: request.id,
            itemId: request.itemId,
            vendorId: request.vendorId,
            quantity: request.quantity || '1',
            unitCost: request.quotedPrice,
            itemLabel: request.itemLabel,
          }),
        );
        request.status = ManagerRequestStatus.IN_CART;
        await requestRepo.save(request);
      }
    }

    for (const catalog of catalogItems) {
      let itemLabel = catalog.itemLabel || null;
      if (!itemLabel && catalog.itemId) {
        const item = await itemRepo.findOne({ where: { id: catalog.itemId } });
        itemLabel = item?.itemName || null;
      }
      await cartItemRepo.save(
        cartItemRepo.create({
          cartId: cart.id,
          requestId: null,
          itemId: catalog.itemId ?? null,
          vendorId: catalog.vendorId,
          quantity: String(catalog.quantity ?? 1),
          unitCost: catalog.unitCost == null ? null : String(catalog.unitCost),
          size: catalog.size ?? null,
          itemNumber: catalog.itemNumber ?? null,
          itemLabel,
        }),
      );
    }

    return this.getOpenCart(req, dto.kind);
  }

  async removeCartItem(req: any, cartItemId: number) {
    const actorId = this.getActorId(req);
    const cartItemRepo = req.tenantConnection.getRepository(DcManagerCartItem);
    const cartRepo = req.tenantConnection.getRepository(DcManagerCart);
    const requestRepo = req.tenantConnection.getRepository(DcManagerRequest);

    const line = await cartItemRepo.findOne({ where: { id: cartItemId } });
    if (!line) throw new NotFoundException(`Cart item ${cartItemId} not found`);

    const cart = await cartRepo.findOne({ where: { id: line.cartId, userId: actorId } });
    if (!cart || cart.status !== ManagerCartStatus.OPEN) {
      throw new BadRequestException('Cart item does not belong to your open cart');
    }

    if (line.requestId) {
      const request = await requestRepo.findOne({ where: { id: line.requestId } });
      if (request && request.status === ManagerRequestStatus.IN_CART) {
        const remaining = await cartItemRepo.count({
          where: { cartId: cart.id, requestId: line.requestId },
        });
        if (remaining <= 1) {
          request.status = ManagerRequestStatus.OPEN;
          await requestRepo.save(request);
        }
      }
    }

    await cartItemRepo.delete(line.id);
    return this.getOpenCart(req, cart.kind);
  }

  async checkout(req: any, kind: ManagerRequestKind) {
    if (kind === ManagerRequestKind.NOTIFICATION) {
      throw new BadRequestException('Notification kind does not support checkout');
    }
    const actorId = this.getActorId(req);
    const cart = await this.ensureOpenCart(req, kind, actorId);
    const cartItemRepo = req.tenantConnection.getRepository(DcManagerCartItem);
    const items: DcManagerCartItem[] = await cartItemRepo.find({ where: { cartId: cart.id } });
    if (!items.length) throw new BadRequestException('Cart is empty');

    const missingVendor = items.filter((item) => !item.vendorId);
    if (missingVendor.length) {
      throw new BadRequestException('Every cart line must have a vendor before checkout');
    }

    const byVendor = new Map<number, DcManagerCartItem[]>();
    for (const item of items) {
      const vendorId = item.vendorId!;
      const list = byVendor.get(vendorId) || [];
      list.push(item);
      byVendor.set(vendorId, list);
    }

    const orderRepo = req.tenantConnection.getRepository(DcManagerOrder);
    const orderItemRepo = req.tenantConnection.getRepository(DcManagerOrderItem);
    const requestRepo = req.tenantConnection.getRepository(DcManagerRequest);
    const cartRepo = req.tenantConnection.getRepository(DcManagerCart);
    const created: DcManagerOrder[] = [];

    for (const [vendorId, lines] of byVendor.entries()) {
      const vendorSnapshot = await this.buildVendorSnapshot(req, vendorId);
      const orderNo = await this.nextOrderNo(req, kind);
      const order = await orderRepo.save(
        orderRepo.create({
          kind,
          orderNo,
          vendorId,
          status: ManagerOrderStatus.PENDING,
          createdByUserId: actorId,
          vendorSnapshot,
        }),
      );

      for (const line of lines) {
        await orderItemRepo.save(
          orderItemRepo.create({
            orderId: order.id,
            requestId: line.requestId,
            itemId: line.itemId,
            itemLabel: line.itemLabel,
            qty: line.quantity,
            quotedPrice: line.unitCost,
            size: line.size,
            itemNumber: line.itemNumber,
            received: false,
          }),
        );
        if (line.requestId) {
          await requestRepo.update(line.requestId, {
            status: ManagerRequestStatus.ORDERED,
            vendorId,
            itemId: line.itemId,
            requestNo: orderNo,
          });
        }
      }

      const emailed = await this.emailVendorOrder(req, order.id, actorId, 'checkout');
      order.emailStatus = emailed.status;
      order.emailTo = emailed.to;
      order.emailedAt = emailed.status === 'sent' ? new Date() : null;
      await orderRepo.save(order);
      created.push(order);
    }

    cart.status = ManagerCartStatus.CHECKED_OUT;
    await cartRepo.save(cart);

    return {
      success: true,
      message: 'Checked out',
      data: created,
    };
  }

  async listOrders(req: any, query: QueryManagerOrdersDto) {
    const repo = req.tenantConnection.getRepository(DcManagerOrder);
    const { page, limit, skip } = this.pageLimit(query);
    const where: Record<string, any> = {};
    if (query.kind) where.kind = query.kind;

    if (query.tab === 'done' || query.status === ManagerOrderStatus.DONE) {
      where.status = ManagerOrderStatus.DONE;
    } else if (query.status) {
      where.status = query.status;
    } else {
      where.status = In([ManagerOrderStatus.PENDING, ManagerOrderStatus.CONTACTED]);
    }

    const [data, total] = await repo.findAndCount({
      where,
      relations: ['items'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      success: true,
      meta: { total, page, lastPage: Math.max(1, Math.ceil(total / limit)) },
      data,
    };
  }

  async markContacted(req: any, orderId: number, dto: MarkOrderContactDto) {
    const actorId = this.getActorId(req);
    const orderRepo = req.tenantConnection.getRepository(DcManagerOrder);
    const order = await orderRepo.findOne({ where: { id: orderId }, relations: ['items'] });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);
    if (order.status === ManagerOrderStatus.DONE) {
      throw new BadRequestException('Order is already complete');
    }

    if (dto.website !== undefined) order.contactedWebsite = dto.website;
    if (dto.phone !== undefined) order.contactedPhone = dto.phone;
    if (dto.email !== undefined) order.contactedEmail = dto.email;

    const messageRepo = req.tenantConnection.getRepository(DcManagerOrderMessage);
    if (order.contactedWebsite) {
      await this.logChannel(messageRepo, order.id, ManagerOrderChannel.WEBSITE, actorId);
    }
    if (order.contactedPhone) {
      await this.logChannel(messageRepo, order.id, ManagerOrderChannel.PHONE, actorId);
    }

    if (order.contactedEmail) {
      const emailed = await this.emailVendorOrder(req, order.id, actorId, 'contact');
      order.emailStatus = emailed.status;
      order.emailTo = emailed.to || order.emailTo;
      if (emailed.status === 'sent') order.emailedAt = new Date();
    }

    order.status = ManagerOrderStatus.CONTACTED;
    await orderRepo.save(order);
    return { success: true, message: 'Contact recorded', data: order };
  }

  async receiveItems(req: any, orderId: number, dto: ReceiveOrderDto) {
    const orderRepo = req.tenantConnection.getRepository(DcManagerOrder);
    const itemRepo = req.tenantConnection.getRepository(DcManagerOrderItem);
    const order = await orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    for (const patch of dto.items) {
      const line = await itemRepo.findOne({ where: { id: patch.id, orderId } });
      if (!line) throw new NotFoundException(`Order item ${patch.id} not found`);
      if (patch.received !== undefined) line.received = patch.received;
      if (patch.actualPrice !== undefined) line.actualPrice = String(patch.actualPrice);
      await itemRepo.save(line);
    }

    const items = await itemRepo.find({ where: { orderId } });
    return { success: true, data: { ...order, items } };
  }

  async completeOrder(req: any, orderId: number) {
    const actorId = this.getActorId(req);
    const orderRepo = req.tenantConnection.getRepository(DcManagerOrder);
    const itemRepo = req.tenantConnection.getRepository(DcManagerOrderItem);
    const requestRepo = req.tenantConnection.getRepository(DcManagerRequest);

    const order = await orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);
    const items = await itemRepo.find({ where: { orderId } });
    if (!items.length) throw new BadRequestException('Order has no items');
    if (items.some((item) => !item.received)) {
      throw new BadRequestException('Mark every item received before completing');
    }

    order.status = ManagerOrderStatus.DONE;
    await orderRepo.save(order);

    const requestIds = items.map((item) => item.requestId).filter((id): id is number => id != null);
    if (requestIds.length) {
      await requestRepo.update({ id: In(requestIds) }, { status: ManagerRequestStatus.RECEIVED });
    }

    const emailed = await this.emailVendorOrder(req, order.id, actorId, 'complete');
    if (emailed.status === 'sent') {
      order.emailedAt = new Date();
      order.emailTo = emailed.to || order.emailTo;
      order.emailStatus = emailed.status;
      await orderRepo.save(order);
    }

    return { success: true, message: 'Order completed', data: { ...order, items, vendorEmail: emailed } };
  }

  private async ensureOpenCart(req: any, kind: ManagerRequestKind, userId: number) {
    const cartRepo = req.tenantConnection.getRepository(DcManagerCart);
    let cart = await cartRepo.findOne({
      where: { userId, kind, status: ManagerCartStatus.OPEN },
    });
    if (!cart) {
      cart = await cartRepo.save(
        cartRepo.create({ userId, kind, status: ManagerCartStatus.OPEN }),
      );
    }
    return cart;
  }

  private async nextOrderNo(req: any, kind: ManagerRequestKind): Promise<string> {
    const orderRepo = req.tenantConnection.getRepository(DcManagerOrder);
    const count = await orderRepo.count({ where: { kind } });
    const prefix = kind === ManagerRequestKind.MAINTENANCE ? 'Maintenance No' : 'Purchase No';
    return `${prefix} ${String(count + 1).padStart(3, '0')}`;
  }

  private async buildVendorSnapshot(req: any, vendorId: number): Promise<Record<string, any>> {
    const record = await this.ruleEngine.loadRelatedRecord(req, 'vendors', vendorId);
    const snapshot: Record<string, any> = {};
    for (const [key, value] of Object.entries(record || {})) {
      if (key.toLowerCase().includes('password')) continue;
      snapshot[key] = value;
    }
    snapshot.email = findValueByKeyHint(snapshot, ['email']);
    snapshot.phone = findValueByKeyHint(snapshot, ['phone', 'phone_number']);
    snapshot.website = findValueByKeyHint(snapshot, ['website']);
    snapshot.min_order = findValueByKeyHint(snapshot, ['min_order']);
    snapshot.name = snapshot.name || snapshot.vendor_name;
    return snapshot;
  }

  private vendorEmailFromSnapshot(snapshot: Record<string, any>): string | null {
    const email = findValueByKeyHint(snapshot, ['email']);
    const raw = email == null ? '' : String(email).trim();
    return raw.includes('@') ? raw : null;
  }

  private async emailVendorOrder(
    req: any,
    orderId: number,
    actorId: number,
    reason: 'checkout' | 'contact' | 'complete',
  ): Promise<{ status: string; detail?: string; to: string | null }> {
    const orderRepo = req.tenantConnection.getRepository(DcManagerOrder);
    const itemRepo = req.tenantConnection.getRepository(DcManagerOrderItem);
    const messageRepo = req.tenantConnection.getRepository(DcManagerOrderMessage);

    const order = await orderRepo.findOne({ where: { id: orderId } });
    if (!order) return { status: 'failed', detail: 'Order missing', to: null };
    const snapshot = order.vendorSnapshot || (await this.buildVendorSnapshot(req, order.vendorId));
    const to = this.vendorEmailFromSnapshot(snapshot);
    if (!to) {
      await this.logChannel(messageRepo, order.id, ManagerOrderChannel.EMAIL, actorId, {
        status: 'skipped',
        body: `No vendor email (${reason})`,
      });
      return { status: 'skipped', detail: 'Vendor has no email', to: null };
    }

    const items = await itemRepo.find({ where: { orderId } });
    const title =
      reason === 'complete'
        ? `Completed ${order.kind} order ${order.orderNo}`
        : `New ${order.kind} order ${order.orderNo}`;
    const rows = [
      { label: 'Order', value: order.orderNo },
      { label: 'Vendor', value: String(snapshot.name || snapshot.vendor_name || order.vendorId) },
      {
        label: 'Items',
        value: items
          .map((item) => {
            const qty = item.qty;
            const label = item.itemLabel || `Item ${item.itemId || ''}`;
            const cost = item.quotedPrice ? ` @ ${item.quotedPrice}` : '';
            return `${label} x ${qty}${cost}`;
          })
          .join('; '),
      },
    ];

    try {
      const result = await this.workflowActions.sendLayoutMail({
        req,
        to,
        subject: title,
        title,
        intro:
          reason === 'complete'
            ? 'This purchase/maintenance order was marked complete.'
            : 'A manager submitted a purchase/maintenance order from the report portal.',
        rows,
        ctaLabel: 'Open Workspace',
      });
      await this.logChannel(messageRepo, order.id, ManagerOrderChannel.EMAIL, actorId, {
        toEmail: to,
        subject: title,
        status: result.status,
        body: result.detail || reason,
        providerMessageId: result.detail?.startsWith('messageId=')
          ? result.detail.replace('messageId=', '')
          : null,
      });
      return { status: result.status, detail: result.detail, to };
    } catch (error) {
      this.logger.error(`Vendor email failed: ${(error as Error).message}`);
      throw new InternalServerErrorException('Failed to email vendor');
    }
  }

  private async logChannel(
    messageRepo: any,
    orderId: number,
    channel: ManagerOrderChannel,
    actorId: number,
    extra?: {
      toEmail?: string | null;
      subject?: string | null;
      body?: string | null;
      status?: string;
      providerMessageId?: string | null;
    },
  ) {
    await messageRepo.save(
      messageRepo.create({
        orderId,
        channel,
        createdBy: actorId,
        toEmail: extra?.toEmail ?? null,
        subject: extra?.subject ?? null,
        body: extra?.body ?? null,
        status: extra?.status ?? 'logged',
        providerMessageId: extra?.providerMessageId ?? null,
      }),
    );
  }
}
