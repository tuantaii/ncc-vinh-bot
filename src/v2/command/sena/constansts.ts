import { SenaCaculator } from './ultis';

export const BOT_NAME = 'SENA';
export const MYSELF_COMMAND = '*sena';
export const PLAY_COMMAND = '*jack';
export const CHECK_BALANCE_COMMAND = '*kttk';
export const WITHDRAW_COMMAND = '*trom';
export const ACCEPT_COMMAND = '36';
export const CHECK_TRANSACTION_COMMAND = '*logs';
export const CHECK_TRANSACTION_SEND_COMMAND = '*lsend';
export const STATISTICS_COMMAND = '*chan';
export const HELP_COMMAND = '*alo';
export const ID_ADMIN1 = '';
export const ID_ADMIN2 = '';
export const ID_ADMIN3 = '1783440675396653056';
export const OFF_WITHDRAW = '*offrut';
export const ON_WITHDRAW = '*onrut';
export const BLOCK_WITHDRAW_KEY = 'BLOCK_WITHDRAW_KEY';
export const OFF_BOT = '*offbot';
export const ON_BOT = '*onbot';
export const ROLL_TET = '*snroll';
export const VAR_TET = '*snvar';

export const VALID_COMMANDS = [
  MYSELF_COMMAND,
  PLAY_COMMAND,
  CHECK_BALANCE_COMMAND,
  WITHDRAW_COMMAND,
  CHECK_TRANSACTION_COMMAND,
  CHECK_TRANSACTION_SEND_COMMAND,
  STATISTICS_COMMAND,
  OFF_WITHDRAW,
  ON_WITHDRAW,
];

export const ADMIN_IDS = [ID_ADMIN1, ID_ADMIN2, ID_ADMIN3];

export const HDSD = `Hướng dẫn sử dụng:
1. ${MYSELF_COMMAND}: Giới thiệu về Sena Bot
2. ${PLAY_COMMAND}: Chơi game Xì Dách với Sena Bot
3. ${CHECK_BALANCE_COMMAND}: Kiểm tra số dư tài khoản
4. ${WITHDRAW_COMMAND} <số tiền>: Rút tiền từ tài khoản của bạn <số tiền>
5. ${CHECK_TRANSACTION_COMMAND} <transactionId>: Kiểm tra lịch sử giao dịch
6. ${CHECK_TRANSACTION_SEND_COMMAND} <transactionId>: Kiểm tra lịch sử giao dịch chuyển tiền
7. ${STATISTICS_COMMAND}: Thống kê top 10 người thắng nhiều nhất
8. ${HELP_COMMAND}: Trợ giúp và hướng dẫn sử dụng bot
Để nạp tiền, hãy chuyển token trực tiếp cho SENA.
--------------------------------------------------
Cách chơi game Xì Dách:
1. Reply hoặc tag một người nào đó với cú pháp *jack <@username> <số tiền> để bắt đầu chơi game Xì Dách với Sena Bot.
2. Bạn sẽ nhận được 2 lá bài đầu tiên, và có thể chọn rút thêm bài hoặc dằn.
3. Mục tiêu là đạt được tổng điểm gần 21 nhất mà không vượt quá 21.
4. Nếu bạn đạt được Xì Bàng (2 lá bài đầu tiên là AA), bạn sẽ thắng ngay lập tức. và thắng x3 số tiền cược.
5. Nếu bạn đạt được Xì Jack (2 lá bài đầu tiên là A và 10/J/Q/K), bạn sẽ thắng x2 số tiền cược.
6. Nếu bạn đạt được Ngũ Linh (5 lá bài có tổng điểm từ 16 trở lên và thấp hơn hoặc bằng 21), bạn sẽ thắng x2 số tiền cược.
7. Nếu bạn vượt quá 21 điểm, bạn sẽ thua và mất số tiền cược.
8. Nếu bạn và đối thủ có cùng tổng điểm, kết quả sẽ là hòa và không ai mất tiền.
9. Nếu bạn trên 28 điểm (ngoắc cần câu), bạn sẽ thua gấp đôi số tiền cược.
--------------------------------------------------`;

export const EMPTY_BALANCE_MESSAGES = [
  `Nghèo, kiếm thêm tiền để donate cho tao, ít thì 5 quả trướng, nhiều thì 1 quả tên lửa`,
  'HẾT TIỀN RỒI! Pay more for love',
];

export const MAX_CARDS = 5;
export const MAX_SCORE = 21;
export const MIN_SCORE = 16;
export const DOUBLE_COST_SCORE = 28;
export const WR_SYSTEM = 'system';

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
    cost: number;
  }) =>
    `Cả 2 đã dằn.
    Bài của ${data.hostName} là ${data.hostCardDisplay} => Tổng: ${data.hostScore}.
    Bài của ${data.guestName} là ${data.guestCardDisplay} => Tổng: ${data.guestScore}.
    Kết quả: ${data.hostName} thắng và nhận được ${SenaCaculator.formatVND(data.cost)} token`,
  [GAME_RESULT.GUEST_WIN]: (data: {
    hostName: string;
    hostCardDisplay: string;
    hostScore: number;
    guestName: string;
    guestCardDisplay: string;
    guestScore: number;
    cost: number;
  }) =>
    `Cả 2 đã dằn.
    Bài của ${data.hostName} là ${data.hostCardDisplay} => Tổng: ${data.hostScore}.
    Bài của ${data.guestName} là ${data.guestCardDisplay} => Tổng: ${data.guestScore}.
    Kết quả: ${data.guestName} thắng và nhận được ${SenaCaculator.formatVND(data.cost)} token`,
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

  userHand: (data: {
    userName: string;
    cardDisplay: string;
    score: number;
    isDoubleAce?: boolean;
  }) =>
    data.isDoubleAce
      ? `\nBài của ${data.userName} là ${data.cardDisplay} 👉 XÌ BÀNNNNNNN làm bố tất cả`
      : `\nBài của ${data.userName} là ${data.cardDisplay}, Tổng điểm là ${data.score}`,

  overScoreDoubleCost: (data: {
    winnerName: string;
    loserName: string;
    cost: number;
    winnerCardDisplay: string;
    winnerScore: number;
    loseCardDisplay: string;
    loseScore: number;
  }) =>
    `Bài của ${data.winnerName} là ${data.winnerCardDisplay} => Tổng: ${data.winnerScore}.\nBài của ${data.loserName} là ${data.loseCardDisplay} => Tổng: ${data.loseScore}.\n${data.loserName} ngoắc cần câu, cháy trên ${DOUBLE_COST_SCORE} điểm thua x2 tiền, bay ${SenaCaculator.formatVND(data.cost)} token`,
  blackjack: (data: { winnerName: string; loserName: string; cost: number }) =>
    `${data.winnerName} được Xì Jack, ${data.loserName} thua. x2 money. lụm ${SenaCaculator.formatVND(data.cost)} token`,
  doubleAce: (data: { winnerName: string; loserName: string; cost: number }) =>
    `${data.winnerName} được Xì Bàng, ${data.loserName} thua. x3 money. lụm ${SenaCaculator.formatVND(data.cost)} token`,
  fiveSpirits: (data: {
    winnerName: string;
    loserName: string;
    cost: number;
  }) =>
    `${data.winnerName} được ngũ linh, ${data.loserName} thua. x2 money. lụm ${SenaCaculator.formatVND(data.cost)} token`,
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
