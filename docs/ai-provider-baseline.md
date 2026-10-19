# P4 AI provider baseline (Week 6)

How the AI boundary behaves on valid replies, malformed replies, rate limits and outages. Every number below comes from a committed fixture and a test that fails if the behavior changes. No hosted model is called.

## Reproduce

From the repository root:

```sh
# The baseline corpus (14 recorded replies)
npm test -w @monabid/assistant-backend -- src/ai/provider-baseline

# All AI boundary suites: adapter, gateway, schema validation, retry, privacy, fallback
npm test -w @monabid/assistant-backend -- src/ai src/buyer/buyer-p4-bridge src/seller-intake/seller-intake-ai.adapter
```

## Corpus

`fixtures/ai-responses/provider-baseline.json` holds 14 provider replies for the configured `gpt-4o-mini` model on the OpenAI-compatible endpoint. `src/ai/provider-baseline.spec.ts` replays each one through `RealProviderService` and `ProviderGatewayService` with a stubbed `fetch`.

Three malformed shapes are marked `recorded`: `gpt-4o-mini` returned them in `json_object` mode during the local smoke run described below. Their text is synthetic.

## Measured result

| Case | Role / language | Outcome | Logged reason | Provider calls |
|---|---|---|---|---|
| buyer-he-valid | buyer / he | accepted | – | 1 |
| buyer-en-valid | buyer / en | accepted | – | 1 |
| seller-he-valid | seller / he | accepted | – | 1 |
| seller-en-valid | seller / en | accepted | – | 1 |
| buyer-en-creators-as-string (recorded) | buyer / en | rejected → guided | invalid_response_invalid_handoff_contract | 2 |
| seller-he-empty-structured-answer (recorded) | seller / he | rejected → guided | invalid_response_wrong_structured_answer_role | 2 |
| seller-en-missing-item (recorded) | seller / en | rejected → guided | invalid_response_seller_missing_item | 2 |
| buyer-en-prose-not-json | buyer / en | rejected → guided | invalid_response_non_json | 2 |
| buyer-he-missing-summary | buyer / he | rejected → guided | invalid_response_invalid_handoff_contract | 2 |
| seller-en-echoes-contact | seller / en | rejected → guided | invalid_response_restricted | 2 |
| buyer-en-empty-content | buyer / en | rejected → guided | invalid_response_no_content | 2 |
| buyer-he-rate-limited | buyer / he | unavailable → guided | http_429 | 1 |
| seller-en-provider-503 | seller / en | unavailable → guided | http_503 | 2 |
| buyer-en-network-error | buyer / en | unavailable → guided | unavailable | 2 |

Totals: 14 cases, 4 accepted, 7 malformed replies rejected, 3 outages or rate limits, 23 provider calls.

What the table shows:

- **No invalid output is accepted.** Every malformed reply ends in `ServiceUnavailableException`, which B2 (`BuyerP4BridgeService`) and S1 (`SellerIntakeAiAdapter`) turn into guided input.
- **Rate limits are not retried.** A 429 costs one call. Other failures get one retry, so they cost two calls.
- **Logs carry only the coarse reason.** The test checks that the API key, the provider URL and contact data never appear in the logs.

These are behavioral counts for a fixed corpus. They are not latency, accuracy or quality thresholds.

## Local smoke observation (not run in CI)

On 2026-10-18 the developer ran the same Hebrew and English buyer and seller prompts against the configured `gpt-4o-mini` endpoint, with a local key:

- **Before the change:** strict JSON-schema output was enabled only for `gpt-4.1-mini`, so this model used `json_object`. 0 of 4 replies passed validation, and 5 of 6 live `/api/ai/generate` calls returned 503.
- **After the change:** strict JSON-schema output is enabled for `gpt-4o`, `gpt-4o-mini` and `gpt-4.1*`. 4 of 4 replies passed validation.

This is a one-off sample of four prompts, recorded to explain the fix. It is not a reliability rate.
