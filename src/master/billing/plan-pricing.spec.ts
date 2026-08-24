import { BillingCycle } from './entities';
import {
  amountCentsForBillingCycle,
  resolveYearlyPriceCents,
  stripePriceIdForBillingCycle,
} from './plan-pricing';

describe('plan-pricing', () => {
  it('defaults yearly price to 12x monthly when yearly is missing', () => {
    expect(resolveYearlyPriceCents(25000)).toBe(300000);
    expect(resolveYearlyPriceCents(25000, 0)).toBe(300000);
    expect(resolveYearlyPriceCents(25000, 240000)).toBe(240000);
  });

  it('returns the selected cycle amount', () => {
    const plan = { priceCents: 25000, yearlyPriceCents: 300000 };
    expect(amountCentsForBillingCycle(plan, BillingCycle.MONTHLY)).toBe(25000);
    expect(amountCentsForBillingCycle(plan, BillingCycle.YEARLY)).toBe(300000);
  });

  it('picks the Stripe price id for the selected cycle', () => {
    const plan = { stripePriceId: 'price_month', stripeYearlyPriceId: 'price_year' };
    expect(stripePriceIdForBillingCycle(plan, BillingCycle.MONTHLY)).toBe('price_month');
    expect(stripePriceIdForBillingCycle(plan, BillingCycle.YEARLY)).toBe('price_year');
  });
});
