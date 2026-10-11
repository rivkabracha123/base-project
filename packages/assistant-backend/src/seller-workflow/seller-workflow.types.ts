export type SellerFunctionName =
  | 'analyzeSellerIntake'
  | 'createSellerLeadDraft'
  | 'createSellerLead'
  | 'rankSellerHouses'
  | 'rankAndStoreSellerHouses'
  | 'rankHousesForLead'
  | 'chooseSellerHouse'
  | 'saveSellerHouseChoice'
  | 'submitFinalSellerLead'
  | 'listSellerLeads'
  | 'getSellerLead'
  | 'listEvidence'
  | 'uploadEvidence'
  | 'getEvidenceFile'
  | 'reorderEvidence'
  | 'deleteEvidence';

export type SellerFunctionResponse =
  | { functionToRun: SellerFunctionName; object: Record<string, unknown> }
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
