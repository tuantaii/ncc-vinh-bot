import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Job, QueueOptions, Worker } from 'bullmq';
import Redis from 'ioredis';
import { SenaWalletService } from '../service';

@Injectable()
export class WithdrawProcessor implements OnModuleInit {
  private worker: Worker;

  constructor(
    private readonly walletService: SenaWalletService,
    @Inject('RedisClient') private readonly redis: Redis,
  ) {}

  onModuleInit() {
    const connection = this.redis.duplicate();
    this.worker = new Worker(
      'withdraw-queue',
      async (job: Job) => {
        const { data, amount } = job.data;
        await this.walletService.withdraw(data, amount);
      },
      {
        connection,
      } as QueueOptions,
    );
  }
}
