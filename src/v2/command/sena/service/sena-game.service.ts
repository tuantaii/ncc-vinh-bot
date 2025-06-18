import { Injectable } from '@nestjs/common';
import { EJackGameStatus, ETransactionType } from '@prisma/client';
import {
  ChannelMessage,
  EButtonMessageStyle,
  EMessageComponentType,
} from 'mezon-sdk';
import { PrismaService } from 'src/prisma/prisma.service';
import { MezonService } from 'src/v2/mezon/mezon.service';
import { EMessagePayloadType, EMessageType } from 'src/v2/mezon/types/mezon';
import { GAME_RESULT, gameMessages, MAX_CARDS, MIN_SCORE } from '../constansts';
import { Game } from '../game';
import { MessageButtonClickedEvent } from '../types';
import { GameMetadata } from '../types/game';
import { ButtonKey, SenaCaculator } from '../ultis';
import { SenaMessageService } from './sena-message.service';
import { SenaWalletService } from './sena-wallet.service';
import { EMessageMode } from 'src/common/enums/mezon.enum';

@Injectable()
export class SenaGameService {
  constructor(
    private readonly mezon: MezonService,
    private readonly messageService: SenaMessageService,
    private readonly walletService: SenaWalletService,
    private readonly prisma: PrismaService,
  ) {}
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private static createGameButtons() {
    return [
      {
        components: [
          {
            id: ButtonKey.AGREE,
            type: EMessageComponentType.BUTTON,
            component: { label: '36', style: EButtonMessageStyle.SUCCESS },
          },
          {
            id: ButtonKey.RUN,
            type: EMessageComponentType.BUTTON,
            component: { label: 'Trốn', style: EButtonMessageStyle.DANGER },
          },
          {
            id: ButtonKey.CANCEL,
            type: EMessageComponentType.BUTTON,
            component: { label: 'Hủy', style: EButtonMessageStyle.SECONDARY },
          },
        ],
      },
    ];
  }

  private static createActionButtons() {
    return [
      {
        components: [
          {
            id: ButtonKey.HIT,
            type: EMessageComponentType.BUTTON,
            component: { label: 'Rút', style: EButtonMessageStyle.SUCCESS },
          },
          {
            id: ButtonKey.STAND,
            type: EMessageComponentType.BUTTON,
            component: { label: 'Dừng', style: EButtonMessageStyle.DANGER },
          },
        ],
      },
    ];
  }

  public async createDeck(data: ChannelMessage, amount: number) {
    const { partnerId, partnerName, parsedAmount } =
      SenaGameService.parsePartnerInfo(data, amount);

    amount = parsedAmount;

    if (data.sender_id === partnerId) {
      return this.messageService.sendSystemMessage(
        data.channel_id,
        `😅 Chơi 1 mình?`,
      );
    }
    if (!partnerId) {
      return this.messageService.sendSystemMessage(
        data.channel_id,
        `😅 Bạn không có đối thủ. Hãy rep tin nhắn ai đó`,
      );
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
    const hostBalance = await this.getOrCreateUserBalance(
      data.sender_id,
      data.username!,
    );

    if (!this.hasEnoughBalance(hostBalance.balance, amount)) {
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

    const guestBalance = await this.getOrCreateUserBalance(
      partnerId,
      data.username!,
    );

    if (!this.hasEnoughBalance(guestBalance.balance, amount)) {
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
            t: `Xì rách giữa ${data.username} và ${partnerName}\n💰Cược ${SenaCaculator.formatVND(amount)} token. Đồng ý = click lên phím "36"`,
            components: SenaGameService.createGameButtons(),
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
          guestName: partnerName!,
          mode: String(data.mode || EMessageMode.CHANNEL_MESSAGE),
        },
      }),
    ]);
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
    await this.messageService.updateSystemMessage(
      record.channelId,
      record.messageId,
      message,
    );
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
            components: SenaGameService.createActionButtons(),
          },
        },
      });

      game.startGame();

      // game.hostCards = [0, 13];

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

      const [guestEphemeral, hostEphemeral] = await Promise.all([
        this.messageService.sendEphemeralCardMessage(
          record.channelId,
          game.guestId,
          game.guestCards,
          game.guestName,
          game.hostName,
        ),
        this.messageService.sendEphemeralCardMessage(
          record.channelId,
          game.hostId,
          game.hostCards,
          game.hostName,
          game.guestName,
        ),
      ]);

      const earlyWin = game.calculateEarlyWin();

      if (earlyWin === GAME_RESULT.HOST_WIN || earlyWin) {
        await this.handleEarlyWin(game, record, earlyWin);
        return;
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
            guestMessageId: guestEphemeral.message_id,
            guestChannelId: guestEphemeral.channel_id,
            hostMessageId: hostEphemeral.message_id,
            hostChannelId: hostEphemeral.channel_id,
            lockedAmount: totalLock,
          } as GameMetadata,
        },
      });
    } catch (err) {
      console.error('Error in handleAgreeButton:', err);
      if (lockSuccess) {
        await this.walletService.refundedLock(record, totalLock);
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
        const { content: systemMessageText, mentions } =
          this.messageService.generateTurnMessage({
            currentPlayerName: game.hostName,
            opponentName: game.guestName,
            cardCount: hostCardCount,
            currentPlayerId: game.hostId,
            opponentId: game.guestId,
            channelId: record.channelId,
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
                components: SenaGameService.createActionButtons(),
              },
            },
            mentions,
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
              components: SenaGameService.createActionButtons(),
            },
          },
        });
      }

      if (isGuestTurn) {
        await this.messageService.sendEphemeralCardMessage(
          record.channelId,
          game.guestId,
          game.guestCards,
          game.guestName,
          game.hostName,
        );
      } else {
        await this.messageService.sendEphemeralCardMessage(
          record.channelId,
          game.hostId,
          game.hostCards,
          game.hostName,
          game.guestName,
        );
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
      const { content: systemMessageText, mentions } =
        this.messageService.generateTurnMessage({
          currentPlayerName: game.hostName,
          opponentName: game.guestName,
          cardCount: hostCardCount,
          currentPlayerId: game.hostId,
          opponentId: game.guestId,
          channelId: record.channelId,
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
              components: SenaGameService.createActionButtons(),
            },
          },
          mentions,
        },
      });

      const updateMess = `${game.guestName} đã dừng. Đang chờ ${game.hostName}...`;
      await this.messageService.updateSystemMessage(
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
      await this.messageService.updateSystemMessage(
        record.channelId,
        record.messageId,
        content,
      );
    }
  }

  async handleEndGameNgulinh(game: Game, record: any) {
    const hostFive = game.hostScore.isFiveSprits;
    const guestFive = game.guestScore.isFiveSprits;
    const content =
      `Bài của ${game.hostName} là ${game.hostCards.map(SenaCaculator.getCardDisplay).join(', ')} => Tổng: ${game.hostScore.value}.\n` +
      `Bài của ${game.guestName} là ${game.guestCards.map(SenaCaculator.getCardDisplay).join(', ')} => Tổng: ${game.guestScore.value}.\n`;
    let resultMessage = '';

    if (guestFive && hostFive) {
      await this.walletService.updateUserBalanceAfterGame(
        game,
        GAME_RESULT.DRAW,
      );
      resultMessage =
        content + `Cả ${game.guestName} và ${game.hostName} đều ngũ linh. HÒA!`;
    } else if (guestFive) {
      await this.walletService.updateUserBalanceAfterGame(
        game,
        GAME_RESULT.GUEST_WIN,
      );
      resultMessage =
        content +
        gameMessages.fiveSprits({
          winnerName: game.guestName,
          loserName: game.hostName,
          cost: game.cost * 2,
        });
    } else if (hostFive) {
      await this.walletService.updateUserBalanceAfterGame(
        game,
        GAME_RESULT.HOST_WIN,
      );
      resultMessage =
        content +
        gameMessages.fiveSprits({
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
      await this.walletService.updateUserBalanceAfterGame(game, game.result);
    }

    await this.messageService.updateGameMessageOnEnd({
      channelId: record.channelId,
      messageId: record.messageId,
      hostName: game.hostName,
      guestName: game.guestName,
    });

    await this.messageService.sendGameResultMessage({
      channelId: record.channelId,
      replyToMessageId: record.messageId,
      hostName: game.hostName,
      guestName: game.guestName,
      resultMessage,
      hostId: game.hostId,
      guestId: game.guestId,
    });
  }

  async handleEarlyWin(
    game: Game,
    record: any,
    earlyWin: GAME_RESULT,
  ): Promise<void> {
    game.end();
    await this.walletService.updateUserBalanceAfterGame(game, earlyWin);

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

  private hasEnoughBalance(balance: number, amount: number): boolean {
    return balance >= amount * 3;
  }

  private async getOrCreateUserBalance(userId: string, username: string) {
    let balance = await this.prisma.userBalance.findUnique({
      where: { userId },
    });
    if (!balance) {
      balance = await this.prisma.userBalance.create({
        data: { userId, balance: 0, username },
      });
    }
    return balance;
  }

  private static parsePartnerInfo(data: ChannelMessage, amount: number) {
    let partnerId: string | undefined;
    let partnerName: string | undefined;
    let parsedAmount = amount;
    if (data.content.t?.includes('@')) {
      const mention = data.mentions?.[0];
      if (mention) {
        const m = data.content.t.trim().split(/\s+/);
        partnerId = mention.user_id;
        const mentionIdx = m.findIndex((x) => x.startsWith('@'));
        partnerName = m
          .slice(mentionIdx, m.length)
          .filter((x) => !/^\d+$/.test(x))
          .map((x) => (x.startsWith('@') ? x.slice(1) : x))
          .join(' ')
          .trim();
        for (let i = mentionIdx + 1; i < m.length; i++) {
          if (!isNaN(Number(m[i]))) {
            parsedAmount = Number(m[i]);
          }
        }
      }
    } else {
      partnerId = data.references?.[0]?.message_sender_id;
      partnerName = data.references?.[0]?.message_sender_username;
    }
    return { partnerId, partnerName, parsedAmount };
  }
}
