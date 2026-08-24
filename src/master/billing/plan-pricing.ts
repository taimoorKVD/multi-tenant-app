import { BillingCycle, Plan } from './entities';

export function resolveYearlyPriceCents(
  monthlyCents: number,
  yearlyCents?: number | null,
): number {
  if (yearlyCents != null && yearlyCents > 0) return yearlyCents;
  return Number(monthlyCents || 0) * 12;
}

export function amountCentsForBillingCycle(
  plan: Pick<Plan, 'priceCents' | 'yearlyPriceCents'>,
  cycle: BillingCycle,
): number {
  if (cycle === BillingCycle.YEARLY) {
    return resolveYearlyPriceCents(plan.priceCents, plan.yearlyPriceCents);
  }
  return Number(plan.priceCents || 0);
}

export function stripePriceIdForBillingCycle(
  plan: Pick<Plan, 'stripePriceId' | 'stripeYearlyPriceId'>,
  cycle: BillingCycle,
): string | null {
  if (cycle === BillingCycle.YEARLY) {
    return plan.stripeYearlyPriceId || null;
  }
  return plan.stripePriceId || null;
}
