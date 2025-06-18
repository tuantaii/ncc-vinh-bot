interface GameMetadata {
  [key: string]: string | number | boolean | object | null | undefined;
  hostMessageId?: string;
  hostChannelId?: string;
  guestMessageId?: string;
  guestChannelId?: string;
}

export type { GameMetadata };

export type BLACKJACK_GAME_LOGS = {
  id: number;
  game_id: number;
  user_id: string;
  card: string;
};
