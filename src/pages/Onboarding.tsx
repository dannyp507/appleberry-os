import { FormEvent, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '../lib/firebase';
import { useTenant } from '../lib/tenant';
import { getCompanySettingsDocId } from '../lib/company';

export default function Onboarding() {
  const { company, companyId, profile } = useTenant();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company_name: '',
    phone: '',
    website: '',
    country: 'South Africa',
    business_type: 'repair_shop',
    branch_name: 'Main Branch',
    address: '',
    email: profile?.email || '',
    vatNumber: '',
    regNumber: '',
  });

  useEffect(() => {
    const load = async () => {
      if (!companyId) {
        setLoading(false);
        return;
      }

      try {
        const shopSnap = await getDoc(doc(db, 'settings', getCompanySettingsDocId('shop', companyId)));
        setForm((current) => ({
          ...current,
          company_name: company?.name || current.company_name,
          phone: company?.phone || current.phone,
          website: company?.website || current.website,
          country: company?.country || current.country,
          business_type: company?.business_type || current.business_type,
          email: profile?.email || current.email,
          address: shopSnap.exists() ? shopSnap.data().address || '' : current.address,
          vatNumber: shopSnap.exists() ? shopSnap.data().vatNumber || '' : current.vatNumber,
          regNumber: shopSnap.exists() ? shopSnap.data().regNumber || '' : current.regNumber,
        }));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [company, companyId, profile?.email]);

  if (!companyId) {
    return <Navigate to="/" replace />;
  }

  if (company?.onboarding_status === 'complete') {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      await Promise.all([
        updateDoc(doc(db, 'companies', companyId), {
          name: form.company_name,
          phone: form.phone || null,
          website: form.website || null,
          country: form.country || null,
          business_type: form.business_type || null,
          onboarding_status: 'complete',
          updated_at: new Date().toISOString(),
        }),
        updateDoc(doc(db, 'settings', getCompanySettingsDocId('shop', companyId)), {
          company_id: companyId,
          name: form.company_name,
          address: form.address,
          phone: form.phone,
          email: form.email,
          website: form.website,
          vatNumber: form.vatNumber,
          regNumber: form.regNumber,
          updated_at: new Date().toISOString(),
        }),
      ]);

      toast.success('Company setup completed.');
      window.location.href = '/';
    } catch (error: any) {
      toast.error(error.message || 'Failed to save onboarding settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen app-shell p-4 md:p-8">
      <div className="mx-auto max-w-5xl grid lg:grid-cols-[0.95fr_1.05fr] gap-6">
        <div className="hero-card rounded-[32px] p-8 md:p-10">
          <p className="text-[11px] uppercase tracking-[0.32em] text-[#7b5c3c] font-semibold mb-4">Company onboarding</p>
          <h1 className="display-font text-5xl font-bold text-[#18242b] leading-none">
            Finish the setup for {company?.name || 'your company'}.
          </h1>
          <p className="mt-6 text-[#5d6468] text-lg leading-7">
            We’re keeping this calm and practical: brand details, branch identity, and the shop information your invoices and staff will rely on.
          </p>

          <div className="mt-8 space-y-3">
            {[
              'Messaging stays in test mode until you intentionally switch live mode on.',
              'Your owner account already has full access to the workspace.',
              'You can invite staff and import data after this setup is complete.',
            ].map((item) => (
              <div key={item} className="rounded-2xl bg-white/70 border border-white/70 px-4 py-4 text-[#4f5a60]">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="app-panel rounded-[32px] p-8 md:p-10">
          {loading ? (
            <div className="py-20 text-center text-[#5d6468]">Loading onboarding...</div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="grid md:grid-cols-2 gap-4">
                <Input label="Company name" value={form.company_name} onChange={(value) => setForm((current) => ({ ...current, company_name: value }))} />
                <Input label="Branch name" value={form.branch_name} onChange={(value) => setForm((current) => ({ ...current, branch_name: value }))} />
                <Input label="Company phone" value={form.phone} onChange={(value) => setForm((current) => ({ ...current, phone: value }))} />
                <Input label="Support email" type="email" value={form.email} onChange={(value) => setForm((current) => ({ ...current, email: value }))} />
                <Input label="Website" value={form.website} onChange={(value) => setForm((current) => ({ ...current, website: value }))} />
                <Input label="Country" value={form.country} onChange={(value) => setForm((current) => ({ ...current, country: value }))} />
                <Input label="VAT number" value={form.vatNumber} onChange={(value) => setForm((current) => ({ ...current, vatNumber: value }))} />
                <Input label="Registration number" value={form.regNumber} onChange={(value) => setForm((current) => ({ ...current, regNumber: value }))} />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#334047]">Business type</label>
                <select
                  value={form.business_type}
                  onChange={(e) => setForm((current) => ({ ...current, business_type: e.target.value }))}
                  className="mt-1 block w-full px-4 py-3 border border-[#dbc8b2] rounded-xl bg-white/85 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#c65a22]/20 focus:border-[#c65a22] sm:text-sm"
                >
                  <option value="repair_shop">Repair shop</option>
                  <option value="retail_store">Retail store</option>
                  <option value="multi_branch">Multi-branch operator</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#334047]">Address</label>
                <textarea
                  value={form.address}
                  onChange={(e) => setForm((current) => ({ ...current, address: e.target.value }))}
                  rows={4}
                  className="mt-1 block w-full px-4 py-3 border border-[#dbc8b2] rounded-xl bg-white/85 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#c65a22]/20 focus:border-[#c65a22] sm:text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="group relative w-full flex justify-center py-3.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white appleberry-gradient hover:opacity-90 focus:outline-none disabled:opacity-50 transition-all shadow-[0_16px_30px_rgba(198,90,34,0.18)]"
              >
                {saving ? 'Saving setup...' : 'Complete Company Setup'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#334047]">{label}</label>
      <input
        type={type}
        required={label !== 'Website' && label !== 'VAT number' && label !== 'Registration number'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full px-4 py-3 border border-[#dbc8b2] rounded-xl bg-white/85 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#c65a22]/20 focus:border-[#c65a22] sm:text-sm"
      />
    </div>
  );
}
