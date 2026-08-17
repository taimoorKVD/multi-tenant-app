/**
 * Records already-applied schema as executed in TypeORM's migrations table.
 * Use this when tables were created before migrations were tracked
 * (e.g. synchronize / manual SQL), then run `npm run migration:run`.
 */
import 'dotenv/config';
import { MasterDataSource } from '../src/database/datasource';

const CHECKS: Array<{ name: string; timestamp: number; sql: string }> = [
  {
    name: 'CreateRolesTable1701010000000',
    timestamp: 1701010000000,
    sql: `SELECT to_regclass('public.roles') IS NOT NULL AS applied`,
  },
  {
    name: 'CreatePermissionsTable1701010001000',
    timestamp: 1701010001000,
    sql: `SELECT to_regclass('public.permissions') IS NOT NULL AS applied`,
  },
  {
    name: 'CreateUsersTable1701010002000',
    timestamp: 1701010002000,
    sql: `SELECT to_regclass('public.users') IS NOT NULL AS applied`,
  },
  {
    name: 'CreateJobPositionsTable1701010003000',
    timestamp: 1701010003000,
    sql: `SELECT to_regclass('public.job_positions') IS NOT NULL AS applied`,
  },
  {
    name: 'CreateTenantsTable1701010004000',
    timestamp: 1701010004000,
    sql: `SELECT to_regclass('public.tenants') IS NOT NULL AS applied`,
  },
  {
    name: 'CreateCountriesTable1701010005000',
    timestamp: 1701010005000,
    sql: `SELECT to_regclass('public.countries') IS NOT NULL AS applied`,
  },
  {
    name: 'CreateStatesTable1701010006000',
    timestamp: 1701010006000,
    sql: `SELECT to_regclass('public.states') IS NOT NULL AS applied`,
  },
  {
    name: 'CreateCitiesTable1701010006500',
    timestamp: 1701010006500,
    sql: `SELECT to_regclass('public.cities') IS NOT NULL AS applied`,
  },
  {
    name: 'CreateEmailTemplatesTable1701010007000',
    timestamp: 1701010007000,
    sql: `SELECT to_regclass('public.email_templates') IS NOT NULL AS applied`,
  },
  {
    name: 'CreateEmailTemplateRecipientsTable1701010008000',
    timestamp: 1701010008000,
    sql: `SELECT to_regclass('public.email_template_recipients') IS NOT NULL AS applied`,
  },
  {
    name: 'CreateGlobalMailSettingsTable1701010009000',
    timestamp: 1701010009000,
    sql: `SELECT to_regclass('public.global_mail_settings') IS NOT NULL AS applied`,
  },
  {
    name: 'CreateEmailLogsTable1701010010000',
    timestamp: 1701010010000,
    sql: `SELECT to_regclass('public.email_logs') IS NOT NULL AS applied`,
  },
  {
    name: 'CreateActivityLogsTable1701010011000',
    timestamp: 1701010011000,
    sql: `SELECT to_regclass('public.activity_logs') IS NOT NULL AS applied`,
  },
  {
    name: 'CreatePasswordResetTokensTable1701010015000',
    timestamp: 1701010015000,
    sql: `SELECT to_regclass('public.password_reset_tokens') IS NOT NULL AS applied`,
  },
  {
    name: 'CreateEmailVerificationTokensTable1701010016000',
    timestamp: 1701010016000,
    sql: `SELECT to_regclass('public.email_verification_tokens') IS NOT NULL AS applied`,
  },
  {
    name: 'CreateRefreshTokensTable1701010017000',
    timestamp: 1701010017000,
    sql: `SELECT to_regclass('public.refresh_tokens') IS NOT NULL AS applied`,
  },
  {
    name: 'AddCountryIdToCitiesTable1701010018000',
    timestamp: 1701010018000,
    sql: `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'cities' AND column_name = 'country_id'
    ) AS applied`,
  },
  {
    name: 'CreateBillingTables1701010020000',
    timestamp: 1701010020000,
    sql: `SELECT to_regclass('public.plans') IS NOT NULL AS applied`,
  },
  {
    name: 'AddModulesToPlansTable1701010021000',
    timestamp: 1701010021000,
    sql: `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'plans' AND column_name = 'modules'
    ) AS applied`,
  },
  {
    name: 'AddTenantProfileFields1701010022000',
    timestamp: 1701010022000,
    sql: `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'industry'
    ) AS applied`,
  },
];

async function main() {
  const ds = await MasterDataSource.initialize();

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "migrations" (
      "id" SERIAL NOT NULL,
      "timestamp" bigint NOT NULL,
      "name" character varying NOT NULL,
      CONSTRAINT "PK_migrations_id" PRIMARY KEY ("id")
    )
  `);

  let recorded = 0;
  let skipped = 0;
  let pending = 0;

  for (const check of CHECKS) {
    const existing = await ds.query(`SELECT 1 FROM "migrations" WHERE "name" = $1 LIMIT 1`, [
      check.name,
    ]);
    if (existing.length) {
      skipped += 1;
      continue;
    }

    const [{ applied }] = await ds.query(check.sql);
    if (!applied) {
      pending += 1;
      console.log(`⏳ Pending (schema missing): ${check.name}`);
      continue;
    }

    await ds.query(`INSERT INTO "migrations" ("timestamp", "name") VALUES ($1, $2)`, [
      check.timestamp,
      check.name,
    ]);
    recorded += 1;
    console.log(`✅ Recorded already-applied: ${check.name}`);
  }

  await ds.destroy();
  console.log(
    `\nBaseline complete. recorded=${recorded}, alreadyTracked=${skipped}, stillPending=${pending}`,
  );
  console.log('Next: npm run migration:run');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
