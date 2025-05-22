export const ETransactionType = {
    DEPOSIT: "DEPOSIT",
    WITHDRAW: "WITHDRAW"
} as const;
export type ETransactionType = (typeof ETransactionType)[keyof typeof ETransactionType];
export const EMessageRole = {
    system: "system",
    user: "user",
    assistant: "assistant"
} as const;
export type EMessageRole = (typeof EMessageRole)[keyof typeof EMessageRole];
export const ETransactionSendStatus = {
    PLAY_JACK: "PLAY_JACK"
} as const;
export type ETransactionSendStatus = (typeof ETransactionSendStatus)[keyof typeof ETransactionSendStatus];
export const EJackGameStatus = {
    PLAYING: "PLAYING",
    ENDED: "ENDED"
} as const;
export type EJackGameStatus = (typeof EJackGameStatus)[keyof typeof EJackGameStatus];
