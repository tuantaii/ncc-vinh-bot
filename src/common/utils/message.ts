import { ChannelMessageContent, EMarkdownType } from 'mezon-sdk';
import { getOptionalFields } from './helper';

export function generateChannelMessageContent({
  message,
  blockMessage,
}: {
  message: string;
  blockMessage: boolean;
}): ChannelMessageContent {
  return {
    t: message,
    mk: blockMessage
      ? [{ type: EMarkdownType.TRIPLE, s: 0, e: message.length }]
      : [],
    ...getOptionalFields({ messageContent: message }),
  };
}
