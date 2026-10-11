import { Injectable } from '@nestjs/common';

// Starts a new seller conversation without demo messages.
@Injectable()
export class SellerChatService {
  async findConversation(_language: string): Promise<unknown[]> {
    // New seller sessions start without a prefilled demo conversation.
    return [];
  }
}
