export enum BillingCycle {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export enum PlanStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  TRIAL = 'trial',
  PAST_DUE = 'past_due',
  CANCELLED = 'cancelled',
  INCOMPLETE = 'incomplete',
  UNPAID = 'unpaid',
}

export enum InvoiceStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
}

export enum TenantBillingStatus {
  ACTIVE = 'active',
  TRIAL = 'trial',
  SUSPENDED = 'suspended',
}

export enum WebsiteSignupStatus {
  PENDING = 'pending',
  PAID = 'paid',
  PROVISIONED = 'provisioned',
  FAILED = 'failed',
  EXPIRED = 'expired',
}
