export type SellerUpdate =
  | { speaker: 'system'; text: string }
  | { speaker: 'error'; code: string; text: string };