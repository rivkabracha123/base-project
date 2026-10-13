import { buyerResponseSchema } from './buyer-response-schema';

function object(properties: Record<string, unknown>) {
  return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false };
}
const optionalText = { type: ['string', 'null'] };
const strings = { type: 'array', items: { type: 'string' } };

export const sellerFunctionNames = [
  'searchSellerComparables', 'getSellerComparableHistory', 'getSellerPriceTrend', 'getSellerItemDetails',
  'getSellerCatalogDraft', 'getSellerEnquiryPreview', 'getSellerProvenanceAdvice', 'getSellerHouseRecommendation',
  'calculateSellerValuation', 'createSellerLeadDraft', 'rankSellerHouses', 'rankAndStoreSellerHouses',
  'chooseSellerHouse', 'submitFinalSellerLead', 'listSellerLeads', 'getSellerLead', 'listEvidence',
  'uploadEvidence', 'getEvidenceFile', 'reorderEvidence', 'deleteEvidence',
] as const;

export const sellerResponseSchema = {
  ...buyerResponseSchema,
  required: [...buyerResponseSchema.required, 'functionCall'],
  properties: {
    ...buyerResponseSchema.properties,
    functionCall: object({
      functionToRun: { type: ['string', 'null'], enum: [null, ...sellerFunctionNames] },
      argumentsJson: optionalText,
    }),
    structuredAnswer: object({
      role: { type: 'string', enum: ['seller'] },
      language: { type: 'string', enum: ['he', 'en'] },
      intent: { type: 'string', minLength: 1 },
      category: { type: 'string', minLength: 1 },
      item: object({
        title: optionalText, condition: optionalText, markings: optionalText,
        signature: optionalText, provenance: optionalText,
        notes: { ...strings, type: ['array', 'null'] },
        dimensions: { ...object({ values: { type: 'array', minItems: 1, items: object({
          label: { type: 'string', minLength: 1 }, value: { type: 'number', minimum: 0 },
          unit: { type: 'string', minLength: 1 },
        }) } }), type: ['object', 'null'] },
      }),
      missingFacts: strings, confirmedFacts: strings, uncertainFacts: strings,
      sellerConfirmation: object({ required: { type: 'boolean' }, status: { type: 'string', enum: ['pending', 'confirmed', 'rejected'] } }),
      hasContactDetails: { type: 'boolean' }, hasImages: { type: 'boolean' },
    }),
  },
};
