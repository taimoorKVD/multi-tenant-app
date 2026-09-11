import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { tenantRoom, tenantUserNotificationsRoom, tenantUserRoom } from '../constants/realtime-rooms';
import { RealtimeService } from '../services/realtime.service';
import { RealtimeSocketUser } from '../types/realtime.types';

type HandshakeAuth = {
  token?: string;
  authorization?: string;
  tenant?: string;
  tenantId?: string;
  tenantSlug?: string;
};

@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class TenantRealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(TenantRealtimeGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly realtimeService: RealtimeService,
  ) {}

  afterInit(server: Server): void {
    this.realtimeService.attachServer(server);
    this.logger.log('Realtime gateway ready (namespace /realtime)');
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const user = this.authenticate(client);
      if (!user?.sub) {
        client.disconnect(true);
        return;
      }

      const tenantSlug = this.resolveTenantSlug(client, user);
      if (!tenantSlug) {
        this.logger.warn(`Realtime connection rejected: missing tenant (user=${user.sub})`);
        client.disconnect(true);
        return;
      }

      if (user.userType && user.userType !== 'tenant') {
        client.disconnect(true);
        return;
      }

      client.data.user = user;
      client.data.tenantSlug = tenantSlug;

      await client.join(tenantRoom(tenantSlug));
      await client.join(tenantUserRoom(tenantSlug, user.sub));
      await client.join(tenantUserNotificationsRoom(tenantSlug, user.sub));

      client.emit('realtime.connected', {
        tenantSlug,
        userId: user.sub,
        at: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Realtime connection failed: ${message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const userId = client.data?.user?.sub;
    const tenantSlug = client.data?.tenantSlug;
    if (userId && tenantSlug) {
      this.logger.debug(`Realtime disconnect user=${userId} tenant=${tenantSlug}`);
    }
  }

  private authenticate(client: Socket): RealtimeSocketUser | null {
    const auth = (client.handshake?.auth || {}) as HandshakeAuth;
    const headers = client.handshake?.headers || {};
    const query = client.handshake?.query || {};

    const rawToken =
      auth.token ||
      auth.authorization ||
      (typeof headers.authorization === 'string' ? headers.authorization : undefined) ||
      (typeof query.token === 'string' ? query.token : undefined);

    if (!rawToken) {
      return null;
    }

    const token = rawToken.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return null;
    }

    const secret =
      this.configService.get<string>('JWT_SECRET') ||
      process.env.JWT_SECRET ||
      'tenant_default_secret';

    const payload = this.jwtService.verify<RealtimeSocketUser>(token, { secret });
    return payload;
  }

  private resolveTenantSlug(client: Socket, user: RealtimeSocketUser): string | null {
    const auth = (client.handshake?.auth || {}) as HandshakeAuth;
    const headers = client.handshake?.headers || {};
    const query = client.handshake?.query || {};

    const fromHandshake =
      auth.tenantSlug ||
      auth.tenantId ||
      auth.tenant ||
      (typeof query.tenant === 'string' ? query.tenant : undefined) ||
      (typeof query.tenantId === 'string' ? query.tenantId : undefined) ||
      (typeof query.tenantSlug === 'string' ? query.tenantSlug : undefined) ||
      (typeof headers['x-tenant'] === 'string' ? headers['x-tenant'] : undefined) ||
      (typeof headers['x-tenant-slug'] === 'string' ? headers['x-tenant-slug'] : undefined);

    const slug = String(fromHandshake || user.tenantId || '')
      .trim()
      .toLowerCase();

    return slug || null;
  }
}
