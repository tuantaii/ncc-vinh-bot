import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { SenaService } from '../sena.service';
import Redis from 'ioredis';
import { Job, QueueOptions, Worker } from 'bullmq';
import {
  CHECK_BALANCE_COMMAND,
  CHECK_TRANSACTION_COMMAND,
  CHECK_TRANSACTION_SEND_COMMAND,
  HELP_COMMAND,
  MYSELF_COMMAND,
  STATISTICS_COMMAND,
} from '../constansts';

@Injectable()
export class BotMessageProcessor implements OnModuleInit {
  private worker: Worker;
  constructor(
    private readonly senaService: SenaService,
    @Inject('RedisClient') private readonly redis: Redis,
  ) {}
  onModuleInit() {
    const connection = this.redis.duplicate();
    this.worker = new Worker(
      'bot-meesage-queue',
      async (job: Job) => {
        const data = job.data;
        if (data.content.t === CHECK_BALANCE_COMMAND) {
          await this.senaService.checkBalance(data);
        } else if (data.content.t === MYSELF_COMMAND) {
          await this.senaService.introduce(data);
        } else if (data.content.t?.startsWith(CHECK_TRANSACTION_COMMAND)) {
          await this.senaService.checkTransaction(data);
        } else if (data.content.t?.startsWith(CHECK_TRANSACTION_SEND_COMMAND)) {
          await this.senaService.checkTransactionSend(data);
        } else if (data.content.t === HELP_COMMAND) {
          await this.senaService.handleHDSD(data);
        } else if (data.content.t === STATISTICS_COMMAND) {
          await this.senaService.handleTop10(data);
        }
      },
      { connection } as QueueOptions,
    );
  }
}
