# Assistant backend

NestJS API for the standalone Monabid assistant. Copy `.env.example` to `.env` for local development. Browser code must call this service rather than external auction or AI providers directly.

## AI history

Run `npm run db:migrate` from the repository root before using history.
`POST /api/ai/generate` now requires the `x-anonymous-session-id` header and saves
each successfully generated request/response pair before returning it. The server
resolves `userId` from `user_profiles.id`; do not send a user ID in the body.
`GET /api/ai/history?page=1` requires the same header and returns
`{ items, total, page, pageSize }`, newest first, 20 exchanges per page.
Each item contains `id`, `userId`, `role`, `language`, `prompt`, `response`, and `createdAt`.

## Conversation dialogue

After running migrations, every history item also has a `conversationId`.
Send `POST /api/ai/generate` without `conversationId` to start a conversation.
The successful response includes `conversationId` and `exchangeId` alongside the
existing AI response fields. Send the returned `conversationId` on subsequent
requests to append to that conversation. The server checks ownership and requires
the same buyer/seller role before invoking the provider.

`GET /api/ai/conversations/:conversationId` returns `{ conversationId, entries }`
with all saved exchanges in chronological order. Each entry contains the original
user `prompt` and complete assistant `response`, including its structured data.
Use the same `x-anonymous-session-id` header for all operations. Unknown and
other-user conversations return 404; a role change within a conversation returns 400.
Previously saved exchanges are migrated into separate conversations, preserving data.
The existing client can reopen a conversation and append messages or start a new one.
Conversation grouping does not yet send previous turns to the AI or merge domain criteria.

History persists in PostgreSQL and is available in the existing `/assistant` page.
Earlier exchanges are not automatically included in model input. Failed generation
attempts are not stored, and exchanges made before this migration cannot be recovered.
Ownership still uses the existing anonymous session credential, not an authenticated
account. Keep that credential private; login and cross-device account linking are not
implemented. Deleting a user profile cascades to its history records in the database.
