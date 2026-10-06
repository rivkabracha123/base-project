export type SellerUpdate =
  | { speaker: 'system'; text: string; functionToRun?: string | null; result?: unknown }
  | { speaker: 'error'; code: string; text: string };