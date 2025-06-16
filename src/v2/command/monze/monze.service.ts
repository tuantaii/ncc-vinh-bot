import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ChannelMessage } from 'mezon-sdk';
import { MezonService } from 'src/v2/mezon/mezon.service';

import {
  EMessagePayloadType,
  EMessageType,
  MessageButtonClickedEvent,
} from 'src/types/types';
import { CoingeckoService } from 'src/v2/coingecko/coingecko.service';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class MonzeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mezon: MezonService,
    private readonly coingecko: CoingeckoService,
  ) {}

  async getBalance(data: ChannelMessage) {
    const res = await this.coingecko.getEthBalance(
      '0xcEe6FeBe294D5591ed3ec94EBfcE35067cBA901F',
    );

    const message = `👋Bạn đang có ${res.balance} ETH`;
    await this.mezon.sendMessage({
      type: EMessageType.CHANNEL,
      reply_to_message_id: data.message_id,
      payload: {
        channel_id: data.channel_id,
        message: {
          type: EMessagePayloadType.SYSTEM,
          content: message,
        },
      },
    });
  }

  async introduce(data: ChannelMessage) {
    const message = `👋Chào các anh em, tao là Monze. Hãy lưu address của bạn bằng cách *monze add 'address'`;
    await this.mezon.sendMessage({
      type: EMessageType.CHANNEL,
      reply_to_message_id: data.message_id,
      payload: {
        channel_id: data.channel_id,
        message: {
          type: EMessagePayloadType.SYSTEM,
          content: message,
        },
      },
    });
  }

  async ping(data: ChannelMessage) {
    await this.mezon.sendMessage({
      type: EMessageType.CHANNEL,
      reply_to_message_id: data.message_id,
      payload: {
        channel_id: data.channel_id,
        message: {
          type: EMessagePayloadType.NORMAL_TEXT,
          content: 'PONG',
        },
      },
    });
  }

  async getTop10EthereumTokens(data: ChannelMessage) {
    try {
      const result = await this.coingecko.getTop10EthereumTokens();
      console.log({ result });
      const message = result
        .map(
          (token, i) =>
            `${i + 1}. ${token.name} (${token.symbol.toUpperCase()}): $${token.price_usd} USD`,
        )
        .join('\n');
      await this.mezon.sendMessage({
        type: EMessageType.CHANNEL,
        reply_to_message_id: data.message_id,
        payload: {
          channel_id: data.channel_id,
          message: {
            type: EMessagePayloadType.SYSTEM,
            content: message,
          },
        },
      });
    } catch (error) {
      console.error('Error fetching token data:', error.message);
    }
  }

  async getPriceOfSymbol(data: ChannelMessage) {
    try {
      const splitedText = data.content.t?.split(' ') ?? [];
      if (splitedText.length >= 3) {
        const symbol = splitedText[2];
        const price = await this.coingecko.getTokenPrice(symbol);
        await this.mezon.sendMessage({
          type: EMessageType.CHANNEL,
          reply_to_message_id: data.message_id,
          payload: {
            channel_id: data.channel_id,
            message: {
              type: EMessagePayloadType.SYSTEM,
              content: `${price.symbol} đang có giá ${price.usd} USD`,
            },
          },
        });
      } else throw NotFoundException;
    } catch (error) {
      await this.mezon.sendMessage({
        type: EMessageType.CHANNEL,
        reply_to_message_id: data.message_id,
        payload: {
          channel_id: data.channel_id,
          message: {
            type: EMessagePayloadType.SYSTEM,
            content: 'Wrong Syntax Or Symbol Not Found',
          },
        },
      });
    }
  }
}
