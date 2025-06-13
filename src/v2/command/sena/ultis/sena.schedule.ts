import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EJackGameStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { MezonService } from 'src/v2/mezon/mezon.service';
import { EMessagePayloadType, EMessageType } from 'src/v2/mezon/types/mezon';

@Injectable()
export class SenaChedule {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mezon: MezonService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async cancleExpireWaitingGames() {
    const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000);
    console.log('one minutes', oneMinuteAgo);
    const expiredGames = await this.prisma.blackJackGame.findMany({
      where: {
        status: EJackGameStatus.WAITING,
        updatedAt: { lt: oneMinuteAgo },
      },
    });

    for (const game of expiredGames) {
      try {
        await this.prisma.blackJackGame.update({
          where: { id: game.id },
          data: { status: EJackGameStatus.ENDED },
        });
        const mess = await this.mezon.updateMessage({
          channel_id: game.channelId,
          message_id: game.messageId,
          content: {
            type: EMessagePayloadType.SYSTEM,
            content: `⏰ Game giữa ${game.hostName} và ${game.guestName} đã bị hủy do chờ quá lâu.`,
          },
        });
        await this.mezon.sendMessage({
          type: EMessageType.CHANNEL,
          reply_to_message_id: mess.id,
          payload: {
            channel_id: game.channelId,
            message: {
              type: EMessagePayloadType.SYSTEM,
              content: `⏰ Game giữa ${game.hostName} và ${game.guestName} đã bị hủy do chờ quá lâu.`,
            },
          },
        });
      } catch (err) {
        console.error('Lỗi khi update hoặc gửi message:', err);
      }
    }
  }
}
