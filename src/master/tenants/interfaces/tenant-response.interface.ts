import { IAdminDetails } from './admin-details.interface';

export interface ITenantResponse {
  success: boolean;
  message: string;
  data: {
    name: string;
    database: string;
    subdomain: string;
    customDomain?: string | null;
    subdomainUrl: string;
    customDomainUrl?: string | null;
    admin: IAdminDetails;
  };
}
