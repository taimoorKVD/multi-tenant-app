import { ISeeder } from '../interfaces/seeder.interface';
import { MasterDataSource } from '../datasource';
import { BillingCycle, Plan, PlanStatus } from '../../master/billing/entities';
import { ALL_PLAN_MODULE_KEYS, CORE_PLAN_MODULE_KEYS, PlanModuleKey } from '../../master/billing/plan-modules';

const PLAN_MODULES_WITHOUT_FORM_BUILDER: PlanModuleKey[] = ALL_PLAN_MODULE_KEYS.filter(
  (key) => key !== 'form-builder',
);

function withoutFormBuilder(modules: string[]): PlanModuleKey[] {
  return (modules as PlanModuleKey[]).filter((key) => key !== 'form-builder');
}

export class BillingPlansSeeder implements ISeeder {
  name = 'BillingPlansSeeder';

  async run() {
    const repo = MasterDataSource.getRepository(Plan);

    const plans = [
      {
        name: 'Basic',
        slug: 'basic',
        description: 'For small teams getting started',
        priceCents: 25000,
        usersLimit: 10,
        storageGb: 20,
        supportLevel: 'Email support',
        features: ['10 users', '20 GB storage', 'Email support', 'Core modules'],
        modules: [...CORE_PLAN_MODULE_KEYS, 'items', 'vendors', 'data-collection'] as PlanModuleKey[],
        sortOrder: 1,
      },
      {
        name: 'Standard',
        slug: 'standard',
        description: 'For growing locations',
        priceCents: 50000,
        usersLimit: 25,
        storageGb: 50,
        supportLevel: 'Chat support',
        features: ['25 users', '50 GB storage', 'Chat support', 'Reporting'],
        modules: [
          ...CORE_PLAN_MODULE_KEYS,
          'items',
          'vendors',
          'reporting-groups',
          'reporting-categories',
          'data-collection',
        ] as PlanModuleKey[],
        sortOrder: 2,
      },
      {
        name: 'Professional',
        slug: 'professional',
        description: 'For multi-site operations',
        priceCents: 75000,
        usersLimit: 50,
        storageGb: 100,
        supportLevel: 'Priority support',
        features: ['50 users', '100 GB storage', 'Priority support', 'Advanced reporting'],
        modules: [
          ...CORE_PLAN_MODULE_KEYS,
          'items',
          'vendors',
          'reporting-groups',
          'reporting-categories',
          'mail',
          'data-collection',
        ] as PlanModuleKey[],
        sortOrder: 3,
      },
      {
        name: 'Enterprise',
        slug: 'enterprise',
        description: 'Unlimited scale with dedicated support',
        priceCents: 150000,
        usersLimit: null,
        storageGb: 500,
        supportLevel: 'Dedicated support',
        features: ['Unlimited users', '500 GB storage', 'Dedicated support', 'Custom SLA'],
        modules: [...PLAN_MODULES_WITHOUT_FORM_BUILDER],
        sortOrder: 4,
      },
    ];

    if ((await repo.count()) === 0) {
      await repo.save(
        plans.map((plan) =>
          repo.create({
            ...plan,
            currency: 'USD',
            billingCycle: BillingCycle.MONTHLY,
            trialDays: 14,
            status: PlanStatus.ACTIVE,
          }),
        ),
      );
      console.log(`✅ Seeded ${plans.length} subscription plans (form-builder excluded).`);
      return;
    }

    const existing = await repo.find();
    let updated = 0;
    for (const plan of existing) {
      const nextModules = withoutFormBuilder(plan.modules || []);
      if (nextModules.length !== (plan.modules || []).length) {
        plan.modules = nextModules;
        await repo.save(plan);
        updated += 1;
      }
    }

    if (updated) {
      console.log(`✅ Removed form-builder from ${updated} existing plan(s).`);
    } else {
      console.log('ℹ️  Plans already exist and none included form-builder.');
    }
  }
}
