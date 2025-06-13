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
    let total = 0;
    let aceCount = 0;
    for (const card of hand) {
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

  static getRewardMultiplier(game: Game, result: GAME_RESULT): number {
    const hostScore = game.hostScore.value;
    const guestScore = game.guestScore.value;

    if (result === GAME_RESULT.HOST_WIN) {
      if (game.hostScore.isDoubleAce) return 3;
      if (
        game.hostScore.isBlackjack ||
        game.hostScore.isFiveSprits ||
        hostScore >= DOUBLE_COST_SCORE ||
        guestScore >= DOUBLE_COST_SCORE
      )
        return 2;
      return 1;
    }
    if (result === GAME_RESULT.GUEST_WIN) {
      if (game.guestScore.isDoubleAce) return 3;
      if (
        game.guestScore.isBlackjack ||
        game.guestScore.isFiveSprits ||
        hostScore >= DOUBLE_COST_SCORE ||
        guestScore >= DOUBLE_COST_SCORE
      )
        return 2;
      return 1;
    }

    return 0;
  }
}
