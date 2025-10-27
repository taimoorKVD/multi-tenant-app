# 🏗️ NestJS Multi-Tenancy Application (PostgreSQL – Database per Tenant)

A scalable multi-tenant architecture built with NestJS and TypeORM, supporting one PostgreSQL database per tenant, alongside a central master database managing tenants, subscriptions, and authentication.

---

## 🚀 Features

- **Multi-Tenancy (Database-per-Tenant)**  
  Each tenant has a fully isolated PostgreSQL database for data security and scalability.

- **Master Database Control**  
  Stores tenant metadata (name, domain, DB credentials), subscription packages, user accounts, and roles.

- **Dynamic Database Connections**  
  Runtime creation and caching of TypeORM connections per tenant domain/ID.

- **JWT-based Authentication**  
  Secure user authentication via HTTP-only cookies, validated against the master database.

- **RESTful API Architecture**  
  Modular and scalable, following NestJS best practices.

---

## 🧩 Tech Stack

| Layer           | Technology                           |
| --------------- | ---------------------------------- |
| Backend Framework | NestJS                             |
| ORM              | TypeORM                            |
| Database         | PostgreSQL (Master + Tenant DBs)  |
| Authentication  | JWT (HTTP-only cookies)            |
| API Docs         | Swagger (@nestjs/swagger)           |

---

## 🗂️ Folder Structure

src/
├── master/
│ ├── entities/
│ ├── modules/
│ └── services/
├── tenants/
│ ├── entities/
│ ├── modules/
│ └── services/
├── common/
│ ├── decorators/
│ ├── interceptors/
│ ├── middleware/
│ └── utils/
├── database/
│ ├── tenant-connection.provider.ts
│ ├── tenant.middleware.ts
│ └── tenant.decorator.ts
├── auth/
│ ├── auth.module.ts
│ ├── jwt.strategy.ts
│ └── guards/
└── seed.ts


---

## ⚙️ Environment Variables

Create a `.env` file in the root:

MASTER_DB_HOST=localhost
MASTER_DB_PORT=5432
MASTER_DB_USER=postgres
MASTER_DB_PASS=yourpassword
MASTER_DB_NAME=masterdb

TENANT_DB_HOST=localhost
TENANT_DB_PORT=5432
TENANT_DB_USER=postgres
TENANT_DB_PASS=yourpassword

JWT_SECRET=your_jwt_secret
JWT_EXPIRY=1d

PORT=3333
NODE_ENV=development

---

## 🏗️ Master Database Schema

| Table          | Description                              |
| -------------- | ------------------------------------   |
| tenants        | Tenant metadata (name, domain, DB info)|
| users          | Global users and roles                  |

Example record in `tenants`:

| id | name     | domain           | db_name    | db_user | db_pass  | db_host   | created_at  |
|----|----------|------------------|------------|---------|----------|-----------|-------------|
| 1  | Tenant A | tenantA.app.com  | tenant_a_db| tenant_a| secret123| localhost | 2025-10-21  |

---

## 🔌 How Multi-Tenancy Works

1. **Request Identification:** Tenant identified by domain, subdomain, or `x-tenant-id` header.

2. **Connection Resolution:** Tenant info fetched from master DB. New TypeORM connection created if not cached.

3. **Scoped Queries:** ORM queries run on the tenant database connection.

4. **Isolation:** Each tenant has a separate DB/schema preventing cross-tenant data leakage.

---

## 🧠 Example API Endpoints

### Auth Routes
| Method | Endpoint       | Description                |
|--------|----------------|----------------------------|
| POST   | `/auth/register` | Register new user          |
| POST   | `/auth/login`    | Authenticate and set JWT cookie |
| GET    | `/auth/profile`  | Get current user profile   |

### Master Routes
| Method | Endpoint          | Description               |
|--------|-------------------|---------------------------|
| POST   | `/tenants/create` | Create new tenant and DB  |
| GET    | `/tenants`        | List all tenants          |
| GET    | `/tenants/:id`    | Fetch tenant details      |

### Tenant Routes
| Method | Endpoint         | Description               |
|--------|------------------|---------------------------|
| GET    | `/dashboard`     | Tenant dashboard data     |
| GET    | `/users`         | Tenant users list         |
| POST   | `/users`         | Add user to tenant DB     |

---

## 🧪 Running the Application

npm install
npm run typeorm migration:run
npm run start:dev


- Access API: `http://localhost:4000`
- Swagger Docs: `http://localhost:4000/api`

---

## 🧱 Roadmap (Planned Features)

| Feature                | Description                                |
|------------------------|--------------------------------------------|
| Tenant Setup Wizard     | Automated DB provisioning for new tenants |
| Tenant Schema Sync      | Auto-migrate models to tenant DBs          |
| Subscription Module    | Billing & renewal management per tenant    |
| Custom Domains          | Dynamic tenant subdomains and SSL           |

---

## 🧰 Scripts

| Command             | Description               |
|---------------------|---------------------------|
| `npm run start:dev`   | Run server in dev mode     |
| `npm run start:prod`  | Run compiled app          |
| `npm run build`       | Compile TypeScript        |
| `npm run test`        | Run tests                 |
| `npm run lint`        | Lint codebase             |

---

## 🛡️ Security

- HTTP-only JWT cookies for authentication
- CSRF-safe API design
- Encrypted tenant credentials in master DB
- Rate limiting and tenant-scoped access control

---

## 📖 License

MIT © 2025 — Maintained by Kingdom Vision
