import type { ColumnType } from "kysely";
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

import type { ETransactionType, EMessageRole, ETransactionSendStatus, EJackGameStatus } from "./enums";

export type BlackJackGame = {
    id: Generated<number>;
    hostId: string;
    hostName: string;
    guestId: string;
    guestName: string;
    cost: Generated<number>;
    createdAt: Generated<Timestamp>;
    updatedAt: Timestamp;
    status: Generated<EJackGameStatus>;
    channelId: string;
    messageId: string;
    clanId: string;
    isPublicChannel: Generated<boolean>;
    mode: Generated<string>;
    remainingCards: number[];
    hostCards: number[];
    guestCards: number[];
    turnOf: string | null;
    isHostStand: Generated<boolean>;
    isGuestStand: Generated<boolean>;
    metadata: unknown | null;
};
export type BlackJackGameLogs = {
    id: Generated<number>;
    gameId: number;
    userId: string;
    card: string;
};
export type MessageLogs = {
    id: Generated<number>;
    messageId: string;
    senderAvatar: string;
    senderName: string;
    senderId: string;
    senderUsername: string;
    content: unknown;
    createdAt: Generated<Timestamp>;
    channelId: string;
    clanId: string;
    clanAvatar: string;
    clanName: string;
    clanUsername: string;
    channelLabel: Generated<string>;
    displayName: Generated<string>;
};
export type TimesheetToken = {
    id: Generated<number>;
    userId: string;
    token: string;
    createdAt: Generated<Timestamp>;
    updatedAt: Timestamp;
    expiresAt: Timestamp;
};
export type TransactionLogs = {
    id: Generated<number>;
    userId: string;
    amount: number;
    transactionId: string;
    createdAt: Generated<Timestamp>;
    updatedAt: Timestamp;
    type: Generated<ETransactionType>;
};
export type TransactionSendLogs = {
    id: Generated<number>;
    userId: string;
    amount: number;
    toUserId: string;
    note: Generated<string>;
    createdAt: Generated<Timestamp>;
    updatedAt: Timestamp;
};
export type UserBalance = {
    id: Generated<number>;
    userId: string;
    username: string;
    balance: Generated<number>;
    createdAt: Generated<Timestamp>;
    updatedAt: Timestamp;
};
export type DB = {
    BlackJackGame: BlackJackGame;
    BlackJackGameLogs: BlackJackGameLogs;
    MessageLogs: MessageLogs;
    TimesheetToken: TimesheetToken;
    TransactionLogs: TransactionLogs;
    TransactionSendLogs: TransactionSendLogs;
    UserBalance: UserBalance;
};
