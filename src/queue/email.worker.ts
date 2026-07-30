import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { EMAIL_QUEUE_NAME } from '../mail/constants/mail.constants';
import { EmailJobPayload } from '../mail/interfaces/mail-job.interface';
import { EmailDispatchService } from './email-dispatch.service';
import { QueueService } from './queue.service';

@Injectable()
export class EmailWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailWorker.name);
  private worker: Worker | null = null;

  constructor(
    private readonly queueService: QueueService,
    private readonly emailDispatchService: EmailDispatchService,
  ) {}

  onModuleInit() {
    const connection = this.queueService.getConnection();

    if (!connection) {
      this.logger.log('Redis connection unavailable; email worker disabled');
      return;
    }

    try {
      this.worker = new Worker<EmailJobPayload>(
        EMAIL_QUEUE_NAME,
        async (job) => {
          const maxAttempts = Number(job.opts.attempts || 3);
          return this.emailDispatchService.dispatch(job.data, job.attemptsMade + 1, maxAttempts);
        },
        {
          connection: connection as IORedis,
          concurrency: Number(process.env.EMAIL_QUEUE_CONCURRENCY || 5),
          limiter: {
            max: Number(process.env.EMAIL_QUEUE_RATE_LIMIT_MAX || 25),
            duration: Number(process.env.EMAIL_QUEUE_RATE_LIMIT_DURATION || 1000),
          },
        },
      );

      this.worker.on('failed', (job, error) => {
        this.logger.error(
          `Email job ${job?.id || 'unknown'} failed on attempt ${job?.attemptsMade || 0}: ${error.message}`,
        );
      });
    } catch (error) {
      this.logger.error('Failed to create email worker', error);
      this.worker = null;
    }
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  getStatus() {
    return {
      running: Boolean(this.worker),
      workerEnabled: Boolean(this.queueService.getConnection()),
    };
  }
}