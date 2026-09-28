/**
 * Set Asia/Karachi on brian tenant and verify frequency wall-clock materialization.
 * Usage: npx ts-node -r tsconfig-paths/register scripts/test-brian-timezone-frequency.ts
 */
import 'dotenv/config';
import { MasterDataSource } from '../src/database/datasource';
import { FrequencyService } from '../src/tenants/data-collection/services/frequency.service';

async function main() {
  await MasterDataSource.initialize();

  await MasterDataSource.query(`
    ALTER TABLE tenants ADD COLUMN IF NOT EXISTS timezone VARCHAR(64)
  `);

  const before = await MasterDataSource.query(
    `SELECT id, name, "dbName", subdomain, timezone
     FROM tenants
     WHERE "dbName" = $1 OR subdomain ILIKE $2 OR name ILIKE $2
     LIMIT 5`,
    ['tenant_brian', '%brian%'],
  );
  console.log('BEFORE:', JSON.stringify(before, null, 2));

  if (!before.length) {
    throw new Error('No brian tenant found (dbName/subdomain/name).');
  }

  const updated = await MasterDataSource.query(
    `UPDATE tenants
     SET timezone = 'Asia/Karachi'
     WHERE "dbName" = $1 OR subdomain ILIKE $2 OR name ILIKE $2
     RETURNING id, name, "dbName", subdomain, timezone`,
    ['tenant_brian', '%brian%'],
  );
  console.log('UPDATED:', JSON.stringify(updated, null, 2));

  const tz = String(updated[0]?.timezone || 'Asia/Karachi');
  const freq = new FrequencyService();
  console.log('Resolved TZ:', freq.getFrequencyTimeZone(tz));

  const cases: Array<{ label: string; f: Record<string, unknown>; expectIso: string[] }> = [
    {
      label: 'atOnce 14:56',
      f: { type: 'atOnce', date: '2026-09-28', time: '14:56' },
      expectIso: ['2026-09-28T09:56:00.000Z'],
    },
    {
      label: 'daily 14:56',
      f: {
        type: 'recurring',
        startDate: '2026-09-28',
        endDate: '2026-09-28',
        recurring: { every: 1, interval: 'day', times: ['14:56'] },
      },
      expectIso: ['2026-09-28T09:56:00.000Z'],
    },
    {
      label: 'weekly Mon 14:56',
      f: {
        type: 'recurring',
        startDate: '2026-09-28',
        endDate: '2026-09-28',
        recurring: {
          every: 1,
          interval: 'week',
          daysOfWeek: ['monday'],
          times: ['14:56'],
        },
      },
      expectIso: ['2026-09-28T09:56:00.000Z'],
    },
    {
      label: 'monthly day 28 14:56',
      f: {
        type: 'recurring',
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        recurring: {
          every: 1,
          interval: 'month',
          monthMode: 'dayOfMonth',
          dayOfMonth: 28,
          times: ['14:56'],
        },
      },
      expectIso: ['2026-09-28T09:56:00.000Z'],
    },
    {
      label: 'yearly Sep 28 14:56',
      f: {
        type: 'recurring',
        startDate: '2026-09-28',
        endDate: '2026-09-28',
        recurring: {
          every: 1,
          interval: 'year',
          yearMonth: 'september',
          yearDay: 28,
          times: ['14:56'],
        },
      },
      expectIso: ['2026-09-28T09:56:00.000Z'],
    },
    {
      label: 'multi times 09:00+17:30',
      f: {
        type: 'recurring',
        startDate: '2026-09-28',
        endDate: '2026-09-28',
        recurring: { every: 1, interval: 'day', times: ['09:00', '17:30'] },
      },
      expectIso: ['2026-09-28T04:00:00.000Z', '2026-09-28T12:30:00.000Z'],
    },
  ];

  let failed = 0;
  for (const c of cases) {
    const dates = freq.expandOccurrences(c.f as any, undefined, tz);
    const iso = dates.map((d) => d.toISOString());
    const fields = dates.map((d) => freq.buildDueTimeFields(d, tz));
    const ok = JSON.stringify(iso) === JSON.stringify(c.expectIso);
    console.log(`\n${ok ? 'PASS' : 'FAIL'} ${c.label}`);
    console.log('  dueAt UTC:', iso.join(', '));
    console.log('  dueTime local:', fields.map((f) => `${f.dueTime} (${f.dueTimeAmPm})`).join(', '));
    if (!ok) {
      console.log('  expected:', c.expectIso.join(', '));
      failed++;
    }
  }

  const utcOnce = freq.expandOccurrences(
    { type: 'atOnce', date: '2026-09-28', time: '14:56' } as any,
    undefined,
    null,
  );
  console.log(
    `\nUTC default (no tenant tz) => ${utcOnce[0]?.toISOString()} (expect 2026-09-28T14:56:00.000Z)`,
  );

  await MasterDataSource.destroy();
  if (failed) {
    console.error(`\n${failed} case(s) failed`);
    process.exit(1);
  }
  console.log('\nAll brian Asia/Karachi frequency cases passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
