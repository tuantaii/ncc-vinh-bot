import { Module } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { RedisModule } from 'src/core/redis/redis.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MezonModule } from 'src/v2/mezon/mezon.module';
import {
  BotMessageProcessor,
  ButtonActionProcessor,
  DepositProcessor,
  WithdrawProcessor,
} from './queue';
import { SenaEvent } from './sena.event';
import { SenaChedule } from './ultis';
import {
  SenaGameService,
  SenaMessageService,
  SenaTransactionService,
  SenaWalletService,
} from './service';

@Module({
  imports: [PrismaModule, MezonModule, RedisModule],
  providers: [
    SenaEvent,
    WithdrawProcessor,
    DepositProcessor,
    ButtonActionProcessor,
    BotMessageProcessor,
    SenaChedule,
    SenaTransactionService,
    SenaMessageService,
    SenaGameService,
    SenaWalletService,
    {
      provide: 'DEPOSIT_QUEUE',
      useFactory: (redis: Redis) => {
        return new Queue('deposit-queue', {
          connection: redis.duplicate(),
        });
      },
      inject: ['RedisClient'],
    },
    {
      provide: 'WITHDRAW_QUEUE',
      useFactory: (redis: Redis) => {
        return new Queue('withdraw-queue', {
          connection: redis.duplicate(),
        });
      },
      inject: ['RedisClient'],
    },
    {
      provide: 'BUTTON-ACTION_QUEUE',
      useFactory: (redis: Redis) => {
        return new Queue('button-action-queue', {
          connection: redis.duplicate(),
        });
      },
      inject: ['RedisClient'],
    },
    {
      provide: 'BOT-MESSAGE_QUEUE',
      useFactory: (redis: Redis) => {
        return new Queue('bot-meesage-queue', {
          connection: redis.duplicate(),
        });
      },
      inject: ['RedisClient'],
    },
  ],
  exports: [
    SenaEvent,
    SenaWalletService,
    SenaGameService,
    SenaTransactionService,
    SenaMessageService,
  ],
})
export class SenaModule {}
