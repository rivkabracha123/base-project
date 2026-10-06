import type { P4BuyerAiContext } from '../ai/p4-ai.types';
import type { BuyerChatUpdate } from './buyer-chat-update';

/** Same sentinel as the client — skip current clarification question. */
export const BUYER_CHAT_SKIP = '__monabid_skip__';

export type BuyerConversationMessageRequest = {
  message: string;
  sessionId?: string;
  language?: 'he' | 'en';
  context?: P4BuyerAiContext;
  /** Chat UI message id for criteria history; generated server-side if omitted. */
  messageId?: string;
};

export type BuyerConversationMessageResponse = {
  sessionId: string;
  updates: BuyerChatUpdate[];
};
