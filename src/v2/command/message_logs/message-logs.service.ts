import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Events } from 'mezon-sdk';
import { ChannelMessage } from 'mezon-sdk/dist/cjs/api/api';
import { PrismaService } from 'src/prisma/prisma.service';
import { BOT_NAME } from '../sena/constansts';

@Injectable()
export class SenaLogService {
  constructor(private readonly prisma: PrismaService) {}

  @OnEvent(Events.ChannelMessage)
  async handleChannelMessage(message: ChannelMessage) {
    if (message.display_name !== process.env.BOT_NAME) return;
    await this.prisma.messageLogs.create({
      data: {
        messageId: message.message_id!,
        senderAvatar: message.avatar!,
        senderName: message.display_name!,
        senderId: message.sender_id,
        senderUsername: message.username!,
        content: JSON.stringify(message.content),
        channelId: message.channel_id,
        clanId: message.clan_id!,
        clanAvatar: message.clan_avatar!,
        clanName: message.clan_nick!,
        clanUsername: message.clan_id!,
        channelLabel: message.channel_label,
        displayName: message.display_name,
      },
    });
  }
}
