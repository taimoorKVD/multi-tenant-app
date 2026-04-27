import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
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
    if ((process.env.NODE_ENV || 'development').toLowerCase() === 'development') {
      return;
    }

    this.worker = new Worker<EmailJobPayload>(
      EMAIL_QUEUE_NAME,
      async (job) => {
        const maxAttempts = Number(job.opts.attempts || 3);
        return this.emailDispatchService.dispatch(job.data, job.attemptsMade + 1, maxAttempts);
      },
      {
        connection: this.queueService.getConnection(),
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
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  getStatus() {
    return {
      running: Boolean(this.worker),
      workerEnabled: (process.env.NODE_ENV || 'development').toLowerCase() !== 'development',
    };
  }
}