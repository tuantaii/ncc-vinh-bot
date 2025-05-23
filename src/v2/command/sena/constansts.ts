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
