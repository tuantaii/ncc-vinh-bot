import { Inject, Injectable } from '@nestjs/common';
import {
  ApiMessageAttachment,
  ChannelMessageAck,
  ChannelMessageContent,
  EMarkdownType,
  MezonClient,
} from 'mezon-sdk';
import {
  EMessagePayloadType,
  EMessageType,
  MezonSendMessage,
  MezonSendToken,
  MezonUpdateMessage,
} from './types/mezon';

@Injectable()
export class MezonService {
  constructor(@Inject('MEZON') private readonly mezonClient: MezonClient) {}

  async sendMessage(data: MezonSendMessage) {
    let sendFunction: any;
    if (data.type === EMessageType.CHANNEL) {
      let root: any;
      if (data.clan_id) {
        const clan = await this.mezonClient.clans.fetch(data.clan_id);
        if (!clan?.id) {
          throw new Error(`Clan ${data.clan_id} not found`);
        }
        root = clan;
      } else {
        root = this.mezonClient;
      }

      const channel = await root.channels.fetch(data.payload.channel_id);
      if (!channel?.id) {
        throw new Error(`Channel ${data.payload.channel_id} not found`);
      }

      sendFunction = channel.send.bind(channel);

      if (data.reply_to_message_id) {
        const message = await channel.messages.fetch(data.reply_to_message_id);
        if (!message?.id) {
          throw new Error(
            `Message ${data.reply_to_message_id} not found in channel ${channel.id}`,
          );
        }
        sendFunction = message.reply.bind(message);
      }
    } else if (data.type === EMessageType.DM) {
      const clan = await this.mezonClient.clans.fetch(data.payload.clan_id);

      if (!clan?.id) {
        throw new Error(`Clan ${data.payload.clan_id} not found`);
      }

      const user = await clan.users.fetch(data.payload.user_id);
      if (!user?.id) {
        throw new Error(
          `User ${data.payload.user_id} not found in clan ${clan.id}`,
        );
      }
      sendFunction = user.sendDM.bind(user);
    }

    let newMessage: ChannelMessageContent;

    if (data.payload.message.type === EMessagePayloadType.OPTIONAL) {
      newMessage = data.payload.message.content;
    } else {
      newMessage = {
        t: data.payload.message.content,
        mk:
          data.payload.message.type === EMessagePayloadType.NORMAL_TEXT
            ? []
            : [
                {
                  type: EMarkdownType.PRE,
                  s: 0,
                  e: data.payload.message.content.length,
                },
              ],
      };
    }

    const args: any[] = [newMessage];

    if (data.payload.mentions && data.payload.mentions.length > 0) {
      args.push(data.payload.mentions);
    }

    if (data.payload.images && Array.isArray(data.payload.images)) {
      const attachments: ApiMessageAttachment[] = [];
      for (const image of data.payload.images) {
        if (typeof image === 'string') {
          attachments.push({
            url: image,
            filename: 'image.png',
            filetype: 'image/jpeg',
            width: 200,
            height: 200,
          });
        } else {
          attachments.push(image);
        }
      }
      args[2] = attachments;
    }

    switch (data.payload.message.type) {
      case EMessagePayloadType.NORMAL_TEXT:
        return (await sendFunction(...args)) as ChannelMessageAck;

      case EMessagePayloadType.SYSTEM:
        return (await sendFunction(
          {
            ...newMessage,
            mk: [
              {
                type: EMarkdownType.PRE,
                s: 0,
                e: data.payload.message.content.length,
              },
            ],
          },
          data.payload.mentions,
        )) as ChannelMessageAck;

      case EMessagePayloadType.OPTIONAL:
        return (await sendFunction(...args)) as ChannelMessageAck;
    }
  }

  async updateMessage(data: MezonUpdateMessage) {
    let root: any;
    if (data.clan_id) {
      const clan = await this.mezonClient.clans.fetch(data.clan_id);
      if (!clan?.id) {
        throw new Error(`Clan ${data.clan_id} not found`);
      }
      root = clan;
    } else {
      root = this.mezonClient;
    }
    const channel = await root.channels.fetch(data.channel_id);
    if (!channel?.id) {
      throw new Error(`Channel ${data.channel_id} not found`);
    }

    const message = await channel.messages.fetch(data.message_id);
    if (!message?.id) {
      throw new Error(
        `Message ${data.message_id} not found in channel ${channel.id}`,
      );
    }

    if (data.content.type === EMessagePayloadType.NORMAL_TEXT) {
      return message.update({
        t: data.content.content,
      });
    } else if (data.content.type === EMessagePayloadType.SYSTEM) {
      return message.update({
        t: data.content.content,
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: data.content.content.length,
          },
        ],
      });
    } else if (data.content.type === EMessagePayloadType.OPTIONAL) {
      return message.update(data.content.content);
    }
  }

  async sendMessageEphemeral(
    data: MezonSendMessage & { user_id: string; reference_message_id?: string },
  ) {
    const root = this.mezonClient;

    if (data.type !== EMessageType.CHANNEL) {
      throw new Error('Ephemeral message chỉ hỗ trợ gửi vào channel');
    }

    const channel = await root.channels.fetch(data.payload.channel_id);
    if (!channel?.id) {
      throw new Error(`Channel ${data.payload.channel_id} not found`);
    }

    let content: ChannelMessageContent;
    if (data.payload.message.type === EMessagePayloadType.OPTIONAL) {
      content = data.payload.message.content;
    } else {
      content = {
        t: data.payload.message.content,
        mk:
          data.payload.message.type === EMessagePayloadType.NORMAL_TEXT
            ? []
            : [
                {
                  type: EMarkdownType.PRE,
                  s: 0,
                  e: data.payload.message.content.length,
                },
              ],
      };
    }

    let attachments: ApiMessageAttachment[] | undefined = undefined;
    if (data.payload.images && Array.isArray(data.payload.images)) {
      attachments = data.payload.images.map((image) =>
        typeof image === 'string'
          ? {
              url: image,
              filename: 'image.png',
              width: 200,
              height: 200,
            }
          : image,
      );
    }

    return await channel.sendEphemeral(
      data.user_id,
      content,
      data.reply_to_message_id,
      data.payload.mentions,
      attachments,
    );
  }

  async deleteMessage(channel_id: string, message_id: string) {
    const channel = await this.mezonClient.channels.fetch(channel_id);
    if (!channel?.id) throw new Error(`Channel ${channel_id} not found`);
    const message = await channel.messages.fetch(message_id);
    if (!message?.id) throw new Error(`Message ${message_id} not found`);
    await message.delete();
  }

  async sendToken(data: MezonSendToken) {
    return this.mezonClient.sendToken({
      receiver_id: data.user_id,
      amount: data.amount,
      note: data.note,
    });
  }
}
