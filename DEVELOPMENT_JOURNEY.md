# VIREO — Backend Development Journey

> How the VIREO API server was built, the architecture behind it, and the real challenges faced along the way.

## 1. Overview

The VIREO API is an **Express 5** backend powering the whole platform — authentication, workspaces, projects, boards, tasks, sprints, workflows, automation, search, reports, AI, billing, and real-time collaboration. It runs on **two databases at once** (PostgreSQL + MongoDB) and ships a Socket.io server for live updates plus a cron scheduler for scheduled automation and trial expiry.

| | |
|---|---|
| Runtime | Node.js 20+ |
| Framework | Express 5.2 |
| Language | TypeScript 7 (strict) |
| Postgres ORM | Prisma 7 + `@prisma/adapter-pg` |
| MongoDB ODM | Mongoose 9 |
| Realtime | Socket.io 4.8 |
| Auth | JWT access + refresh rotation, bcrypt, OTP, OAuth |
| Payments | Stripe 22 (subscriptions, checkout, webhooks, portal) |
| AI | OpenAI 6 (any compatible endpoint) |
| Email | Nodemailer + multi-provider relay chain |
| Scheduling | node-cron |

---

## 2. Architecture: Why Two Databases?

One of the biggest upfront decisions was splitting data across **two stores** rather than forcing everything into one:

- **PostgreSQL (Prisma)** holds the *organizational spine* — the relational, tightly-coupled core: `Workspace`, `WorkspaceMember`, `Invitation`, `Project`, `Board`, `Column`, `Sprint`. These need relational integrity (unique keys, relationships, joins).
- **MongoDB (Mongoose)** holds the *high-cardinality, schema-flexible* data: `User`, `Task`, `Comment`, `Workflow`, `WorkflowScheme`, `AutomationRule`, `Epic`, `Version`, `Component`, `CustomField`, `SavedFilter`, `Notification`, `PermissionScheme`, `ProjectRole`, `IssueSecurityScheme`, `Subscription`, `Integration`, `AuditLog`, `ActivityLog`, `AIInteraction`, `Dashboard`, `Group`.

**Why:** tasks, comments, audit logs and AI interactions are written at very high volume and evolve quickly (custom fields, workflows). A document store fits that shape without migration churn, while the workspace/project/board tree stays relational for strict integrity.

**The trade-off:** there is **no automatic cross-database join**. Any feature that spans both stores (e.g., "which tasks belong to a workspace's projects") must resolve memberships across Prisma and Mongoose manually. This was the single most consistent source of complexity throughout development.

---

## 3. How It's Organized

Clean separation — routes → controllers → services:

- **`src/routes/`** — Express route definitions, one file per domain, mounted in `src/app.ts`. Authorization middleware is applied per route.
- **`src/controllers/`** — thin request handlers. No business logic — every controller just wraps its service in `try/catch → next(error)`.
- **`src/services/`** — the real business logic (auth, workspace, project, task, sprint, workflow, automation, billing, ai, search, reports…).
- **`src/models/mongoose/`** — Mongoose schemas.
- **`prisma/schema.prisma`** — PostgreSQL schema.
- **`src/middleware/`** — auth, workspace role guards, permission/issue-security checks, rate limiter, error handler.
- **`src/socket/`** — Socket.io server.
- **`src/emails/`** — HTML email templates.
- **`src/scripts/`** — one-off maintenance scripts.

---

## 4. How the Core Systems Were Built

### 4.1 Authentication
- Registration creates a User, generates a **6-digit OTP** (SHA-256 hashed, 10-min expiry), emails it, and issues tokens only after email verification.
- **JWT access + refresh tokens** with **rotation** — each refresh invalidates the old refresh token and returns a new pair, so stolen tokens are short-lived.
- **Google / GitHub OAuth** — redirect to the provider, exchange the code for an access token, fetch the profile, auto-create the user (verified), and redirect back to the client with fresh tokens.
- Password reset uses a hashed, expiring token.

### 4.2 Real-time (Socket.io)
- Every socket connection is authenticated by verifying the access token from the handshake.
- Each user joins a private `user:{id}` room; boards and workspaces are joined on demand (`join-board`, `join-workspace`).
- Services emit events to rooms — notifications to the user, `subscription-updated` to the workspace, board/task events to the board — so the UI updates live without polling.

### 4.3 Automation Engine
- Rules are modeled as **trigger → conditions → actions → branches** and stored in Mongo.
- `evaluateTriggers` runs fire-and-forget after task/comment events: it evaluates conditions, **enforces the plan's automation-run limit (skips, never throws)**, executes branches and actions, records the run, and writes an activity/audit entry.
- **Scheduled rules** are registered with node-cron (validated expressions kept in a `scheduledJobs` map), plus an hourly sweep that notifies assignees of tasks due within 24 hours.
- A **natural-language parser** heuristically converts English ("when a bug is created, assign it to John") into a structured rule.

### 4.4 AI / LLM
- An OpenAI client is initialized from env (`LLM_API_KEY` / `LLM_API_URL` / `LLM_MODEL`); if no key or init fails, `openai` is null.
- Each AI feature (ticket draft, summarize, comment reply, triage, sprint plan, chat) calls the LLM, parses JSON responses (stripping markdown fences), records an `AIInteraction`, and — critically — **falls back to deterministic heuristics** (`fallbackAI.ts`) when the LLM is unavailable or errors. The product never breaks when AI is down.
- AI calls are gated by plan limits **non-fatally** — the AI keeps working even if a subscription record is missing.

### 4.5 Billing (Stripe)
- A `Subscription` is eager-created for every workspace at creation (free plan, 14-day trial, rolling 30-day period).
- Checkout creates a subscription-mode Stripe session (per-seat quantity, 14-day trial) and stores the customer ID.
- **Usage limits are derived from the plan at check-time** (single source of truth in `plan.ts`), never read from stored limit fields — so changing a plan instantly changes the enforced limits.
- An hourly cron rolls the 30-day window, resetting usage counters.

### 4.6 Email
- Emails are sent through a **six-provider fallback chain**: Relay → SendGrid → Mailjet → Brevo → Resend → SMTP (Nodemailer). Each is tried in order and falls through on failure, so delivery is resilient across many environments.
- Resend auto-swaps the from-address to `onboarding@resend.dev` if `EMAIL_FROM` is a free mailbox (gmail/yahoo/etc.).
- If nothing is configured, it falls back to a localhost dummy transport so development never crashes.

### 4.7 Permissions & Security
- Layered authorization: `authenticate` (JWT) → workspace role guards → **permission schemes** (22 Jira-style permissions) → **project roles** → **issue security levels**.
- `requireTaskEditor` blocks VIEW-role members from editing; `requireTaskStatusEditor` lets a VIEW member change status only on their own tasks; `checkIssueSecurity` enforces security levels (ADMIN bypass).
- In-memory **AI rate limiter** (10 req/min per user).
- Centralized `errorHandler` hides internal details in production.

---

## 5. Challenges Faced (and How They Were Solved)

### 5.1 The dual-database "no join" problem
The relational core and document store can't join automatically. Early on, this caused subtle bugs when fetching tasks for a workspace/project, or checking a user's membership across both stores.

**Solution:** deliberate, explicit cross-store resolution in services (raw Prisma queries for the spine, Mongoose for the data) plus careful indexing on the Mongo side (task key, sprint, project, workspace, audit entity-type/action, notification prefs).

### 5.2 Express 5 breaking changes
Express 5 changed async error handling and some router APIs. Rather than depend on a patch, **every controller uses explicit `try/catch → next(error)`**, so errors reliably reach the single `errorHandler`. It's more verbose but predictable.

### 5.3 Prisma 7 + driver adapters
Prisma 7 uses **driver adapters** (`@prisma/adapter-pg`), not the binary engine. This required a `prisma.config.ts` with `earlyAccess: true`, and the schema is synced with `prisma db push` (no migration history — a known gap documented in the README).

### 5.4 TypeScript strict mode
The server runs with `strict: true` and **no `any`**. This caught many cross-DB shape mismatches at compile time, but made the explicit Prisma↔Mongo joins more verbose to type.

### 5.5 Billing activation "stuck" on free plan — the biggest production bug
Users paid on Stripe but their workspace **stayed on the free plan**. Root cause: the Stripe **webhook endpoint wasn't configured** on the host, so `checkout.session.completed` and `customer.subscription.*` events never arrived to flip the plan. The webhook also can't fire reliably on a free hosting tier.

**Solution (layered, webhook-independent):**
1. **`confirmCheckoutSession`** — a webhook-independent fallback that retrieves + expands the session server-side and applies the plan immediately if `status === "complete"`.
2. **`activateSubscriptionFromStripe`** (recovery endpoint `POST /billing/:workspaceId/activate`) — loads the workspace owner's Stripe customer, lists their subscriptions, finds one matching the workspace, and applies plan/status. The client calls this on the billing page when the plan looks stuck.
3. **Client polling** as a final fallback.
4. **`syncStripeSubscriptions.ts`** script to reconcile Mongo subscriptions against live Stripe and repair missed webhooks.
5. **`backfillSubscriptions.ts`** script to create subscriptions for workspaces that never got one.

The combination of an active recovery endpoint + polling means **plan activation works even when webhooks are unavailable** — the webhook became a fast-path optimization rather than a single point of failure.

### 5.6 Email deliverability across environments
Different hosts allow different email providers, and free mailboxes can't be used as senders. Solved with the **6-provider fallback chain** and automatic from-address handling, so email works wherever it's deployed.

### 5.7 AI resilience
LLM outages/limits shouldn't break the product. Solved with **deterministic fallbacks** for every AI feature and **non-fatal** billing guards, so AI degrades gracefully instead of erroring.

### 5.8 Plan-limit consistency
Storing limit numbers on the subscription would go stale. Solved by **deriving all limits from the plan at check-time** in one place (`plan.ts`) — one source of truth.

---

## 6. Scripts & Maintenance

```bash
npm run dev                # tsx watch — dev API on :5000
npm run build              # prisma generate + tsc (emits dist/)
npm run start              # run compiled server
npm run prisma:generate    # regenerate Prisma client
npm run prisma:push        # sync PostgreSQL schema
npm run prisma:studio      # browse Postgres data
```

### One-off scripts
- `npx tsx src/scripts/syncStripeSubscriptions.ts [--execute]` — reconcile subscriptions with Stripe (dry-run by default).
- `npx tsx src/scripts/backfillSubscriptions.ts [--execute]` — create missing subscriptions (dry-run by default).

---

## 7. Environment

Full reference in `.env.example` (config read in `src/config/index.ts`). Highlights:

| Group | Key variables |
|---|---|
| Server | `PORT`, `NODE_ENV` |
| Databases | `MONGODB_URI`, `DATABASE_URL` |
| Auth | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` |
| Email | `SMTP_*`, `EMAIL_FROM`, `EMAIL_RELAY_*`, `RESEND_API_KEY`, `SENDGRID_API_KEY`, `MAILJET_*`, `BREVO_API_KEY` |
| AI | `LLM_API_KEY`, `LLM_API_URL`, `LLM_MODEL` |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, `STRIPE_ENTERPRISE_PRICE_ID` |
| OAuth | `GOOGLE_CLIENT_*`, `GITHUB_CLIENT_*` |
| Client | `CLIENT_URL`, `OAUTH_REDIRECT_URL` |
| Uploads | `CLOUDINARY_*` |

---

## 8. Known Gaps / Roadmap

- **No automated test framework** yet — verified via `npm run build` (`tsc`).
- **No Prisma migration history** — schema synced with `db push`.
- **Stripe webhook** should be configured in production (though plan activation is webhook-independent).
- `.env.example` still lists a few unused vars (`SLACK_WEBHOOK_URL`, `GITHUB_TOKEN`, `GITHUB_WEBHOOK_SECRET`).
