import { Injectable } from '@nestjs/common';
import {
  BlackJackGame,
  EJackGameStatus,
  ETransactionType,
} from '@prisma/client';
import {
  ChannelMessage,
  EButtonMessageStyle,
  EMessageComponentType,
  TokenSentEvent,
} from 'mezon-sdk';
import { EMessageMode } from 'src/common/enums/mezon.enum';
import { random } from 'src/common/utils/helper';
import { PrismaService } from 'src/prisma/prisma.service';
import { MezonService } from 'src/v2/mezon/mezon.service';
import { EMessagePayloadType, EMessageType } from 'src/v2/mezon/types/mezon';
import { v4 as uuidv4 } from 'uuid';
import {
  BLOCK_WITHDRAW_KEY,
  EMPTY_BALANCE_MESSAGES,
  GAME_RESULT,
  gameMessages,
  HDSD,
  MAX_CARDS,
  MIN_SCORE,
  WR_SYSTEM,
} from './constansts';
import { Game } from './game';
import { MessageButtonClickedEvent } from './types';
import { GameMetadata } from './types/game';
import { ButtonKey, SenaCaculator } from './ultis';
import { RedisRepository } from 'src/core/redis/redis.repo';

@Injectable()
export class SenaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mezon: MezonService,
    private readonly redisRepository: RedisRepository,
  ) {}
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async sendSystemMessage(
    channel_id: string,
    content: string,
    reply_to_message_id?: string,
  ) {
    return this.mezon.sendMessage({
      type: EMessageType.CHANNEL,
      reply_to_message_id,
      payload: {
        channel_id,
        message: {
          type: EMessagePayloadType.SYSTEM,
          content,
        },
      },
    });
  }

  private async updateSystemMessage(
    channel_id: string,
    message_id: string,
    content: string,
  ) {
    return this.mezon.updateMessage({
      channel_id,
      message_id,
      content: {
        type: EMessagePayloadType.SYSTEM,
        content,
      },
    });
  }

  async introduce(data: ChannelMessage) {
    const message = `👋 Chào nợ tộc, tao là Sena, thằng nào có tiền thì donate cho tao.`;
    await this.sendSystemMessage(data.channel_id, message, data.message_id);
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

  async checkBalance(data: ChannelMessage) {
    const userBalance = await this.prisma.userBalance.findUnique({
      where: {
        userId: data.sender_id,
      },
    });
    if (!userBalance) {
      const message = random(EMPTY_BALANCE_MESSAGES);
      await this.sendSystemMessage(data.channel_id, message, data.message_id);
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

  async withdraw(data: ChannelMessage, amount: number) {
    const isBlocked = await this.redisRepository.get(
      WR_SYSTEM,
      BLOCK_WITHDRAW_KEY,
    );
    const content = 'Chức năng rút tiền đang bị khóa. Vui lòng thử lại sau!';
    if (isBlocked) {
      await this.sendSystemMessage(data.channel_id, content, data.message_id);
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

  private createGameButtons() {
    return [
      {
        components: [
          {
            id: ButtonKey.AGREE,
            type: EMessageComponentType.BUTTON,
            component: {
              label: '36',
              style: EButtonMessageStyle.SUCCESS,
            },
          },
          {
            id: ButtonKey.RUN,
            type: EMessageComponentType.BUTTON,
            component: {
              label: 'Trốn',
              style: EButtonMessageStyle.DANGER,
            },
          },
          {
            id: ButtonKey.CANCEL,
            type: EMessageComponentType.BUTTON,
            component: {
              label: 'Hủy',
              style: EButtonMessageStyle.SECONDARY,
            },
          },
        ],
      },
    ];
  }

  private createActionButtons() {
    return [
      {
        components: [
          {
            id: ButtonKey.HIT,
            type: EMessageComponentType.BUTTON,
            component: {
              label: 'Rút',
              style: EButtonMessageStyle.SUCCESS,
            },
          },
          {
            id: ButtonKey.STAND,
            type: EMessageComponentType.BUTTON,
            component: {
              label: 'Dừng',
              style: EButtonMessageStyle.DANGER,
            },
          },
        ],
      },
    ];
  }

  async handleButtonClicked(data: MessageButtonClickedEvent) {
    switch (data.button_id) {
      case ButtonKey.AGREE.toString():
        return this.handleAgreeButton(data);
      case ButtonKey.HIT.toString():
        return this.handleHitButton(data);
      case ButtonKey.STAND.toString():
        return this.handleStandButton(data);
      case ButtonKey.RUN.toString():
        return this.handleRunButton(data);
      case ButtonKey.CANCEL.toString():
        return this.handleCancelButton(data);
    }
  }

  async handleRunButton(data: MessageButtonClickedEvent) {
    const { message_id: messageId, user_id: userId } = data;
    const record = await this.prisma.blackJackGame.findFirst({
      where: {
        messageId,
        status: EJackGameStatus.WAITING,
      },
    });
    if (!record) return;
    if (record.guestId != userId) return;
    const game = new Game(record);
    game.end();

    const { guestName } = game;
    const message = `💸 ${guestName} đã trốn.`;
    await this.updateSystemMessage(record.channelId, record.messageId, message);
    await this.prisma.blackJackGame.update({
      where: { id: game.id },
      data: {
        status: EJackGameStatus.ENDED,
        turnOf: game.turnOf,
        isHostStand: game.isHostStand,
        isGuestStand: game.isGuestStand,
      },
    });
  }

  async handleCancelButton(data: MessageButtonClickedEvent) {
    const { message_id: messageId, user_id: userId } = data;
    const record = await this.prisma.blackJackGame.findFirst({
      where: {
        messageId,
        status: EJackGameStatus.WAITING,
      },
    });

    if (!record) return;
    if (record.hostId != userId) return;
    const game = new Game(record);
    game.end();

    const message = `💸 ${game.hostName} Lừa thôi không chơi đâu, chôn Vi en.`;
    await this.mezon.updateMessage({
      channel_id: record.channelId,
      message_id: record.messageId,
      content: {
        type: EMessagePayloadType.SYSTEM,
        content: message,
      },
    });

    await this.prisma.blackJackGame.update({
      where: { id: game.id },
      data: {
        status: EJackGameStatus.ENDED,
        turnOf: game.turnOf,
        isHostStand: game.isHostStand,
        isGuestStand: game.isGuestStand,
      },
    });
  }

  async sendCardMessageToUser(
    userId: string,
    cards: number[],
    opponentName?: string,
  ) {
    try {
      const partner = opponentName ? `\nĐối thủ của bạn: ${opponentName}` : '';
      const sentMessage = await this.mezon.sendMessage({
        type: EMessageType.DM,
        payload: {
          clan_id: '0',
          user_id: userId,
          message: {
            type: EMessagePayloadType.SYSTEM,
            content:
              gameMessages.userHand({
                userName: 'Bạn',
                cardDisplay: cards.map(SenaCaculator.getCardDisplay).join(', '),
                score: SenaCaculator.calculateHandValue(cards),
                isDoubleAce:
                  cards.length === 2 && cards.every((i) => i % 13 === 0),
              }) + partner,
          },
        },
      });
      return sentMessage;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async sendCardMessageToChannel(data: {
    channelId: string;
    userName: string;
    cards: number[];
    messageId?: string;
  }) {
    const { channelId, userName, cards, messageId } = data;
    try {
      const sentMessage = await this.mezon.sendMessage({
        type: EMessageType.CHANNEL,
        reply_to_message_id: messageId,
        payload: {
          channel_id: channelId,
          message: {
            type: EMessagePayloadType.SYSTEM,
            content: gameMessages.userHand({
              userName,
              cardDisplay: cards.map(SenaCaculator.getCardDisplay).join(', '),
              score: SenaCaculator.calculateHandValue(cards),
              isDoubleAce:
                cards.length === 2 && cards.every((i) => i % 13 === 0),
            }),
          },
        },
      });
      return sentMessage;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async handleAgreeButton(data: MessageButtonClickedEvent) {
    const { message_id, user_id } = data;
    const record = await this.prisma.blackJackGame.findFirst({
      where: {
        messageId: message_id,
        status: EJackGameStatus.WAITING,
      },
    });
    if (!record || record.guestId !== user_id) return;

    const totalLock = record.cost * 3;
    let lockSuccess = false;

    try {
      await this.prisma.$transaction(async (tx) => {
        const [host, guest] = await Promise.all([
          tx.userBalance.findUnique({ where: { userId: record.hostId } }),
          tx.userBalance.findUnique({ where: { userId: record.guestId } }),
        ]);

        if (
          !host ||
          !guest ||
          host.balance < totalLock ||
          guest.balance < totalLock
        ) {
          throw new Error('Số dư không đủ để lock tiền cược x3');
        }

        await Promise.all([
          tx.userBalance.update({
            where: { userId: record.hostId },
            data: { balance: { decrement: totalLock } },
          }),
          tx.userBalance.update({
            where: { userId: record.guestId },
            data: { balance: { decrement: totalLock } },
          }),
          tx.transactionLogs.create({
            data: {
              transactionId: `lock_${record.id}_${Date.now()}_host`,
              userId: record.hostId,
              amount: -totalLock,
              type: ETransactionType.LOCKS,
            },
          }),
          tx.transactionLogs.create({
            data: {
              transactionId: `lock_${record.id}_${Date.now()}_guest`,
              userId: record.guestId,
              amount: -totalLock,
              type: ETransactionType.LOCKS,
            },
          }),
        ]);

        lockSuccess = true;
      });

      const game = new Game(record);
      await this.mezon.updateMessage({
        channel_id: record.channelId,
        message_id,
        content: {
          type: EMessagePayloadType.OPTIONAL,
          content: {
            t: `${game.guestName} đang rút...`,
            components: this.createActionButtons(),
          },
        },
      });

      game.startGame();

      const [guestCardsString, hostCardsString] = [
        game.guestCards.map(SenaCaculator.getCardDisplay).join(', '),
        game.hostCards.map(SenaCaculator.getCardDisplay).join(', '),
      ];

      await Promise.all([
        this.prisma.blackJackGameLogs.create({
          data: {
            gameId: game.id,
            userId: game.guestId,
            card: guestCardsString,
          },
        }),
        this.prisma.blackJackGameLogs.create({
          data: { gameId: game.id, userId: game.hostId, card: hostCardsString },
        }),
      ]);

      const [playerMessage, hostMessage] = await Promise.all([
        this.sendCardMessageToUser(
          game.guestId,
          game.guestCards,
          game.hostName,
        ),
        this.sendCardMessageToUser(game.hostId, game.hostCards, game.guestName),
      ]);

      const earlyWin = game.calculateEarlyWin();
      if (earlyWin) {
        await this.handleEarlyWin(game, record, earlyWin);
      }

      await this.prisma.blackJackGame.update({
        where: { id: game.id },
        data: {
          hostCards: game.hostCards,
          guestCards: game.guestCards,
          remainingCards: game.remainingCards,
          status: game.status,
          turnOf: game.turnOf,
          metadata: {
            guestMessageId: playerMessage.message_id,
            guestChannelId: playerMessage.channel_id,
            hostMessageId: hostMessage.message_id,
            hostChannelId: hostMessage.channel_id,
            lockedAmount: totalLock,
          } as GameMetadata,
        },
      });
    } catch (err) {
      console.error('Error in handleAgreeButton:', err);
      if (lockSuccess) {
        await this.refundedLock(record, totalLock);
      }

      await this.mezon.updateMessage({
        channel_id: record.channelId,
        message_id,
        content: {
          type: EMessagePayloadType.SYSTEM,
          content: `Không thể bắt đầu game: ${err.message || 'Lỗi hệ thống'}.`,
        },
      });
    }
  }

  async handleHitButton(data: MessageButtonClickedEvent) {
    const { message_id: messageId, user_id: userId } = data;
    const record = await this.prisma.blackJackGame.findFirst({
      where: {
        messageId,
        status: EJackGameStatus.PLAYING,
      },
    });
    if (!record) return;
    if (record.turnOf != userId) return;
    if (record.hostId != userId && record.guestId != userId) return;

    const game = new Game(record);
    const turnOf = game.turnOf;
    const isGuestTurn = turnOf === game.guestId;
    let newMessageId = record.messageId;

    try {
      game.hitCard();

      const metadata = record.metadata as GameMetadata;
      const playerMessageText =
        gameMessages.userHand({
          userName: isGuestTurn ? game.guestName : game.hostName,
          cardDisplay: (isGuestTurn ? game.guestCards : game.hostCards)
            .map(SenaCaculator.getCardDisplay)
            .join(', '),
          score: SenaCaculator.calculateHandValue(
            isGuestTurn ? game.guestCards : game.hostCards,
          ),
          isDoubleAce: (isGuestTurn ? game.guestScore : game.hostScore)
            .isDoubleAce,
        }) +
        `\nĐối thủ của bạn: ${isGuestTurn ? game.hostName : game.guestName}`;

      const cardIndex = (isGuestTurn ? game.guestCards : game.hostCards).slice(
        -1,
      )[0];
      const cardString = SenaCaculator.getCardDisplay(cardIndex);

      await this.prisma.blackJackGameLogs.create({
        data: {
          gameId: game.id,
          userId: isGuestTurn ? game.guestId : game.hostId,
          card: cardString,
        },
      });

      const isEndGame = game.status === EJackGameStatus.ENDED;
      const isChangeTurn =
        (isGuestTurn ? game.guestCards : game.hostCards).length === MAX_CARDS;

      if (isEndGame) {
        await this.handleEndGameNgulinh(game, record);
      } else if (isChangeTurn) {
        const hostCardCount = game.hostCards.length - 2;
        const systemMessageText = this.generateTurnMessage({
          currentPlayerName: game.hostName,
          opponentName: game.guestName,
          cardCount: hostCardCount,
        });

        const newMessage = await this.mezon.sendMessage({
          type: EMessageType.CHANNEL,
          reply_to_message_id: record.messageId,
          payload: {
            channel_id: record.channelId,
            message: {
              type: EMessagePayloadType.OPTIONAL,
              content: {
                t: systemMessageText,
                components: this.createActionButtons(),
              },
            },
          },
        });

        newMessageId = newMessage.message_id;

        await this.mezon.updateMessage({
          channel_id: record.channelId,
          message_id: record.messageId,
          content: {
            type: EMessagePayloadType.OPTIONAL,
            content: {
              t: `${isGuestTurn ? game.guestName : game.hostName} đã rút đủ 5 lá. Đang chờ ${isGuestTurn ? game.hostName : game.guestName}...`,
              components: [],
            },
          },
        });
      } else {
        const cardCount =
          (isGuestTurn ? game.guestCards : game.hostCards).length - 2;
        const systemMessageText = gameMessages.playerHitting({
          guestName: isGuestTurn ? game.guestName : game.hostName,
          cardCount,
          hostName: isGuestTurn ? game.hostName : game.guestName,
        });

        await this.mezon.updateMessage({
          channel_id: record.channelId,
          message_id: record.messageId,
          content: {
            type: EMessagePayloadType.OPTIONAL,
            content: {
              t: systemMessageText,
              components: this.createActionButtons(),
            },
          },
        });
      }

      if (isGuestTurn) {
        await this.mezon.updateMessage({
          channel_id: metadata.guestChannelId!,
          message_id: metadata.guestMessageId!,
          content: {
            type: EMessagePayloadType.SYSTEM,
            content: playerMessageText,
          },
        });
      } else {
        await this.mezon.updateMessage({
          channel_id: metadata.hostChannelId!,
          message_id: metadata.hostMessageId!,
          content: {
            type: EMessagePayloadType.SYSTEM,
            content: playerMessageText,
          },
        });
      }

      await this.prisma.blackJackGame.update({
        where: { id: game.id },
        data: {
          hostCards: game.hostCards,
          guestCards: game.guestCards,
          remainingCards: game.remainingCards,
          turnOf: game.turnOf,
          isHostStand: game.isHostStand,
          isGuestStand: game.isGuestStand,
          status: game.status,
          messageId: newMessageId,
        },
      });
    } catch (error) {
      console.error('Error handling hit button:', error);
      await this.mezon.updateMessage({
        channel_id: record.channelId,
        message_id: record.messageId,
        content: {
          type: EMessagePayloadType.SYSTEM,
          content: 'Đã có lỗi xảy ra. Vui lòng thử lại!',
        },
      });
    }
  }

  async handleStandButton(data: MessageButtonClickedEvent) {
    const { message_id: messageId, user_id: userId } = data;
    const record = await this.prisma.blackJackGame.findFirst({
      where: {
        messageId,
        status: EJackGameStatus.PLAYING,
      },
    });

    if (!record) return;
    if (record.turnOf != userId) return;
    if (record.hostId != userId && record.guestId != userId) return;

    const game = new Game(record);
    const isHost = userId === game.hostId;
    const score = isHost
      ? SenaCaculator.calculateHandValue(game.hostCards)
      : SenaCaculator.calculateHandValue(game.guestCards);

    const playerName = isHost ? game.hostName : game.guestName;

    try {
      if (score < MIN_SCORE) {
        await this.mezon.updateMessage({
          channel_id: record.channelId,
          message_id: record.messageId,
          content: {
            type: EMessagePayloadType.OPTIONAL,
            content: {
              t: `Điểm của ${playerName} chưa đủ để dằn. Rút mạnh đê bạn sợ à?`,
              components: [
                {
                  components: [
                    {
                      id: ButtonKey.HIT,
                      type: EMessageComponentType.BUTTON,
                      component: {
                        label: 'Rút',
                        style: EButtonMessageStyle.SUCCESS,
                      },
                    },
                  ],
                },
              ],
            },
          },
        });
        return;
      }

      game.stand();

      if (game.status === EJackGameStatus.ENDED) {
        await this.handleEndGameNgulinh(game, record);
        await this.prisma.blackJackGame.update({
          where: { id: game.id },
          data: {
            messageId: record.messageId,
            status: game.status,
            turnOf: game.turnOf,
            isGuestStand: game.isGuestStand,
            isHostStand: game.isHostStand,
          },
        });
        return;
      }

      const hostCardCount = game.hostCards.length - 2;
      const systemMessageText = this.generateTurnMessage({
        currentPlayerName: game.hostName,
        opponentName: game.guestName,
        cardCount: hostCardCount,
      });

      const newMessage = await this.mezon.sendMessage({
        type: EMessageType.CHANNEL,
        reply_to_message_id: record.messageId,
        payload: {
          channel_id: record.channelId,
          message: {
            type: EMessagePayloadType.OPTIONAL,
            content: {
              t: systemMessageText,
              components: this.createActionButtons(),
            },
          },
        },
      });

      const updateMess = `${game.guestName} đã dừng. Đang chờ ${game.hostName}...`;
      await this.updateSystemMessage(
        record.channelId,
        record.messageId,
        updateMess,
      );

      await this.prisma.blackJackGame.update({
        where: { id: game.id },
        data: {
          messageId: newMessage.message_id,
          status: game.status,
          turnOf: game.turnOf,
          isGuestStand: game.isGuestStand,
          isHostStand: game.isHostStand,
        },
      });
    } catch (error) {
      console.error('Error handling stand button:', error);
      const content = 'Đã có lỗi xảy ra. Vui lòng thử lại!';
      await this.updateSystemMessage(
        record.channelId,
        record.messageId,
        content,
      );
    }
  }

  public async createDeck(data: ChannelMessage, amount: number) {
    let partnerId: string | undefined;
    let parterName: string | undefined;
    if (data.content.t?.includes('@')) {
      const mention = data.mentions?.[0];
      if (mention) {
        const m = data.content.t.trim().split(/\s+/);
        partnerId = mention.user_id;
        parterName = m.find((x) => x.startsWith('@'))?.slice(1);
        const mentionIdx = m.findIndex((x) => x.startsWith('@'));
        const afterMention = m[mentionIdx + 1];
        if (afterMention && !isNaN(Number(afterMention))) {
          amount = Number(afterMention);
        } else {
          amount = 0;
        }
      }
    } else {
      partnerId = data.references?.[0]?.message_sender_id;
      parterName = data.references?.[0]?.message_sender_username;
    }

    if (data.sender_id === partnerId) {
      const message = `😅 Chơi 1 mình?`;
      await this.mezon.sendMessage({
        type: EMessageType.CHANNEL,
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
    if (!partnerId) {
      const message = `😅 Bạn không có đối thủ. Hãy rep tin nhắn ai đó`;
      await this.mezon.sendMessage({
        type: EMessageType.CHANNEL,
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

    const isExistedGame = await this.prisma.blackJackGame.findFirst({
      where: {
        hostId: data.sender_id,
        guestId: partnerId,
        status: EJackGameStatus.PLAYING,
      },
    });

    if (isExistedGame) {
      const message = `😅 Bạn đã có game đang diễn ra. Hãy chờ game kết thúc`;
      await this.mezon.sendMessage({
        type: EMessageType.CHANNEL,
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

    const m = `🔃Đang thiết lập game...`;
    const promiseMessage = await this.mezon.sendMessage({
      type: EMessageType.CHANNEL,
      payload: {
        channel_id: data.channel_id,
        message: {
          type: EMessagePayloadType.SYSTEM,
          content: m,
        },
      },
    });

    if (!promiseMessage) return;

    await this.delay(1000);

    if (amount < 0 || amount > 1000000 || isNaN(amount)) {
      const message = `😅 Số tiền cược không hợp lệ. Vui lòng nhập số tiền từ 0 đến 1.000.000 token`;
      await this.mezon.updateMessage({
        channel_id: promiseMessage.channel_id,
        message_id: promiseMessage.message_id,
        content: {
          type: EMessagePayloadType.SYSTEM,
          content: message,
        },
      });
      return;
    }

    const myBalance = await this.prisma.userBalance.findUnique({
      where: {
        userId: data.sender_id,
      },
    });

    let mBalance: any;
    if (!myBalance) {
      mBalance = await this.prisma.userBalance.create({
        data: {
          userId: data.sender_id,
          balance: 0,
          username: data.username!,
        },
      });
    } else {
      mBalance = myBalance;
    }

    if (mBalance.balance < amount * 3) {
      const message = `😅 Số dư của bạn không đủ để cược ${SenaCaculator.formatVND(amount)} token (phải ≥ ${SenaCaculator.formatVND(amount * 3)} token để phòng trường hợp x3)`;
      await this.mezon.updateMessage({
        channel_id: promiseMessage.channel_id,
        message_id: promiseMessage.message_id,
        content: {
          type: EMessagePayloadType.SYSTEM,
          content: message,
        },
      });
      return;
    }

    const partnerBalance = await this.prisma.userBalance.findUnique({
      where: {
        userId: partnerId,
      },
    });

    let pBalance: any;
    if (!partnerBalance) {
      pBalance = await this.prisma.userBalance.create({
        data: {
          userId: partnerId,
          balance: 0,
          username: parterName!,
        },
      });
    } else {
      pBalance = partnerBalance;
    }

    if (pBalance.balance < amount * 3) {
      const message = `😅 Số dư của đối thủ không đủ để cược ${SenaCaculator.formatVND(amount)} token (phải ≥ ${SenaCaculator.formatVND(amount * 3)} token để phòng trường hợp x3)`;
      await this.mezon.updateMessage({
        channel_id: promiseMessage.channel_id,
        message_id: promiseMessage.message_id,
        content: {
          type: EMessagePayloadType.SYSTEM,
          content: message,
        },
      });
      return;
    }

    await Promise.all([
      this.mezon.updateMessage({
        channel_id: promiseMessage.channel_id,
        message_id: promiseMessage.message_id,
        content: {
          type: EMessagePayloadType.OPTIONAL,
          content: {
            t: `Xì rách giữa ${data.username} và ${parterName}\n💰Cược ${SenaCaculator.formatVND(amount)} token. Đồng ý = click lên phím "36"`,
            components: this.createGameButtons(),
          },
        },
      }),
      this.prisma.blackJackGame.create({
        data: {
          status: EJackGameStatus.WAITING,
          hostId: data.sender_id,
          guestId: partnerId,
          cost: amount,
          channelId: promiseMessage.channel_id,
          messageId: promiseMessage.message_id,
          clanId: data.clan_id!,
          isPublicChannel: data.is_public || false,
          hostName: data.username!,
          guestName: parterName!,
          mode: String(data.mode || EMessageMode.CHANNEL_MESSAGE),
        },
      }),
    ]);
  }

  private async updateUserBalanceAfterGame(game: Game, result: GAME_RESULT) {
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

  async checkTransaction(data: ChannelMessage) {
    const m = data.content.t?.split(' ') || [];
    const transactionId = m[1];
    if (!transactionId) {
      await this.mezon.sendMessage({
        type: EMessageType.CHANNEL,
        reply_to_message_id: data.message_id,
        payload: {
          channel_id: data.channel_id,
          message: {
            type: EMessagePayloadType.SYSTEM,
            content:
              'Vui lòng nhập transaction Id cần kiểm tra. Ví dụ: *logs <transaction Id>',
          },
        },
      });
      return;
    }

    try {
      const transaction = await this.prisma.transactionLogs.findFirst({
        where: { transactionId },
      });

      let content = ' ';
      if (transaction) {
        const user = await this.prisma.userBalance.findUnique({
          where: { userId: transaction.userId },
        });
        content = `TransactionLogs: 
      - User: ${user?.username || 'Không tìm thấy người dùng'}
      - Amount: ${SenaCaculator.formatVND(transaction.amount)}
      - Created At: ${transaction.createdAt.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })}
      - Type: ${transaction.type}`;
      } else {
        content = `Không tìm thấy transaction với ID: ${transactionId}`;
      }

      await this.mezon.sendMessage({
        type: EMessageType.CHANNEL,
        reply_to_message_id: data.message_id,
        payload: {
          channel_id: data.channel_id,
          message: {
            type: EMessagePayloadType.SYSTEM,
            content,
          },
        },
      });
    } catch (error) {
      console.error('Error checking transaction:', error);
      await this.mezon.sendMessage({
        type: EMessageType.CHANNEL,
        reply_to_message_id: data.message_id,
        payload: {
          channel_id: data.channel_id,
          message: {
            type: EMessagePayloadType.SYSTEM,
            content:
              'Đã xảy ra lỗi khi kiểm tra transaction. Vui lòng thử lại sau.',
          },
        },
      });
    }
  }

  async checkTransactionSend(data: ChannelMessage) {
    const m = data.content.t?.split(' ') || [];
    const transactionId = m[1];

    if (!transactionId) {
      await this.mezon.sendMessage({
        type: EMessageType.CHANNEL,
        reply_to_message_id: data.message_id,
        payload: {
          channel_id: data.channel_id,
          message: {
            type: EMessagePayloadType.SYSTEM,
            content:
              'Vui lòng nhập transaction Id cần kiểm tra. Ví dụ: *lsend <transaction Id>',
          },
        },
      });
      return;
    }

    try {
      const transactionSend = await this.prisma.transactionSendLogs.findFirst({
        where: { id: Number(transactionId) },
      });

      let content = '';

      if (!transactionSend) {
        await this.mezon.sendMessage({
          type: EMessageType.CHANNEL,
          reply_to_message_id: data.message_id,
          payload: {
            channel_id: data.channel_id,
            message: {
              type: EMessagePayloadType.SYSTEM,
              content: `Không tìm thấy transaction send với ID: ${transactionId}`,
            },
          },
        });
        return;
      } else {
        const fromUser = await this.prisma.userBalance.findUnique({
          where: { userId: transactionSend.userId },
        });
        const toUser = await this.prisma.userBalance.findUnique({
          where: { userId: transactionSend.toUserId },
        });

        content = `TransactionSendLogs:
          - From: ${transactionSend.userId} (${fromUser?.username || 'unknown'})
          - To: ${transactionSend.toUserId} (${toUser?.username || 'unknown'})
          - Amount: ${SenaCaculator.formatVND(transactionSend.amount)}
          - Note: ${transactionSend.note}
          - Created At: ${transactionSend.createdAt.toLocaleDateString(
            'vi-VN',
            {
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            },
          )}`;
      }

      if (!content) {
        content = `Không tìm thấy transaction với ID: ${transactionId}`;
      }

      await this.mezon.sendMessage({
        type: EMessageType.CHANNEL,
        reply_to_message_id: data.message_id,
        payload: {
          channel_id: data.channel_id,
          message: {
            type: EMessagePayloadType.SYSTEM,
            content,
          },
        },
      });
    } catch (error) {
      console.error('Error checking transaction send:', error);
      await this.mezon.sendMessage({
        type: EMessageType.CHANNEL,
        reply_to_message_id: data.message_id,
        payload: {
          channel_id: data.channel_id,
          message: {
            type: EMessagePayloadType.SYSTEM,
            content:
              'Đã xảy ra lỗi khi kiểm tra transaction gửi. Vui lòng thử lại sau.',
          },
        },
      });
    }
  }

  async handleTop10(data: ChannelMessage) {
    const placeholder = await this.mezon.sendMessage({
      type: EMessageType.CHANNEL,
      clan_id: data.clan_id,
      payload: {
        channel_id: data.channel_id,
        message: {
          type: EMessagePayloadType.SYSTEM,
          content: 'Đang lấy danh sách top 10 người thắng xì rách...',
        },
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const games = await this.prisma.blackJackGame.findMany({
      where: { channelId: data.channel_id },
      select: { guestId: true, hostId: true },
    });

    const userIdsInChannel = Array.from(
      new Set(games.flatMap((g) => [g.guestId, g.hostId])),
    );

    const topWinners = await this.prisma.transactionSendLogs.groupBy({
      by: ['userId'],
      where: {
        amount: { gt: 0 },
        toUserId: { in: userIdsInChannel },
        userId: { in: userIdsInChannel },
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 10,
    });

    const userIds = topWinners.map((winner) => winner.userId);
    const users = await this.prisma.userBalance.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, username: true },
    });

    const userMap = new Map(users.map((user) => [user.userId, user.username]));

    let content = '🏆 Top 10 người chơi thắng nhiều nhất:\n';

    for (let i = 0; i < topWinners.length; i++) {
      const userId = topWinners[i].userId;
      const username = userMap.get(userId) || userId;
      content += `${i + 1}. ${username}: ${topWinners[i]._count.id} lần \n`;
    }

    await this.mezon.updateMessage({
      channel_id: data.channel_id,
      message_id: placeholder.message_id,
      content: {
        type: EMessagePayloadType.SYSTEM,
        content,
      },
    });
  }

  async handleHDSD(data: ChannelMessage) {
    await this.mezon.sendMessage({
      type: EMessageType.CHANNEL,
      reply_to_message_id: data.message_id,
      payload: {
        channel_id: data.channel_id,
        message: {
          type: EMessagePayloadType.SYSTEM,
          content: HDSD,
        },
      },
    });
  }

  private generateTurnMessage({
    currentPlayerName,
    opponentName,
    cardCount,
  }: {
    currentPlayerName: string;
    opponentName: string;
    cardCount: number;
  }): string {
    if (cardCount === 0) {
      return `Tới lượt ${currentPlayerName}, rút hay dằn? Đối thủ: ${opponentName}`;
    }
    return gameMessages.playerHitting({
      guestName: currentPlayerName,
      cardCount,
      hostName: opponentName,
    });
  }

  private async updateGameMessageOnEnd({
    channelId,
    messageId,
    hostName,
    guestName,
  }: {
    channelId: string;
    messageId: string;
    hostName: string;
    guestName: string;
  }) {
    await this.mezon.updateMessage({
      channel_id: channelId,
      message_id: messageId,
      content: {
        type: EMessagePayloadType.OPTIONAL,
        content: {
          t: `Game đã kết thúc giữa ${hostName} và ${guestName}`,
          components: [],
        },
      },
    });
  }

  private async sendGameResultMessage({
    channelId,
    replyToMessageId,
    hostName,
    guestName,
    resultMessage,
  }: {
    channelId: string;
    replyToMessageId: string;
    hostName: string;
    guestName: string;
    resultMessage: string;
  }) {
    await this.mezon.sendMessage({
      type: EMessageType.CHANNEL,
      reply_to_message_id: replyToMessageId,
      payload: {
        channel_id: channelId,
        message: {
          type: EMessagePayloadType.SYSTEM,
          content: `🎲 Kết quả cuối cùng của ván bài giữa: ${hostName} và ${guestName} là: \n${resultMessage}`,
        },
      },
    });
  }

  private async handleEndGameNgulinh(game: Game, record: any) {
    const hostFive = game.hostScore.isFiveSprits;
    const guestFive = game.guestScore.isFiveSprits;
    let resultMessage = '';

    if (guestFive && hostFive) {
      await this.updateUserBalanceAfterGame(game, GAME_RESULT.DRAW);
      resultMessage = `Cả ${game.guestName} và ${game.hostName} đều ngũ linh. HÒA!`;
    } else if (guestFive) {
      await this.updateUserBalanceAfterGame(game, GAME_RESULT.GUEST_WIN);
      resultMessage = gameMessages.fiveSprits({
        winnerName: game.guestName,
        loserName: game.hostName,
        cost: game.cost * 2,
      });
    } else if (hostFive) {
      await this.updateUserBalanceAfterGame(game, GAME_RESULT.HOST_WIN);
      resultMessage = gameMessages.fiveSprits({
        winnerName: game.hostName,
        loserName: game.guestName,
        cost: game.cost * 2,
      });
    } else {
      resultMessage = gameMessages[game.result]({
        hostName: game.hostName,
        hostCardDisplay: game.hostCards
          .map(SenaCaculator.getCardDisplay)
          .join(', '),
        hostScore: game.hostScore.value,
        guestName: game.guestName,
        guestCardDisplay: game.guestCards
          .map(SenaCaculator.getCardDisplay)
          .join(', '),
        guestScore: game.guestScore.value,
        cost: game.cost,
      });
      await this.updateUserBalanceAfterGame(game, game.result);
    }

    await this.updateGameMessageOnEnd({
      channelId: record.channelId,
      messageId: record.messageId,
      hostName: game.hostName,
      guestName: game.guestName,
    });

    await this.sendGameResultMessage({
      channelId: record.channelId,
      replyToMessageId: record.messageId,
      hostName: game.hostName,
      guestName: game.guestName,
      resultMessage,
    });
  }

  private async refundedLock(record: BlackJackGame, totalLock: number) {
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

  private async handleEarlyWin(
    game: Game,
    record: any,
    earlyWin: GAME_RESULT,
  ): Promise<void> {
    game.end();
    await this.updateUserBalanceAfterGame(game, earlyWin);

    const content = this.generateEarlyWinMessage(game, earlyWin);

    await Promise.all([
      this.mezon.updateMessage({
        channel_id: record.channelId,
        message_id: record.messageId,
        content: {
          type: EMessagePayloadType.SYSTEM,
          content,
        },
      }),
      this.mezon.sendMessage({
        type: EMessageType.CHANNEL,
        reply_to_message_id: record.messageId,
        payload: {
          channel_id: record.channelId,
          message: {
            type: EMessagePayloadType.SYSTEM,
            content,
          },
        },
      }),
    ]);
  }

  private generateEarlyWinMessage(game: Game, earlyWin: GAME_RESULT): string {
    if (earlyWin === GAME_RESULT.HOST_WIN && game.hostScore.isDoubleAce) {
      return gameMessages.doubleAce({
        winnerName: game.hostName,
        loserName: game.guestName,
        cost: game.cost * 3,
      });
    } else if (
      earlyWin === GAME_RESULT.GUEST_WIN &&
      game.guestScore.isDoubleAce
    ) {
      return gameMessages.doubleAce({
        winnerName: game.guestName,
        loserName: game.hostName,
        cost: game.cost * 3,
      });
    } else if (
      earlyWin === GAME_RESULT.HOST_WIN &&
      game.hostScore.isBlackjack
    ) {
      return gameMessages.blackjack({
        winnerName: game.hostName,
        loserName: game.guestName,
        cost: game.cost * 2,
      });
    } else if (
      earlyWin === GAME_RESULT.GUEST_WIN &&
      game.guestScore.isBlackjack
    ) {
      return gameMessages.blackjack({
        winnerName: game.guestName,
        loserName: game.hostName,
        cost: game.cost * 2,
      });
    }
    return gameMessages[earlyWin]({
      hostName: game.hostName,
      hostCardDisplay: game.hostCards
        .map(SenaCaculator.getCardDisplay)
        .join(', '),
      hostScore: game.hostScore.value,
      guestName: game.guestName,
      guestCardDisplay: game.guestCards
        .map(SenaCaculator.getCardDisplay)
        .join(', '),
      guestScore: game.guestScore.value,
      cost: game.cost,
    });
  }

  async handlOffWithDraw(data: ChannelMessage) {
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

  async handlOnWithDraw(data: ChannelMessage) {
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
}
