import { IAdminDetails } from './admin-details.interface';

export interface ITenantResponse {
  success: boolean;
  message: string;
  data: {
    id: number;
    name: string;
    database: string;
    dbName: string;
    subdomain: string;
    customDomain?: string | null;
    subdomainUrl: string;
    customDomainUrl?: string | null;
    email?: string | null;
    credentialsEmail?: {
      sent: boolean;
      recipients: string[];
      error: string | null;
    };
    phoneCountryCode?: string | null;
    phoneNumber?: string | null;
    phone?: string | null;
    industry?: string | null;
    description?: string | null;
    countryId?: number | null;
    country?: { id: number; name: string; code: string | null } | null;
    stateId?: number | null;
    state?: { id: number; name: string } | null;
    city?: string | null;
    address?: string | null;
    postalCode?: string | null;
    status?: string | null;
    plan?: string | null;
    planId?: number | null;
    subscriptionStatus?: string | null;
    billingCycle?: string | null;
    trialEndsAt?: Date | null;
    subscription?: unknown;
    stripe?: {
      configured: boolean;
      customerId: string | null;
      subscriptionId: string | null;
    };
    admin: IAdminDetails;
  };
}
