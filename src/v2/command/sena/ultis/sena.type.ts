import { EJackGameStatus } from 'src/db/enums';
import { GameMetadata } from '../types/game';

export interface GameMessageParams {
  userName: string;
  cardDisplay: string;
  score: number;
  isDoubleAce: boolean;
}

export interface TurnMessageParams {
  currentPlayerName: string;
  opponentName: string;
  cardCount: number;
}

export interface GameEndMessageParams {
  channelId: string;
  messageId: string;
  hostName: string;
  guestName: string;
}

export interface GameResultMessageParams extends GameEndMessageParams {
  replyToMessageId: string;
  resultMessage: string;
}
export enum ButtonKey {
  HIT = 'hit',
  STAND = 'stand',
  RUN = 'run',
  AGREE = 'agree',
  CANCEL = 'cancel',
}
