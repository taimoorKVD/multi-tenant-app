# EuSocial Backend

**EuSocial** is a multi-tenant operations platform for organizations that need isolated workspaces, structured data collection, and coordinated team workflows — all from a single API.

This repository is the NestJS backend that powers the EuSocial Master Admin and Tenant applications. It is developed and maintained by **Kingdom Vision**.

---

## Overview

EuSocial follows a **database-per-tenant** architecture:

| Layer | Responsibility |
| ----- | -------------- |
| **Master App** | Platform administration — tenants, global users, roles, permissions, geography, mail settings, and activity logs |
| **Tenant App** | Organization workspace — users, locations, vendors, items, form builder, data collection, reporting, and dashboards |

Each tenant runs on its own PostgreSQL database. Tenant requests are resolved at runtime (domain, subdomain, or headers such as `X-Tenant` / `X-Tenant-Slug`), then routed through a cached TypeORM connection so data never crosses tenant boundaries.

---

## Product Capabilities

### Platform (Master)

- Tenant provisioning and lifecycle management
- Central authentication, roles, and permissions
- Job positions and geographic reference data (countries, states, cities)
- Global email templates and SMTP configuration
- Activity logging across administrative actions

### Tenant Workspace

- Authentication with access and refresh tokens, email verification, and password reset
- Role-based access control scoped to the tenant
- Locations, vendors, items, and job positions
- **Form Builder** — configurable entity forms (users, items, vendors, and related modules)
- **Data Collection Engine** — operational checklists, inspections, inventory counts, and recurring assignments
- Reporting groups and categories
- Tenant-level mail settings and branded email delivery
- Operational dashboards

> Detailed Data Collection contracts and wizard mapping live in [`docs/data-collection-engine.md`](docs/data-collection-engine.md).

---

## Tech Stack

| Layer | Technology |
| ----- | ---------- |
| Runtime | Node.js 22 |
| Framework | NestJS 11 |
| ORM | TypeORM |
| Database | PostgreSQL (master + one DB per tenant) |
| Auth | JWT (Bearer), refresh tokens |
| Queues | BullMQ + Redis |
| Mail | Nodemailer (SMTP / SendGrid / Mailtrap) |
| Templates | EJS |
| API Docs | Swagger (`@nestjs/swagger`) |

---

## Architecture

```
                    ┌─────────────────────────┐
                    │   EuSocial Frontend(s)  │
                    │  Master  ·  Tenant App  │
                    └───────────┬─────────────┘
                                │  HTTPS / JWT
                    ┌───────────▼─────────────┐
                    │   EuSocial Backend API  │
                    │   NestJS  ·  /api/*     │
                    └─────┬─────────────┬─────┘
                          │             │
              ┌───────────▼───┐   ┌─────▼──────────┐
              │  Master DB    │   │  Tenant DBs    │
              │  (platform)   │   │  (isolated)    │
              └───────────────┘   └────────────────┘
                          │
                    ┌─────▼─────┐
                    │   Redis   │
                    │  (queues) │
                    └───────────┘
```

**Request flow**

1. Identify the tenant from host, subdomain, or tenant headers.
2. Load tenant metadata from the master database.
3. Resolve or create a cached TypeORM connection to that tenant’s database.
4. Enforce authentication and permission checks within the tenant (or master) context.
5. Execute queries only against the resolved database.

---

## Project Structure

```
src/
├── master/           # Platform admin APIs and entities
├── tenants/          # Tenant workspace APIs and entities
├── common/           # Shared guards, decorators, middleware, DTOs
├── config/           # Database and Swagger configuration
├── database/         # Master datasource, migrations, seeders
├── mail/             # Mail delivery, template resolvers, queue jobs
├── queue/            # Redis / BullMQ integration
├── views/            # Landing page and EJS views
└── main.ts           # Application bootstrap
```

---

## Getting Started

### Prerequisites

- Node.js **22+**
- PostgreSQL **14+**
- Redis (required for background mail / job queues)
- npm

### Installation

```bash
npm install
```

### Environment

Create a `.env` file in the project root. At minimum:

```env
NODE_ENV=development
PORT=3000

# Master database (required in production)
DATABASE_URL=postgresql://user:password@localhost:5432/eusocial_master

# Tenant database host credentials (used when provisioning / connecting tenants)
TENANT_DB_HOST=localhost
TENANT_DB_PORT=5432
TENANT_DB_USER=postgres
TENANT_DB_PASS=yourpassword

# Auth
JWT_SECRET=change-me
MASTER_JWT_SECRET=change-me-master
TENANT_JWT_SECRET=change-me-tenant
JWT_REFRESH_SECRET=change-me-refresh
MASTER_REFRESH_JWT_SECRET=change-me-master-refresh

# Frontend / CORS
FRONTEND_URL=http://localhost:4200
BASE_DOMAIN=localhost
CORS_ORIGINS=http://localhost:4200

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
# REDIS_URL=redis://localhost:6379
# REDIS_PASSWORD=

# Mail (branded as EuSocial)
MAIL_FROM_EMAIL=no-reply@eusocial.com
MAIL_FROM_NAME=EuSocial
MAIL_REPLY_TO=support@eusocial.com
MAIL_HOST=sandbox.smtp.mailtrap.io
MAIL_PORT=2525
MAIL_USER=
MAIL_PASS=
MAIL_SECURE=false

# Optional
DB_LOGGING=false
```

### Database setup

```bash
# Run master migrations
npm run migration:run

# Seed master reference data (roles, permissions, templates, etc.)
npm run seed:master
```

### Run

```bash
# Development (watch mode)
npm run start:dev

# Production build
npm run build
npm run start:prod
```

- API base: `http://localhost:3000/api`
- Health check: `http://localhost:3000/health`
- Landing: `http://localhost:3000/`

---

## API Documentation

Swagger collections are generated at runtime:

| Audience | URL |
| -------- | --- |
| Master Admin | `/api/collection/master` |
| Tenant Workspace | `/api/collection/tenant` |

Authenticate in Swagger with a Bearer JWT (`access-token`).

---

## Scripts

| Command | Description |
| ------- | ----------- |
| `npm run start:dev` | Start API in watch mode |
| `npm run start:prod` | Run compiled production build |
| `npm run build` | Compile TypeScript |
| `npm run test` | Run unit tests |
| `npm run lint` | Lint and autofix |
| `npm run migration:run` | Apply master migrations |
| `npm run migration:revert` | Revert the last master migration |
| `npm run seed:master` | Seed master database |
| `npm run seed:reset` | Reset and re-seed master database |

---

## Security Model

- Separate JWT secrets for master and tenant contexts
- Permission guards on master and tenant routes
- Tenant middleware isolates connections per request
- Encrypted / controlled handling of mail credentials
- CORS restricted to known EuSocial frontends and configured origins
- Rate limiting available via shared guards

---

## Environments

| Environment | Notes |
| ----------- | ----- |
| Local | `npm run start:dev` against local PostgreSQL and Redis |
| Staging / Beta | Hosted under `*.eusocial.thebetawebsite.com` |
| Production | Deployed via GitHub Actions to Plesk on merge to `production` |

---

## Related Documentation

- [Data Collection Engine](docs/data-collection-engine.md) — template schema, publish flow, assignments, and reminders

---

## License

Proprietary — © 2026 **EuSocial**. All rights reserved.

Developed and maintained by **Kingdom Vision**.
