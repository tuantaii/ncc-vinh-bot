import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { ChannelMessage, Events, TokenSentEvent } from 'mezon-sdk';
import {
  MYSELF_COMMAND,
  NHA_CAI,
  OFF_WITHDRAW,
  ON_WITHDRAW,
  PLAY_COMMAND,
  WITHDRAW_COMMAND,
} from './constansts';
import { MessageButtonClickedEvent } from './types';
import {
  SenaGameService,
  SenaMessageService,
  SenaWalletService,
} from './service';

@Injectable()
export class SenaEvent {
  constructor(
    private readonly gameService: SenaGameService,
    private readonly walletService: SenaWalletService,
    private readonly messageService: SenaMessageService,
    @Inject('WITHDRAW_QUEUE') private readonly withdrawQueue: Queue,
    @Inject('DEPOSIT_QUEUE') private readonly depositQueue: Queue,
    @Inject('BUTTON-ACTION_QUEUE') private readonly buttonActionQueue: Queue,
    @Inject('BOT-MESSAGE_QUEUE') private readonly botMessageQueue: Queue,
  ) {}

  @OnEvent(Events.TokenSend)
  async handleTokenCreated(data: TokenSentEvent & { transaction_id: string }) {
    await this.depositQueue.add('deposit', { data });
  }

  @OnEvent(Events.ChannelMessage)
  async handleChannelMessage(data: ChannelMessage) {
    await this.botMessageQueue.add('bot-meesage-queue', data);
  }

  @OnEvent(Events.ChannelMessage)
  async handleChannelMessageButtonClicked(data: ChannelMessage) {
    const cmd = data.content.t?.split(' ')[0];
    if (cmd === PLAY_COMMAND) {
      const numberInString = data.content.t?.match(/\d+/);
      const amount = numberInString ? parseInt(numberInString[0]) : 0;
      await this.gameService.createDeck(data, amount);
    } else if (data.content.t?.startsWith(WITHDRAW_COMMAND)) {
      const numberInString = data.content.t.match(/\d+/);
      if (numberInString) {
        const number = parseInt(numberInString[0]);
        if (number) {
          await this.withdrawQueue.add('withdraw', { data, amount: number });
        }
      }
    } else if (data.content.t === OFF_WITHDRAW) {
      await this.walletService.handleOffWithDraw(data);
    } else if (data.content.t === ON_WITHDRAW) {
      await this.walletService.handleOnWithDraw(data);
    } else if (data.content.t === NHA_CAI) {
      await this.messageService.handleNhacaiCommand(data);
    }
  }

  @OnEvent(Events.MessageButtonClicked)
  async handleMessageButtonClicked(data: MessageButtonClickedEvent) {
    this.buttonActionQueue.add('button-action-queue', data);
  }
}
