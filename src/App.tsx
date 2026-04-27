/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, limit, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { ALL_PERMISSIONS } from './lib/permissions';
import { Toaster } from 'sonner';
import { Menu } from 'lucide-react';
import { Company, Profile } from './types';
import { hasPermission } from './lib/permissions';
import { TenantContext } from './lib/tenant';

// Pages
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const MarketingHub = lazy(() => import('./pages/MarketingHub'));
const MarketingLanding = lazy(() => import('./pages/MarketingLanding'));
const WhatsAppStudio = lazy(() => import('./pages/WhatsAppStudio'));
const POS = lazy(() => import('./pages/POS'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Repairs = lazy(() => import('./pages/Repairs'));
const RepairDetail = lazy(() => import('./pages/RepairDetail'));
const NewRepair = lazy(() => import('./pages/NewRepair'));
const Customers = lazy(() => import('./pages/Customers'));
const IMEISearch = lazy(() => import('./pages/IMEISearch'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Appointments = lazy(() => import('./pages/Appointments'));
const ManageData = lazy(() => import('./pages/ManageData'));
const InvoiceView = lazy(() => import('./pages/InvoiceView'));
const Invoices = lazy(() => import('./pages/Invoices'));
const SalesReports = lazy(() => import('./pages/SalesReports'));
const InventoryReports = lazy(() => import('./pages/InventoryReports'));
const ActivityLog = lazy(() => import('./pages/ActivityLog'));
const StaffManagement = lazy(() => import('./pages/StaffManagement'));
const PlaceholderPage = lazy(() => import('./pages/PlaceholderPage'));
const ActivateAccount = lazy(() => import('./pages/ActivateAccount'));
const GettingStarted = lazy(() => import('./pages/GettingStarted'));
const Orders = lazy(() => import('./pages/Orders'));
const InventoryTransfer = lazy(() => import('./pages/InventoryTransfer'));
const Website = lazy(() => import('./pages/Website'));
const Setup = lazy(() => import('./pages/Setup'));
const Integrations = lazy(() => import('./pages/Integrations'));
const DevicesInventory = lazy(() => import('./pages/DevicesInventory'));

// Components
import Sidebar from './components/Sidebar';
import GlobalSearch from './components/GlobalSearch';

function RouteLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
    </div>
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function scoreProfileCandidate(profile: Profile, user: User) {
  let score = 0;

  if (profile.id === user.uid) score += 100;
  if ((profile as any).auth_uid === user.uid) score += 40;
  if (profile.email && user.email && profile.email.toLowerCase() === user.email.toLowerCase()) score += 20;
  if (profile.company_id) score += 30;
  if (profile.role === 'owner') score += 25;
  if (profile.role === 'admin') score += 15;

  return score;
}

async function resolveCompanyForUser(user: User, profile: Profile | null): Promise<Company | null> {
  const directCompanyId = profile?.company_id || null;
  if (directCompanyId) {
    const directCompanySnap = await getDoc(doc(db, 'companies', directCompanyId));
    if (directCompanySnap.exists()) {
      return { id: directCompanySnap.id, ...directCompanySnap.data() } as Company;
    }
  }

  const companyLookups = await Promise.all([
    getDocs(query(collection(db, 'companies'), where('owner_user_id', '==', user.uid), limit(1))),
    ...(user.email ? [getDocs(query(collection(db, 'companies'), where('owner_email', '==', user.email), limit(1)))] : []),
  ]);

  for (const snapshot of companyLookups) {
    if (!snapshot.empty) {
      const matchedCompany = snapshot.docs[0];
      return { id: matchedCompany.id, ...matchedCompany.data() } as Company;
    }
  }

  return null;
}

/**
 * If the authenticated user is the company owner but their profile has a degraded role
 * (e.g. 'staff'), promote it to 'owner' and persist the fix to Firestore so it is
 * permanent across sessions.
 */
async function healOwnerProfile(user: User, profile: Profile, company: Company): Promise<Profile> {
  const isOwner =
    company.owner_user_id === user.uid ||
    (user.email && company.owner_email && company.owner_email.toLowerCase() === user.email.toLowerCase());

  if (!isOwner || profile.role === 'owner') return profile;

  const healed: Profile = {
    ...profile,
    role: 'owner',
    permissions: ALL_PERMISSIONS,
    company_id: company.id,
    auth_uid: user.uid,
  };

  try {
    await updateDoc(doc(db, 'profiles', profile.id), {
      role: 'owner',
      permissions: ALL_PERMISSIONS,
      company_id: company.id,
      auth_uid: user.uid,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // If the profile doc doesn't exist at the expected path, create it
    try {
      await setDoc(doc(db, 'profiles', user.uid), {
        ...healed,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } catch {
      // Carry on with in-memory healed profile even if write fails
    }
  }

  return healed;
}

async function resolveProfileAndCompany(user: User): Promise<{ profile: Profile | null; company: Company | null }> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const profileSnap = await getDoc(doc(db, 'profiles', user.uid));
    if (profileSnap.exists()) {
      const nextProfile = { id: profileSnap.id, ...profileSnap.data() } as Profile;
      const nextCompany = await resolveCompanyForUser(user, nextProfile);

      const finalProfile = nextCompany
        ? await healOwnerProfile(user, nextProfile.company_id ? nextProfile : { ...nextProfile, company_id: nextCompany.id }, nextCompany)
        : nextProfile;

      return { profile: finalProfile, company: nextCompany };
    }

    const fallbackQueries = [
      getDocs(query(collection(db, 'profiles'), where('auth_uid', '==', user.uid))),
      ...(user.email ? [getDocs(query(collection(db, 'profiles'), where('email', '==', user.email)))] : []),
    ];

    const candidates = new Map<string, Profile>();

    for (const lookup of fallbackQueries) {
      const snapshot = await lookup;
      for (const matchedDoc of snapshot.docs) {
        candidates.set(matchedDoc.id, { id: matchedDoc.id, ...matchedDoc.data() } as Profile);
      }
    }

    if (candidates.size > 0) {
      const matchedProfile = [...candidates.values()].sort((a, b) => scoreProfileCandidate(b, user) - scoreProfileCandidate(a, user))[0];
      const matchedCompany = await resolveCompanyForUser(user, matchedProfile);

      const resolvedProfile = matchedCompany && !matchedProfile.company_id
        ? { ...matchedProfile, company_id: matchedCompany.id }
        : matchedProfile;

      const finalProfile = matchedCompany
        ? await healOwnerProfile(user, resolvedProfile, matchedCompany)
        : resolvedProfile;

      return { profile: finalProfile, company: matchedCompany };
    }

    if (attempt < 5) {
      await sleep(500);
    }
  }

  return { profile: null, company: null };
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    const loadingFallback = window.setTimeout(() => {
      setLoading(false);
    }, 4000);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      setUser(user);
      setMobileSidebarOpen(false);

      if (!user) {
        setProfile(null);
        setCompany(null);
        setLoading(false);
        return;
      }

      try {
        const resolved = await resolveProfileAndCompany(user);
        setProfile(resolved.profile);
        setCompany(resolved.company);
      } catch (error) {
        console.error('Error fetching user profile:', error);
        setProfile(null);
        setCompany(null);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      window.clearTimeout(loadingFallback);
      unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <Router>
        <Suspense fallback={<RouteLoader />}>
          <Routes>
            <Route path="/" element={<MarketingLanding />} />
            <Route path="/whatsapp-studio" element={<WhatsAppStudio />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/activate" element={<ActivateAccount />} />
            <Route path="/view-invoice/:id" element={<InvoiceView />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <Toaster position="top-right" />
      </Router>
    );
  }

  if (!user.emailVerified) {
    return (
      <Router>
        <Suspense fallback={<RouteLoader />}>
          <Routes>
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="*" element={<Navigate to={`/verify-email?email=${encodeURIComponent(user.email || '')}`} replace />} />
          </Routes>
        </Suspense>
        <Toaster position="top-right" />
      </Router>
    );
  }

  const requiresOnboarding = Boolean(profile?.company_id && company && company.onboarding_status !== 'complete');

  return (
    <Router>
      <TenantContext.Provider value={{ profile, company, companyId: profile?.company_id || null }}>
        <div className="flex min-h-screen app-shell overflow-hidden">
          <Sidebar
            profile={profile}
            company={company}
            mobileOpen={mobileSidebarOpen}
            onCloseMobile={() => setMobileSidebarOpen(false)}
          />
          <main className="min-w-0 flex-1 overflow-y-auto p-3 pb-6 md:p-6 lg:p-8">
            <div className="sticky top-0 z-30 mb-4 space-y-3">
              <div className="hidden lg:block">
                <GlobalSearch profile={profile} />
              </div>
              <div className="lg:hidden">
              <div className="rounded-[22px] border border-[#dfcfbb] bg-[rgba(255,251,245,0.94)] px-4 py-3 shadow-[0_10px_30px_rgba(63,43,22,0.08)] backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-[#8b6f51] font-semibold">Appleberry OS</p>
                    <p className="truncate text-sm font-semibold text-[#17242b]">{company?.name || profile?.full_name || 'Workspace'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <GlobalSearch profile={profile} compact />
                    <button
                      type="button"
                      aria-label="Open navigation"
                      onClick={() => setMobileSidebarOpen(true)}
                      className="shrink-0 rounded-2xl border border-[#d7c5b0] bg-white/90 p-2.5 text-[#214e5f] shadow-sm"
                    >
                      <Menu className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
              </div>
            </div>
            <Suspense fallback={<RouteLoader />}>
              <Routes>
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : <Dashboard profile={profile} />} />
                <Route path="/campaigns" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : hasPermission(profile, 'marketing.view') ? <MarketingHub /> : <Navigate to="/" replace />} />
                <Route path="/whatsapp-studio" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : hasPermission(profile, 'marketing.view') ? <WhatsAppStudio /> : <Navigate to="/" replace />} />
                <Route path="/pos" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : hasPermission(profile, 'pos.use') ? <POS /> : <Navigate to="/" replace />} />
                <Route path="/view-invoice/:id" element={<InvoiceView />} />
                <Route path="/inventory" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : hasPermission(profile, 'inventory.view') ? <Inventory /> : <Navigate to="/" replace />} />
                <Route path="/repairs" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : hasPermission(profile, 'repairs.view') ? <Repairs /> : <Navigate to="/" replace />} />
                <Route path="/repairs/new" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : hasPermission(profile, 'repairs.view') ? <NewRepair /> : <Navigate to="/" replace />} />
                <Route path="/repairs/:id" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : hasPermission(profile, 'repairs.view') ? <RepairDetail /> : <Navigate to="/" replace />} />
                <Route path="/customers" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : hasPermission(profile, 'customers.view') ? <Customers /> : <Navigate to="/" replace />} />
                <Route path="/imei" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : hasPermission(profile, 'imei.view') ? <IMEISearch /> : <Navigate to="/" replace />} />
                
                <Route path="/invoices" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : hasPermission(profile, 'invoices.view') ? <Invoices /> : <Navigate to="/" replace />} />
                <Route path="/purchase-orders" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : hasPermission(profile, 'purchase_orders.view') ? <PurchaseOrders /> : <Navigate to="/" replace />} />
                <Route path="/orders" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : hasPermission(profile, 'orders.view') ? <Orders /> : <Navigate to="/" replace />} />
                <Route path="/devices" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : hasPermission(profile, 'devices.view') ? <DevicesInventory /> : <Navigate to="/" replace />} />
                <Route path="/stock-take" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : hasPermission(profile, 'stock_take.view') ? <StockTake /> : <Navigate to="/" replace />} />
                <Route path="/expenses" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : hasPermission(profile, 'expenses.view') ? <Expenses /> : <Navigate to="/" replace />} />
                <Route path="/transfer" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : hasPermission(profile, 'transfer.view') ? <InventoryTransfer /> : <Navigate to="/" replace />} />
                <Route path="/end-of-day" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : hasPermission(profile, 'end_of_day.view') ? <EndOfDay /> : <Navigate to="/" replace />} />
                <Route path="/appointments" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : hasPermission(profile, 'appointments.view') ? <Appointments /> : <Navigate to="/" replace />} />
                <Route path="/staff" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : hasPermission(profile, 'staff.manage') ? <StaffManagement /> : <Navigate to="/" replace />} />
                <Route path="/website" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : hasPermission(profile, 'website.view') ? <Website /> : <Navigate to="/" replace />} />
                <Route path="/reports/sales" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : hasPermission(profile, 'reports.sales') ? <SalesReports /> : <Navigate to="/" replace />} />
                <Route path="/reports/repairs" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : hasPermission(profile, 'reports.repairs') ? <RepairsReports /> : <Navigate to="/" replace />} />
                <Route path="/reports/inventory" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : hasPermission(profile, 'reports.inventory') ? <InventoryReports /> : <Navigate to="/" replace />} />
                <Route path="/activity" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : hasPermission(profile, 'activity.view') ? <ActivityLog /> : <Navigate to="/" replace />} />
                <Route path="/getting-started" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : hasPermission(profile, 'getting_started.view') ? <GettingStarted /> : <Navigate to="/" replace />} />
                <Route path="/manage-data" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : hasPermission(profile, 'manage_data.view') ? <ManageData /> : <Navigate to="/" replace />} />
                <Route path="/setup" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : hasPermission(profile, 'setup.view') ? <Setup /> : <Navigate to="/" replace />} />
                <Route path="/integrations" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : hasPermission(profile, 'integrations.view') ? <Integrations /> : <Navigate to="/" replace />} />

                <Route path="*" element={<Navigate to={requiresOnboarding ? "/onboarding" : "/"} replace />} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </TenantContext.Provider>
      <Toaster position="top-right" />
    </Router>
  );
}
