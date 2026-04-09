import { collection, doc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { Company } from '../types';
import { ALL_PERMISSIONS } from './permissions';

export function createCompanySlug(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function getCompanySettingsDocId(kind: 'shop' | 'communication', companyId: string) {
  return `${kind}_${companyId}`;
}

export async function seedCompanyWorkspace(input: {
  companyId: string;
  companyName: string;
  ownerUserId: string;
  ownerEmail: string;
  ownerName: string;
}) {
  const now = new Date().toISOString();

  const companyRef = doc(db, 'companies', input.companyId);
  const profileRef = doc(db, 'profiles', input.ownerUserId);
  const shopSettingsRef = doc(db, 'settings', getCompanySettingsDocId('shop', input.companyId));
  const communicationSettingsRef = doc(db, 'settings', getCompanySettingsDocId('communication', input.companyId));

  const statuses = [
    { name: 'Booked In', color: '#214e5f', order_index: 1 },
    { name: 'Awaiting Quote Approval', color: '#d98a3a', order_index: 2 },
    { name: 'In Progress', color: '#4d7787', order_index: 3 },
    { name: 'Ready for Collection', color: '#2b8a57', order_index: 4 },
    { name: 'Collected', color: '#6d6862', order_index: 5 },
  ];

  const company: Omit<Company, 'id'> = {
    name: input.companyName,
    slug: createCompanySlug(input.companyName),
    owner_user_id: input.ownerUserId,
    owner_email: input.ownerEmail,
    plan: 'starter',
    status: 'trial',
    onboarding_status: 'pending',
    trial_ends_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
    business_type: 'repair_shop',
    created_at: now,
    updated_at: now,
  };

  const bootstrapBatch = writeBatch(db);
  bootstrapBatch.set(companyRef, company);
  bootstrapBatch.set(profileRef, {
    full_name: input.ownerName,
    role: 'owner',
    company_id: input.companyId,
    permissions: ALL_PERMISSIONS,
    email: input.ownerEmail,
    status: 'active',
    auth_uid: input.ownerUserId,
    created_at: now,
    updated_at: now,
  });
  await bootstrapBatch.commit();

  const workspaceBatch = writeBatch(db);
  workspaceBatch.set(shopSettingsRef, {
    company_id: input.companyId,
    name: input.companyName,
    address: '',
    phone: '',
    email: input.ownerEmail,
    website: '',
    vatNumber: '',
    regNumber: '',
    logoUrl: '',
    created_at: now,
    updated_at: now,
  });

  workspaceBatch.set(communicationSettingsRef, {
    company_id: input.companyId,
    mode: 'test',
    email: {
      host: '',
      port: '',
      secure: false,
      user: '',
      pass: '',
      fromName: input.companyName,
      fromEmail: input.ownerEmail,
    },
    whatsapp: {
      provider: 'official',
      accessToken: '',
      phoneId: '',
      templateName: '',
      instanceId: '',
      apiUrl: '',
    },
    created_at: now,
    updated_at: now,
  });

  statuses.forEach((status) => {
    const statusRef = doc(collection(db, 'repair_status_options'));
    workspaceBatch.set(statusRef, {
      ...status,
      company_id: input.companyId,
      created_at: now,
    });
  });

  await workspaceBatch.commit();
}
