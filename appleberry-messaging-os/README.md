# Appleberry Messaging OS

Production-oriented multi-tenant WhatsApp marketing, chatbot, inbox, and automation SaaS.

## Stack

- Frontend: Next.js, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Zustand, Framer Motion
- Backend: NestJS, TypeScript, REST-first APIs, WebSocket gateway
- Data: PostgreSQL, Prisma
- Jobs: Redis, BullMQ
- Storage: S3-compatible object storage
- Infra: Docker, Docker Compose, Nginx

## Workspace Layout

- `apps/web`: Next.js SaaS dashboard
- `apps/api`: NestJS backend and worker entrypoints
- `packages/config`: shared TypeScript, eslint, and env helpers
- `packages/types`: shared product and API types
- `packages/ui`: shared design system primitives
- `prisma`: schema, migrations, seeds
- `docs`: product architecture and implementation plans
- `docker`: local and VPS deployment assets

## Delivery Phases

1. Architecture, module map, database, API, queue design
2. Backend scaffolding, auth, workspace system, Prisma models, queue foundation
3. WhatsApp accounts, campaigns, contacts, templates
4. Flow builder, autoresponders, fallback engine, developer API center
5. Inbox, analytics, super admin, plan enforcement, billing-ready foundation
6. Testing, deployment hardening, demo seed data, production checklist

## Current Status

This repository includes:

- product and system architecture
- monorepo scaffolding
- backend foundation with auth, tenancy, RBAC, API modules, and queue bootstrap
- frontend dashboard shell
- Prisma schema covering the core SaaS entities
- Docker and environment templates

## Quick Start

```bash
cp .env.example .env
docker compose up -d postgres redis minio
pnpm install
pnpm --filter @appleberry/api prisma:migrate
pnpm --filter @appleberry/api prisma:seed
pnpm dev
```

## Product Position

Appleberry Messaging OS is designed to be the operational layer for:

- WhatsApp campaigns
- chatbot flows and autoresponders
- inbox and team collaboration
- CRM-like contact and segmentation workflows
- provider abstraction across Cloud API and session-based engines
- API-first automation and future white-label SaaS
