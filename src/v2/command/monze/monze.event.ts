import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ChannelMessage, Events, TokenSentEvent } from 'mezon-sdk';
import { MezonService } from 'src/v2/mezon/mezon.service';
import { MonzeService } from './monze.service';
import { MessageButtonClickedEvent } from 'src/types/types';

@Injectable()
export class MonzeEvent {
  constructor(
    private readonly monzeService: MonzeService,
    private readonly _: MezonService,
  ) {}

  @OnEvent(Events.ChannelMessage)
  async handleChannelMessage(data: ChannelMessage) {
    if (data.content.t?.startsWith('*monze top10') == true) {
      await this.monzeService.getTop10EthereumTokens(data);
    } else if (data.content.t?.startsWith('*monze balance') == true) {
      await this.monzeService.getBalance(data);
    } else if (data.content.t?.startsWith('*monze priceOf') == true) {
      await this.monzeService.getPriceOfSymbol(data);
    } else if (data.content.t == '*monze') {
      await this.monzeService.introduce(data);
    }
  }

  @OnEvent(Events.ChannelMessage)
  async handleChannelMessageButtonClicked(data: ChannelMessage) {}

  @OnEvent(Events.MessageButtonClicked)
  async handleMessageButtonClicked(data: MessageButtonClickedEvent) {}
}
