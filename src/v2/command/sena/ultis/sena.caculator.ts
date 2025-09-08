import { DOUBLE_COST_SCORE, GAME_RESULT } from '../constansts';
import { Game } from '../game';

export class SenaCaculator {
  static SUITS = ['♠', '♥', '♦', '♣'];
  static RANKS = [
    'A',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    'J',
    'Q',
    'K',
  ];

  static getCardDisplay(index: number): string {
    const suit = SenaCaculator.SUITS[Math.floor(index / 13)];
    const rank = SenaCaculator.RANKS[index % 13];
    return `${rank}${suit}`;
  }

  static formatVND(amount: number): string {
    if (isNaN(amount)) throw new Error('Số tiền không hợp lệ');
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  }

  static calculateHandValue(hand: number[]): number {
    const ranks = hand.map((i) => i % 13);
    const aces = ranks.filter((rank) => rank === 0);
    const nonAces = ranks.filter((rank) => rank !== 0);

    let nonAceTotal = 0;
    for (const rank of nonAces) {
      if (rank >= 10) {
        nonAceTotal += 10;
      } else {
        nonAceTotal += rank + 1;
      }
    }

    let total = nonAceTotal;
    const aceCount = aces.length;

    if (aceCount > 0) {
      if (hand.length === 3 && aceCount === 1) {
        if (nonAceTotal + 10 <= 21) {
          total = nonAceTotal + 10;
        } else if (nonAceTotal + 11 <= 21) {
          total = nonAceTotal + 11;
        } else {
          total = nonAceTotal + 1;
        }
      } else {
        total += aceCount * 11;
        let acesAsEleven = aceCount;
        while (total > 21 && acesAsEleven > 0) {
          total -= 10;
          acesAsEleven--;
        }
      }
    }

    return total;
  }

  static getRewardMultiplier(game: Game, result: GAME_RESULT): number {
    if (!game || !game.hostScore || !game.guestScore) {
      throw new Error('Invalid game data');
    }
    if (!Object.values(GAME_RESULT).includes(result)) {
      throw new Error('Invalid game result');
    }

    if (result === GAME_RESULT.DRAW) {
      return 0;
    }

    const isHostWin = result === GAME_RESULT.HOST_WIN;
    const score = isHostWin ? game.hostScore : game.guestScore;
    const opponentScore = isHostWin ? game.guestScore : game.hostScore;

    if (score.isDoubleAce) {
      return 3;
    }
    if (
      score.isBlackjack ||
      score.isFiveSpirits ||
      score.value >= DOUBLE_COST_SCORE ||
      opponentScore.value >= DOUBLE_COST_SCORE
    ) {
      return 2;
    }

    return 1;
  }
}
