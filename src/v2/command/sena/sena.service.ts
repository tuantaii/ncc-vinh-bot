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
import { EMPTY_BALANCE_MESSAGES } from './constansts';
import { random } from 'src/common/utils/helper';
import { EMessageMode } from 'src/common/enums/mezon.enum';

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
      const message = random(EMPTY_BALANCE_MESSAGES);
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
      case 'agree':
        return this.handleAgreeButton(data);
      case ButtonKey.HIT:
        return this.handleHitButton(data);
      case ButtonKey.STAND:
        return this.handleStandButton(data);
    }
  }

  async sendCardMessageToUser(userId: string, cards: number[]) {
    try {
      const sentMessage = await this.mezon.sendMessage({
        type: 'dm',
        payload: {
          clan_id: '0',
          user_id: userId,
          message: {
            type: 'system',
            content: `Bài của bạn là ${cards.map(this.getCardDisplay).join(', ')}, Tổng điểm là ${this.calculateHandValue(cards)}`,
          },
        },
      });
      return sentMessage;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async sendCardMessageToChannel(
    channelId: string,
    userName: string,
    cards: number[],
  ) {
    try {
      const sentMessage = await this.mezon.sendMessage({
        type: 'channel',
        payload: {
          channel_id: channelId,
          message: {
            type: 'system',
            content: `Bài của ${userName} là ${cards.map(this.getCardDisplay).join(', ')}, Tổng điểm là ${this.calculateHandValue(cards)}`,
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
    const game = await this.prisma.jack_game.findFirst({
      where: {
        message_id,
        status: EJackGameStatus.PLAYING,
      },
    });
    if (!game) return;

    if (game.only_for_user_id == user_id) {
      const { only_for_user_name } = game;
      const message = `${only_for_user_name} đang rút...`;

      await this.mezon.updateMessage({
        channel_id: game.channel_id,
        message_id,
        content: {
          type: 'optional',
          content: {
            t: message,
            components: this.createActionButtons(),
          },
        },
      });

      const cards = Array.from({ length: 52 }, (_, i) => i);
      const deck = this.shuffle(cards);

      const hostCards = [deck[0], deck[2]];
      const playerCards = [deck[1], deck[3]];
      const remainingDeck = deck.slice(4);

      const playerMessage = await this.sendCardMessageToUser(
        game.only_for_user_id,
        playerCards,
      );

      await this.prisma.jack_game.update({
        where: { id: game.id },
        data: {
          turn: user_id,
          playerA_hand: hostCards,
          playerB_hand: playerCards,
          deck: remainingDeck,
          metadata: {
            playerMessageId: playerMessage.message_id,
            playerChannelId: playerMessage.channel_id,
          },
        },
      });
    }
  }

  async handleHitButton(data: MessageButtonClickedEvent) {
    const { message_id, user_id } = data;
    const game = await this.prisma.jack_game.findFirst({
      where: {
        message_id,
        status: EJackGameStatus.PLAYING,
      },
    });
    if (!game) return;

    if (game.turn === user_id) {
      const { metadata, deck } = game;

      const handField =
        user_id === game.user_id_create ? 'playerA_hand' : 'playerB_hand';
      const currentHand = (game[handField] || []) as number[];
      const totalPoint = this.calculateHandValue(currentHand);

      if (handField === 'playerB_hand') {
        const { playerMessageId, playerChannelId } = metadata as any;

        const card = deck.pop()!;
        currentHand.push(card);

        let message = `Bài của bạn là ${currentHand.map(this.getCardDisplay).join(', ')}, Tổng điểm là ${this.calculateHandValue(currentHand)}`;
        const sentMessage = await this.mezon.updateMessage({
          channel_id: playerChannelId,
          message_id: playerMessageId,
          content: {
            type: 'normal_text',
            content: message,
          },
        });
        const isStoodTurn = !(currentHand.length == 5);

        let hostMessage: ChannelMessageAck | undefined;

        if (isStoodTurn) {
          hostMessage = await this.sendCardMessageToUser(
            game.user_id_create,
            game.playerA_hand,
          );
        }

        await this.prisma.jack_game.update({
          where: { id: game.id },
          data: {
            deck,
            [handField]: currentHand,
            playerB_stood: isStoodTurn,
            turn: !isStoodTurn ? game.user_id_create : game.only_for_user_id,
            metadata: {
              ...((metadata || {}) as Record<string, any>),
              playerMessageId: sentMessage.message_id,
              playerChannelId: sentMessage.channel_id,
              ...(hostMessage && {
                hostMessageId: hostMessage.message_id,
                hostChannelId: hostMessage.channel_id,
              }),
            },
          },
        });

        const { only_for_user_name, user_name_create, playerA_hand } = game;

        message =
          currentHand.length == 5
            ? `${only_for_user_name} đã dằn.
            \n${user_name_create} đang có ${playerA_hand.length} lá bài
            \n${user_name_create} đang rút...`
            : `${only_for_user_name} đang có ${currentHand.length} lá bài
            \n${only_for_user_name} đang rút...`;

        await this.mezon.updateMessage({
          channel_id: game.channel_id,
          message_id,
          content: {
            type: 'optional',
            content: {
              t: message,
              components: this.createActionButtons(),
            },
          },
        });
      } else {
        const { hostMessageId, hostChannelId } = metadata as any;

        const card = deck.pop()!;
        currentHand.push(card);

        let message = `Bài của bạn là ${currentHand.map(this.getCardDisplay).join(', ')}, Tổng điểm là ${this.calculateHandValue(currentHand)}`;
        const sentMessage = await this.mezon.updateMessage({
          channel_id: hostChannelId,
          message_id: hostMessageId,
          content: {
            type: 'normal_text',
            content: message,
          },
        });

        await this.prisma.jack_game.update({
          where: { id: game.id },
          data: {
            deck,
            status:
              currentHand.length == 5
                ? EJackGameStatus.ENDED
                : EJackGameStatus.PLAYING,
            [handField]: currentHand,
            playerA_stood: !(currentHand.length == 5),
            metadata: {
              ...((metadata || {}) as Record<string, any>),
              hostMessageId: sentMessage.message_id,
              hostChannelId: sentMessage.channel_id,
            },
          },
        });

        const { only_for_user_name, user_name_create, playerB_hand } = game;

        message =
          currentHand.length == 5
            ? `
            ${user_name_create} đang có ${currentHand.length} lá bài: ${currentHand.map(this.getCardDisplay).join(', ')} => Tổng: ${this.calculateHandValue(currentHand)}
            \n${only_for_user_name} đang có ${playerB_hand.length} lá bài: ${playerB_hand.map(this.getCardDisplay).join(', ')} => Tổng: ${this.calculateHandValue(playerB_hand)}
            `
            : `${only_for_user_name} đã dằn.
            \n${user_name_create} đang có ${currentHand.length} lá bài
            \n${user_name_create} đang rút...`;

        await this.mezon.updateMessage({
          channel_id: game.channel_id,
          message_id,
          content: {
            type: 'optional',
            content: {
              t: message,
              components:
                currentHand.length == 5 ? [] : this.createActionButtons(),
            },
          },
        });
      }
    }
  }

  async handleStandButton(data: MessageButtonClickedEvent) {
    const { message_id, user_id } = data;
    const game = await this.prisma.jack_game.findFirst({
      where: {
        message_id,
      },
    });
    if (!game) return;

    if (game.turn === user_id) {
      const { playerA_stood, playerB_stood, user_id_create, only_for_user_id } =
        game;

      const isHost = user_id == user_id_create;

      let hostMessage: ChannelMessageAck | undefined;
      if (!isHost) {
        hostMessage = await this.sendCardMessageToUser(
          user_id_create,
          game.playerA_hand,
        );
      }

      await this.prisma.jack_game.update({
        where: { id: game.id },
        data: {
          playerA_stood: isHost ? true : playerA_stood,
          playerB_stood: !isHost ? true : playerB_stood,
          turn: isHost ? only_for_user_id : user_id_create,
          metadata: {
            ...((game.metadata || {}) as Record<string, any>),
            ...(hostMessage && {
              hostMessageId: hostMessage.message_id,
              hostChannelId: hostMessage.channel_id,
            }),
          },
        },
      });
      const {
        user_name_create,
        only_for_user_name,
        playerA_hand: currentHand,
        playerB_hand,
      } = game;

      const message =
        currentHand.length == 5
          ? `
            ${user_name_create} đang có ${currentHand.length} lá bài: ${currentHand.map(this.getCardDisplay).join(', ')} => Tổng: ${this.calculateHandValue(currentHand)}
            \n${only_for_user_name} đang có ${playerB_hand.length} lá bài: ${playerB_hand.map(this.getCardDisplay).join(', ')} => Tổng: ${this.calculateHandValue(playerB_hand)}
            `
          : `${only_for_user_name} đã dằn.
            \n${user_name_create} đang có ${currentHand.length} lá bài
            \n${user_name_create} đang rút...`;

      await this.mezon.updateMessage({
        channel_id: game.channel_id,
        message_id,
        content: {
          type: 'optional',
          content: {
            t: message,
            components:
              currentHand.length == 5
                ? []
                : [
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
                          id: 'stand',
                          type: EMessageComponentType.BUTTON,
                          component: {
                            label: 'Dừng',
                            style: EButtonMessageStyle.DANGER,
                          },
                        },
                      ],
                    },
                  ],
          },
        },
      });
    }
  }

  private getCardDisplay(index: number): string {
    const suit = SUITS[Math.floor(index / 13)];
    const rank = RANKS[index % 13];
    return `${rank}${suit}`;
  }

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
        type: 'channel',
        payload: {
          channel_id: data.channel_id,
          message: {
            type: 'system',
            content: message,
          },
        },
      });
      return;
    }
    if (!partnerId) {
      const message = `😅Bạn không có đối thủ. Hãy rep tin nhắn ai đó`;
      await this.mezon.sendMessage({
        type: 'channel',
        payload: {
          channel_id: data.channel_id,
          message: {
            type: 'system',
            content: message,
          },
        },
      });
      return;
    }

    const isExistedGame = await this.prisma.jack_game.findFirst({
      where: {
        user_id_create: data.sender_id,
        only_for_user_id: partnerId,
        status: EJackGameStatus.PLAYING,
      },
    });

    if (isExistedGame) {
      const message = `😅Bạn đã có game đang diễn ra. Hãy chờ game kết thúc`;
      await this.mezon.sendMessage({
        type: 'channel',
        payload: {
          channel_id: data.channel_id,
          message: {
            type: 'system',
            content: message,
          },
        },
      });
      return;
    }

    const m = `🔃Đang thiết lập game...`;
    const promiseMessage = await this.mezon.sendMessage({
      type: 'channel',
      payload: {
        channel_id: data.channel_id,
        message: {
          type: 'system',
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
          type: 'optional',
          content: {
            t: `Xì rách giữa ${data.username} và ${data.references?.[0]?.message_sender_username}\n💰. Đồng ý = reply lên phím "36"`,
            components: [
              {
                components: [
                  {
                    id: 'agree',
                    type: EMessageComponentType.BUTTON,
                    component: {
                      label: '36',
                      style: EButtonMessageStyle.SUCCESS,
                    },
                  },
                  {
                    id: 'disagree',
                    type: EMessageComponentType.BUTTON,
                    component: {
                      label: 'Trốn',
                      style: EButtonMessageStyle.DANGER,
                    },
                  },
                ],
              },
            ],
          },
        },
      }),
      this.prisma.jack_game.create({
        data: {
          status: EJackGameStatus.PLAYING,
          user_id_create: data.sender_id,
          cost: 0,
          only_for_user_id: partnerId,
          channel_id: promiseMessage.channel_id,
          message_id: promiseMessage.message_id,
          clan_id: data.clan_id!,
          is_public_channel: data.is_public || false,
          user_name_create: data.username!,
          only_for_user_name: data.references?.[0]?.message_sender_username,
          mode: String(data.mode || EMessageMode.CHANNEL_MESSAGE),
        },
      }),
    ]);
  }

  public shuffle(deck: number[]): number[] {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
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
