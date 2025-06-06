import { Injectable } from '@nestjs/common';
import { EJackGameStatus, ETransactionType } from '@prisma/client';
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
import {
  DOUBLE_COST_SCORE,
  EMPTY_BALANCE_MESSAGES,
  GAME_RESULT,
  gameMessages,
  MAX_CARDS,
  MIN_SCORE,
} from './constansts';
import { Game } from './game';
import { MessageButtonClickedEvent } from './types';
import { GameMetadata } from './types/game';

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
        '💸Bạn đang chơi game, không thể rút tiền, tính trốn à?????';
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
    if (!userBalance || userBalance.balance < amount || amount <= 1000) {
      const message = `💸Số dư của bạn không đủ để rút hoặc số tiền rút không hợp lệ, số tiền phải lớn hơn hoặc bằng 1000`;
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

      // game.guestCards = [0, 1, 2, 3]; // Set guest's initial cards to Ace of Spades and 2 of Hearts for test ting

      const guestCardsString = game.guestCards
        .map(this.getCardDisplay)
        .join(', ');

      const hostCardsString = game.hostCards
        .map(this.getCardDisplay)
        .join(', ');

      await Promise.all([
        this.prisma.blackJackGameLogs.create({
          data: {
            gameId: game.id,
            userId: game.guestId,
            card: guestCardsString,
          },
        }),

        this.prisma.blackJackGameLogs.create({
          data: {
            gameId: game.id,
            userId: game.hostId,
            card: hostCardsString,
          },
        }),
      ]);

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
        await this.updateUserBalanceAfterGame(game, earlyWin);

        if (earlyWin === GAME_RESULT.HOST_WIN && game.hostScore.isDoubleAce) {
          content = gameMessages.doubleAce({
            winnerName: game.hostName,
            loserName: game.guestName,
            cost: game.cost * 3,
          });
        } else if (
          earlyWin === GAME_RESULT.GUEST_WIN &&
          game.guestScore.isDoubleAce
        ) {
          content = gameMessages.doubleAce({
            winnerName: game.guestName,
            loserName: game.hostName,
            cost: game.cost * 3,
          });
        } else if (
          earlyWin === GAME_RESULT.HOST_WIN &&
          game.hostScore.isBlackjack
        ) {
          content = gameMessages.blackjack({
            winnerName: game.hostName,
            loserName: game.guestName,
            cost: game.cost * 2,
          });
        } else if (
          earlyWin === GAME_RESULT.GUEST_WIN &&
          game.guestScore.isBlackjack
        ) {
          content = gameMessages.blackjack({
            winnerName: game.guestName,
            loserName: game.hostName,
            cost: game.cost * 2,
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
            cost: game.cost,
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
        isDoubleAce: game.guestScore.isDoubleAce,
      });

      const cardIndex = game.guestCards[game.guestCards.length - 1];

      const cardString = this.getCardDisplay(cardIndex);

      await this.prisma.blackJackGameLogs.create({
        data: {
          gameId: game.id,
          userId: game.guestId,
          card: cardString,
        },
      });

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

      const cardIndex = game.hostCards[game.hostCards.length - 1];

      const cardString = this.getCardDisplay(cardIndex);

      await this.prisma.blackJackGameLogs.create({
        data: {
          gameId: game.id,
          userId: game.hostId,
          card: cardString,
        },
      });

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
            cost: game.cost,
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

    const isHost = userId === game.hostId;
    const score = isHost
      ? this.calculateHandValue(game.hostCards)
      : this.calculateHandValue(game.guestCards);

    if (score < MIN_SCORE) {
      const message = `Điểm của bạn là ${score}, không thể dừng lại. Bạn phải rút thêm bài. Rút mạnh đê bạn sợ à?`;
      await this.mezon.updateMessage({
        channel_id: record.channelId,
        message_id: record.messageId,
        content: {
          type: EMessagePayloadType.OPTIONAL,
          content: {
            t: message,
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

    const bothStand = game.isHostStand && game.isGuestStand;

    if (bothStand) {
      const guestFive = game.isFiveSprits('guest');
      const hostFive = game.isFiveSprits('host');

      let systemMessageText = '';
      if (guestFive && hostFive) {
        game.end();
        await this.updateUserBalanceAfterGame(game, GAME_RESULT.DRAW);
        systemMessageText = `Cả ${guestName} và ${hostName} đều ngũ linh. HÒA!`;
      } else if (guestFive) {
        game.end();
        await this.updateUserBalanceAfterGame(game, GAME_RESULT.GUEST_WIN);
        systemMessageText = gameMessages.fiveSprits({
          winnerName: guestName,
          loserName: hostName,
          cost: game.cost * 2,
        });
      } else if (hostFive) {
        game.end();
        await this.updateUserBalanceAfterGame(game, GAME_RESULT.HOST_WIN);
        systemMessageText = gameMessages.fiveSprits({
          winnerName: hostName,
          loserName: guestName,
          cost: game.cost * 2,
        });
      }

      if (systemMessageText) {
        await Promise.all([
          this.mezon.updateMessage({
            channel_id: record.channelId,
            message_id: record.messageId,
            content: {
              type: EMessagePayloadType.SYSTEM,
              content: systemMessageText,
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
        return;
      }
    }

    const isEnded = status === EJackGameStatus.ENDED;

    let systemMessageText = '';
    if (isEnded) {
      await this.updateUserBalanceAfterGame(game, result);
      if (
        hostScore.value >= DOUBLE_COST_SCORE &&
        guestScore.value < DOUBLE_COST_SCORE
      ) {
        systemMessageText = gameMessages.overScoreDoubleCost({
          loserName: hostName,
          cost: game.cost * 2,
        });
      } else if (
        guestScore.value >= DOUBLE_COST_SCORE &&
        hostScore.value < DOUBLE_COST_SCORE
      ) {
        systemMessageText = gameMessages.overScoreDoubleCost({
          loserName: guestName,
          cost: game.cost * 2,
        });
      } else {
        systemMessageText = gameMessages[result]({
          hostName,
          hostCardDisplay: hostCards.map(this.getCardDisplay).join(', '),
          hostScore: hostScore.value,
          guestName,
          guestCardDisplay: guestCards.map(this.getCardDisplay).join(', '),
          guestScore: guestScore.value,
          cost: game.cost,
        });
      }
    } else {
      systemMessageText = gameMessages.guestPlayerStood({
        hostName,
        guestName,
      });
    }

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

  public async createDeck(data: ChannelMessage, amount: number) {
    let partnerId: string | undefined;
    let parterName: string | undefined;
    if (data.content.t?.includes('@')) {
      const mention = data.mentions?.[0];
      if (mention) {
        const m = data.content.t.split(' ');
        partnerId = mention.user_id;
        parterName = m[1].slice(1);
        amount = Number(m[2]);
        if (isNaN(amount)) return;
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

    if (amount < 0 || amount > 1000000 || isNaN(amount)) {
      const message = `😅Số tiền cược không hợp lệ. Vui lòng nhập số tiền từ 0 đến 1.000.000 token`;
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
      const message = `😅Số dư của đối thủ không đủ để cược ${amount} token (phải ≥ ${amount * 3} token để phòng trường hợp x3). Vui lòng chọn số tiền nhỏ hơn hoặc bằng ${Math.floor(pBalance.balance / 3)} token`;
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
      const message = `😅Số dư của bạn không đủ để cược ${amount} token (phải ≥ ${amount * 3} token để phòng trường hợp x3). Vui lòng chọn số tiền nhỏ hơn hoặc bằng ${Math.floor(mBalance.balance / 3)} token`;
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
            t: `Xì rách giữa ${data.username} và ${parterName}\n💰Cược ${amount} token. Đồng ý = click lên phím "36"`,
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

  private checkGuestOrHostHit(game: Game, userId: string) {
    const cardIndex = game.hitCard.length - 1;

    const cardString = this.getCardDisplay(cardIndex);

    this.prisma.blackJackGameLogs.create({
      data: {
        gameId: game.id,
        userId: userId,
        card: cardString,
      },
    });
  }

  private getRewardMultiplier(game: Game, result: GAME_RESULT): number {
    const hostScore = game.hostScore.value;
    const guestScore = game.guestScore.value;

    if (result === GAME_RESULT.HOST_WIN) {
      if (game.hostScore.isDoubleAce) return 3;
      if (
        game.hostScore.isBlackjack ||
        game.hostScore.isFiveSprits ||
        hostScore >= DOUBLE_COST_SCORE ||
        guestScore >= DOUBLE_COST_SCORE
      )
        return 2;
      return 1;
    }

    if (result === GAME_RESULT.GUEST_WIN) {
      if (game.guestScore.isDoubleAce) return 3;
      if (
        game.guestScore.isBlackjack ||
        game.guestScore.isFiveSprits ||
        hostScore >= DOUBLE_COST_SCORE ||
        guestScore >= DOUBLE_COST_SCORE
      )
        return 2;
      return 1;
    }

    return 0;
  }

  private async updateUserBalanceAfterGame(game: Game, result: GAME_RESULT) {
    const multiplier = this.getRewardMultiplier(game, result);
    let hostReward = 0;
    let guestReward = 0;

    const reward = game.cost * multiplier;
    if (result === GAME_RESULT.HOST_WIN) {
      hostReward = reward;
      guestReward = -reward;
    } else if (result === GAME_RESULT.GUEST_WIN) {
      hostReward = -reward;
      guestReward = reward;
    }

    try {
      await Promise.all([
        this.prisma.userBalance.update({
          where: { userId: game.hostId },
          data: { balance: { increment: hostReward } },
        }),
        this.prisma.userBalance.update({
          where: { userId: game.guestId },
          data: { balance: { increment: guestReward } },
        }),
      ]);
      console.log('Balance updated successfully');
    } catch (err) {
      console.error('Error updating balance:', err);
    }
  }
}
