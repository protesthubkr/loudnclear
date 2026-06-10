# Loud & Clear

Standalone statement feed prepared from the ProtestHub `/statements` vertical slice.

## Local Setup

1. Copy `.env.example` to `.env.local`.
2. Fill the Supabase, OpenAI, and cron secret values.
3. Run `npm install`.
4. Run `npm run dev`.

The public feed is served from `/`. Ingest endpoints remain under `/api/ingest/*`.
