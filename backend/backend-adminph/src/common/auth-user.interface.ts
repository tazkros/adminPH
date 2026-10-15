export interface AuthUser {
  id: string;
  organizationId: string | null;
  username: string;
  fullName: string;
  roles: string[];
}
