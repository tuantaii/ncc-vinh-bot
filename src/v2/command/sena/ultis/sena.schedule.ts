import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EJackGameStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { MezonService } from 'src/v2/mezon/mezon.service';
import { EMessagePayloadType, EMessageType } from 'src/v2/mezon/types/mezon';
import { SenaMessageService, SenaWalletService } from '../service';
import type { ApiMessageMention } from 'mezon-sdk';

@Injectable()
export class SenaChedule {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mezon: MezonService,
    private readonly walletService: SenaWalletService,
    private readonly messageService: SenaMessageService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async cancleExpireWaitingGames() {
    const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000);
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
      } catch (err) {
        console.error('Lỗi khi update hoặc gửi message:', err);
      }
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async cancleExpirePlayingGames() {
    const tenMinuteAgo = new Date(Date.now() - 10 * 60 * 1000);
    const expiredGames = await this.prisma.blackJackGame.findMany({
      where: {
        status: EJackGameStatus.PLAYING,
        updatedAt: { lt: tenMinuteAgo },
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

        const totalLock = game.cost ? game.cost * 3 : 0;
        if (totalLock > 0) {
          await this.walletService.refundedLock(game, totalLock);

          const content = `💸 Game lỗi ~ Hủy game! Hoàn tiền cho @${game.hostName} và @${game.guestName} thành công`;

          const mentions: ApiMessageMention[] = [];

          const hostTag = `@${game.hostName}`;
          const guestTag = `@${game.guestName}`;

          const hostIndex = content.indexOf(hostTag);
          if (hostIndex !== -1) {
            mentions.push({
              user_id: game.hostId,
              username: game.hostName,
              s: hostIndex,
              e: hostIndex + hostTag.length,
            });
          }

          const guestIndex = content.indexOf(guestTag);
          if (guestIndex !== -1) {
            mentions.push({
              user_id: game.guestId,
              username: game.guestName,
              s: guestIndex,
              e: guestIndex + guestTag.length,
            });
          }

          const aaaa = await this.messageService.sendSystemMessage(
            game.channelId,
            content,
            game.messageId,
            mentions,
          );
        }
      } catch (err) {
        console.error('Lỗi khi update hoặc gửi message:', err);
      }
    }
  }
}
