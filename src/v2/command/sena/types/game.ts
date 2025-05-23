import { EJackGameStatus } from '@prisma/client';

interface GameMetadata {
  [key: string]: string | number | boolean | object | null | undefined;
  hostMessageId?: string;
  hostChannelId?: string;
  guestMessageId?: string;
  guestChannelId?: string;
}

export type { GameMetadata };
