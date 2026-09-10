
import { randomUUID } from 'node:crypto';

export function createMockProfileId(): string {
  return `mock-profile-${randomUUID()}`;
}

