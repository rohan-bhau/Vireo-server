# VIREO — Implementation Progress Tracker

> AI-powered, Jira-class project management platform — MERN + Socket.io + LLM layer

<p align="left">
  <img src="client/public/vireo-logo.svg" alt="Vireo" width="180" />
</p>

## Repositories

| Repo | GitHub |
|------|--------|
| **Frontend** (`client/`) | `https://github.com/<your-username>/vireo-client` |
| **Backend** (`server/`) | `https://github.com/<your-username>/vireo-server` |

## Commit Strategy

- Build one small piece at a time, then commit immediately
- Each commit message must be **meaningful** (e.g. `feat: add user registration route`, not `Phase 1 step 3`)
- **Never** use milestone, phase, or step numbers in commit messages
- Frontend target: **50+ commits**
- Backend target: **30+ commits**
- Pushing after every 2–3 commits keeps the GitHub graph active

---

## Phase 0: Project Initialization
> Goal: Scaffold both repos and connect to GitHub. Zero application code.

### Frontend (Next.js + TypeScript + Tailwind + shadcn/ui)
- [x] 0.1 Create Next.js app with TypeScript, App Router, Tailwind
- [x] 0.2 Install shadcn/ui dependencies (lucide-react, clsx, tailwind-merge)
- [x] 0.3 Setup folder structure: /components, /lib, /app/(routes)
- [x] 0.4 Setup Redux Toolkit + RTK Query
- [x] 0.5 Setup Socket.io client
- [x] 0.6 Add env.local, ESLint, tsconfig tweaks
- [x] 0.7 Initialize Git (done by create-next-app)

### Backend (Node + Express + MongoDB + PostgreSQL)
- [x] 0.8 Initialize Node project, Express, TypeScript
- [x] 0.9 Setup Prisma schema (Postgres) + Mongoose config (MongoDB)
- [x] 0.10 Setup Socket.io server
- [x] 0.11 Setup folder structure: /routes, /controllers, /models, /middleware, /services
- [x] 0.12 Add env + env.example, tsconfig
- [x] 0.13 Initialize Git

### Root
- [x] 0.14 Create this implementation.md at repo root

---

## Phase 1: Core Foundation
> Auth · Workspaces · Projects · Kanban Board · Tasks (all types) · Comments · RBAC

### 1.1 Backend — Auth & Users
- [ ] User model (Mongoose)
- [ ] Auth routes: register, login, refresh, logout, forgot-password
- [ ] JWT middleware (access + refresh tokens)
- [ ] OAuth (Google/GitHub) — optional
- [ ] Profile route (GET/PUT /api/users/profile)

### 1.2 Frontend — Auth & Users
- [ ] Landing page (`/`)
- [ ] Login page (`/login`)
- [ ] Register page (`/register`)
- [ ] Auth context / Redux slice
- [ ] Forgot password page
- [ ] Profile page (`/profile`)
- [ ] Auth guard HOC / middleware

### 1.3 Backend — Workspaces
- [ ] Workspace model (Postgres via Prisma)
- [ ] Workspace CRUD routes
- [ ] Invitation model + routes (Postgres)
- [ ] Member role middleware

### 1.4 Frontend — Workspaces
- [ ] Workspace selection page (`/workspaces`)
- [ ] Create workspace dialog
- [ ] Workspace home page (`/w/:workspaceId`)
- [ ] Members page (`/w/:workspaceId/members`)
- [ ] Workspace settings page (`/w/:workspaceId/settings`)

### 1.5 Backend — Projects & Boards
- [ ] Project model (Postgres)
- [ ] Board model (Postgres — columns config)
- [ ] Project CRUD routes
- [ ] Board routes

### 1.6 Frontend — Projects & Boards
- [ ] Project creation flow
- [ ] Kanban board page (`/p/:projectId/board`)
- [ ] Board drag-drop (@dnd-kit)
- [ ] Real-time board sync (Socket.io)
- [ ] Board filters + swimlanes

### 1.7 Backend — Tasks
- [x] Task model (Mongoose — all 5 types: task, bug, epic, story, subtask)
- [x] Task routes: CRUD, status transitions, linked tasks, board/column moves
- [x] Activity log model + recording middleware
- [x] Attachment upload support (URL-based, extensible to Multer + Cloudinary)
- [x] Real-time socket events: task-moved, task-updated, join/leave task rooms

### 1.8 Frontend — Tasks
- [ ] Task detail page (`/task/:taskKey`)
- [ ] Task create/edit dialog
- [ ] Rich-text description editor
- [ ] Comment thread (create, edit, delete)
- [ ] Activity log display
- [ ] Attachment upload UI

### 1.9 Notifications
- [ ] Notification model (MongoDB)
- [ ] Notification creation on triggers (assigned, mentioned, status change)
- [ ] Notification center UI (`/notifications`)

---

## Phase 2: Agile Engine
> Backlog · Sprints · Scrum Board · Epics · Story Points · Reports

### 2.1 Backend — Sprints & Epics
- [ ] Sprint model (Postgres)
- [ ] Epic model (MongoDB)
- [ ] Sprint CRUD routes + start/complete
- [ ] Backlog assignment routes

### 2.2 Frontend — Sprints & Epics
- [ ] Backlog page (`/p/:projectId/backlog`)
- [ ] Create sprint dialog
- [ ] Sprint planning (drag tasks, capacity bar)
- [ ] Scrum board (`/p/:projectId/sprint/:sprintId`)
- [ ] Epic color-coded sidebar

### 2.3 Reports
- [ ] Burndown chart
- [ ] Velocity chart
- [ ] Reports page (`/p/:projectId/reports`)

---

## Phase 3: Advanced PM
> Roadmap · Custom Workflows · JQL-lite · Automation

### 3.1 Backend
- [ ] Workflow model + routes
- [ ] Automation rule model + execution engine
- [ ] Search/filter query builder

### 3.2 Frontend
- [ ] Roadmap Gantt view (`/p/:projectId/roadmap`)
- [ ] Workflow editor in project settings
- [ ] Advanced filter builder UI
- [ ] Saved filters sidebar
- [ ] All-tasks table view (`/p/:projectId/tasks`)
- [ ] Global search (`/search`)

---

## Phase 4: AI Features
> Ticket Writer · Summarizer · Smart Triage · Sprint Planner · Chat Assistant

- [ ] Backend AI service layer (centralized LLM calls)
- [ ] AIInteraction logging model
- [ ] Rate limiting on AI endpoints
- [ ] AI ticket writer (draft from title)
- [ ] AI thread summarizer
- [ ] AI smart triage (labels, assignee suggestions)
- [ ] AI sprint planner
- [ ] AI chat assistant panel (`/ai-assistant`)
- [ ] Contextual AI launcher on task/board pages

---

## Phase 5: Enterprise Polish
> Notifications Center · Audit Logs · Admin Settings · Integrations · Dashboards

- [ ] Audit log viewer
- [ ] Admin settings page
- [ ] Slack webhook integration
- [ ] GitHub integration
- [ ] Dashboard page with widgets

---

## Phase 6: Team Messaging & Billing
> Chat · Calls · Plans · Trials

- [ ] Conversation model (MongoDB)
- [ ] Message model with readBy, voice/file types
- [ ] Group chat UI (`/w/:workspaceId/chat`)
- [ ] Direct messages (`/dm/:userId`)
- [ ] Typing indicators + read receipts
- [ ] Voice message recording
- [ ] WebRTC audio/video calls
- [ ] CallSession logging
- [ ] Presence (online/offline)
- [ ] Plans & billing page (`/w/:workspaceId/settings/billing`)
- [ ] 14-day trial logic
- [ ] Member limit enforcement
- [ ] Email notifications (invites, trial ending)

---

## Commit Log
| Date | Repo | Message |
|------|------|---------|
| 2026-07-15 | server | feat: initial project scaffolding |
| 2026-07-15 | client | feat: initial project scaffolding |
| 2026-07-15 | server | chore: strip business logic, keep bare scaffolding only |
| 2026-07-15 | client | chore: add logo assets, strip business logic stubs |
