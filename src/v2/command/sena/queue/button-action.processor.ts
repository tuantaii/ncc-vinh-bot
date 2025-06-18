import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Job, QueueOptions, Worker } from 'bullmq';
import Redis from 'ioredis';
import { SenaGameService } from '../service';
import { MessageButtonClickedEvent } from '../types';

@Injectable()
export class ButtonActionProcessor implements OnModuleInit {
  private worker: Worker;

  constructor(
    private readonly gameService: SenaGameService,
    @Inject('RedisClient') private readonly redis: Redis,
  ) {}
  onModuleInit() {
    const connection = this.redis.duplicate();
    this.worker = new Worker(
      'button-action-queue',
      async (job: Job) => {
        const data: MessageButtonClickedEvent = job.data;
        await this.gameService.handleButtonClicked(data);
      },
      { connection } as QueueOptions,
    );
  }
}
