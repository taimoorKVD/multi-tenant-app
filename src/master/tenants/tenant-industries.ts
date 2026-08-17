export const TENANT_INDUSTRIES = [
  'Restaurant',
  'Hotel',
  'Cafe',
  'Catering',
  'Cloud Kitchen',
  'QSR',
  'Food Truck',
  'Bakery',
  'Bar',
  'Other',
] as const;

export type TenantIndustry = (typeof TENANT_INDUSTRIES)[number];
