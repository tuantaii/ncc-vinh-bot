import { GAME_RESULT, MAX_CARDS, MAX_SCORE } from './constansts';
import { shuffle } from 'lodash';
import { BlackJackGame, EJackGameStatus } from '@prisma/client';

export class Game {
  public id: number;
  public hostId: string;
  public guestId: string;
  public cost: number;
  public createdAt: Date;
  public updatedAt: Date;
  public status: EJackGameStatus;
  public hostName: string;
  public guestName: string;
  public hostCards: number[];
  public guestCards: number[];
  public remainingCards: number[];
  public turnOf: string | null;
  public isHostStand: boolean;
  public isGuestStand: boolean;

  constructor(data: BlackJackGame) {
    this.id = data.id;
    this.hostId = data.hostId;
    this.guestId = data.guestId;
    this.cost = data.cost;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.status = data.status;
    this.hostName = data.hostName;
    this.guestName = data.guestName;
    this.hostCards = data.hostCards;
    this.guestCards = data.guestCards;
    this.remainingCards = data.remainingCards;
    this.turnOf = data.turnOf;
    this.isHostStand = data.isHostStand;
    this.isGuestStand = data.isGuestStand;
  }

  get hostScore() {
    return this.getScore(this.hostCards);
  }
  get guestScore() {
    return this.getScore(this.guestCards);
  }

  startGame() {
    this.status = EJackGameStatus.PLAYING;
    this.turnOf = this.guestId;
    this.isHostStand = false;
    this.isGuestStand = false;

    const cards = Array.from({ length: 52 }, (_, i) => i);

    const suffledCards = shuffle(cards);
    this.hostCards = [suffledCards[0], suffledCards[2]];
    this.guestCards = [suffledCards[1], suffledCards[3]];
    this.remainingCards = suffledCards.slice(4);
  }

  hitCard() {
    const card = this.remainingCards.pop();
    const isHostTurn = this.turnOf === this.hostId;
    const playerCards = isHostTurn ? this.hostCards : this.guestCards;
    playerCards.push(card!);

    const isLastTurn = playerCards.length === MAX_CARDS;

    if (isLastTurn) {
      this.stand();
    }
  }

  stand() {
    const isHostTurn = this.turnOf === this.hostId;
    if (isHostTurn) {
      this.isHostStand = true;
      this.status = EJackGameStatus.ENDED;
      this.turnOf = null;
    } else {
      this.isGuestStand = true;
      this.turnOf = this.hostId;
    }
  }

  getScore(cards: number[]): number {
    let total = 0;
    let aceCount = 0;
    for (const card of cards) {
      const rankIndex = card % 13;
      if (rankIndex === 0) {
        aceCount++;
        total += 11;
      } else if (rankIndex >= 10) {
        total += 10;
      } else {
        total += rankIndex + 1;
      }
    }
    while (total > 21 && aceCount > 0) {
      total -= 10;
      aceCount--;
    }
    return total;
  }

  get result(): GAME_RESULT {
    if (this.hostScore > MAX_SCORE && this.guestScore > MAX_SCORE) {
      return GAME_RESULT.DRAW;
    }

    if (this.hostScore > MAX_SCORE || this.guestScore > this.hostScore) {
      return GAME_RESULT.GUEST_WIN;
    }

    if (this.guestScore > MAX_SCORE || this.hostScore > this.guestScore) {
      return GAME_RESULT.HOST_WIN;
    }

    return GAME_RESULT.DRAW;
  }
}
