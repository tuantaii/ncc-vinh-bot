export const BOT_NAME = 'SENA';
export const MYSELF_COMMAND = '*sena';
export const PLAY_COMMAND = '*jack';
export const CHECK_BALANCE_COMMAND = '*kttk';
export const WITHDRAW_COMMAND = '*trom';
export const ACCEPT_COMMAND = '36';

export const EMPTY_BALANCE_MESSAGES = [
  `Nghèo, kiếm thêm tiền để donate cho tao, ít thì 5 quả trướng, nhiều thì 1 quả tên lửa`,
  'HẾT TIỀN RỒI! Pay more for love',
];

export const MAX_CARDS = 5;
export const MAX_SCORE = 21;
export const DOUBLE_COST_SCORE = 26;

export enum GAME_RESULT {
  HOST_WIN,
  GUEST_WIN,
  DRAW,
}

export const gameMessages = {
  [GAME_RESULT.HOST_WIN]: (data: {
    hostName: string;
    hostCardDisplay: string;
    hostScore: number;
    guestName: string;
    guestCardDisplay: string;
    guestScore: number;
  }) =>
    `Cả 2 đã dằn.\nBài của ${data.hostName} là ${data.hostCardDisplay} => Tổng: ${data.hostScore}.\nBài của ${data.guestName} là ${data.guestCardDisplay} => Tổng: ${data.guestScore}.\nKết quả: ${data.hostName} thắng`,
  [GAME_RESULT.GUEST_WIN]: (data: {
    hostName: string;
    hostCardDisplay: string;
    hostScore: number;
    guestName: string;
    guestCardDisplay: string;
    guestScore: number;
  }) =>
    `Cả 2 đã dằn.\nBài của ${data.hostName} là ${data.hostCardDisplay} => Tổng: ${data.hostScore}.\nBài của ${data.guestName} là ${data.guestCardDisplay} => Tổng: ${data.guestScore}.\nKết quả: ${data.hostName} thắng`,
  guestPlayerStood: (data: { hostName: string; guestName: string }) =>
    `${data.guestName} đã dằn, tới lượt ${data.hostName}.`,
  playerHitting: (data: {
    guestName: string;
    cardCount: number;
    hostName?: string;
  }) =>
    data.hostName == null
      ? `${data.guestName} đã dằn, ${data.hostName} đang rút ${data.cardCount} lá bài.`
      : `${data.guestName} đang rút ${data.cardCount} lá bài.`,

  userHand: (data: { userName: string; cardDisplay: string; score: number }) =>
    `Bài của ${data.userName} là ${data.cardDisplay}, Tổng điểm là ${data.score}`,

  blackjack: (data: { winnerName: string; loserName: string }) =>
    `${data.winnerName} được Xì Jack, ${data.loserName} thua. x2 money.`,
  doubleAce: (data: { winnerName: string; loserName: string }) =>
    `${data.winnerName} được Xì Bàng, ${data.loserName} thua. x3 money.`,
  [GAME_RESULT.DRAW]: (data: {
    hostName: string;
    hostCardDisplay: string;
    hostScore: number;
    guestName: string;
    guestCardDisplay: string;
    guestScore: number;
  }) =>
    `Bài của ${data.hostName} là ${data.hostCardDisplay} => Tổng: ${data.hostScore}.\nBài của ${data.guestName} là ${data.guestCardDisplay} => Tổng: ${data.guestScore}.\nKết quả: HÒAAAAAAAA`,
};
