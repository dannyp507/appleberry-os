/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, limit, query, updateDoc, where } from 'firebase/firestore';
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
const POS = lazy(() => import('./pages/POS'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Repairs = lazy(() => import('./pages/Repairs'));
const RepairDetail = lazy(() => import('./pages/RepairDetail'));
const NewRepair = lazy(() => import('./pages/NewRepair'));
const Customers = lazy(() => import('./pages/Customers'));
const IMEISearch = lazy(() => import('./pages/IMEISearch'));
const Expenses = lazy(() => import('./pages/Expenses'));
const EndOfDay = lazy(() => import('./pages/EndOfDay'));
const ManageData = lazy(() => import('./pages/ManageData'));
const InvoiceView = lazy(() => import('./pages/InvoiceView'));
const Invoices = lazy(() => import('./pages/Invoices'));
const SalesReports = lazy(() => import('./pages/SalesReports'));
const RepairsReports = lazy(() => import('./pages/RepairsReports'));
const ActivityLog = lazy(() => import('./pages/ActivityLog'));
const StaffManagement = lazy(() => import('./pages/StaffManagement'));
const ActivateAccount = lazy(() => import('./pages/ActivateAccount'));
const StockTake = lazy(() => import('./pages/StockTake'));
const PurchaseOrders = lazy(() => import('./pages/PurchaseOrders'));
const InventoryTransfer = lazy(() => import('./pages/InventoryTransfer'));
const MarketingLanding = lazy(() => import('./pages/MarketingLanding'));
const DevicesInventory = lazy(() => import('./pages/DevicesInventory'));
const Setup = lazy(() => import('./pages/Setup'));
const WhatsAppStudio = lazy(() => import('./pages/WhatsAppStudio'));
const Appointments = lazy(() => import('./pages/Appointments'));
const Orders = lazy(() => import('./pages/Orders'));
const InventoryReports = lazy(() => import('./pages/InventoryReports'));

// Components
import Sidebar from './components/Sidebar';
import GlobalSearch from './components/GlobalSearch';

function RouteLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#22C55E]" />
    </div>
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** If a profile has no company_id, search companies to find and heal the link. */
async function healMissingCompany(user: User, profile: Profile): Promise<{ profile: Profile; company: Company | null }> {
  // Try owner_user_id match first
  const byOwner = await getDocs(query(collection(db, 'companies'), where('owner_user_id', '==', user.uid), limit(1)));
  if (!byOwner.empty) {
    const companyDoc = byOwner.docs[0];
    const company = { id: companyDoc.id, ...companyDoc.data() } as Company;
    try { await updateDoc(doc(db, 'profiles', profile.id), { company_id: company.id, auth_uid: user.uid }); } catch {}
    return { profile: { ...profile, company_id: company.id }, company };
  }
  // Try owner_email match
  if (user.email) {
    const byEmail = await getDocs(query(collection(db, 'companies'), where('owner_email', '==', user.email.toLowerCase()), limit(1)));
    if (!byEmail.empty) {
      const companyDoc = byEmail.docs[0];
      const company = { id: companyDoc.id, ...companyDoc.data() } as Company;
      try { await updateDoc(doc(db, 'profiles', profile.id), { company_id: company.id, auth_uid: user.uid }); } catch {}
      return { profile: { ...profile, company_id: company.id }, company };
    }
  }
  return { profile, company: null };
}

async function resolveProfileAndCompany(user: User): Promise<{ profile: Profile | null; company: Company | null }> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const profileSnap = await getDoc(doc(db, 'profiles', user.uid));
    if (profileSnap.exists()) {
      const nextProfile = { id: profileSnap.id, ...profileSnap.data() } as Profile;

      // Profile has no company_id — try to find and heal it
      if (!nextProfile.company_id) {
        return healMissingCompany(user, nextProfile);
      }

      const nextCompany = await getDoc(doc(db, 'companies', nextProfile.company_id)).then((companySnap) =>
        companySnap.exists() ? ({ id: companySnap.id, ...companySnap.data() } as Company) : null
      );

      // Company doc missing despite company_id being set — try to heal
      if (!nextCompany) {
        return healMissingCompany(user, nextProfile);
      }

      return { profile: nextProfile, company: nextCompany };
    }

    const fallbackQueries = [
      getDocs(query(collection(db, 'profiles'), where('auth_uid', '==', user.uid), limit(1)))
    ];

    for (const lookup of fallbackQueries) {
      const snapshot = await lookup;
      if (!snapshot.empty) {
        const matchedDoc = snapshot.docs[0];
        const matchedProfile = { id: matchedDoc.id, ...matchedDoc.data() } as Profile;

        if (!matchedProfile.company_id) {
          return healMissingCompany(user, matchedProfile);
        }

        const matchedCompany = await getDoc(doc(db, 'companies', matchedProfile.company_id)).then((companySnap) =>
          companySnap.exists() ? ({ id: companySnap.id, ...companySnap.data() } as Company) : null
        );
        return { profile: matchedProfile, company: matchedCompany };
      }
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

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#22C55E]"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <Router>
        <Suspense fallback={<RouteLoader />}>
          <Routes>
            <Route path="/" element={<MarketingLanding />} />
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
              <div className="rounded-xl border border-[#2A2A2E] bg-[#141416]/95 px-4 py-3 shadow-[0_14px_40px_rgba(0,0,0,0.4)] backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-semibold">Appleberry OS</p>
                    <p className="truncate text-sm font-semibold text-white">{company?.name || profile?.full_name || 'Workspace'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <GlobalSearch profile={profile} compact />
                    <button
                      type="button"
                      aria-label="Open navigation"
                      onClick={() => setMobileSidebarOpen(true)}
                      className="shrink-0 rounded-xl border border-[#2A2A2E] bg-[#1C1C1F] p-2.5 text-white shadow-sm"
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
                <Route path="/orders" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : <Orders />} />
                <Route path="/devices" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : hasPermission(profile, 'devices.view') ? <DevicesInventory /> : <Navigate to="/" replace />} />
                <Route path="/stock-take" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : hasPermission(profile, 'stock_take.view') ? <StockTake /> : <Navigate to="/" replace />} />
                <Route path="/expenses" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : hasPermission(profile, 'expenses.view') ? <Expenses /> : <Navigate to="/" replace />} />
                <Route path="/transfer" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : hasPermission(profile, 'transfer.view') ? <InventoryTransfer /> : <Navigate to="/" replace />} />
                <Route path="/end-of-day" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : hasPermission(profile, 'end_of_day.view') ? <EndOfDay /> : <Navigate to="/" replace />} />
                <Route path="/appointments" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : <Appointments />} />
                <Route path="/staff" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : hasPermission(profile, 'staff.manage') ? <StaffManagement /> : <Navigate to="/" replace />} />
                <Route path="/website" element={<Navigate to="/" replace />} />
                <Route path="/reports/sales" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : hasPermission(profile, 'reports.sales') ? <SalesReports /> : <Navigate to="/" replace />} />
                <Route path="/reports/repairs" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : hasPermission(profile, 'reports.repairs') ? <RepairsReports /> : <Navigate to="/" replace />} />
                <Route path="/reports/inventory" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : <InventoryReports />} />
                <Route path="/activity" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : hasPermission(profile, 'activity.view') ? <ActivityLog /> : <Navigate to="/" replace />} />
                <Route path="/getting-started" element={<Navigate to="/" replace />} />
                <Route path="/manage-data" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : hasPermission(profile, 'manage_data.view') ? <ManageData /> : <Navigate to="/" replace />} />
                <Route path="/setup" element={requiresOnboarding ? <Navigate to="/onboarding" replace /> : <Setup />} />
                <Route path="/integrations" element={<Navigate to="/" replace />} />

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
