export class MessageQueueStore {
  private readonly queue: ReplyMezonMessage[] = [];

  getMessageQueue() {
    return this.queue;
  }

  addMessage(message: ReplyMezonMessage) {
    this.queue.push(message);
  }

  addMessages(messages: ReplyMezonMessage[]) {
    this.queue.push(...messages);
  }

  getNextMessage(): ReplyMezonMessage | undefined {
    return this.queue.shift();
  }

  hasMessages(): boolean {
    return this.queue.length > 0;
  }
}
