import type { ColumnType } from "kysely";
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

import type { ETransactionType, EMessageRole, ETransactionSendStatus, EJackGameStatus } from "./enums";

export type jack_game = {
    id: Generated<number>;
    user_id_create: string;
    cost: Generated<number>;
    only_for_user_id: string;
    created_at: Generated<Timestamp>;
    updated_at: Timestamp;
    status: Generated<EJackGameStatus>;
    channel_id: string;
    message_id: string;
    clan_id: string;
    user_name_create: Generated<string>;
    only_for_user_name: Generated<string>;
    is_public_channel: Generated<boolean>;
    mode: Generated<string>;
    deck: Generated<number[]>;
    playerA_hand: number[];
    playerB_hand: number[];
    turn: string | null;
    playerA_stood: Generated<boolean>;
    playerB_stood: Generated<boolean>;
    metadata: unknown | null;
};
export type jack_game_logs = {
    id: Generated<number>;
    game_id: number;
    user_id: string;
    card: string;
};
export type message_logs = {
    id: Generated<number>;
    message_id: string;
    sender_avatar: string;
    sender_name: string;
    sender_id: string;
    sender_username: string;
    content: unknown;
    created_at: Generated<Timestamp>;
    channel_id: string;
    clan_id: string;
    clan_avatar: string;
    clan_name: string;
    clan_username: string;
    channel_label: Generated<string>;
    display_name: Generated<string>;
};
export type sena_assistant = {
    id: Generated<number>;
    channel_id: string;
    clan_id: string;
    is_active: Generated<boolean>;
    ai_model: Generated<string>;
    api_key: Generated<string>;
    max_tokens: Generated<string>;
    created_at: Generated<Timestamp>;
    updated_at: Timestamp;
    system_prompt: Generated<string>;
};
export type sena_assistant_message_logs = {
    id: Generated<number>;
    sena_assistant_id: number;
    role: Generated<EMessageRole>;
    mezon_message_id: Generated<string>;
    message: string;
    created_at: Generated<Timestamp>;
    updated_at: Timestamp;
    channel_id: Generated<string>;
    clan_id: Generated<string>;
    user_id: Generated<string>;
};
export type sena_tokens_took = {
    id: Generated<number>;
    sena_assistant_id: number;
    tokens_took: Generated<string>;
    created_at: Generated<Timestamp>;
    updated_at: Timestamp;
    sena_assistant_message_logs_id: number;
};
export type timesheet_token = {
    id: Generated<number>;
    user_id: string;
    token: string;
    created_at: Generated<Timestamp>;
    updated_at: Timestamp;
    expires_at: Timestamp;
};
export type transaction_logs = {
    id: Generated<number>;
    user_id: string;
    amount: number;
    transaction_id: string;
    created_at: Generated<Timestamp>;
    updated_at: Timestamp;
    type: Generated<ETransactionType>;
};
export type transaction_send_logs = {
    id: Generated<number>;
    user_id: string;
    amount: number;
    to_user_id: string;
    note: Generated<string>;
    created_at: Generated<Timestamp>;
    updated_at: Timestamp;
};
export type user_balance = {
    id: Generated<number>;
    user_id: string;
    username: string;
    balance: Generated<number>;
    created_at: Generated<Timestamp>;
    updated_at: Timestamp;
};
export type DB = {
    jack_game: jack_game;
    jack_game_logs: jack_game_logs;
    message_logs: message_logs;
    sena_assistant: sena_assistant;
    sena_assistant_message_logs: sena_assistant_message_logs;
    sena_tokens_took: sena_tokens_took;
    timesheet_token: timesheet_token;
    transaction_logs: transaction_logs;
    transaction_send_logs: transaction_send_logs;
    user_balance: user_balance;
};
