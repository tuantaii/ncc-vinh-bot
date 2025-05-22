import { Injectable } from '@nestjs/common';
import { MezonService } from '../mezon/mezon.service';
import { MessageQueueStore } from './message-queue-store.service';

@Injectable()
export class MessageQueueService {
  constructor(
    private readonly _: MezonService,
    private readonly messageQueueStore: MessageQueueStore,
  ) {
    this.startMessageProcessor();
  }

  private async processDirectMessage(message: ReplyMezonMessage) {}

  private async processChannelMessage(message: ReplyMezonMessage) {}

  private async processNextMessage() {
    if (!this.messageQueueStore.hasMessages()) return;

    const message = this.messageQueueStore.getNextMessage();
    if (!message) return;

    if (message.mezonUserId) {
      await this.processDirectMessage(message);
    } else {
      await this.processChannelMessage(message);
    }
  }

  private startMessageProcessor() {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    setInterval(async () => {
      await this.processNextMessage();
    }, 50);
  }
}
