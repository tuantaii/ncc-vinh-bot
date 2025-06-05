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

  end() {
    this.status = EJackGameStatus.ENDED;
    this.turnOf = null;
    this.isHostStand = true;
    this.isGuestStand = true;
  }

  stand() {
    const isHostTurn = this.turnOf === this.hostId;
    if (isHostTurn) {
      this.isHostStand = true;
      if (this.isGuestStand) {
        this.end();
      } else {
        this.turnOf = this.guestId;
      }
    } else {
      this.isGuestStand = true;
      if (this.isHostStand) {
        this.end();
      } else {
        this.turnOf = this.hostId;
      }
    }
  }

  isFiveSprits(player: 'host' | 'guest'): boolean {
    const cards = player === 'host' ? this.hostCards : this.guestCards;
    const score = this.getScore(cards);
    return cards.length === 5 && score.value <= 21;
  }

  get result(): GAME_RESULT {
    const { value: guestScore } = this.guestScore;
    const { value: hostScore } = this.hostScore;

    if (guestScore === hostScore) {
      return GAME_RESULT.DRAW;
    }

    if (hostScore > MAX_SCORE && guestScore > MAX_SCORE) {
      return GAME_RESULT.DRAW;
    }

    if (hostScore > MAX_SCORE) {
      return GAME_RESULT.GUEST_WIN;
    }

    if (guestScore > MAX_SCORE) {
      return GAME_RESULT.HOST_WIN;
    }

    return guestScore > hostScore
      ? GAME_RESULT.GUEST_WIN
      : GAME_RESULT.HOST_WIN;
  }

  private getScore(cardIndices: number[]): {
    value: number;
    isBlackjack: boolean;
    isDoubleAce: boolean;
    isFiveSprits: boolean;
  } {
    let total = 0;
    let aceCount = 0;
    const ranks = cardIndices.map((i) => i % 13);

    for (const rank of ranks) {
      if (rank === 0) {
        aceCount++;
        total += 11;
      } else if (rank >= 10) {
        total += 10;
      } else {
        total += rank + 1;
      }
    }

    while (total > 21 && aceCount > 0) {
      total -= 10;
      aceCount--;
    }

    const isDoubleAce =
      cardIndices.length === 2 && ranks[0] === 0 && ranks[1] === 0;
    const isBlackjack =
      cardIndices.length === 2 &&
      ranks.includes(0) &&
      ranks.some((r) => r === 10 || r === 11 || r === 12 || r === 9); // 10, J, Q, K
    const isFiveSprits = cardIndices.length === 5 && total <= 21;

    return {
      value: total,
      isBlackjack,
      isDoubleAce,
      isFiveSprits,
    };
  }

  calculateEarlyWin(): GAME_RESULT | null {
    const hostResult = this.getScore(this.hostCards);
    const guestResult = this.getScore(this.guestCards);
    if (hostResult.isDoubleAce && guestResult.isDoubleAce) {
      return GAME_RESULT.DRAW;
    }
    if (hostResult.isDoubleAce) {
      return GAME_RESULT.HOST_WIN;
    }
    if (guestResult.isDoubleAce) {
      return GAME_RESULT.GUEST_WIN;
    }
    if (hostResult.isBlackjack && guestResult.isBlackjack) {
      return GAME_RESULT.DRAW;
    }
    if (hostResult.isBlackjack) {
      return GAME_RESULT.HOST_WIN;
    }
    if (guestResult.isBlackjack) {
      return GAME_RESULT.GUEST_WIN;
    }
    return null;
  }
}
