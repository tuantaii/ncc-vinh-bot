import { Injectable } from '@nestjs/common';
import { TopupService } from './topup.service';
import { OnEvent } from '@nestjs/event-emitter';
import { ChannelMessage, Events, TokenSentEvent } from 'mezon-sdk';
import { MessageButtonClickedEvent } from './types';
import { MezonService } from 'src/v2/mezon/mezon.service';
@Injectable()
export class TopupEvent {
  constructor(
    private readonly topupService: TopupService,
    private readonly mezon: MezonService,
  ) {}

  @OnEvent(Events.TokenSend)
  async handleTokenCreated(data: TokenSentEvent & { transaction_id: string }) {
    await this.topupService.createToken(data as any);
  }

  @OnEvent(Events.ChannelMessage)
  async handleChannelMessage(data: ChannelMessage) {
    if (data.content.t === '*kttk') {
      await this.topupService.checkBalance(data);
    }
  }

  @OnEvent(Events.ChannelMessage)
  async handleCreateKBB(data: ChannelMessage) {
    if (data.content.t?.startsWith('*kbb')) {
      //filter number in string
      const numberInString = data.content.t.match(/\d+/);
      if (numberInString) {
        const number = parseInt(numberInString[0]);
        if (!isNaN(number)) {
          await this.topupService.createKBB(data, number);
        } else {
          await this.mezon.sendMessage({
            type: 'channel',
            payload: {
              channel_id: data.channel_id,
              message: {
                type: 'system',
                content: 'Số tiền không hợp lệ',
              },
            },
          });
        }
      }
    }
  }

  @OnEvent(Events.ChannelMessage)
  async handleChannelMessageButtonClicked(data: ChannelMessage) {
    if (data.content.t?.startsWith('*rut')) {
      const numberInString = data.content.t.match(/\d+/);
      if (numberInString) {
        const number = parseInt(numberInString[0]);
        if (number) {
          await this.topupService.withdraw(data, number);
        }
      }
    }
  }

  @OnEvent(Events.MessageButtonClicked)
  async handleMessageButtonClicked(data: MessageButtonClickedEvent) {
    await this.topupService.handleMessageButtonClicked(data);
  }
}
