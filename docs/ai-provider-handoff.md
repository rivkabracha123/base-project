# AI provider handoff (P4)

How to configure, run, diagnose and explain the AI boundary: the one server-side adapter that sends buyer and seller messages to the project-owner selected OpenAI-compatible model, validates every reply against the buyer or seller handoff contract, and hands B2 (buyer understanding) and S1 (seller intake) either a validated answer or an explicit 503 that they turn into guided input. Everything below describes the code as it is in this repository; where the code does not do something, it says so under [Known limits](#known-limits).

Measured evidence for the fallback behavior is in [ai-provider-baseline.md](ai-provider-baseline.md).

## What it does, in one paragraph

`POST /api/ai/generate` receives one message with a `role` (`buyer` | `seller`) and a `language` (`he` | `en`). In `fixture` mode it answers from a deterministic local provider and never touches the network. In `real` mode it removes contact data, URLs, images, codes and credentials from the message and the conversation history, calls `<AI_BASE_URL>/chat/completions` with the selected model, rejects any reply that contains restricted data, is not JSON or does not match the role's handoff contract, retries once, and either returns the validated reply (HTTP 201) or answers HTTP 503. It never returns unvalidated model output and never substitutes a fixture answer for a failed real one. B2 and S1 own what happens next: on 503 they continue the conversation with their own guided parsing.

## Where the code is

All paths are under `packages/assistant-backend/src/ai/` unless stated.

| File | Responsibility |
|---|---|
| `ai.controller.ts` | `POST /api/ai/generate`, `POST /api/ai/generate-text`, conversation history routes. Sends earlier relevant turns as history. |
| `ai.service.ts` | Reads the `AI_*` configuration, calls the gateway, re-validates the result, adds the deterministic buyer `intentRoute`. |
| `provider-gateway.service.ts` | Chooses fixture or real, retry rules, off-topic handling, `classifyProviderFailure` (the logged reason codes), the 503 on failure. |
| `real-provider.service.ts` | The OpenAI-compatible call: system prompt, `sanitizePrompt`, strict JSON-schema selection, restricted-output check, parsing, normalization, contract validation. |
| `fixture-provider.service.ts` | Deterministic buyer and seller answers for fixture mode and tests. |
| `ai.dto.ts`, `buyer-handoff.ts`, `seller-handoff.ts` | The response envelope and the two handoff contracts (`isGenerateAiResponseDto`, `isBuyerHandoffContract`, `isSellerHandoffContract`). |
| `buyer-response-schema.ts`, `seller-response-schema.ts` | The JSON schemas sent to the model in strict mode, and the buyer example embedded in the system prompt. |
| `off-topic.ts` | Off-topic detection and the Hebrew/English redirect copy. |
| `p4-ai-generate.client.ts` | The HTTP client B2 and S1 use to call `AI_GENERATE_URL`. |

Consumers, owned by B2 and S1: `src/buyer/buyer-p4-bridge.service.ts` (`generateWithGuidedFallback`) and `src/seller-intake/seller-intake-ai.adapter.ts` (the 503 branch of `analyze`).

## Configuration

All variables are read server-side by `ConfigService` and validated at boot in `src/config/environment.ts`. Values in the process environment take precedence over `packages/assistant-backend/.env`. The backend reads them only at start, so **restart the backend after changing them** (`nest start --watch` restarts on source changes, not on `.env` changes).

| Variable | Default | Used by | Meaning |
|---|---|---|---|
| `AI_PROVIDER_MODE` | `fixture` | `ai.service.ts`, `p4-ai-generate.client.ts` | `fixture`: deterministic answers, no network. `real`: call the hosted model. Any other value fails boot validation. |
| `AI_BASE_URL` | none (example: `https://api.openai.com/v1`) | `ai.service.ts` | OpenAI-compatible base URL. The backend posts to `<AI_BASE_URL>/chat/completions`. |
| `AI_MODEL_NAME` | none (example: `gpt-4o-mini`) | `ai.service.ts` | Model identifier selected by the project owner. |
| `AI_API_KEY` | none | `ai.service.ts`, `p4-ai-generate.client.ts` | Provider key, sent as `Authorization: Bearer`. Server-side only. |
| `AI_TIMEOUT_MS` | `20000` | `ai.service.ts` | How long one provider call may take before it is aborted (minimum 1000). See [Limits](#limits-and-retry-behavior). |
| `AI_GENERATE_URL` | none (example: `http://localhost:3001/api/ai/generate`) | `p4-ai-generate.client.ts` | Where B2 and S1 send messages. `generate-text` is derived from it by replacing the trailing `/generate`. |
| `AI_GENERATE_API_KEY` | none | `p4-ai-generate.client.ts` | Bearer token for `AI_GENERATE_URL`. When unset, `AI_API_KEY` is sent instead (see [Known limits](#known-limits)). |
| `AI_ANONYMOUS_SESSION_ID` | none | `p4-ai-generate.client.ts` | Session header used when B2/S1 have no session id. Falls back to `buyer-b2-dev-session` / `seller-dev-session`. |

The committed defaults are in `packages/assistant-backend/.env.example`. The client never receives any of these values.

### Strict JSON-schema output

The request uses `response_format: { type: 'json_schema', strict: true }` with the role's schema only for these combinations. Every other model uses `{ type: 'json_object' }`, which validates far less often (see the smoke observation in [ai-provider-baseline.md](ai-provider-baseline.md)).

| Host of `AI_BASE_URL` | Models |
|---|---|
| `api.openai.com` | `gpt-4o`, `gpt-4o-mini`, `gpt-4.1`, `gpt-4.1-mini`, `gpt-4.1-nano`, optionally with a `-YYYY-MM-DD` suffix |
| `api.groq.com` | `openai/gpt-oss-120b`, `openai/gpt-oss-20b` (also sent `reasoning_effort: 'low'`) |

Changing the model to one outside this table keeps the app working but expect more replies to be rejected and more turns to fall back to guided input.

## Contracts

### In

`GenerateAiRequestDto` (`ai.dto.ts`): `prompt` (string), `role` (`buyer` | `seller`, required), optional `language`, `conversationId` (UUID), `sessionId`, `selectedLot` and `lots` (`{ id }` only). The `x-anonymous-session-id` header identifies the user for history.

### Out

HTTP 201 with `GenerateAiResponseDto`: `provider` and `mode` (`fixture` | `real`), `isRelevant`, `error`, non-empty `content`, `summary`, `recommendation`, `nextAction`, `confidence` (`low` | `medium`), `structuredAnswer` (a buyer or seller handoff whose `role` equals the requested role), optional `intentRoute` (buyer only) and `functionCall`, plus `conversationId` and `exchangeId`.

HTTP 503 `{ "message": "Real AI provider is unavailable." }` when the real provider failed, or `"Real AI provider is enabled but not fully configured."` when a variable is missing.

### What is validated, in order

1. Raw reply text: rejected if it contains an image data URL, a URL, an email, a phone-like number, a verification code or a credential (`invalid_response_restricted`).
2. JSON parse (`invalid_response_non_json`).
3. Normalization only of shape, never of meaning: seller `null` item fields are dropped, Hebrew units and axis labels become English (`ס"מ` → `cm`, `גובה` → `height`), missing seller arrays become empty, a missing seller confirmation becomes `{ required: true, status: 'pending' }`; in strict buyer mode `null` optional fields are dropped.
4. `isGenerateAiResponseDto(result, role)`: envelope fields, role match, and the full buyer or seller contract. A failure is logged with the first failing rule, for example `invalid_response_seller_missing_item`.
5. The gateway and `AiService` re-check the same contract; S1's client checks `isSellerHandoffContract` again on its side.

## Limits and retry behavior

| Limit | Value | Where |
|---|---|---|
| Characters per message sent to the model | 4000 after sanitization (`MAX_PROVIDER_PROMPT_LENGTH`), applied to the current message and each history prompt and answer | `real-provider.service.ts` |
| Output tokens per structured call | `max_completion_tokens: 2048` | `real-provider.service.ts` |
| Provider calls per turn | at most 2 | `provider-gateway.service.ts` |
| History sent | every earlier turn in the same conversation with `isRelevant: true`, as `{ prompt, answer: nextAction }`, not capped | `ai.controller.ts` |
| Time per provider call | `AI_TIMEOUT_MS`, default 20 000 ms (`DEFAULT_PROVIDER_TIMEOUT_MS`), for both `generate` and `generate-text`. A ceiling chosen at about 4× the slowest live reply seen on 2026-10-20 (2.3–5.0 s); not a measured latency target. | `real-provider.service.ts` |
| Rate limit on `/api/ai/generate` itself | none | – |

When a second call happens:

| First call | Second call? | Result |
|---|---|---|
| Valid reply | No | Returned. |
| HTTP 429 | **No** | 503, reason `http_429`. One call. |
| No answer within `AI_TIMEOUT_MS` | **No** | 503, reason `timeout`. One call, so guided input starts after one wait. |
| Other HTTP error, network error, invalid reply | Yes | Second result, or 503 with the second failure's reason. |
| Valid reply in the wrong language (more Latin than Hebrew letters in a Hebrew chat, or the reverse) | Yes | The second reply is returned even if still in the wrong language. |
| Valid reply with `isRelevant: false` while the message mentions buying, selling or auctions | Yes | The second reply is returned. |

Messages that are plainly off-topic (recipe, weather, joke, cooking, without any buy/sell/auction words) never reach the model: the gateway answers with the off-topic copy below and the controller restores the last relevant `structuredAnswer`, so saved item facts are kept.

## What the user sees

| Situation | Buyer (B2) | Seller (S1) |
|---|---|---|
| Real reply accepted | The model's `summary`/`nextAction` in the chat language, then B2's search. | The model's extraction merged into the S1 draft, then S1's next question. |
| Off-topic message | He: "אני יכולה לעזור בקנייה או במכירה של פריטים במכירות פומביות." En: "I can help with buying or selling items at auction." plus a line inviting them to continue. Saved facts unchanged. | Same copy. |
| Provider down, rate-limited, misconfigured or invalid reply | The chat continues with B2's local parser (`extract.error: 'guided_fallback'`, `confidence: 'low'`); search still runs when criteria are sufficient. No banner is shown. | S1's guided intake continues (`ai.fallbackMode: 'guided'`); dimensions, condition, markings, signature and provenance are parsed locally. No banner is shown. |
| Provider unavailable and the message is a general auction question | He: "זו שאלה בתחום המכירות הפומביות, אבל שירות ה־AI אינו זמין כרגע. לא אוכל לענות עליה באופן אמין כרגע." En: "This is an auction question, but the AI service is unavailable. I cannot answer it reliably right now." | Same meaning, seller wording. |
| `AI_PROVIDER_MODE=fixture` | B2 never calls `/api/ai/generate`; it uses its local fixture extract. | Every turn is guided (`generateSellerExtract` returns 503 in fixture mode by design). |

The unavailable copy for general questions belongs to B2 and S1; the off-topic copy belongs to `off-topic.ts`.

## Logs and privacy

Logged lines from the boundary, all at `warn` level from `ProviderGatewayService` or `AiService`:

```text
Real provider attempt <n> failed: <reason>
Real provider attempt 1 answered in the wrong language; retrying.
Real provider attempt 1 judged a buy/sell message unrelated; retrying.
Falling back to guided input: <reason>
Falling back to guided input: not_configured (missing AI_API_KEY)
Free-text generation failed: <reason>
```

| Reason | Meaning | First thing to check |
|---|---|---|
| `not_configured` | Real mode is on but a variable is empty. The log names the missing variables, never their values. | `.env`, then restart. |
| `http_401`, `http_403` | Key rejected. | `AI_API_KEY`, account access to `AI_MODEL_NAME`. |
| `http_404` | Wrong path or model. | `AI_BASE_URL` must end before `/chat/completions`; `AI_MODEL_NAME`. |
| `http_429` | Rate limited; not retried. | Provider quota. The journey continues guided. |
| `http_5xx` | Provider outage. | Provider status. |
| `timeout` | The provider did not answer within `AI_TIMEOUT_MS`. Not retried. | Provider status; raise `AI_TIMEOUT_MS` only if replies are genuinely slow. |
| `unavailable` | Network failure (DNS, refused connection, offline). | Network access from the backend host to `AI_BASE_URL`. |
| `invalid_response_non_json`, `invalid_response_no_content` | Reply was not usable JSON. | Model outside the strict-schema table. |
| `invalid_response_restricted` | Reply contained a URL, contact-like number, code or credential. | Usually the model echoed a link or a phone-like number; see [Contact data and numbers](#contact-data-and-numbers). |
| `invalid_response_<rule>` | Reply broke the contract at `<rule>` (for example `seller_missing_item`, `wrong_structured_answer_role`, `invalid_handoff_contract`). | The rule names the field. |

Provider error bodies, prompts, replies, the key and the base URL are never logged; only the reason. HTTP request logs redact `authorization` and `x-anonymous-session-id`. The tests in `provider-baseline.spec.ts` and `provider-gateway.service.spec.ts` check this.

### Contact data and numbers

`sanitizePrompt` (outgoing) and the restricted-output check (incoming) treat any run of 8 or more digits, spaces, dots, dashes and brackets as a phone number, with two exceptions that are item facts:

- an ascending year range between 1000 and 2099: "1850-1900", "1850 - 1900" are kept; "1900-1850" is removed;
- a thousands-grouped amount with a currency within a few characters: "1 000 000 ש\"ח", "$2 500 000", "1.000.000 EUR" are kept; "1 000 000" alone and "1 800 123 456" are removed.

Tests: "keeps year ranges and currency amounts that look like phone numbers", "still removes phone numbers, including ones that resemble years or amounts" and "accepts a reply that echoes a year range but rejects one with a phone number" in `real-provider.service.spec.ts`.

Contact details typed by a buyer are captured to the buyer's profile by `ProfilesService.captureContactIfPresent` **before** sanitization; they are removed from what is sent to the model. Conversations (prompt and validated response) are stored in the `ai_history` table for the history screen; they are not written to logs.

## Runbook

All commands from the repository root.

### Run in fixture mode (default, CI)

```sh
docker compose up -d
npm run dev
npm test -w @monabid/assistant-backend -- src/ai src/buyer/buyer-p4-bridge src/seller-intake/seller-intake-ai.adapter
```

No variable besides `AI_PROVIDER_MODE=fixture` is needed, and nothing calls the network.

### Switch to the real model

1. In `packages/assistant-backend/.env` set `AI_PROVIDER_MODE=real`, `AI_BASE_URL`, `AI_MODEL_NAME`, `AI_API_KEY` (from the project owner) and `AI_GENERATE_URL=http://localhost:3001/api/ai/generate`.
2. Restart `npm run dev`.
3. Smoke one Hebrew and one English message. Send the body as UTF-8 from Node; inline Hebrew in `curl` from Git Bash on Windows arrives garbled and the model then extracts nonsense.

```js
// save as smoke.mjs, run with: node smoke.mjs
for (const body of [
  { role: 'buyer', language: 'he', prompt: 'אני מחפשת כתב יד עתיק עד 100000 דולר' },
  { role: 'seller', language: 'en', prompt: 'I want to sell a silver kiddush cup, 12 cm tall, good condition' },
]) {
  const res = await fetch('http://localhost:3001/api/ai/generate', { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-anonymous-session-id': crypto.randomUUID() },
    body: JSON.stringify(body) });
  const json = await res.json();
  console.log(res.status, json.provider, json.summary, JSON.stringify(json.structuredAnswer));
}
```

Expected: status `201`, `provider: real`, and the item, price and currency from the message in `structuredAnswer`.

### Demonstrate the unavailable journey

Point the provider at a closed port and restart: `AI_BASE_URL=http://127.0.0.1:9/v1`. `/api/ai/generate` answers 503, the log shows `Real provider attempt 1 failed: unavailable`, `attempt 2`, then `Falling back to guided input: unavailable`, and the buyer chat still searches and the seller chat still asks guided questions. Empty `AI_API_KEY` gives the same journey with `not_configured (missing AI_API_KEY)`.

### Diagnose a turn that fell back

1. Find `Falling back to guided input: <reason>` in the backend log for that time.
2. Look up the reason in the table above.
3. To reproduce a malformed reply without the hosted model, add a case to `fixtures/ai-responses/provider-baseline.json` with the reply text and the expected reason, and run `npm test -w @monabid/assistant-backend -- src/ai/provider-baseline`.

## Fixture trace (week 7 checkpoint)

`provider-baseline.spec.ts`, describe block "P4 fixture trace into B2 and S1":

- `buyer-he-valid` ("אני מחפשת כתב יד עתיק עד 100000 דולר") is replayed through `RealProviderService` and `ProviderGatewayService`, then handed to `P4AiGenerateClient.generateBuyerExtract`, the call B2 makes. B2 receives `provider: real`, `category: rare_books`, `price: { max: 100000, currency: 'USD' }` and the Hebrew summary.
- `seller-he-valid` ("יש לי כתב יד עתיק במצב טוב") reaches `generateSellerExtract`, the call S1 makes, as a valid seller handoff: `category: rare_books`, `item.condition: 'מצב טוב'`, `missingFacts: ['dimensions']`, confirmation `pending`.
- `buyer-he-rate-limited` ends as reason `http_429` after one call, and the 503 reaches both clients as `ServiceUnavailableException`, the exact error `generateWithGuidedFallback` (B2) and the adapter's 503 branch (S1) catch. Their guided behavior is tested in `buyer-p4-bridge.service.spec.ts` ("opens a guided search immediately when the AI is unavailable") and `seller-intake-ai.adapter.spec.ts` ("continues with guided intake when the real AI provider is unavailable").

## Known limits

- **Prompt files are not loaded at runtime.** `prompts/buyer/v1.json` and `prompts/seller/v1.json` are review references. The live system prompt is built in `real-provider.service.ts` (`BUYER_DOMAIN_RULES`, `SELLER_DOMAIN_RULES` and the instruction list in `generate`) plus the example in `buyer-response-schema.ts`. A change to the JSON files changes nothing until it is copied there.
- **Grouped amounts without a currency are still removed.** "budget 1 000 000" (no currency word or symbol next to it) reaches the model as `[contact removed]`, and so does any plain run of 8 or more digits ("10000000"); up to 7 plain digits ("1000000") are kept. This keeps "1 800 123 456" style phone numbers out.
- **Long seller conversations lose their latest message.** S1 sends `Previous seller details: … Latest seller message: …` as one prompt, and the 4000-character cut keeps the beginning. Found by reading the code; not reproduced.
- **A buyer turn can wait twice the timeout.** B2 calls `/api/ai/generate` twice in one buyer turn (the message and the search-readiness check), so with a silent provider the turn waits up to 2 × `AI_TIMEOUT_MS` before the guided result. Measured with `AI_TIMEOUT_MS=2000`: 4.3 s.
- **No rate limit or cost cap of our own.** Each turn costs one or two provider calls, and history grows with the conversation.
- **The provider key can be sent to `AI_GENERATE_URL`.** When `AI_GENERATE_API_KEY` is unset, B2/S1 send `AI_API_KEY` as the bearer token to `AI_GENERATE_URL`. `/api/ai/generate` does not check it. This is harmless while the URL is this backend; set `AI_GENERATE_API_KEY` before pointing it anywhere else.
- **Guided mode is silent.** Neither chat tells the user the AI is unavailable, except for general auction questions. The client string `assistant.fallback` ("הספק אינו זמין. הופעלו שאלות מונחות.") exists but is not rendered anywhere, and `SellerChat.tsx` strips an "AI is temporarily unavailable…" prefix from system messages if one arrives.
- **Strict schema only for the listed models.** See [Strict JSON-schema output](#strict-json-schema-output).
- **Wrong-language replies are retried once, not repaired.** If the second reply is also in the wrong language it is returned.
- **Quality is not measured.** The baseline counts how replies are accepted or rejected for a fixed corpus. There is no accuracy, latency or relevance threshold, and the live checks below are samples, not rates.

## Live observation (2026-10-20, local, not in CI)

Against `gpt-4o-mini` on `api.openai.com` with the developer's key:

- Hebrew buyer "אני מחפשת כתב יד עתיק עד 100000 דולר", twice: `category: manuscripts`, `price: { max: 100000, currency: 'USD' }` both times. Hebrew buyer "מחפש חנוכייה מכסף עד 3000 דולר": `menorahs`, 3000 USD.
- Hebrew seller "אני רוצה למכור גביע קידוש מכסף, גובה 12 ס\"מ, במצב טוב": height 12 cm extracted, `category: unknown`, and the next question asked for the category. English seller with the same item: `kiddush_cups`.
- Hebrew "תן לי מתכון לעוגת שוקולד": answered by the off-topic copy without calling the model.
- After the sanitizer change, Hebrew "מחפשת ציור שמן מהתקופה 1850-1900 עד 1 000 000 ש\"ח": `periods: ['1850-1900']`, `price: { max: 1000000, currency: 'ILS' }`; English "…from 1850-1900, budget up to $2 500 000": same period, 2 500 000 USD. English seller message ending "call me at 050-123-4567": number removed, `hasContactDetails: false`, item extracted.
- 13 accepted live calls took 2.3–5.0 s end to end.
- Second backend pointed at a server that accepts connections and never answers, `AI_TIMEOUT_MS=2000`: `/api/ai/generate` 503 after 2.1 s with one `timeout` attempt logged; the buyer chat completed a guided search in 4.3 s.
- Second backend with `AI_BASE_URL=http://127.0.0.1:9/v1`: `/api/ai/generate` 503, two `unavailable` attempts logged, buyer chat completed a search with `guided_fallback`. With empty `AI_API_KEY`: 503, log `not_configured (missing AI_API_KEY)`, same buyer result.

A handful of messages, recorded to show actual behavior, not as a reliability rate.
