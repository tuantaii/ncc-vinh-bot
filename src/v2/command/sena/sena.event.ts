import { Injectable } from '@nestjs/common';
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
} from './constansts';
import { EMessagePayloadType, EMessageType } from 'src/v2/mezon/types/mezon';

@Injectable()
export class SenaEvent {
  constructor(
    private readonly senaService: SenaService,
    private readonly mezon: MezonService,
  ) {}

  @OnEvent(Events.TokenSend)
  async handleTokenCreated(data: TokenSentEvent & { transaction_id: string }) {
    await this.senaService.createToken(data as any);
  }

  @OnEvent(Events.ChannelMessage)
  async handleChannelMessage(data: ChannelMessage) {
    if (data.content.t === CHECK_BALANCE_COMMAND) {
      await this.senaService.checkBalance(data);
    } else if (data.content.t === MYSELF_COMMAND) {
      await this.senaService.introduce(data);
    }
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
          await this.senaService.withdraw(data, number);
        }
      }
    }
  }

  @OnEvent(Events.MessageButtonClicked)
  async handleMessageButtonClicked(data: MessageButtonClickedEvent) {
    this.senaService.handleButtonClicked(data);
  }
}
