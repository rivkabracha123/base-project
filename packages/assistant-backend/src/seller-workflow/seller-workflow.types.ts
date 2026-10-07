export type SellerFunctionResponse =
  | { functionToRun: 'analyzeSellerIntake'; object: { input: string } }
  | {
      functionToRun: 'createSellerLead';
      object: {
        profileId: string;
        contact: { preferredName: string; email?: string; phone?: string };
        serviceConsent: true;
      };
    }
  | {
      functionToRun: 'rankHousesForLead';
      object: {
        leadId: string;
        category: string;
        geography?: string;
        preferredLanguage?: string;
      };
    }
  | { functionToRun: 'saveSellerHouseChoice'; object: { leadId: string; houseId: string } }
  | { functionToRun: null; object: null };

export type SellerHandoffContract = SellerFunctionResponse;

export interface SellerWorkflowRequest {
  profileId: string;
  structuredAnswer: SellerHandoffContract;
}

export interface SellerWorkflowResult {
  functionToRun: SellerFunctionResponse['functionToRun'];
  result: unknown;
}

export type SellerWorkflowResultCallback = (result: SellerWorkflowResult) => void | Promise<void>;
