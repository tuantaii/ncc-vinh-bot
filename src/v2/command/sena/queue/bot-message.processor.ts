import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Job, QueueOptions, Worker } from 'bullmq';
import Redis from 'ioredis';
import {
  CHECK_BALANCE_COMMAND,
  CHECK_TRANSACTION_COMMAND,
  CHECK_TRANSACTION_SEND_COMMAND,
  gameMessages,
  HELP_COMMAND,
  MYSELF_COMMAND,
  STATISTICS_COMMAND,
  VALID_COMMANDS,
} from '../constansts';
import {
  SenaGameService,
  SenaMessageService,
  SenaTransactionService,
  SenaWalletService,
} from '../service';
import { suggestCommand } from '../ultis';

@Injectable()
export class BotMessageProcessor implements OnModuleInit {
  private worker: Worker;
  constructor(
    private readonly messageService: SenaMessageService,
    private readonly walletService: SenaWalletService,
    private readonly gameService: SenaGameService,
    @Inject('RedisClient') private readonly redis: Redis,
    private readonly transactionService: SenaTransactionService,
  ) {}

  private async handleUnknownCommand(data: {
    content: { t: string };
    channel_id: string;
    message_id: string;
  }) {
    if (!data.content.t.startsWith('*')) {
      return;
    }

    const inputCmd = data.content.t.split(' ')[0];
    if (VALID_COMMANDS.includes(inputCmd)) {
      return;
    }

    const suggestions = suggestCommand(inputCmd);

    let message: string;

    if (suggestions.length === 1) {
      message = `error: '${inputCmd}' is not a command. See '*alo'.\nDid you mean this?\n\t${suggestions[0]}`;
    } else if (suggestions.length > 1) {
      message = `error: '${inputCmd}' is not a command. See '*alo'.\nDid you mean one of these?\n${suggestions
        .map((s) => `\t${s}`)
        .join('\n')}`;
    } else {
      message = `error: '${inputCmd}' is not a command. See '*alo' for a list of available commands`;
    }

    await this.messageService['sendSystemMessage'](
      data.channel_id,
      message,
      data.message_id,
    );
  }

  onModuleInit() {
    const connection = this.redis.duplicate();
    this.worker = new Worker(
      'bot-meesage-queue',
      async (job: Job) => {
        const data = job.data;
        if (data.content.t === CHECK_BALANCE_COMMAND) {
          await this.walletService.checkBalance(data);
        } else if (data.content.t === MYSELF_COMMAND) {
          await this.messageService.introduce(data);
        } else if (data.content.t?.startsWith(CHECK_TRANSACTION_COMMAND)) {
          await this.transactionService.checkTransaction(data);
        } else if (data.content.t?.startsWith(CHECK_TRANSACTION_SEND_COMMAND)) {
          await this.transactionService.checkTransactionSend(data);
        } else if (data.content.t === HELP_COMMAND) {
          await this.messageService.handleHDSD(data);
        } else if (data.content.t === STATISTICS_COMMAND) {
          await this.messageService.handleTop10(data);
        } else if (data.content.t) {
          await this.handleUnknownCommand(data);
        }
      },
      { connection } as QueueOptions,
    );
  }
}
