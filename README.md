<div align="center">

<img src="./assets/vireo-logo.svg" alt="VIREO" width="320" />

# VIREO API Server

### REST + WebSocket API for the VIREO Project Management Platform

Express 5 backend powering the [VIREO client](https://github.com/rohan-bhau/Vireo) — authentication, workspaces, boards, tasks, sprints, workflows, automation, AI, billing, and real-time collaboration across a dual PostgreSQL + MongoDB data layer.

[![Live API](https://img.shields.io/badge/Live%20API-vireo--server.onrender.com-orange?style=for-the-badge&logo=render)](https://vireo-server.onrender.com)
[![Node.js](https://img.shields.io/badge/Node.js-20-339933?style=for-the-badge&logo=nodedotjs)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5-black?style=for-the-badge&logo=express)](https://expressjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-9-47A248?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.8-black?style=for-the-badge&logo=socketdotio)](https://socket.io/)
[![Stripe](https://img.shields.io/badge/Stripe-22-635BFF?style=for-the-badge&logo=stripe)](https://stripe.com/)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Source Code](#source-code)
- [Tech Stack](#tech-stack)
- [Architecture Note](#architecture-note)
- [Security & Middleware](#security--middleware)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [API Overview](#api-overview)
- [Available Scripts](#available-scripts)
- [Webhooks](#webhooks)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [Related Repositories](#related-repositories)
- [Author](#author)
- [Support](#support)
- [License](#license)

---

## Overview

VIREO API is the backend service for the [VIREO project management platform](https://github.com/rohan-bhau/Vireo). It exposes a REST API for workspaces, projects, boards, tasks, sprints, workflows, automation, search, reports, and billing — plus a Socket.io server for real-time board and notification events, and a cron scheduler for scheduled automation rules and trial expiry.

All endpoints are JWT-protected with role- and permission-based middleware, validated with `express-validator`, and centralized error handling. Live instance: https://vireo-server.onrender.com (`GET /api/health`).

---

## Source Code

[![Server Repository](https://img.shields.io/badge/Server%20Repository-Vireo--server-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/rohan-bhau/Vireo-server)
[![Client Repository](https://img.shields.io/badge/Client%20Repository-Vireo-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/rohan-bhau/Vireo)

---

## Tech Stack

| Category        | Technology                                                        |
| --------------- | ----------------------------------------------------------------- |
| Runtime         | Node.js 20+                                                        |
| Framework       | Express 5.2.1                                                      |
| Language        | TypeScript 7 (strict mode, `tsx` for dev)                          |
| ORM (Postgres)  | Prisma 7.8.0 with `@prisma/adapter-pg` (driver adapters)          |
| ODM (MongoDB)   | Mongoose 9.7.4                                                     |
| Realtime        | Socket.io 4.8.3 (JWT-authenticated rooms)                          |
| Auth            | jsonwebtoken 9 (access + refresh token rotation)                  |
| Payments        | Stripe 22.3.2 (subscriptions, checkout, webhooks, billing portal) |
| File uploads    | Cloudinary 2.10 + Multer 2.2                                       |
| AI / LLM        | OpenAI 6.48 (works with any OpenAI-compatible endpoint)           |
| Email           | Nodemailer 9 (SMTP, HTML templates)                               |
| Scheduling      | node-cron 4.6                                                      |
| Validation      | express-validator 7.3                                              |

---

## Architecture Note

The API intentionally uses **two databases**:

- **PostgreSQL** (via Prisma) stores the relational core of the platform: `Workspace`, `WorkspaceMember`, `Invitation`, `Project`, `Board`, `Column`, and `Sprint`.
- **MongoDB** (via Mongoose) stores the high-volume, document-shaped data: `User`, `Task`, `Comment`, `Workflow`, `WorkflowScheme`, `AutomationRule`, `Epic`, `Version`, `Component`, `CustomField`, `SavedFilter`, `Notification`, `PermissionScheme`, `ProjectRole`, `IssueSecurityScheme`, `Subscription`, `Integration`, `AuditLog`, `ActivityLog`, `AIInteraction`, `Dashboard`, `Group`, and notification preferences.

Both connections are initialized at boot (`src/config/prisma.ts`, `src/config/mongoose.ts`). MongoDB collections are created automatically by Mongoose; the PostgreSQL schema is managed with Prisma (`npm run prisma:push`).

---

## Security & Middleware

- **JWT auth** — access + refresh token rotation (`src/middleware/auth.ts`, `src/utils/token.ts`); passwords hashed with `bcryptjs`.
- **Authorization** — workspace role guards (`requireWorkspaceMember`, `requireWorkspaceRole` in `src/middleware/workspace.ts`) plus permission-scheme and issue-security checks (`src/middleware/permission.ts`).
- **Rate limiting** — per-user rate limiter on AI endpoints (`src/middleware/rateLimiter.ts`).
- **Input validation** — `express-validator` on request bodies.
- **Error handling** — centralized `errorHandler` (hides internal details in production, `src/middleware/errorHandler.ts`).
- **CORS** — restricted to the configured `CLIENT_URL` origin.
- **Realtime auth** — every Socket.io connection is authenticated with a valid access token at handshake, then joined to user/board/workspace rooms.

---

## Project Structure

```
prisma/
└── schema.prisma        # PostgreSQL schema (workspaces, projects, boards, columns, sprints)

src/
├── app.ts               # App bootstrap: middleware, routes, Socket.io, cron scheduler
├── config/              # Env config, Prisma + Mongoose connection setup
├── controllers/         # Request handlers, one file per domain (auth, task, workflow…)
├── routes/              # Express route definitions, one file per domain
├── services/            # Business logic (task, sprint, automation, billing, ai, search…)
├── models/mongoose/     # Mongoose schemas for MongoDB entities
├── middleware/          # Auth, workspace & permission guards, rate limiting, error handler
├── socket/              # Socket.io server (JWT handshake, board/workspace/user rooms)
├── emails/              # HTML email templates (invite, OTP, reset, welcome)
├── scripts/             # One-off scripts (Stripe subscription sync/backfill)
└── utils/               # AppError, JWT token helpers
```

---

## Getting Started

### Prerequisites

- **Node.js 20+** and npm
- **MongoDB** (local or Atlas) — `MONGODB_URI`
- **PostgreSQL** (local or Neon/Supabase) — `DATABASE_URL`

### Clone & Install

```bash
git clone https://github.com/rohan-bhau/Vireo-server.git
cd Vireo-server
npm install          # postinstall runs `prisma generate` automatically
```

### Environment Variables

Copy the structure from `.env.example` into a new `.env` file and fill in real values:

| Variable                     | Description                                 | Example placeholder                     |
| ---------------------------- | ------------------------------------------- | --------------------------------------- |
| `PORT`                       | API port                                    | `5000`                                  |
| `NODE_ENV`                   | Environment                                 | `development`                           |
| `MONGODB_URI`                | MongoDB connection string                   | `mongodb://localhost:27017/vireo`       |
| `DATABASE_URL`               | PostgreSQL connection string                | `postgresql://user:pass@localhost:5432/vireo` |
| `JWT_ACCESS_SECRET`          | Access-token signing secret                 | `change-me-access-secret`               |
| `JWT_REFRESH_SECRET`         | Refresh-token signing secret                | `change-me-refresh-secret`              |
| `JWT_ACCESS_EXPIRES_IN`      | Access-token lifetime                       | `15d`                                   |
| `JWT_REFRESH_EXPIRES_IN`     | Refresh-token lifetime                      | `7d`                                   |
| `CLIENT_URL`                 | Allowed CORS origin (the frontend)          | `http://localhost:3000`                 |
| `OAUTH_REDIRECT_URL`         | Public base URL that OAuth redirects land on (the API host) | `http://localhost:5000` |
| `SMTP_HOST`                  | SMTP host for email                         | `smtp.gmail.com`                        |
| `SMTP_PORT`                  | SMTP port                                   | `587`                                   |
| `SMTP_USER`                  | SMTP username                               | `you@example.com`                       |
| `SMTP_PASS`                  | SMTP password / app password                | `your-smtp-password`                    |
| `EMAIL_FROM`                 | "From" address for outgoing email           | `noreply@vireo.app`                     |
| `LLM_API_KEY`                | LLM API key (OpenAI-compatible)             | `sk-your-llm-key`                       |
| `LLM_API_URL`                | LLM base URL                                | `https://api.openai.com/v1`             |
| `LLM_MODEL`                  | Model to use for AI features                | `gpt-4o-mini`                           |
| `CLOUDINARY_CLOUD_NAME`      | Cloudinary cloud name (attachments)         | `your-cloud`                            |
| `CLOUDINARY_API_KEY`         | Cloudinary API key                          | `your-cloudinary-key`                   |
| `CLOUDINARY_API_SECRET`      | Cloudinary API secret                       | `your-cloudinary-secret`                |
| `STRIPE_SECRET_KEY`          | Stripe secret key (test mode)               | `sk_test_...`                           |
| `STRIPE_PUBLISHABLE_KEY`     | Stripe publishable key                      | `pk_test_...`                           |
| `STRIPE_WEBHOOK_SECRET`      | Stripe webhook signing secret               | `whsec_...`                             |
| `STRIPE_PRO_PRICE_ID`        | Stripe Price ID for the Pro plan            | `price_...`                             |
| `STRIPE_ENTERPRISE_PRICE_ID` | Stripe Price ID for the Enterprise plan     | `price_...`                             |
| `GOOGLE_CLIENT_ID`           | Google OAuth client ID                      | `xxxx.apps.googleusercontent.com`       |
| `GOOGLE_CLIENT_SECRET`       | Google OAuth client secret                  | `your-google-secret`                    |
| `GITHUB_CLIENT_ID`           | GitHub OAuth client ID                      | `your-github-client-id`                 |
| `GITHUB_CLIENT_SECRET`       | GitHub OAuth client secret                  | `your-github-secret`                    |

### Database Setup

```bash
npm run prisma:generate    # generate the Prisma client (also runs on install)
npm run prisma:push        # sync the PostgreSQL schema (repo uses db push, no migration history)
```

MongoDB requires no setup — Mongoose auto-creates collections from the schemas in `src/models/mongoose/`.

### Run

```bash
npm run dev                # tsx watch — starts the API on http://localhost:5000
```

---

## API Overview

All routes are prefixed with `/api` and protected by JWT auth unless noted.

| Base Path                        | Description                                                        |
| -------------------------------- | ------------------------------------------------------------------ |
| `GET /health`                    | Health check (no auth)                                             |
| `/auth`                          | Register, login, refresh, logout, OTP email verify, password reset, Google/GitHub OAuth |
| `/users`                         | User profile + admin user management                               |
| `/workspaces`                    | Workspace CRUD, membership, roles                                  |
| `/invitations`                   | Invite creation, accept, decline, resend                           |
| `/projects`                      | Project CRUD, issue types, settings                                |
| `/workspaces/:id/projects`       | Project CRUD scoped to a workspace                                 |
| `/boards`                        | Board & column CRUD, WIP limits, reorder                           |
| `/tasks`                         | Issue CRUD, move, link, subtasks, attachments (Cloudinary), comments, watch |
| `/sprints`                       | Sprint lifecycle (plan → active → complete)                        |
| `/epics`                         | Epic CRUD                                                          |
| `/versions`                      | Release versions & progress                                        |
| `/components`                    | Project components                                                 |
| `/labels`                        | Labels                                                             |
| `/workflows`                     | Visual workflows: statuses, transitions, validators, post-functions |
| `/workflow-schemes`              | Map issue types to workflows                                       |
| `/automation`                    | Automation rules: triggers, conditions, branches, actions          |
| `/search`                        | Global search, advanced filtering, field suggestions               |
| `/filters`                       | Saved (JQL) filters                                                |
| `/ai`                            | Ticket draft, summarize, comment reply, triage, sprint plan, chat, conversation history |
| `/notifications`                 | In-app notifications & read state                                  |
| `/notification-preferences`      | Per-user notification preferences                                  |
| `/notification-schemes`          | Per-project notification schemes                                   |
| `/audit-logs`                    | Audit trail for workspace actions                                  |
| `/integrations`                  | Slack, GitHub, and outbound webhook integrations                   |
| `/dashboard`                     | Workspace stats, task timeline, team workload, gadget data         |
| `/reports`                       | Burndown, velocity, cumulative flow, control chart, created-vs-resolved |
| `/billing`                       | Plans, subscription, usage limits, Stripe checkout & billing portal |
| `/admin`                         | Platform admin: users, permission schemes, issue security, workflows |
| `/webhooks`                      | Stripe webhook (no auth) + outbound webhook testing (auth)         |

---

## Available Scripts

| Script                  | Description                                                      |
| ----------------------- | ---------------------------------------------------------------- |
| `npm run dev`           | Starts the API in watch mode via `tsx` on port 5000              |
| `npm run build`         | `prisma generate` + TypeScript compile (emits `dist/`)           |
| `npm start`             | Runs the compiled server from `dist/`                            |
| `npm run prisma:generate` | Regenerates the Prisma client                                  |
| `npm run prisma:push`   | Pushes the Prisma schema to PostgreSQL                           |
| `npm run prisma:studio` | Opens Prisma Studio to browse the PostgreSQL data                |
| `postinstall`           | Automatically runs `prisma generate` after install               |

---

## Webhooks

### Stripe Webhook

`POST /api/webhooks/stripe` receives Stripe events (`checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.payment_succeeded/failed`) to keep MongoDB subscriptions in sync. The endpoint verifies the `Stripe-Signature` header against **`STRIPE_WEBHOOK_SECRET`** — billing webhooks will fail until it is configured.

To test locally with the Stripe CLI:

```bash
stripe listen --forward-to localhost:5000/api/webhooks/stripe
```

Use the signing secret printed by the CLI as `STRIPE_WEBHOOK_SECRET`.

### Outbound Webhooks

`POST /api/webhooks/trigger` (authenticated) fires a test webhook payload at an arbitrary URL and returns the status, duration, and response — useful when validating automation webhook actions.

---

## Deployment

The API is deployed on **Render** (works equally on Railway). Both database connection strings are required in production:

- `MONGODB_URI` — MongoDB Atlas
- `DATABASE_URL` — PostgreSQL (e.g. Neon)

Add every variable from [Environment Variables](#environment-variables) to the Render/Railway dashboard, then build with `npm run build` and start with `npm start`.

- **Live API:** https://vireo-server.onrender.com
- **Health check:** https://vireo-server.onrender.com/api/health

---

## Roadmap

Known gaps and next steps, reflecting the current state of the repo:

- [ ] **Automated tests** — no test framework is installed yet (verified via `npm run build`)
- [ ] **Migration history** — the schema is synced with `prisma db push`; a `prisma migrate` workflow would add versioned migrations
- [ ] **Production webhook secret** — `STRIPE_WEBHOOK_SECRET` must be set for billing events to sync
- [ ] **Cleanup** — `.env.example` still lists a few variables not read anywhere in the code (`SLACK_WEBHOOK_URL`, `GITHUB_TOKEN`, `GITHUB_WEBHOOK_SECRET`); the email provider keys (`RESEND_API_KEY`, `SENDGRID_API_KEY`, `MAILJET_*`, `BREVO_API_KEY`, `EMAIL_RELAY_*`) are live and consumed by `src/services/email.ts`

---

## Related Repositories

- **VIREO frontend** — Next.js 16 client: [github.com/rohan-bhau/Vireo](https://github.com/rohan-bhau/Vireo)

---

## Author

**MD Rohan Mia** — Full-Stack Developer

[![GitHub](https://img.shields.io/badge/GitHub-@rohan--bhau-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/rohan-bhau)

---

## Support

If you find VIREO useful, consider giving the repository a ⭐ on GitHub.

---

## License

No `LICENSE` file is included in this repository (the `package.json` declares `ISC`). Until a license file is added, all rights are reserved by the author.

---

<div align="center">

Built with ❤️ using Node.js, Express, TypeScript, Prisma, MongoDB & Socket.io

</div>
