import { ChannelMessageContent } from 'mezon-sdk';

declare global {
  type MezonSendMessageToChannelCore = {
    clan_id: string;
    channel_id: string;
    is_public: boolean;
    mode: EMessageMode;
    msg: ChannelMessageContent;
    mentions?: Array<ApiMessageMention>;
    attachments?: Array<ApiMessageAttachment>;
    ref?: Array<ApiMessageRef>;
  };

  type MezonSendMessageToUserCore = {
    channelDmId: string;
    textContent: string;
    messOptions: any;
    attachments: Array<ApiMessageAttachment>;
    refs: Array<ApiMessageRef>;
  };

  type MezonReactMessageChannelCore = {
    clan_id: string;
    channel_id: string;
    message_id: string;
    reaction: string;
    is_public: boolean;
    emoji_id: string;
    emoji: string;
    count: number;
    message_sender_id: string;
  };

  type MezonMessageToChannel = Pick<
    MezonSendMessageToChannelCore,
    | 'clan_id'
    | 'channel_id'
    | 'is_public'
    | 'mode'
    | 'msg'
    | 'mentions'
    | 'attachments'
    | 'ref'
  >;

  type MezonClientConfig = {
    token: string;
  };

  interface MezonModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
    useFactory?: (...args: any[]) => Promise<any> | any;
    inject?: any[];
  }

  type ReplyMezonMessage = {
    message: string;
    messageMode: EMessageMode;
    isPublic: boolean;
    blockMessage: boolean;
    clan?: {
      id: string;
    };
    channel?: {
      id: string;
    };
    mezonUserId?: string;
  };

  type ReplyContentType = {
    messageContent?: string;
    clan_id?: string;
    channel_id?: string;
    mode?: number;
    is_public?: boolean;
    mentions?: unknown[];
    attachments?: unknown[];
    lk?: unknown;
    hg?: unknown; // for channel
    mk?: unknown; // for send message to user
    ej?: unknown;
    vk?: unknown;
    contentThread?: unknown;
  };
}

export {};
