import { Injectable } from '@nestjs/common';
import {
  BlackJackGame,
  EJackGameStatus,
  ETransactionType,
} from '@prisma/client';
import { RedisRepository } from 'src/core/redis/redis.repo';
import { PrismaService } from 'src/prisma/prisma.service';
import { MezonService } from 'src/v2/mezon/mezon.service';
import { EMessagePayloadType, EMessageType } from 'src/v2/mezon/types/mezon';
import {
  BLOCK_WITHDRAW_KEY,
  EMPTY_BALANCE_MESSAGES,
  GAME_RESULT,
  WR_SYSTEM,
} from '../constansts';
import { SenaCaculator } from '../ultis';
import { SenaMessageService } from './sena-message.service';
import { v4 as uuidv4 } from 'uuid';
import { random } from 'src/common/utils/helper';
import { ChannelMessage, TokenSentEvent } from 'mezon-sdk';
import { Game } from '../game';

@Injectable()
export class SenaWalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messageService: SenaMessageService,
    private readonly redisRepository: RedisRepository,
    private readonly mezon: MezonService,
  ) {}

  async withdraw(data: ChannelMessage, amount: number) {
    const isBlocked = await this.redisRepository.get(
      WR_SYSTEM,
      BLOCK_WITHDRAW_KEY,
    );
    const content = 'Chức năng rút tiền đang bị khóa. Vui lòng thử lại sau!';
    if (isBlocked) {
      await this.messageService.sendSystemMessage(
        data.channel_id,
        content,
        data.message_id,
      );
      return;
    }

    const isPlayingGame = await this.prisma.blackJackGame.findFirst({
      where: {
        OR: [{ hostId: data.sender_id }, { guestId: data.sender_id }],
        status: {
          in: [EJackGameStatus.PLAYING, EJackGameStatus.WAITING],
        },
      },
    });

    if (isPlayingGame) {
      const message =
        '💸 Bạn đang chơi game, không thể rút tiền, tính trốn à?????';
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
      return;
    }

    const userBalance = await this.prisma.userBalance.findUnique({
      where: {
        userId: data.sender_id,
      },
    });
    if (!userBalance || userBalance.balance < amount || amount <= 0) {
      const message = `💸 Số dư của bạn không đủ để rút hoặc số tiền rút không hợp lệ, bạn hãy kiểm tra lại số tiền`;
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
      return;
    }
    const transactionId = uuidv4();
    try {
      await this.mezon.sendToken({
        user_id: data.sender_id,
        amount: amount,
        note: `Rút ${SenaCaculator.formatVND(amount)} token`,
      });

      await this.prisma.$transaction(async (tx) => {
        await tx.userBalance.update({
          where: {
            userId: data.sender_id,
          },
          data: {
            balance: {
              decrement: amount,
            },
          },
        });
        await tx.transactionLogs.create({
          data: {
            userId: data.sender_id,
            amount: amount,
            type: ETransactionType.WITHDRAW,
            transactionId,
          },
        });
      });

      const message = `💸 Rút ${SenaCaculator.formatVND(amount)} token thành công`;
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
      console.log('transfer balance is successfully');
    } catch (error) {
      await this.mezon.sendMessage({
        type: EMessageType.CHANNEL,
        reply_to_message_id: data.message_id,
        payload: {
          channel_id: data.channel_id,
          message: {
            type: EMessagePayloadType.SYSTEM,
            content: `Rút tiền không thành công, sena đang quá tải. Vui lòng kiểm tra lại tài khoản nếu có mất tiền xin liên hệ với đội IT để được hỗ trợ`,
          },
        },
      });
      console.log('error', error);
    }
  }

  async createToken(data: TokenSentEvent & { transaction_id: string }) {
    const transactionId = data.transaction_id;
    try {
      const check = await this.prisma.transactionLogs.findFirst({
        where: {
          transactionId,
        },
      });
      if (check || !data.sender_id) return;
      await Promise.all([
        this.prisma.$transaction(async (tx) => {
          const userBalance = await tx.userBalance.findUnique({
            where: {
              userId: data.sender_id,
            },
          });
          if (!userBalance) {
            await tx.userBalance.create({
              data: {
                userId: data.sender_id!,
                balance: data.amount,
                username: data.sender_name!,
              },
            });
            await tx.transactionLogs.create({
              data: {
                transactionId,
                userId: data.sender_id!,
                amount: data.amount,
              },
            });
          } else {
            await tx.userBalance.update({
              where: {
                userId: data.sender_id!,
              },
              data: {
                balance: {
                  increment: data.amount,
                },
              },
            });
            await tx.transactionLogs.create({
              data: {
                transactionId,
                userId: data.sender_id!,
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

  async checkBalance(data: ChannelMessage) {
    const userBalance = await this.prisma.userBalance.findUnique({
      where: {
        userId: data.sender_id,
      },
    });
    if (!userBalance) {
      const message = random(EMPTY_BALANCE_MESSAGES);
      await this.messageService.sendSystemMessage(
        data.channel_id,
        message,
        data.message_id,
      );
    } else {
      const message = `💸 Số dư của bạn là ${SenaCaculator.formatVND(userBalance.balance)} token`;
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
  }

  async handleOnWithDraw(data: ChannelMessage) {
    if (data.sender_id !== '1930090353453436928') {
      await this.mezon.sendMessage({
        type: EMessageType.CHANNEL,
        reply_to_message_id: data.message_id,
        payload: {
          channel_id: data.channel_id,
          message: {
            type: EMessagePayloadType.SYSTEM,
            content: 'Chỉ có người được chọn mới có thể mở chức năng rút tiền.',
          },
        },
      });
      return;
    }

    await this.redisRepository.delete(WR_SYSTEM, BLOCK_WITHDRAW_KEY);
    await this.mezon.sendMessage({
      type: EMessageType.CHANNEL,
      reply_to_message_id: data.message_id,
      payload: {
        channel_id: data.channel_id,
        message: {
          type: EMessagePayloadType.SYSTEM,
          content: 'Đã mở lại chức năng rút tiền.',
        },
      },
    });
  }

  async handleOffWithDraw(data: ChannelMessage) {
    await this.redisRepository.set(WR_SYSTEM, BLOCK_WITHDRAW_KEY, '1');
    await this.mezon.sendMessage({
      type: EMessageType.CHANNEL,
      reply_to_message_id: data.message_id,
      payload: {
        channel_id: data.channel_id,
        message: {
          type: EMessagePayloadType.SYSTEM,
          content: 'Đã tạm khóa chức năng rút tiền.',
        },
      },
    });
  }

  async refundedLock(record: BlackJackGame, totalLock: number) {
    try {
      await this.prisma.$transaction(async (tx) => {
        await Promise.all([
          tx.userBalance.update({
            where: { userId: record.hostId },
            data: { balance: { increment: totalLock } },
          }),
          tx.userBalance.update({
            where: { userId: record.guestId },
            data: { balance: { increment: totalLock } },
          }),
          tx.transactionLogs.create({
            data: {
              transactionId: `refund_${record.id}_${Date.now()}`,
              userId: record.hostId,
              amount: totalLock,
              type: ETransactionType.REFUND,
            },
          }),
          tx.transactionLogs.create({
            data: {
              transactionId: `refund_${record.id}_${Date.now()}`,
              userId: record.guestId,
              amount: totalLock,
              type: ETransactionType.REFUND,
            },
          }),
        ]);
      });
    } catch (refundError) {
      console.error('Error refunding lock:', refundError);
      await this.mezon.sendMessage({
        type: EMessageType.CHANNEL,
        payload: {
          channel_id: record.channelId,
          message: {
            type: EMessagePayloadType.SYSTEM,
            content:
              'Lỗi hoàn tiền lock, vui lòng liên hệ admin để được hỗ trợ!',
          },
        },
      });
    }
  }

  async updateUserBalanceAfterGame(game: Game, result: GAME_RESULT) {
    const multiplier = SenaCaculator.getRewardMultiplier(game, result);
    const reward = game.cost * multiplier;
    const totalLock = game.cost * 3;

    let hostChange = 0;
    let guestChange = 0;

    if (result === GAME_RESULT.DRAW) {
      hostChange = totalLock;
      guestChange = totalLock;
    } else if (result === GAME_RESULT.HOST_WIN) {
      hostChange = totalLock + reward;
      guestChange = totalLock - reward;
    } else if (result === GAME_RESULT.GUEST_WIN) {
      hostChange = totalLock - reward;
      guestChange = totalLock + reward;
    }

    try {
      const balancePromises = [
        this.prisma.userBalance.update({
          where: { userId: game.hostId },
          data: { balance: { increment: hostChange } },
        }),
        this.prisma.userBalance.update({
          where: { userId: game.guestId },
          data: { balance: { increment: guestChange } },
        }),
      ];

      const logPromises: Promise<any>[] = [];

      if (result === GAME_RESULT.HOST_WIN) {
        logPromises.push(
          this.prisma.transactionSendLogs.create({
            data: {
              userId: game.hostId,
              toUserId: game.guestId,
              amount: reward,
              note: 'win blackjack',
            },
          }),
        );
      } else if (result === GAME_RESULT.GUEST_WIN) {
        logPromises.push(
          this.prisma.transactionSendLogs.create({
            data: {
              userId: game.guestId,
              toUserId: game.hostId,
              amount: reward,
              note: 'win blackjack',
            },
          }),
        );
      }

      await Promise.all([...balancePromises, ...logPromises]);
      console.log('✅ Balance updated and win log recorded');
    } catch (err) {
      console.error('❌ Error updating balance or logging win:', err);
    }
  }
}
