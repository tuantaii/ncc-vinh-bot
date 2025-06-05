import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MessageButtonClickedEvent, TokenSentEventI } from './types';
import {
  ChannelMessage,
  ChannelMessageAck,
  EButtonMessageStyle,
  EMessageComponentType,
} from 'mezon-sdk';
import { EJackGameStatus, ETransactionType } from '@prisma/client';
import { MezonService } from 'src/v2/mezon/mezon.service';
import { TokenSentEvent } from 'mezon-sdk';
import {
  gameMessages,
  EMPTY_BALANCE_MESSAGES,
  GAME_RESULT,
  MAX_CARDS,
} from './constansts';
import { random } from 'src/common/utils/helper';
import { EMessageMode } from 'src/common/enums/mezon.enum';
import { GameMetadata } from './types/game';
import { Game } from './game';
import { EMessagePayloadType, EMessageType } from 'src/v2/mezon/types/mezon';

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
];

export enum ButtonKey {
  HIT = 'hit',
  STAND = 'stand',
  RUN = 'run',
  AGREE = 'agree',
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class SenaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mezon: MezonService,
  ) {}

  async introduce(data: ChannelMessage) {
    const message = `👋Chào nợ tộc, tao là Sena, thằng nào có tiền thì donate cho tao.`;
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
    } else {
      const message = `💸Số dư của bạn là ${userBalance.balance} token`;
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
    const userBalance = await this.prisma.userBalance.findUnique({
      where: {
        userId: data.sender_id,
      },
    });
    if (!userBalance || userBalance.balance < amount || amount < 1000) {
      const message = `💸Số dư của bạn không đủ để rút hoặc số tiền rút không hợp lệ`;
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
    } else {
      //check

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
    const message = `💸${guestName} đã trốn.`;
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

  async sendCardMessageToUser(userId: string, cards: number[]) {
    try {
      const sentMessage = await this.mezon.sendMessage({
        type: EMessageType.DM,
        payload: {
          clan_id: '0',
          user_id: userId,
          message: {
            type: EMessagePayloadType.NORMAL_TEXT,
            content: gameMessages.userHand({
              userName: 'Bạn',
              cardDisplay: cards.map(this.getCardDisplay).join(', '),
              score: this.calculateHandValue(cards),
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
              cardDisplay: cards.map(this.getCardDisplay).join(', '),
              score: this.calculateHandValue(cards),
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
    if (!record) return;

    if (record.guestId == user_id) {
      const game = new Game(record);

      const message = `${game.guestName} đang rút...`;

      await this.mezon.updateMessage({
        channel_id: record.channelId,
        message_id,
        content: {
          type: EMessagePayloadType.OPTIONAL,
          content: {
            t: message,
            components: this.createActionButtons(),
          },
        },
      });

      game.startGame();

      // game.hostCards = [0, 13]; // Guest starts with 2 cards

      // const [playerMessage, hostMessage] = await Promise.all([
      //   this.sendCardMessageToUser(record.guestId, game.guestCards),
      //   this.sendCardMessageToUser(record.hostId, game.hostCards),
      // ]);

      const [playerMessage, hostMessage] = await Promise.all([
        this.sendCardMessageToChannel({
          channelId: record.channelId,
          userName: record.guestName,
          cards: game.guestCards,
          messageId: record.messageId,
        }),
        this.sendCardMessageToChannel({
          channelId: record.channelId,
          userName: record.hostName,
          cards: game.hostCards,
          messageId: record.messageId,
        }),
      ]);

      const earlyWin = game.calculateEarlyWin();

      if (earlyWin === GAME_RESULT.HOST_WIN || earlyWin) {
        game.end();

        let content: string;

        if (earlyWin === GAME_RESULT.HOST_WIN && game.hostScore.isDoubleAce) {
          content = gameMessages.doubleAce({
            winnerName: game.hostName,
            loserName: game.guestName,
          });
        } else if (
          earlyWin === GAME_RESULT.GUEST_WIN &&
          game.guestScore.isDoubleAce
        ) {
          content = gameMessages.doubleAce({
            winnerName: game.guestName,
            loserName: game.hostName,
          });
        } else if (
          earlyWin === GAME_RESULT.HOST_WIN &&
          game.hostScore.isBlackjack
        ) {
          content = gameMessages.blackjack({
            winnerName: game.hostName,
            loserName: game.guestName,
          });
        } else if (
          earlyWin === GAME_RESULT.GUEST_WIN &&
          game.guestScore.isBlackjack
        ) {
          content = gameMessages.blackjack({
            winnerName: game.guestName,
            loserName: game.hostName,
          });
        } else {
          content = gameMessages[earlyWin]({
            hostName: game.hostName,
            hostCardDisplay: game.hostCards.map(this.getCardDisplay).join(', '),
            hostScore: game.hostScore.value,
            guestName: game.guestName,
            guestCardDisplay: game.guestCards
              .map(this.getCardDisplay)
              .join(', '),
            guestScore: game.guestScore.value,
          });
        }

        await this.mezon.updateMessage({
          channel_id: record.channelId,
          message_id: record.messageId,
          content: {
            type: EMessagePayloadType.SYSTEM,
            content,
          },
        });
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
          } as GameMetadata,
        },
      });
    }
  }

  async handleHitButton(data: MessageButtonClickedEvent) {
    const { message_id: messageId, user_id: userId } = data;
    const record = await this.prisma.blackJackGame.findFirst({
      where: {
        messageId: messageId,
        status: EJackGameStatus.PLAYING,
      },
    });
    if (!record) return;
    if (record.turnOf != userId) return;
    if (record.hostId != userId && record.guestId != userId) return;
    const game = new Game(record);
    const turnOf = game.turnOf;
    const isGuestTurn = turnOf === game.guestId;
    if (isGuestTurn) {
      game.hitCard();
      const { guestMessageId, guestChannelId } =
        record.metadata as GameMetadata;
      const playerMessageText = gameMessages.userHand({
        userName: game.guestName,
        cardDisplay: game.guestCards.map(this.getCardDisplay).join(', '),
        score: this.calculateHandValue(game.guestCards),
      });

      if (game.isFiveSprits('guest')) {
        game.end();

        const content = gameMessages.fiveSprits({
          winnerName: game.guestName,
          loserName: game.hostName,
        });

        await Promise.all([
          this.mezon.updateMessage({
            channel_id: guestChannelId!,
            message_id: guestMessageId!,
            content: {
              type: EMessagePayloadType.SYSTEM,
              content: playerMessageText,
            },
          }),

          this.mezon.updateMessage({
            channel_id: record.channelId,
            message_id: record.messageId,
            content: {
              type: EMessagePayloadType.SYSTEM,
              content,
            },
          }),

          this.prisma.blackJackGame.update({
            where: { id: game.id },
            data: {
              remainingCards: game.remainingCards,
              guestCards: game.guestCards,
              turnOf: game.turnOf,
              isGuestStand: game.isGuestStand,
              status: game.status,
            },
          }),
        ]);
        return;
      }

      const isChangeTurn = game.guestCards.length === MAX_CARDS;

      const cardCount =
        (isGuestTurn ? game.guestCards : game.hostCards).length - 2;

      const systemMessageText = isChangeTurn
        ? gameMessages.guestPlayerStood({
            guestName: game.guestName,
            hostName: game.hostName,
          })
        : gameMessages.playerHitting({
            guestName: game.guestName,
            cardCount,
            hostName: game.hostName,
          });

      await Promise.all([
        this.mezon.updateMessage({
          channel_id: guestChannelId!,
          message_id: guestMessageId!,
          content: {
            type: EMessagePayloadType.SYSTEM,
            content: playerMessageText,
          },
        }),
        this.mezon.updateMessage({
          channel_id: record.channelId,
          message_id: record.messageId,
          content: {
            type: EMessagePayloadType.OPTIONAL,
            content: {
              t: systemMessageText,
              components: this.createActionButtons(),
            },
          },
        }),
        this.prisma.blackJackGame.update({
          where: { id: game.id },
          data: {
            remainingCards: game.remainingCards,
            guestCards: game.guestCards,
            turnOf: game.turnOf,
            isGuestStand: game.isGuestStand,
            status: game.status,
          },
        }),
      ]);
    } else {
      game.hitCard();
      const { hostMessageId, hostChannelId } = record.metadata as GameMetadata;
      const hostMessageText = gameMessages.userHand({
        userName: game.hostName,
        cardDisplay: game.hostCards.map(this.getCardDisplay).join(', '),
        score: this.calculateHandValue(game.hostCards),
      });

      if (game.isFiveSprits('host')) {
        game.end();

        const content = gameMessages.fiveSprits({
          winnerName: game.hostName,
          loserName: game.guestName,
        });

        await Promise.all([
          this.mezon.updateMessage({
            channel_id: hostChannelId!,
            message_id: hostMessageId!,
            content: {
              type: EMessagePayloadType.SYSTEM,
              content: hostMessageText,
            },
          }),

          this.mezon.updateMessage({
            channel_id: record.channelId,
            message_id: record.messageId,
            content: {
              type: EMessagePayloadType.SYSTEM,
              content,
            },
          }),

          this.prisma.blackJackGame.update({
            where: { id: game.id },
            data: {
              remainingCards: game.remainingCards,
              guestCards: game.guestCards,
              turnOf: game.turnOf,
              isGuestStand: game.isGuestStand,
              status: game.status,
            },
          }),
        ]);
        return;
      }

      const isEndGame = game.status === EJackGameStatus.ENDED;

      const {
        hostName,
        guestName,
        hostCards,
        guestCards,
        hostScore,
        guestScore,
        result,
      } = game;

      const systemMessageText = isEndGame
        ? gameMessages[result]({
            hostName,
            hostCardDisplay: hostCards.map(this.getCardDisplay).join(', '),
            hostScore: hostScore.value,
            guestName,
            guestCardDisplay: guestCards.map(this.getCardDisplay).join(', '),
            guestScore: guestScore.value,
          })
        : gameMessages.playerHitting({
            guestName: game.hostName,
            cardCount: hostCards.length - 2,
            hostName: game.guestName,
          });

      await Promise.all([
        this.mezon.updateMessage({
          channel_id: hostChannelId!,
          message_id: hostMessageId!,
          content: {
            type: EMessagePayloadType.SYSTEM,
            content: hostMessageText,
          },
        }),
        this.mezon.updateMessage({
          channel_id: record.channelId,
          message_id: record.messageId,
          content: {
            type: EMessagePayloadType.OPTIONAL,
            content: {
              t: systemMessageText,
              components: isEndGame ? undefined : this.createActionButtons(),
            },
          },
        }),
        this.prisma.blackJackGame.update({
          where: { id: game.id },
          data: {
            hostCards: game.hostCards,
            guestCards: game.guestCards,
            remainingCards: game.remainingCards,
            turnOf: game.turnOf,
            isHostStand: game.isHostStand,
            status: game.status,
          },
        }),
      ]);
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
    game.stand();
    const {
      hostName,
      guestName,
      hostCards,
      guestCards,
      hostScore,
      guestScore,
      result,
      status,
    } = game;

    const isEnded = status === EJackGameStatus.ENDED;

    const systemMessageText = isEnded
      ? gameMessages[result]({
          hostName,
          hostCardDisplay: hostCards.map(this.getCardDisplay).join(', '),
          hostScore: hostScore.value,
          guestName,
          guestCardDisplay: guestCards.map(this.getCardDisplay).join(', '),
          guestScore: guestScore.value,
        })
      : gameMessages.guestPlayerStood({
          hostName,
          guestName,
        });

    await Promise.all([
      this.mezon.updateMessage({
        channel_id: record.channelId,
        message_id: record.messageId,
        content: {
          type: EMessagePayloadType.OPTIONAL,
          content: {
            t: systemMessageText,
            components: isEnded ? undefined : this.createActionButtons(),
          },
        },
      }),
      this.prisma.blackJackGame.update({
        where: { id: game.id },
        data: {
          status: game.status,
          turnOf: game.turnOf,
          isGuestStand: game.isGuestStand,
          isHostStand: game.isHostStand,
        },
      }),
    ]);
  }

  getCardDisplay = (index: number): string => {
    const suit = SUITS[Math.floor(index / 13)];
    const rank = RANKS[index % 13];
    return `${rank}${suit}`;
  };

  public async createDeck(data: ChannelMessage) {
    let partnerId: string | undefined;
    let parterName: string | undefined;
    if (data.content.t?.includes('@')) {
      const mention = data.mentions?.[0];
      if (mention) {
        const m = data.content.t.split(' ');
        partnerId = mention.user_id;
        parterName = m[1].slice(1);
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
      const message = `😅Bạn không có đối thủ. Hãy rep tin nhắn ai đó`;
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
      const message = `😅Bạn đã có game đang diễn ra. Hãy chờ game kết thúc`;
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

    await delay(1000);

    await Promise.all([
      this.mezon.updateMessage({
        channel_id: promiseMessage.channel_id,
        message_id: promiseMessage.message_id,
        content: {
          type: EMessagePayloadType.OPTIONAL,
          content: {
            t: `Xì rách giữa ${data.username} và ${parterName}\n💰. Đồng ý = click lên phím "36"`,
            components: this.createGameButtons(),
          },
        },
      }),
      this.prisma.blackJackGame.create({
        data: {
          status: EJackGameStatus.WAITING,
          hostId: data.sender_id,
          guestId: partnerId,
          cost: 0,
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

  public calculateHandValue(hand: number[]): number {
    let total = 0;
    let aceCount = 0;
    for (const card of hand) {
      const rankIndex = card % 13;
      if (rankIndex === 0) {
        aceCount++;
        total += 11;
      } else if (rankIndex >= 10) {
        total += 10;
      } else {
        total += rankIndex + 1;
      }
    }
    while (total > 21 && aceCount > 0) {
      total -= 10;
      aceCount--;
    }
    return total;
  }
}
