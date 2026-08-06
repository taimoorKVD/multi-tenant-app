import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { EMAIL_JOB_NAME, EMAIL_QUEUE_NAME } from '../mail/constants/mail.constants';
import { EmailJobPayload } from '../mail/interfaces/mail-job.interface';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly redisConnection: IORedis | null;
  private readonly queue: Queue | null;

  constructor() {
    const redisHost = process.env.REDIS_HOST?.trim();
    const redisPort = Number(process.env.REDIS_PORT?.trim() || 6379);
    const redisPassword = process.env.REDIS_PASSWORD?.trim() || undefined;
    const redisUrl = process.env.REDIS_URL?.trim();

    if (!redisUrl && !redisHost) {
      this.redisConnection = null;
      this.queue = null;
      this.logger.log('Redis not configured; queue features disabled');
      return;
    }

    try {
      this.redisConnection = redisUrl
        ? new IORedis(redisUrl, { maxRetriesPerRequest: null, lazyConnect: true })
        : new IORedis({
            host: redisHost,
            port: redisPort,
            password: redisPassword,
            maxRetriesPerRequest: null,
            lazyConnect: true,
          });

      this.queue = new Queue(EMAIL_QUEUE_NAME, {
        connection: this.redisConnection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      });
    } catch (error) {
      this.logger.error('Failed to initialize Redis/Queue', error);
      this.redisConnection = null;
      this.queue = null;
    }
  }

  getConnection(): IORedis | null {
    return this.redisConnection;
  }

  isEnabled(): boolean {
    return Boolean(this.queue);
  }

  async enqueueEmail(payload: EmailJobPayload): Promise<void> {
    if (!this.queue) {
      this.logger.warn('Email not queued: queue is disabled');
      return;
    }

    await this.queue.add(EMAIL_JOB_NAME, payload, {
      jobId: payload.idempotencyKey,
      priority: 1,
    });
  }

  async getHealth() {
    const mode = (process.env.NODE_ENV || 'development').toLowerCase();

    if (!this.queue) {
      return {
        mode,
        queueEnabled: false,
        redisConnected: false,
        counts: {
          waiting: 0,
          active: 0,
          delayed: 0,
          completed: 0,
          failed: 0,
        },
      };
    }

    const pingResponse = await this.redisConnection?.ping();
    const counts = await this.queue.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed');

    return {
      mode,
      queueEnabled: true,
      redisConnected: pingResponse === 'PONG',
      counts,
    };
  }

  async onModuleDestroy() {
    await this.queue?.close();
    await this.redisConnection?.quit();
  }
}