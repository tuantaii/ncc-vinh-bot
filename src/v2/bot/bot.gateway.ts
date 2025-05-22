import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  ApiMessageReaction,
  MezonClient,
  Events,
  ChannelMessage,
  ChannelCreatedEvent,
  ChannelDeletedEvent,
  ChannelUpdatedEvent,
  UserChannelAddedEvent,
  UserClanRemovedEvent,
  TokenSentEvent,
} from 'mezon-sdk';
import { MezonService } from '../mezon/mezon.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
// import {
//   MessageButtonClickedEvent,
//   TokenSentEventI,
// } from 'src/fomu/command/topup/types';
import { RedisRepository } from 'src/core/redis/redis.repo';
import { MessageButtonClicked } from 'mezon-sdk/dist/cjs/rtapi/realtime';
import { BOT_NAME } from '../command/sena/constansts';

@Injectable()
export class BotGateway {
  private readonly logger = new Logger(BotGateway.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly redisRepository: RedisRepository,
  ) {}

  async initEvent(client: MezonClient) {
    await this.redisRepository.set(
      'system',
      'timeup',
      new Date().toISOString(),
    );

    await client.onChannelMessage(this.handlechannelmessage);
    client.onMessageReaction(this.handlemessagereaction);
    client.onChannelCreated(this.handlechannelcreated);
    client.onUserClanRemoved(this.handleuserclanremoved);
    client.onUserChannelAdded(this.handleuserchanneladded);
    client.onChannelDeleted(this.handlechanneldeleted);
    client.onChannelUpdated(this.handlechannelupdated);
    client.onTokenSend(this.handletokensend);
    client.onAddClanUser(this.handleaddclanuser);
    client.onMessageButtonClicked(this.handlemessagebuttonclicked);
  }
  // processMessage(msg: ChannelMessage) {}

  /* cspell:words handlemessagereaction */
  handlemessagereaction = async (msg: ApiMessageReaction) => {
    this.eventEmitter.emit(Events.MessageReaction, msg);
  };

  /* cspell:words handlechannelcreated */
  handlechannelcreated = async (channel: ChannelCreatedEvent) => {
    this.eventEmitter.emit(Events.ChannelCreated, channel);
  };

  /* cspell:words handleuserclanremoved */
  handleuserclanremoved = async (user: UserClanRemovedEvent) => {
    this.eventEmitter.emit(Events.UserClanRemoved, user);
  };

  /* cspell:words handlerole */
  handlerole = async (msg) => {};

  /* cspell:words handleroleassign */
  handleroleassign = async (msg) => {};

  /* cspell:words handleuserchanneladded */
  handleuserchanneladded = async (user: UserChannelAddedEvent) => {
    this.eventEmitter.emit(Events.UserChannelAdded, user);
  };

  /* cspell:words handlechanneldeleted */
  handlechanneldeleted = async (channel: ChannelDeletedEvent) => {
    this.eventEmitter.emit(Events.ChannelDeleted, channel);
  };

  /* cspell:words handlechannelupdated */
  handlechannelupdated = async (channel: ChannelUpdatedEvent) => {
    this.eventEmitter.emit(Events.ChannelUpdated, channel);
  };

  // /* cspell:words handleuserchannelremoved */
  // handleuserchannelremoved = async (msg: UserChannelRemovedEvent) => {
  //   this.eventEmitter.emit(Events.UserChannelRemoved, msg);
  // };

  /* cspell:words handlegivecoffee */
  handlegivecoffee = async (data: TokenSentEvent) => {
    this.eventEmitter.emit(Events.TokenSend, data);
  };

  /* cspell:words handleaddclanuser */
  handleaddclanuser = async (data) => {
    this.eventEmitter.emit(Events.AddClanUser, data);
  };

  /* cspell:words handleroleassigned */
  handleroleassigned = async (msg) => {};

  /* cspell:words handlemessagebuttonclicked */
  handlemessagebuttonclicked = async (data: MessageButtonClicked) => {
    try {
      const in_cache = await this.redisRepository.get(
        'message_button_clicked',
        data.message_id,
      );
      if (in_cache) {
        return;
      } else {
        await this.redisRepository.setWithExpiry(
          'message_button_clicked',
          data.message_id,
          '1',
          1,
        );
        this.eventEmitter.emit(Events.MessageButtonClicked, data);
      }
    } catch (error) {
      this.logger.error(error);
    }
  };

  handletokensend = async (
    data: TokenSentEvent & { transaction_id: string },
  ) => {
    if (data.sender_name === 'dulieu.vblc') return;
    try {
      const in_cache = await this.redisRepository.get(
        'token_send',
        data.transaction_id,
      );
      if (in_cache) {
        return;
      } else {
        await this.redisRepository.setWithExpiry(
          'token_send',
          data.transaction_id,
          '1',
          1,
        );
        this.eventEmitter.emit(Events.TokenSend, data);
      }
    } catch (error) {
      this.logger.error(error);
    }
  };

  /* cspell:words handlechannelmessage */
  handlechannelmessage = async (msg: ChannelMessage) => {
    if (msg.code) return; // ignored edited message
    ['attachments', 'mentions', 'references'].forEach((key) => {
      if (!Array.isArray(msg[key])) msg[key] = [];
    });
    if (msg.display_name?.toLowerCase().includes(BOT_NAME)) return;
    try {
      const in_cache = await this.redisRepository.get('msg', msg.id);
      if (in_cache) {
        return;
      } else {
        await this.redisRepository.setWithExpiry('msg', msg.id, '1', 5);
        this.eventEmitter.emit(Events.ChannelMessage, msg);
      }
    } catch (error) {
      this.logger.error(error);
    }
  };
}
