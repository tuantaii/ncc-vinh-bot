import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MessageButtonClickedEvent, TokenSentEventI } from './types';
import {
  ChannelMessage,
  EButtonMessageStyle,
  EMessageComponentType,
} from 'mezon-sdk';
import { ETransactionType } from '@prisma/client';
import { MezonService } from 'src/v2/mezon/mezon.service';
import { TokenSentEvent } from 'mezon-sdk';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class SenaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mezon: MezonService,
  ) {}

  async introduce(data: ChannelMessage) {
    const message = `👋Chào bạn, tôi là Sena, một bot hỗ trợ cho bạn trong việc quản lý token và chơi game Jackpot.`;
    await this.mezon.sendMessage({
      type: 'channel',
      reply_to_message_id: data.message_id,
      payload: {
        channel_id: data.channel_id,
        message: {
          type: 'normal_text',
          content: message,
        },
      },
    });
  }

  async createToken(data: TokenSentEvent & { transaction_id: string }) {
    const transactionId = data.transaction_id;
    try {
      const check = await this.prisma.transaction_logs.findFirst({
        where: {
          transaction_id: transactionId,
        },
      });
      if (check || !data.sender_id) return;
      await Promise.all([
        this.prisma.$transaction(async (tx) => {
          const userBalance = await tx.user_balance.findUnique({
            where: {
              user_id: data.sender_id,
            },
          });
          if (!userBalance) {
            await tx.user_balance.create({
              data: {
                user_id: data.sender_id!,
                balance: data.amount,
                username: data.sender_name!,
              },
            });
            await tx.transaction_logs.create({
              data: {
                transaction_id: transactionId,
                user_id: data.sender_id!,
                amount: data.amount,
              },
            });
          } else {
            await tx.user_balance.update({
              where: {
                user_id: data.sender_id!,
              },
              data: {
                balance: {
                  increment: data.amount,
                },
              },
            });
            await tx.transaction_logs.create({
              data: {
                transaction_id: transactionId,
                user_id: data.sender_id!,
                amount: data.amount,
              },
            });
          }
        }),
      ]);
    } catch (error) {
      console.log(error);
    }
  }

  async ping(data: ChannelMessage) {
    await this.mezon.sendMessage({
      type: 'channel',
      reply_to_message_id: data.message_id,
      payload: {
        channel_id: data.channel_id,
        message: {
          type: 'normal_text',
          content: 'PONG',
        },
      },
    });
  }

  async checkBalance(data: ChannelMessage) {
    const userBalance = await this.prisma.user_balance.findUnique({
      where: {
        user_id: data.sender_id,
      },
    });
    if (!userBalance) {
      const message = `Nghèo, kiếm thêm tiền để donate cho tao`;
      await this.mezon.sendMessage({
        type: 'channel',
        reply_to_message_id: data.message_id,
        payload: {
          channel_id: data.channel_id,
          message: {
            type: 'system',
            content: message,
          },
        },
      });
    } else {
      const message = `💸Số dư của bạn là ${userBalance.balance} token`;
      await this.mezon.sendMessage({
        type: 'channel',
        reply_to_message_id: data.message_id,
        payload: {
          channel_id: data.channel_id,
          message: {
            type: 'system',
            content: message,
          },
        },
      });
    }
  }

  async withdraw(data: ChannelMessage, amount: number) {
    const userBalance = await this.prisma.user_balance.findUnique({
      where: {
        user_id: data.sender_id,
      },
    });
    if (!userBalance || userBalance.balance < amount || amount < 1000) {
      const message = `💸Số dư của bạn không đủ để rút hoặc số tiền rút không hợp lệ`;
      await this.mezon.sendMessage({
        type: 'channel',
        reply_to_message_id: data.message_id,
        payload: {
          channel_id: data.channel_id,
          message: {
            type: 'system',
            content: message,
          },
        },
      });
    } else {
      //check

      await this.prisma.$transaction(async (tx) => {
        await tx.user_balance.update({
          where: {
            user_id: data.sender_id,
          },
          data: {
            balance: {
              decrement: amount,
            },
          },
        });
        await tx.transaction_logs.create({
          data: {
            user_id: data.sender_id,
            amount: amount,
            type: ETransactionType.WITHDRAW,
          },
        });
      });
      await this.mezon.sendToken({
        user_id: data.sender_id,
        amount: amount,
        note: `Rút ${amount} token`,
      });
      const message = `💸Rút ${amount} token thành công`;
      await this.mezon.sendMessage({
        type: 'channel',
        reply_to_message_id: data.message_id,
        payload: {
          channel_id: data.channel_id,
          message: {
            type: 'system',
            content: message,
          },
        },
      });
    }
  }
}
