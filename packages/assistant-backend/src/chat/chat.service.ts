import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Provides the demo conversation messages for a language from the fixture file.
@Injectable()
export class ChatService {
  // Parsed fixture, kept in memory after the first read so later requests skip the disk.
  private conversations?: Record<string, unknown[]>;

  // Returns the conversation messages for the requested language, loading the fixture on first use.
  async findConversation(language: string): Promise<unknown[]> {
    if (!this.conversations) {
      this.conversations = await this.loadFixture();
    }
    return this.conversations[language] ?? [];
  }

  // Reads and parses the fixture file from disk. Runs only on the first request.
  private async loadFixture(): Promise<Record<string, unknown[]>> {
    const fixturePath = resolve(__dirname, '../../../../fixtures/demo-scenarios/buyer-conversation.json');
    const raw = await readFile(fixturePath, 'utf8');
    return (JSON.parse(raw) as { conversations: Record<string, unknown[]> }).conversations;
  }
}
