export interface IAdminDetails {
  email: string;
  password: string;
  role: {
    id: number;
    name: string;
    permissions: { id: number; name: string }[];
  };
}
