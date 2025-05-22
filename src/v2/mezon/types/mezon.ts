import { ApiMessageAttachment, ChannelMessageContent } from 'mezon-sdk';

export type MezonSendMessageBase = {
  type: 'channel' | 'dm';
  reply_to_message_id?: string;
};

export type MezonSendChannelMessage = MezonSendMessageBase & {
  clan_id?: string;
  type: 'channel';
  payload: {
    channel_id: string;
    message: MezonPayloadContent;
    images?: string[] | ApiMessageAttachment[];
  };
};

export type MezonSendDMMessage = MezonSendMessageBase & {
  type: 'dm';
  payload: {
    clan_id: string;
    user_id: string;
    message: MezonPayloadContent;
    images?: string[] | ApiMessageAttachment[];
  };
};

export type MezonPayloadContent =
  | {
      type: 'normal_text';
      content: string;
    }
  | {
      type: 'system';
      content: string;
    }
  | {
      type: 'optional';
      content: ChannelMessageContent;
    };

export type MezonSendMessage = MezonSendChannelMessage | MezonSendDMMessage;

export type MezonUpdateMessage = {
  clan_id?: string;
  channel_id: string;
  message_id: string;
  content: MezonPayloadContent;
};

export type MezonSendToken = {
  user_id: string;
  amount: number;
  note?: string;
};
