import { BadRequestException } from '@nestjs/common';
import {
  ManagerCartStatus,
  ManagerOrderStatus,
  ManagerRequestKind,
  ManagerRequestStatus,
} from '../entities/enums';
import { ManagerReportService } from './manager-report.service';

type Row = Record<string, any>;

function matchesWhere(row: Row, where: Record<string, any> | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, expected]) => {
    if (expected == null) return row[key] == null;
    // TypeORM FindOperator (In, etc.)
    if (typeof expected === 'object') {
      const type = (expected as any)._type ?? (expected as any).type;
      const vals = (expected as any)._value ?? (expected as any).value;
      if (type === 'in' && Array.isArray(vals)) return vals.includes(row[key]);
      if (Array.isArray(vals) && !type) return vals.includes(row[key]);
    }
    return row[key] === expected;
  });
}

function createMemoryRepo(seed: Row[] = []) {
  const rows: Row[] = seed.map((r) => ({ ...r }));
  let seq = rows.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0);

  const repo = {
    rows,
    create: jest.fn((data: Row) => ({ ...data })),
    save: jest.fn(async (data: Row | Row[]) => {
      if (Array.isArray(data)) return Promise.all(data.map((d) => repo.save(d)));
      if (data.id == null) {
        seq += 1;
        data.id = seq;
        rows.push(data);
        return { ...data };
      }
      const idx = rows.findIndex((r) => r.id === data.id);
      if (idx >= 0) rows[idx] = { ...rows[idx], ...data };
      else rows.push(data);
      return { ...data };
    }),
    findOne: jest.fn(async ({ where }: { where?: Record<string, any> } = {}) => {
      const found = rows.find((r) => matchesWhere(r, where));
      return found ? { ...found } : null;
    }),
    find: jest.fn(async ({ where }: { where?: Record<string, any> } = {}) => {
      return rows.filter((r) => matchesWhere(r, where)).map((r) => ({ ...r }));
    }),
    findAndCount: jest.fn(async ({ where, skip = 0, take = 100 }: any = {}) => {
      const filtered = rows.filter((r) => matchesWhere(r, where));
      return [filtered.slice(skip, skip + take).map((r) => ({ ...r })), filtered.length];
    }),
    count: jest.fn(async ({ where }: { where?: Record<string, any> } = {}) => {
      return rows.filter((r) => matchesWhere(r, where)).length;
    }),
    update: jest.fn(async (criteria: any, partial: Row) => {
      let where: Record<string, any>;
      if (typeof criteria === 'number') {
        where = { id: criteria };
      } else if (typeof criteria === 'object' && criteria != null) {
        where = criteria;
      } else {
        return;
      }
      for (const row of rows) {
        if (matchesWhere(row, where)) Object.assign(row, partial);
      }
    }),
    delete: jest.fn(async (idOrCriteria: any) => {
      const id = typeof idOrCriteria === 'number' ? idOrCriteria : idOrCriteria?.id;
      const idx = rows.findIndex((r) => r.id === id);
      if (idx >= 0) rows.splice(idx, 1);
    }),
  };
  return repo;
}

describe('ManagerReportService full API flow', () => {
  const sendLayoutMail = jest.fn().mockResolvedValue({ status: 'sent', detail: 'messageId=flow-1' });
  const loadRelatedRecord = jest.fn().mockResolvedValue({
    vendor_name: 'ABC Company',
    name: 'ABC Company',
    email: 'orders@abc.com',
    phone_number: '718-795-5864',
    website: 'https://abc.com',
    min_order: 1,
  });

  let service: ManagerReportService;
  let requestRepo: ReturnType<typeof createMemoryRepo>;
  let cartRepo: ReturnType<typeof createMemoryRepo>;
  let cartItemRepo: ReturnType<typeof createMemoryRepo>;
  let orderRepo: ReturnType<typeof createMemoryRepo>;
  let orderItemRepo: ReturnType<typeof createMemoryRepo>;
  let messageRepo: ReturnType<typeof createMemoryRepo>;
  let itemRepo: ReturnType<typeof createMemoryRepo>;
  let req: any;

  beforeEach(() => {
    sendLayoutMail.mockClear();
    loadRelatedRecord.mockClear();
    service = new ManagerReportService(
      { sendLayoutMail } as any,
      { loadRelatedRecord } as any,
    );

    requestRepo = createMemoryRepo([
      {
        id: 12,
        kind: ManagerRequestKind.PURCHASE,
        status: ManagerRequestStatus.OPEN,
        itemId: 2,
        vendorId: null,
        quantity: '3',
        quotedPrice: '10',
        itemLabel: 'Apple',
        note: 'Use for Pie',
        requesterName: 'Peter Johan',
        createdAt: new Date('2026-10-06T12:00:00Z'),
      },
      {
        id: 15,
        kind: ManagerRequestKind.NOTIFICATION,
        status: ManagerRequestStatus.OPEN,
        note: 'Current Quantity < Item Par',
        requesterName: 'Peter Johan',
        createdAt: new Date('2026-10-06T12:01:00Z'),
      },
    ]);
    cartRepo = createMemoryRepo();
    cartItemRepo = createMemoryRepo();
    orderRepo = createMemoryRepo();
    orderItemRepo = createMemoryRepo();
    messageRepo = createMemoryRepo();
    itemRepo = createMemoryRepo([{ id: 2, itemName: 'Apple' }]);

    const repos: Record<string, any> = {
      DcManagerRequest: requestRepo,
      DcManagerCart: cartRepo,
      DcManagerCartItem: cartItemRepo,
      DcManagerOrder: orderRepo,
      DcManagerOrderItem: orderItemRepo,
      DcManagerOrderMessage: messageRepo,
      Item: itemRepo,
    };

    req = {
      user: { id: 4 },
      tenantConnection: {
        getRepository: (entity: { name: string }) => {
          const repo = repos[entity.name];
          if (!repo) throw new Error(`Unexpected repository ${entity.name}`);
          return repo;
        },
      },
    };
  });

  it('runs purchase Request → cart → checkout → contact → receive → complete, and notification dismiss', async () => {
    // 1) List Request tab
    const requests = await service.listRequests(req, { kind: ManagerRequestKind.PURCHASE });
    expect(requests.meta.total).toBe(1);
    expect(requests.data[0].id).toBe(12);
    expect(requests.data[0].status).toBe(ManagerRequestStatus.OPEN);

    // 2) List Notification tab
    const notifications = await service.listRequests(req, { kind: ManagerRequestKind.NOTIFICATION });
    expect(notifications.meta.total).toBe(1);
    expect(notifications.data[0].note).toBe('Current Quantity < Item Par');

    // 3) Notification has no cart
    await expect(service.getOpenCart(req, ManagerRequestKind.NOTIFICATION)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    // 4) Add purchase request + catalog line (vendor required for checkout)
    // Request alone has vendorId null — assign vendor via catalog companion line + update request path:
    // First add requestIds (copies null vendor), then we need vendor on lines.
    // Realistic UI: add catalogItems with vendorId, and requestIds after patching request vendor.
    requestRepo.rows[0].vendorId = 5;
    const cartAfterAdd = await service.addToCart(req, {
      kind: ManagerRequestKind.PURCHASE,
      requestIds: [12],
      catalogItems: [
        {
          itemId: 2,
          vendorId: 5,
          quantity: 1,
          unitCost: 10,
          size: '1kg',
          itemNumber: '002',
          itemLabel: 'Apple',
        },
      ],
    });
    expect(cartAfterAdd.success).toBe(true);
    expect(cartAfterAdd.data.items.length).toBe(2);
    expect(requestRepo.rows.find((r) => r.id === 12)?.status).toBe(ManagerRequestStatus.IN_CART);

    // 5) Get open cart
    const cart = await service.getOpenCart(req, ManagerRequestKind.PURCHASE);
    expect(cart.data.status).toBe(ManagerCartStatus.OPEN);
    expect(cart.data.items.every((i: any) => i.vendorId === 5)).toBe(true);

    // 6) Checkout → pending order + vendor email
    const checkout = await service.checkout(req, ManagerRequestKind.PURCHASE);
    expect(checkout.message).toBe('Checked out');
    expect(checkout.data).toHaveLength(1);
    expect(checkout.data[0].orderNo).toBe('Purchase No 001');
    expect(checkout.data[0].status).toBe(ManagerOrderStatus.PENDING);
    expect(checkout.data[0].emailStatus).toBe('sent');
    expect(checkout.data[0].emailTo).toBe('orders@abc.com');
    expect(sendLayoutMail).toHaveBeenCalled();
    expect(requestRepo.rows.find((r) => r.id === 12)?.status).toBe(ManagerRequestStatus.ORDERED);
    expect(cartRepo.rows[0].status).toBe(ManagerCartStatus.CHECKED_OUT);
    expect(orderItemRepo.rows.length).toBe(2);

    const orderId = checkout.data[0].id;

    // 7) List pending orders
    const pending = await service.listOrders(req, {
      kind: ManagerRequestKind.PURCHASE,
      tab: 'pending',
    });
    expect(pending.meta.total).toBe(1);
    expect(pending.data[0].id).toBe(orderId);

    // 8) Mark Email contact (Done on pending card)
    const contacted = await service.markContacted(req, orderId, {
      website: false,
      phone: true,
      email: true,
    });
    expect(contacted.data.status).toBe(ManagerOrderStatus.CONTACTED);
    expect(contacted.data.contactedPhone).toBe(true);
    expect(contacted.data.contactedEmail).toBe(true);
    expect(messageRepo.rows.some((m) => m.channel === 'phone')).toBe(true);
    expect(messageRepo.rows.some((m) => m.channel === 'email')).toBe(true);

    // 9) Receive items (Purchases Done prep)
    const lineIds = orderItemRepo.rows.map((r) => r.id);
    const received = await service.receiveItems(req, orderId, {
      items: lineIds.map((id) => ({ id, received: true, actualPrice: 12 })),
    });
    expect(received.data.items.every((i: any) => i.received)).toBe(true);

    // 10) Complete order
    const completed = await service.completeOrder(req, orderId);
    expect(completed.message).toBe('Order completed');
    expect(completed.data.status).toBe(ManagerOrderStatus.DONE);
    expect(completed.data.vendorEmail.status).toBe('sent');
    expect(requestRepo.rows.find((r) => r.id === 12)?.status).toBe(ManagerRequestStatus.RECEIVED);

    // 11) List done tab
    const done = await service.listOrders(req, { kind: ManagerRequestKind.PURCHASE, tab: 'done' });
    expect(done.meta.total).toBe(1);
    expect(done.data[0].status).toBe(ManagerOrderStatus.DONE);

    // 12) Dismiss notification
    const dismissed = await service.dismissNotification(req, 15);
    expect(dismissed.data.status).toBe(ManagerRequestStatus.RECEIVED);
    const openNotifications = await service.listRequests(req, {
      kind: ManagerRequestKind.NOTIFICATION,
    });
    expect(openNotifications.meta.total).toBe(0);

    // Guard rails already covered elsewhere, but assert checkout empty cart fails after checkout
    await expect(service.checkout(req, ManagerRequestKind.PURCHASE)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('blocks notification from cart/checkout and only dismisses notification kind', async () => {
    await expect(
      service.addToCart(req, { kind: ManagerRequestKind.NOTIFICATION, requestIds: [15] }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(service.checkout(req, ManagerRequestKind.NOTIFICATION)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    await expect(service.dismissNotification(req, 12)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('ManagerReportService guards', () => {
  const sendLayoutMail = jest.fn().mockResolvedValue({ status: 'sent', detail: 'messageId=1' });
  const loadRelatedRecord = jest.fn().mockResolvedValue({
    vendor_name: 'ABC Company',
    name: 'ABC Company',
    email: 'vendor@abc.com',
    phone_number: '718-111',
  });

  const service = new ManagerReportService(
    { sendLayoutMail } as any,
    { loadRelatedRecord } as any,
  );

  function repoMap(map: Record<string, any>) {
    return {
      user: { id: 4 },
      tenantConnection: {
        getRepository: (entity: { name: string }) => map[entity.name],
      },
    };
  }

  it('rejects adding notification kind to cart', async () => {
    await expect(
      service.addToCart(repoMap({}), { kind: ManagerRequestKind.NOTIFICATION, requestIds: [1] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects empty add-to-cart', async () => {
    await expect(
      service.addToCart(repoMap({}), { kind: ManagerRequestKind.PURCHASE }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires a vendor on every cart line before checkout', async () => {
    const cart = { id: 1, userId: 4, kind: ManagerRequestKind.PURCHASE, status: ManagerCartStatus.OPEN };
    const req = repoMap({
      DcManagerCart: {
        findOne: jest.fn().mockResolvedValue(cart),
        save: jest.fn().mockResolvedValue(cart),
        create: jest.fn((row) => row),
      },
      DcManagerCartItem: {
        find: jest.fn().mockResolvedValue([{ id: 9, vendorId: null, quantity: '1' }]),
      },
    });

    await expect(service.checkout(req, ManagerRequestKind.PURCHASE)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
