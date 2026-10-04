<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project: JobSeeker

Resume → LLM profile extraction → free job-API search + JD match scoring. Next.js 16 App Router, Prisma + SQLite, Auth.js v5 credentials, Vercel AI SDK.

### Commands
- `npm run dev` — dev server
- `npm run build` / `npm run lint` / `npx tsc --noEmit` — verification
- `npx prisma migrate dev` — after schema changes
- npm `allowScripts` is enforced — approve install scripts via `npm approve-scripts <pkg>` if a package fails to set up (Prisma engines need this)

### Architecture
- `lib/llm.ts` — provider factory (platform-agnostic, user's own key) + `extractProfile`
- `lib/jobs/` — free providers (Remotive, RemoteOK, Arbeitnow, Jobicy) + aggregator (normalize, dedupe, location filter)
- `lib/agent.ts` — query planning → aggregation → LLM ranking (2-stage, no tool-calling required)
- `lib/matcher.ts` — resume vs JD analysis
- `lib/coach.ts` — interview Q&A (learn + practice), learned-profile merge, market demand scan
- `proxy.ts` — route protection (Next 16 convention, replaces middleware.ts)
- User LLM keys are session-only: zustand + sessionStorage, sent per request, never persisted

### Env
- `.env`: `DATABASE_URL="file:./dev.db"`, `AUTH_SECRET`
