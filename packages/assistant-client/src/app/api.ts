import { auctionLotFixtureSchema, auctionLotSchema, type AuctionLot } from '@monabid/shared';
import { z } from 'zod';
import lotFixtures from '../../../../fixtures/auction-data/lots.json';
import type { StaffLead } from '../staff-operations.types';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api';

// Keep dashboard data limited to the fields required for manual review.
const staffLeadListSchema = z.array(z.object({
  id: z.string().min(1),
  type: z.enum(['buyer', 'seller']),
  clientName: z.string().min(1),
  status: z.string().min(1),
  requestDetails: z.string().min(1),
  createdAt: z.string().datetime(),
}));

export async function getSampleLot(language: string, signal?: AbortSignal): Promise<AuctionLot> {
  if (import.meta.env.VITE_FIXTURE_MODE === 'true') {
    const [sampleLot] = auctionLotFixtureSchema.parse(lotFixtures);
    if (!sampleLot) throw new Error('No sample fixture is available');
    return sampleLot;
  }

  const response = await fetch(`${apiBaseUrl}/lots/sample?language=${encodeURIComponent(language)}`, { signal });
  if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
  return auctionLotSchema.parse(await response.json());
}

export async function getStaffOperationLeads(signal?: AbortSignal): Promise<StaffLead[]> {
  const response = await fetch(`${apiBaseUrl}/staff-operations/leads`, { signal });
  if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
  return staffLeadListSchema.parse(await response.json());
}
