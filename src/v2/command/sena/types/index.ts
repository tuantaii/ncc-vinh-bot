import { TokenSentEvent } from 'mezon-sdk';

interface TokenSentEventI extends TokenSentEvent {
  user_id: string;
  amount: number;
  transaction_id: string;
}

interface MessageButtonClickedEvent {
  message_id: string;
  channel_id: string;
  button_id: string;
  sender_id: string;
  user_id: string;
  extra_data: string;
}

export { TokenSentEventI, MessageButtonClickedEvent };
