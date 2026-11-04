<div align="center">

<img src="artifacts/tadaruk/public/brand-logo.png" alt="TADARUK logo" width="230" />

# TADARUK | تدارك

### بلّغ وتابع وتدارك

**An Arabic-first maintenance management platform that turns scattered issue reports into clear, trackable work.**

<br />

![React](https://img.shields.io/badge/React-19-1F3363?style=flat-square&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-1F3363?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-5276A7?style=flat-square&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-5276A7?style=flat-square&logo=tailwindcss&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-384B6A?style=flat-square&logo=express&logoColor=white)

**[The Problem](#the-problem) · [How It Works](#how-it-works) · [Demo Roles](#explore-the-three-roles) · [Tech Stack](#tech-stack) · [Getting Started](#getting-started)**

</div>

---

## The idea

Maintenance reports often arrive through messages, calls, or conversations. When information is scattered, it becomes harder to know **what happened, who is responsible, and whether the issue was resolved**.

**TADARUK (تدارك)** brings reporting, assignment, follow-up, and repair documentation into one shared workflow. The initial use case focuses on multi-branch restaurant operations.

> **One report. One clear owner. One place to follow the work.**

## How it works

```mermaid
flowchart LR
    A["Report an issue"] --> B["Structure the ticket"]
    B --> C["Assign a technician"]
    C --> D["Document the repair"]
    D --> E["Reporter confirms"]
    E --> F["Close and retain the solution"]
```

1. **Report** — Describe an issue in writing, attach a photo, or use the voice-input experience.
2. **Prepare** — Review a structured ticket with a title, description, category, location, and suggested priority.
3. **Assign** — Route the work to a technician based on branch and relevant specialization, with a pending-assignment path when needed.
4. **Track** — Follow ticket status and technician updates in one place.
5. **Confirm** — The reporter reviews the completed repair before the ticket closes.
6. **Learn** — Confirmed repair details become useful entries in the maintenance knowledge base.

### A note on the AI experience

The repository currently includes a **demo analysis adapter** with preset maintenance scenarios. It illustrates the intended AI-assisted ticket creation flow; it should **not** be mistaken for a fully deployed production AI model or live speech-to-text service.

## Explore the three roles

| Role | What they can do |
| :-- | :-- |
| **Reporter · المبلّغ** | Create reports, review suggested ticket details, track their own tickets, and confirm repairs. |
| **Technician · الفني** | View assigned work, update progress, and document the repair. |
| **Operations Manager · مدير العمليات** | Monitor tickets across branches, manage technicians and branches, and review recurring-issue insights and the knowledge base. |

The app includes selectable demo accounts and seeded example maintenance reports to showcase these different perspectives. Access is scoped by role within the application's API workflow.

## Product highlights

- **Arabic-first experience** with RTL/LTR support and language switching.
- **Light and dark themes** using TADARUK's navy-led visual identity.
- **Structured reporting** with text, photo, and a voice-input interface.
- **Demo-assisted ticket analysis** designed to be replaceable with a real AI service.
- **Specialization-aware assignment** and ticket status tracking.
- **Multi-branch operations** and technician management.
- **Repair confirmation and knowledge capture**.
- **Responsive interfaces** for desktop and mobile.

## Tech stack

| Layer | Technology |
| :-- | :-- |
| Frontend | React 19, TypeScript, Vite 7 |
| UI and motion | Tailwind CSS 4, Radix UI, Motion, Lucide React |
| Routing and data | Wouter, TanStack Query |
| Backend | Node.js, Express 5 |
| Database | PostgreSQL, Drizzle ORM |
| API contracts | Shared workspace libraries, Zod, generated React API client |
| Workspace | pnpm monorepo |

## Project structure

```text
TADARUK/
├── artifacts/
│   ├── tadaruk/           # React frontend and public assets
│   └── api-server/        # Express API
├── lib/
│   ├── api-client-react/  # Shared generated API client
│   └── db/                # Database access and schema
├── attached_assets/       # Project assets
├── pnpm-workspace.yaml
└── vercel.json
```

## Getting started

**Requirements:** Node.js compatible with the workspace dependencies, pnpm 10, and a PostgreSQL database.

Clone and install from the repository root:

```bash
git clone https://github.com/FatimaAlsaggaf/TADARUK.git
cd TADARUK
pnpm install
```

The backend requires environment configuration, including:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
PORT=3000
```

These are **placeholders**, not production credentials. Never commit your actual `.env` files or secrets.

Build the backend and start it from the project root:

```bash
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run start
```

In another terminal, run the frontend:

```bash
pnpm --filter @workspace/tadaruk run dev
```

The frontend's default local development port is `5173` unless overridden. A working application also needs its API routing, session/cookie configuration, and database initialized appropriately for the target environment.

### Deployment note

This is a **frontend + backend monorepo**. Building the Vite frontend alone does **not** deploy the Express API or PostgreSQL database. When deploying to a static host such as Vercel, configure a reachable backend and API routes separately.

## Current scope

TADARUK is a **prototype / demonstration project**. Its seeded accounts, example maintenance tickets, and mock AI analysis are intended to communicate the product workflow. Production integrations, security hardening, and end-to-end deployment configuration should be validated before real operational use.

---

<div align="center">

**TADARUK · تدارك**

*From the first report to a confirmed repair.*

</div>
