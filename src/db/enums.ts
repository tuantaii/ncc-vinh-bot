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
    PLAY_KBB: "PLAY_KBB",
    PLAY_XS: "PLAY_XS"
} as const;
export type ETransactionSendStatus = (typeof ETransactionSendStatus)[keyof typeof ETransactionSendStatus];
export const KeoBuaBaoEnum = {
    KEO: "KEO",
    BUA: "BUA",
    BAO: "BAO"
} as const;
export type KeoBuaBaoEnum = (typeof KeoBuaBaoEnum)[keyof typeof KeoBuaBaoEnum];
export const EKeobuabaoGameStatus = {
    PLAYING: "PLAYING",
    ENDED: "ENDED"
} as const;
export type EKeobuabaoGameStatus = (typeof EKeobuabaoGameStatus)[keyof typeof EKeobuabaoGameStatus];
