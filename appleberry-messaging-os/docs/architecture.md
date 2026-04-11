# Appleberry Messaging OS Architecture

## 1. System Architecture

### Topology

- `apps/web`
  - Next.js application for tenant dashboard, inbox, campaign builder, analytics, and super admin
- `apps/api`
  - NestJS monolith-modular backend exposing REST APIs and WebSocket streams
- `worker runtime`
  - BullMQ processors for campaign sends, retries, imports, exports, analytics rollups, webhook delivery, and provider session monitoring
- `PostgreSQL`
  - primary OLTP store for tenancy, CRM, campaigns, flows, templates, inbox, audit, and billing metadata
- `Redis`
  - queues, cache, websocket fan-out metadata, rate-limit counters, ephemeral send locks
- `S3-compatible storage`
  - media, imports, exports, QR artifacts, logs, and archived campaign payloads
- `provider adapters`
  - Cloud API adapter
  - unofficial session adapter
  - future adapters behind a common contract

### Architectural Style

- modular monolith first for speed and maintainability
- strict bounded modules with shared core abstractions
- provider and job execution behind interfaces so specific subsystems can later split into microservices
- CQRS-lite approach for heavy reporting and inbox read models
- append-only events for message and campaign state changes

### Runtime Boundaries

- HTTP API: CRUD, admin ops, outbound API, webhook intake
- WebSocket gateway: live inbox, campaign counters, account status
- Scheduler: delayed automations, follow-ups, retries, health checks
- Workers: isolated queue consumers with idempotency keys

## 2. Modules and Submodules

### Identity and Access

- auth
- session management
- MFA/OTP ready hooks
- RBAC
- API keys
- device/IP session tracking

### Tenant Core

- organizations
- workspaces
- memberships
- roles and permission grants
- plans and subscriptions
- usage enforcement
- branding and white-label settings

### WhatsApp Accounts

- provider registry
- cloud api adapter
- session engine adapter
- account diagnostics
- webhook status
- session reset and reconnect
- sending policy and warmup rules

### Messaging and Inbox

- inbound event normalization
- outbound send orchestration
- inbox threads
- inbox messages
- agent assignment
- notes and canned replies
- takeover and bot handoff

### Contacts CRM

- contacts
- custom fields
- tags
- static groups
- dynamic segments
- imports and dedupe
- blacklist and suppression

### Campaigns

- campaign authoring
- targeting
- account rotation
- throttling
- scheduling
- send windows
- versioning
- execution and retries
- reporting

### Templates

- plain text templates
- media templates
- interactive button templates
- interactive list templates
- approval and provider compatibility metadata

### Automation

- autoresponder rules
- fallback rules
- advanced automation builder
- sequence scheduler
- webhook triggers
- CRM triggers

### Flow Builder

- flow definitions
- node graph
- edge graph
- run engine
- reusable blocks
- analytics
- import/export

### Analytics

- message KPIs
- campaign KPIs
- inbox KPIs
- provider health
- queue health
- agent metrics
- export service

### Admin and Platform Ops

- super admin dashboard
- tenant control
- provider health
- quota overrides
- abuse and risk review
- system notifications and alerts

## 3. User Roles

- `super_admin`
  - platform owner with global tenant, provider, plan, and audit visibility
- `workspace_owner`
  - full workspace control, members, billing metadata, channel ownership
- `manager`
  - campaigns, flows, templates, contacts, reports, agent oversight
- `agent`
  - inbox, contact updates, notes, assigned automations
- `viewer`
  - read-only dashboards and reports

## 4. Provider Abstraction Design

### Core interfaces

- `ProviderAdapter`
  - `connect()`
  - `disconnect()`
  - `healthCheck()`
  - `sendMessage()`
  - `sendTemplate()`
  - `uploadMedia()`
  - `syncAccount()`
  - `registerWebhook()`
  - `parseInboundEvent()`
- `SessionAdapter` extends provider adapter
  - `generateQr()`
  - `resetSession()`
  - `resumeSession()`

### Internal normalized entities

- normalized account state
- normalized outbound message command
- normalized inbound event envelope
- normalized delivery receipt
- normalized provider capability map

## 5. API Structure

### Public tenant APIs

- `/v1/auth/*`
- `/v1/me/*`
- `/v1/workspaces/*`
- `/v1/whatsapp-accounts/*`
- `/v1/contacts/*`
- `/v1/contact-groups/*`
- `/v1/campaigns/*`
- `/v1/templates/*`
- `/v1/flows/*`
- `/v1/autoresponders/*`
- `/v1/fallback-rules/*`
- `/v1/inbox/*`
- `/v1/analytics/*`
- `/v1/api-keys/*`
- `/v1/automations/*`
- `/v1/link-tools/*`
- `/v1/files/*`

### Developer delivery APIs

- `/v1/send/text`
- `/v1/send/media`
- `/v1/send/template`
- `/v1/flow-runs/trigger`
- `/v1/webhooks/subscriptions`

### Provider webhooks

- `/webhooks/providers/:provider/:accountId`
- `/webhooks/custom/:workspaceId/:subscriptionId`

### Platform admin APIs

- `/admin/tenants/*`
- `/admin/plans/*`
- `/admin/system-health/*`
- `/admin/provider-health/*`
- `/admin/audit/*`

## 6. Queue and Job Design

### Queues

- `campaign-dispatch`
- `message-send`
- `message-retry`
- `provider-sync`
- `provider-session-monitor`
- `webhook-delivery`
- `contact-import`
- `contact-export`
- `analytics-rollup`
- `automation-runner`
- `flow-execution`
- `cleanup`
- `notifications`

### Reliability rules

- idempotency key on every outbound message command
- dead-letter queue per critical pipeline
- exponential backoff with provider-specific retry policies
- jitter for bulk sends
- queue partitioning by workspace and provider where needed

## 7. User Flows

### Connect account

1. owner chooses provider
2. account draft is created
3. credentials or QR bootstrap is initiated
4. provider capability and health are stored
5. webhook validation runs
6. account becomes active and can be assigned defaults

### Launch campaign

1. manager creates campaign draft
2. target segment resolves
3. preflight runs dedupe, opt-out, and limit checks
4. test send optional
5. scheduled job dispatches recipients into send queue
6. deliveries and failures stream into campaign events
7. analytics aggregates update dashboard

### Inbound automation

1. provider webhook arrives
2. message normalizer persists raw and canonical payload
3. inbox thread updates
4. autoresponder and flow entry conditions evaluate
5. fallback engine catches unsupported states
6. agent handoff or AI reply follows rule policy

## 8. MVP vs Pro

### MVP

- multi-tenant auth and RBAC
- cloud api provider
- session provider scaffold
- contacts and groups
- campaigns with scheduling, throttling, retries
- templates
- keyword autoresponders
- inbox basics
- flow builder schema and execution engine
- API keys and send APIs
- analytics essentials
- super admin basics

### Pro

- AI campaign assistant
- AI inbox reply copilot
- A/B testing
- advanced automations
- warmup engine
- white-label branding
- CRM integrations
- advanced billing and metering
- richer team SLAs and inbox QA
- multilingual UI and custom domains
