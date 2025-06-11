import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Job, QueueOptions, Worker } from 'bullmq';
import Redis from 'ioredis';
import { SenaService } from '../sena.service';
import { MessageButtonClickedEvent } from '../types';

@Injectable()
export class ButtonActionProcessor implements OnModuleInit {
  private worker: Worker;

  constructor(
    private readonly senaService: SenaService,
    @Inject('RedisClient') private readonly redis: Redis,
  ) {}
  onModuleInit() {
    const connection = this.redis.duplicate();
    this.worker = new Worker(
      'button-action-queue',
      async (job: Job) => {
        const data: MessageButtonClickedEvent = job.data;
        await this.senaService.handleButtonClicked(data);
      },
      { connection } as QueueOptions,
    );
  }
}
