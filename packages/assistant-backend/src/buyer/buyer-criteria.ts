/** The buyer budget captured by the criteria flow. */
export interface BuyerBudget {
  min: number;
  max: number;
}

/** Structured buyer intent received from B2. */
export interface BuyerCriteria {
  category?: string;
  creator?: string;
  period?: string;
  media?: string;
  keywords?: string[];
  geography?: string;
  budget?: BuyerBudget;
  missing: string[];
  nextQuestion?: string;
}
