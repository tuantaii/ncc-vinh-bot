import { Inject, Injectable } from '@nestjs/common';
import {
  ApiMessageMention,
  ChannelMessage,
  EMarkdownType,
  MezonClient,
} from 'mezon-sdk';
import { PrismaService } from 'src/prisma/prisma.service';
import { MezonService } from 'src/v2/mezon/mezon.service';
import { EMessagePayloadType, EMessageType } from 'src/v2/mezon/types/mezon';
import { gameMessages, HDSD, MYIMAGE_QR } from '../constansts';
import { SenaCaculator } from '../ultis';

@Injectable()
export class SenaMessageService {
  constructor(
    private readonly mezon: MezonService,
    private readonly prisma: PrismaService,
    @Inject('MEZON') private readonly mezonClient: MezonClient,
  ) {}

  async introduce(data: ChannelMessage) {
    const message = `👋 Chào nợ tộc, tao là Sena, thằng nào có tiền thì donate cho tao.`;

    await this.sendSystemMessage(data.channel_id, message, data.message_id);
  }

  async handleNhacaiCommand(data: ChannelMessage) {
    const content = `Nhà cái đây! 😎`;

    const result = await this.mezon.sendMessage({
      type: EMessageType.CHANNEL,
      payload: {
        channel_id: data.channel_id,
        message: {
          type: EMessagePayloadType.NORMAL_TEXT,
          content: content,
        },
        images: [MYIMAGE_QR],
      },
    });
    return result;
  }

  async sendSystemMessage(
    channel_id: string,
    content: string,
    reply_to_message_id?: string,
    mentions?: ApiMessageMention[],
  ) {
    return this.mezon.sendMessage({
      type: EMessageType.CHANNEL,
      reply_to_message_id,
      payload: {
        channel_id,
        message: {
          type:
            mentions && mentions.length > 0
              ? EMessagePayloadType.NORMAL_TEXT
              : EMessagePayloadType.SYSTEM,
          content,
        },
        mentions:
          mentions?.map((m) => ({
            user_id: m.user_id,
            channel_id,
            s: m.s,
            e: m.e,
          })) || [],
      },
    });
  }

  async updateSystemMessage(
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

  async sendEphemeralMessage(
    channel_id: string,
    user_id: string,
    content: string,
    reply_to_message_id?: string,
    mentions?: Array<{
      user_id: string;
      username: string;
    }>,
  ) {
    let messageContent = content;
    const apiMentions: Array<ApiMessageMention> = [];

    if (mentions && mentions.length > 0) {
      mentions.forEach((mention) => {
        const mentionString = mention.username;
        const regex = new RegExp(`\\b${mentionString}\\b`);
        const match = regex.exec(messageContent);
        if (match) {
          apiMentions.push({
            user_id: mention.user_id,
            channel_id: channel_id,
            s: match.index,
            e: match.index + mentionString.length,
          });
        }
      });
    }

    return this.mezon.sendMessageEphemeral({
      type: EMessageType.CHANNEL,
      payload: {
        channel_id,
        message: {
          type: EMessagePayloadType.NORMAL_TEXT,
          content: messageContent,
        },
        mentions: apiMentions,
      },
      user_id,
      reply_to_message_id,
    });
  }

  generateTurnMessage({
    currentPlayerName,
    opponentName,
    cardCount,
    currentPlayerId,
    opponentId,
    channelId,
  }: {
    currentPlayerName: string;
    opponentName: string;
    cardCount: number;
    currentPlayerId: string;
    opponentId: string;
    channelId: string;
  }): { content: string; mentions: ApiMessageMention[] } {
    let content: string;
    if (cardCount === 0) {
      content = `Tới lượt ${currentPlayerName}, rút hay dằn? Đối thủ: ${opponentName}`;
    } else {
      content = gameMessages.playerHitting({
        guestName: currentPlayerName,
        cardCount,
        hostName: opponentName,
      });
    }

    const apiMentions: Array<ApiMessageMention> = [];

    const currentPlayerMatch = new RegExp(`\\b${currentPlayerName}\\b`).exec(
      content,
    );
    const opponentMatch = new RegExp(`\\b${opponentName}\\b`).exec(content);

    if (currentPlayerMatch) {
      apiMentions.push({
        user_id: currentPlayerId,
        channel_id: channelId,
        s: currentPlayerMatch.index,
        e: currentPlayerMatch.index + currentPlayerName.length,
      });
    }

    if (opponentMatch) {
      apiMentions.push({
        user_id: opponentId,
        channel_id: channelId,
        s: opponentMatch.index,
        e: opponentMatch.index + opponentName.length,
      });
    }

    return { content, mentions: apiMentions };
  }

  async updateGameMessageOnEnd({
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

  async sendGameResultMessage({
    channelId,
    replyToMessageId,
    hostName,
    guestName,
    resultMessage,
    hostId,
    guestId,
  }: {
    channelId: string;
    replyToMessageId: string;
    hostName: string;
    guestName: string;
    resultMessage: string;
    hostId: string;
    guestId: string;
  }) {
    const normalContent = `🎲 Kết quả cuối cùng của ván bài giữa: ${hostName} và ${guestName} là:`;
    const messageContent = `${normalContent}\n${resultMessage}`;
    const apiMentions: Array<ApiMessageMention> = [];

    const hostMentionString = hostName;
    const guestMentionString = guestName;

    const hostMatch = new RegExp(`\\b${hostMentionString}\\b`).exec(
      messageContent,
    );
    const guestMatch = new RegExp(`\\b${guestMentionString}\\b`).exec(
      messageContent,
    );

    if (hostMatch) {
      apiMentions.push({
        user_id: hostId,
        channel_id: channelId,
        s: hostMatch.index,
        e: hostMatch.index + hostMentionString.length,
      });
    }

    if (guestMatch) {
      apiMentions.push({
        user_id: guestId,
        channel_id: channelId,
        s: guestMatch.index,
        e: guestMatch.index + guestMentionString.length,
      });
    }

    await this.mezon.sendMessage({
      type: EMessageType.CHANNEL,
      reply_to_message_id: replyToMessageId,
      payload: {
        channel_id: channelId,
        message: {
          type: EMessagePayloadType.OPTIONAL,
          content: {
            t: messageContent,
            mk: [
              {
                type: EMarkdownType.PRE,
                s: normalContent.length + 1,
                e: messageContent.length,
              },
            ],
          },
        },
        mentions: apiMentions,
      },
    });
  }

  async sendEphemeralCardMessage(
    channelId: string,
    userId: string,
    cards: number[],
    userName: string,
    opponentName?: string,
  ) {
    const normalContent = `Bài của ${userName} `;

    const cardsDisplay = cards.map(SenaCaculator.getCardDisplay).join(', ');
    const score = SenaCaculator.calculateHandValue(cards);
    const partner = opponentName ? `\nĐối thủ của bạn: ${opponentName}` : '';
    const systemContent = `${cardsDisplay}, Tổng điểm là ${score}${partner}`;

    return this.sendSplitEphemeralMessage(
      channelId,
      userId,
      normalContent,
      systemContent,
      [{ user_id: userId, username: userName }],
    );
  }

  async sendSplitEphemeralMessage(
    channel_id: string,
    user_id: string,
    normalContent: string,
    systemContent: string,
    mentions?: Array<{
      user_id: string;
      username: string;
    }>,
  ) {
    let messageContent = `${normalContent}\n${systemContent}`;
    const apiMentions: Array<ApiMessageMention> = [];

    if (mentions) {
      mentions.forEach((mention) => {
        const mentionString = mention.username;
        const regex = new RegExp(`\\b${mentionString}\\b`);
        const match = regex.exec(messageContent);
        if (match) {
          apiMentions.push({
            user_id: mention.user_id,
            channel_id: channel_id,
            s: match.index,
            e: match.index + mentionString.length,
          });
        }
      });
    }

    return this.mezon.sendMessageEphemeral({
      type: EMessageType.CHANNEL,
      payload: {
        channel_id,
        message: {
          type: EMessagePayloadType.OPTIONAL,
          content: {
            t: messageContent,
            mk: [
              {
                type: EMarkdownType.PRE,
                s: normalContent.length + 1,
                e: messageContent.length,
              },
            ],
          },
        },
        mentions: apiMentions,
      },
      user_id,
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

  async updateEphemeralCardMessage(
    channelId: string,
    messageId: string,
    cards: number[],
    userName: string,
    opponentName?: string,
  ) {
    const partner = opponentName ? `\nĐối thủ của bạn: ${opponentName}` : '';
    const content =
      gameMessages.userHand({
        userName,
        cardDisplay: cards.map(SenaCaculator.getCardDisplay).join(', '),
        score: SenaCaculator.calculateHandValue(cards),
        isDoubleAce: cards.length === 2 && cards.every((i) => i % 13 === 0),
      }) + partner;
    return this.mezon.updateMessage({
      channel_id: channelId,
      message_id: messageId,
      content: {
        type: EMessagePayloadType.SYSTEM,
        content,
      },
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
}
