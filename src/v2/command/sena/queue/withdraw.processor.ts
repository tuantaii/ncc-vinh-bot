import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Job, QueueOptions, Worker } from 'bullmq';
import Redis from 'ioredis';
import { SenaService } from '../sena.service';

@Injectable()
export class WithdrawProcessor implements OnModuleInit {
  private worker: Worker;

  constructor(
    private readonly senaService: SenaService,
    @Inject('RedisClient') private readonly redis: Redis,
  ) {}

  onModuleInit() {
    const connection = this.redis.duplicate();
    this.worker = new Worker(
      'withdraw-queue',
      async (job: Job) => {
        const { data, amount } = job.data;
        await this.senaService.withdraw(data, amount);
      },
      {
        connection,
      } as QueueOptions,
    );
  }
}
