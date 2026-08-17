import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBillingTables1701010020000 implements MigrationInterface {
  name = 'CreateBillingTables1701010020000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "stripe_customer_id" VARCHAR(255)
    `);
    await queryRunner.query(`
      ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "status" VARCHAR(30) NOT NULL DEFAULT 'active'
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "plans_billing_cycle_enum" AS ENUM ('monthly', 'yearly');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "plans_status_enum" AS ENUM ('active', 'inactive');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "subscriptions_status_enum" AS ENUM (
          'active', 'trial', 'past_due', 'cancelled', 'incomplete', 'unpaid'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "subscriptions_billing_cycle_enum" AS ENUM ('monthly', 'yearly');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "invoices_status_enum" AS ENUM (
          'draft', 'pending', 'paid', 'overdue', 'cancelled', 'failed'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "plans"
      (
        "id"                SERIAL          NOT NULL,
        "name"              VARCHAR(100)    NOT NULL UNIQUE,
        "slug"              VARCHAR(120)    NOT NULL UNIQUE,
        "description"       TEXT,
        "price_cents"       INTEGER         NOT NULL,
        "currency"          VARCHAR(3)      NOT NULL DEFAULT 'EUR',
        "billing_cycle"     "plans_billing_cycle_enum" NOT NULL DEFAULT 'monthly',
        "users_limit"       INTEGER,
        "storage_gb"        INTEGER,
        "support_level"     VARCHAR(80),
        "features"          JSONB           NOT NULL DEFAULT '[]'::jsonb,
        "trial_days"        INTEGER         NOT NULL DEFAULT 0,
        "sort_order"        INTEGER         NOT NULL DEFAULT 0,
        "status"            "plans_status_enum" NOT NULL DEFAULT 'active',
        "stripe_product_id" VARCHAR(255),
        "stripe_price_id"   VARCHAR(255),
        "created_at"        TIMESTAMPTZ     DEFAULT now(),
        "updated_at"        TIMESTAMPTZ     DEFAULT now(),
        CONSTRAINT "PK_plans_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "subscriptions"
      (
        "id"                      SERIAL       NOT NULL,
        "tenant_id"               INTEGER      NOT NULL,
        "plan_id"                 INTEGER      NOT NULL,
        "status"                  "subscriptions_status_enum" NOT NULL DEFAULT 'incomplete',
        "billing_cycle"           "subscriptions_billing_cycle_enum" NOT NULL DEFAULT 'monthly',
        "amount_cents"            INTEGER      NOT NULL,
        "currency"                VARCHAR(3)   NOT NULL DEFAULT 'EUR',
        "trial_ends_at"           TIMESTAMPTZ,
        "current_period_start"    TIMESTAMPTZ,
        "current_period_end"      TIMESTAMPTZ,
        "cancel_at"               TIMESTAMPTZ,
        "cancelled_at"            TIMESTAMPTZ,
        "cancel_at_period_end"    BOOLEAN      NOT NULL DEFAULT false,
        "stripe_customer_id"      VARCHAR(255),
        "stripe_subscription_id"  VARCHAR(255),
        "created_at"              TIMESTAMPTZ  DEFAULT now(),
        "updated_at"              TIMESTAMPTZ  DEFAULT now(),
        CONSTRAINT "PK_subscriptions_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_subscriptions_tenant_id" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_subscriptions_plan_id" FOREIGN KEY ("plan_id")
          REFERENCES "plans" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_subscriptions_tenant_id" ON "subscriptions" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_subscriptions_status" ON "subscriptions" ("status")`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_subscriptions_stripe_subscription_id"
      ON "subscriptions" ("stripe_subscription_id")
      WHERE "stripe_subscription_id" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "invoices"
      (
        "id"                        SERIAL       NOT NULL,
        "invoice_number"            VARCHAR(40)  NOT NULL UNIQUE,
        "tenant_id"                 INTEGER      NOT NULL,
        "subscription_id"           INTEGER,
        "amount_cents"              INTEGER      NOT NULL,
        "currency"                  VARCHAR(3)   NOT NULL DEFAULT 'EUR',
        "status"                    "invoices_status_enum" NOT NULL DEFAULT 'pending',
        "invoice_date"              DATE         NOT NULL,
        "due_date"                  DATE,
        "paid_at"                   TIMESTAMPTZ,
        "hosted_invoice_url"        VARCHAR(500),
        "invoice_pdf_url"           VARCHAR(500),
        "stripe_invoice_id"         VARCHAR(255),
        "stripe_payment_intent_id"  VARCHAR(255),
        "created_at"                TIMESTAMPTZ  DEFAULT now(),
        "updated_at"                TIMESTAMPTZ  DEFAULT now(),
        CONSTRAINT "PK_invoices_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_invoices_tenant_id" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_invoices_subscription_id" FOREIGN KEY ("subscription_id")
          REFERENCES "subscriptions" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_invoices_tenant_id" ON "invoices" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_invoices_status" ON "invoices" ("status")`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_invoices_stripe_invoice_id"
      ON "invoices" ("stripe_invoice_id")
      WHERE "stripe_invoice_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "invoices"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "subscriptions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "plans"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "invoices_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "subscriptions_billing_cycle_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "subscriptions_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "plans_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "plans_billing_cycle_enum"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "status"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "stripe_customer_id"`);
  }
}
