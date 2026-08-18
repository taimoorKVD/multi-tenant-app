import { Injectable, InternalServerErrorException, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { EMAIL_JOB_NAME, EMAIL_QUEUE_NAME } from '../mail/constants/mail.constants';
import { EmailJobPayload } from '../mail/interfaces/mail-job.interface';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly redisConnection: IORedis | null;
  private readonly queue: Queue | null;

  constructor() {
    this.redisConnection = null;
    this.queue = null;
    return;
    // const isDevelopment = (process.env.NODE_ENV || 'development').toLowerCase() === 'development';
    // if (isDevelopment) {
    //   this.redisConnection = null;
    //   this.queue = null;
    //   return;
    // }

    // const host = process.env.REDIS_HOST || '127.0.0.1';
    // const port = Number(process.env.REDIS_PORT || 6379);
    // const password = process.env.REDIS_PASSWORD || undefined;
    // const url = process.env.REDIS_URL;

    // this.redisConnection = url
    //   ? new IORedis(url, { maxRetriesPerRequest: null })
    //   : new IORedis({
    //       host,
    //       port,
    //       password,
    //       maxRetriesPerRequest: null,
    //     });

    // this.queue = new Queue(EMAIL_QUEUE_NAME, {
    //   connection: this.redisConnection,
    //   defaultJobOptions: {
    //     attempts: 3,
    //     backoff: {
    //       type: 'exponential',
    //       delay: 5000,
    //     },
    //     removeOnComplete: 100,
    //     removeOnFail: 100,
    //   },
    // });
  }

  getConnection(): IORedis {
    if (!this.redisConnection) {
      throw new InternalServerErrorException('Redis connection is not available.');
    }

    return this.redisConnection;
  }

  isEnabled(): boolean {
    return Boolean(this.queue);
  }

  async enqueueEmail(payload: EmailJobPayload): Promise<void> {
    if (!this.queue) {
      throw new InternalServerErrorException('Email queue is not initialized.');
    }

    return this.queue.add(EMAIL_JOB_NAME, payload, {
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