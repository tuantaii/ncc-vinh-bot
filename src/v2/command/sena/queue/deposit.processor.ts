import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Job, QueueOptions, Worker } from 'bullmq';
import Redis from 'ioredis';
import { SenaService } from '../sena.service';

@Injectable()
export class DepositProcessor implements OnModuleInit {
  private worker: Worker;

  constructor(
    private readonly senaService: SenaService,
    @Inject('RedisClient') private readonly redis: Redis,
  ) {}

  onModuleInit() {
    const connection = this.redis.duplicate();
    this.worker = new Worker(
      'deposit-queue',
      async (job: Job) => {
        const { data } = job.data;
        await this.senaService.createToken(data);
      },
      {
        connection,
      } as QueueOptions,
    );
  }
}
