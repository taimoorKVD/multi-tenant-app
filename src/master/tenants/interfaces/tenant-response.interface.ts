import { IAdminDetails } from './admin-details.interface';

export interface ITenantResponse {
  success: boolean;
  message: string;
  data: {
    id: number;
    name: string;
    database: string;
    subdomain: string;
    customDomain?: string | null;
    subdomainUrl: string;
    customDomainUrl?: string | null;
    admin: IAdminDetails;
  };
}
