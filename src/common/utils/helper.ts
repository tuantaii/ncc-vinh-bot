import { COMMAND_PREFIX } from 'src/common/enums/bot.enum';

export const extractMessage = (messageContent: string) => {
  const trimmedMessageContent = messageContent.trim();
  if (
    !COMMAND_PREFIX.some((prefix) => trimmedMessageContent.startsWith(prefix))
  ) {
    return { commandName: '', args: [] };
  }

  const [rawCommand, ...args] = trimmedMessageContent.split(' ');
  const commandName = rawCommand.slice(1).trim();

  return { commandName, args };
};

export function getOptionalFields(replyContent: ReplyContentType) {
  const optionalFields = ['lk', 'hg', 'mk', 'ej', 'vk', 'contentThread'];

  return optionalFields.reduce((acc, field) => {
    if (field in replyContent) {
      acc[field] = replyContent[field];
    }
    return acc;
  }, {});
}

export function getRandomColor(): string {
  const colors = [
    '#1ABC9C',
    '#11806A',
    '#57F287',
    '#1F8B4C',
    '#3498DB',
    '#206694',
    '#9B59B6',
    '#71368A',
    '#E91E63',
    '#AD1457',
    '#F1C40F',
    '#C27C0E',
    '#E67E22',
    '#A84300',
    '#ED4245',
    '#992D22',
    '#95A5A6',
    '#979C9F',
    '#7F8C8D',
    '#BCC0C0',
    '#34495E',
    '#2C3E50',
    '#FFFF00',
  ];
  return random(colors);
}

export function random<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}
