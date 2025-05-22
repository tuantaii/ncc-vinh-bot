import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Events } from 'mezon-sdk';
import { ChannelMessage } from 'mezon-sdk';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SenaLogService {
  constructor(private readonly prisma: PrismaService) {}

  @OnEvent(Events.ChannelMessage)
  async handleChannelMessage(message: ChannelMessage) {
    if (message.display_name === 'SENA') return;
    await this.prisma.message_logs.create({
      data: {
        message_id: message.message_id!,
        sender_avatar: message.avatar!,
        sender_name: message.display_name!,
        sender_id: message.sender_id,
        sender_username: message.username!,
        content: JSON.stringify(message.content),
        channel_id: message.channel_id,
        clan_id: message.clan_id!,
        clan_avatar: message.clan_avatar!,
        clan_name: message.clan_nick!,
        clan_username: message.clan_id!,
        channel_label: message.channel_label,
        display_name: message.display_name,
      },
    });
  }
}
