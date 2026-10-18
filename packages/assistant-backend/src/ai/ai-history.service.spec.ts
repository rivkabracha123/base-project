import { Repository } from 'typeorm';
import { AiHistoryEntity } from '../database/ai-history.entity';
import { ProfilesService } from '../profiles/profiles.service';
import { AiHistoryService } from './ai-history.service';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { FixtureProviderService } from './fixture-provider.service';

describe('AI history ownership and persistence', () => {
  const rows: AiHistoryEntity[] = [];
  const profiles = { getOrCreateBySessionId: jest.fn(async (session: string) => ({ id: `user-${session}` })) };
  const repository = {
    findOneBy: jest.fn(async (where: { userId: string; conversationId: string }) => rows.find(row => row.userId === where.userId && row.conversationId === where.conversationId) ?? null),
    find: jest.fn(async ({ where }: { where: { userId: string; conversationId: string } }) => rows.filter(row => row.userId === where.userId && row.conversationId === where.conversationId)),
    create: (row: Partial<AiHistoryEntity>) => row,
    save: jest.fn(async (row: AiHistoryEntity) => { rows.push(row); return row; }),
    findAndCount: jest.fn(async ({ where, skip, take }) => {
      const owned = rows.filter(row => row.userId === where.userId);
      return [owned.slice(skip, skip + take), owned.length];
    }),
  };
  const history = new AiHistoryService(repository as unknown as Repository<AiHistoryEntity>, profiles as unknown as ProfilesService);
  const request = { prompt: 'blue ring budget 500', role: 'buyer' as const, language: 'en' as const };

  beforeEach(() => { rows.length = 0; jest.clearAllMocks(); });
  it.each(['buyer', 'seller'] as const)('retains both sides of a %s dialogue under one conversation ID', async role => {
    const controller = new AiController({ generate: (input: typeof request) => new FixtureProviderService().generate(input) } as unknown as AiService, history);
    const first = await controller.generate({ ...request, role }, 'a');
    const second = await controller.generate({ ...request, role, prompt: 'More item details', conversationId: first.conversationId }, 'a');
    expect(second.conversationId).toBe(first.conversationId);
    expect(second.exchangeId).not.toBe(first.exchangeId);
    const dialogue = await history.conversation('a', first.conversationId);
    expect(dialogue.entries.map(entry => entry.prompt)).toEqual([request.prompt, 'More item details']);
    expect(dialogue.entries[0]?.response.summary).toBe(first.summary);
    expect(dialogue.entries[1]?.response.nextAction).toBe(second.nextAction);
    const fresh = await controller.generate({ ...request, role }, 'a');
    expect(fresh.conversationId).not.toBe(first.conversationId);
  });
//test to reject access
  it('rejects access and writes to another user conversation before AI generation', async () => {
    const generate = jest.fn((input: typeof request) => new FixtureProviderService().generate(input));
    const controller = new AiController({ generate } as unknown as AiService, history);
    const first = await controller.generate(request, 'a');
    generate.mockClear();
    await expect(history.conversation('b', first.conversationId)).rejects.toThrow('Conversation not found');
    await expect(controller.generate({ ...request, conversationId: first.conversationId }, 'b')).rejects.toThrow('Conversation not found');
    await expect(controller.generate({ ...request, role: 'seller', conversationId: first.conversationId }, 'a')).rejects.toThrow('Start a new conversation');
    expect(generate).not.toHaveBeenCalled();
  });
//test to dont mix buyer and seller
  it('persists buyer and seller exchanges under the resolved user, keeping sessions isolated', async () => {
    const ai = { generate: (input: typeof request) => new FixtureProviderService().generate(input) };
    const controller = new AiController(ai as unknown as AiService, history);
    await controller.generate(request, 'a');
    await controller.generate({ ...request, role: 'seller' }, 'a');
    await controller.generate(request, 'b');
    const first = await history.list('a', 1);
    expect(first.total).toBe(2);
    expect(first.items.every(item => item.userId === 'user-a')).toBe(true);
    expect(first.items[0]?.response.summary).toBeTruthy();
    expect((await history.list('b', 1)).total).toBe(1);
    expect((await history.list('c', 1)).items).toEqual([]);
  });
//test reject missing sessions before saving an answer
  it('rejects missing sessions before generating or saving an answer', async () => {
    const ai = { generate: jest.fn() };
    const controller = new AiController(ai as unknown as AiService, history);
    await expect(controller.generate(request)).rejects.toThrow('session ID');
    await expect(history.list(' ', 1)).rejects.toThrow('session ID');
    expect(ai.generate).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });
//test when DB cant save the changes
  it('does not acknowledge success when the database cannot save the exchange', async () => {
    const response = await new FixtureProviderService().generate(request);
    repository.save.mockRejectedValueOnce(new Error('database unavailable'));
    const controller = new AiController({ generate: jest.fn().mockResolvedValue(response) } as unknown as AiService, history);
    await expect(controller.generate(request, 'a')).rejects.toThrow('database unavailable');
  });
//test validate pages
  it('validates pages and applies pagination within the owner filter', async () => {
    await expect(history.list('a', 0)).rejects.toThrow('Page');
    await history.list('a', 2);
    expect(repository.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-a' }, skip: 20, take: 20 }));
  });
});
