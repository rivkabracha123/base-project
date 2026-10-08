import type { P4BuyerAiContext } from '../ai/p4-ai.types';

export type OpenBuyerConversationRequest = {
  message: string;
  language?: 'he' | 'en';
  context?: P4BuyerAiContext;
};
