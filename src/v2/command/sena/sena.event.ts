import { Inject, Injectable } from '@nestjs/common';
import { SenaService } from './sena.service';
import { OnEvent } from '@nestjs/event-emitter';
import { ChannelMessage, Events, TokenSentEvent } from 'mezon-sdk';
import { MessageButtonClickedEvent } from './types';
import { MezonService } from 'src/v2/mezon/mezon.service';
import {
  CHECK_BALANCE_COMMAND,
  MYSELF_COMMAND,
  WITHDRAW_COMMAND,
  PLAY_COMMAND,
  CHECK_TRANSACTION_COMMAND,
  CHECK_TRANSACTION_SEND_COMMAND,
  HELP_COMMAND,
  STATISTICS_COMMAND,
} from './constansts';
import { EMessagePayloadType, EMessageType } from 'src/v2/mezon/types/mezon';
import { Queue } from 'bullmq';

@Injectable()
export class SenaEvent {
  constructor(
    private readonly senaService: SenaService,
    private readonly mezon: MezonService,
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
    if (data.content.t?.startsWith(PLAY_COMMAND)) {
      const numberInString = data.content.t.match(/\d+/);
      const amount = numberInString ? parseInt(numberInString[0]) : 0;
      await this.senaService.createDeck(data, amount);
    } else if (data.content.t?.startsWith(WITHDRAW_COMMAND)) {
      const numberInString = data.content.t.match(/\d+/);
      if (numberInString) {
        const number = parseInt(numberInString[0]);
        if (number) {
          await this.withdrawQueue.add('withdraw', { data, amount: number });
        }
      }
    }
  }

  @OnEvent(Events.MessageButtonClicked)
  async handleMessageButtonClicked(data: MessageButtonClickedEvent) {
    this.buttonActionQueue.add('button-action-queue', data);
  }
}
