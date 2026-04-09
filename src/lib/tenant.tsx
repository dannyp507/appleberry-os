import { createContext, useContext } from 'react';
import { Company, Profile } from '../types';

export type TenantState = {
  profile: Profile | null;
  company: Company | null;
  companyId: string | null;
};

export const TenantContext = createContext<TenantState>({
  profile: null,
  company: null,
  companyId: null,
});

export function useTenant() {
  return useContext(TenantContext);
}
