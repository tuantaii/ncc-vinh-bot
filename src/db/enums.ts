export const ETransactionType = {
    DEPOSIT: "DEPOSIT",
    WITHDRAW: "WITHDRAW",
    REFUND: "REFUND",
    LOCKS: "LOCKS"
} as const;
export type ETransactionType = (typeof ETransactionType)[keyof typeof ETransactionType];
export const EMessageRole = {
    system: "system",
    user: "user",
    assistant: "assistant"
} as const;
export type EMessageRole = (typeof EMessageRole)[keyof typeof EMessageRole];
export const ETransactionSendStatus = {
    PLAY_BlACK_JACK: "PLAY_BlACK_JACK"
} as const;
export type ETransactionSendStatus = (typeof ETransactionSendStatus)[keyof typeof ETransactionSendStatus];
export const EJackGameStatus = {
    WAITING: "WAITING",
    PLAYING: "PLAYING",
    ENDED: "ENDED"
} as const;
export type EJackGameStatus = (typeof EJackGameStatus)[keyof typeof EJackGameStatus];
