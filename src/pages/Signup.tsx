import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, sendEmailVerification, signOut } from 'firebase/auth';
import { collection, doc } from 'firebase/firestore';
import { auth } from '../lib/firebase';
import { seedCompanyWorkspace } from '../lib/company';
import { db } from '../lib/firebase';
import { toast } from 'sonner';

export default function Signup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    company_name: '',
    email: '',
    password: '',
    confirm_password: '',
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters long.');
      return;
    }

    if (form.password !== form.confirm_password) {
      toast.error('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const { user } = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
      const companyId = doc(collection(db, 'companies')).id;
      const email = form.email.trim();

      await seedCompanyWorkspace({
        companyId,
        companyName: form.company_name.trim(),
        ownerUserId: user.uid,
        ownerEmail: email,
        ownerName: form.full_name.trim(),
      });

      await sendEmailVerification(user);
      await signOut(auth);

      toast.success('We sent a verification email. Verify your address before signing in.');
      navigate(`/verify-email?email=${encodeURIComponent(email)}`, { replace: true });
    } catch (error: any) {
      toast.error(error.message || 'Failed to create your workspace.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center app-shell p-4 md:p-8">
      <div className="max-w-6xl w-full grid lg:grid-cols-[1.05fr_0.95fr] gap-6">
        <div className="hero-card rounded-[32px] p-8 md:p-10 relative overflow-hidden hidden lg:block">
          <div className="absolute inset-0 soft-grid opacity-50" />
          <div className="relative">
            <div className="w-18 h-18 rounded-[28px] brand-badge flex items-center justify-center text-white font-bold text-4xl mb-8">
              A
            </div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-[#7b5c3c] font-semibold mb-4">Start your own workspace</p>
            <h1 className="display-font text-5xl font-bold text-[#18242b] leading-none max-w-xl">
              Launch Appleberry OS with a clean company setup from day one.
            </h1>
            <div className="mt-8 grid grid-cols-1 gap-4 max-w-2xl">
              {[
                'Create your company and owner account in one step.',
                'Start in test mode so no real messages go out by accident.',
                'Get default repair statuses and a blank workspace ready for imports.',
              ].map((item) => (
                <div key={item} className="rounded-2xl bg-white/70 border border-white/70 px-4 py-4 text-[#4f5a60]">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="app-panel rounded-[32px] p-8 md:p-10">
          <div className="text-center">
            <div className="w-16 h-16 rounded-[22px] brand-badge mx-auto flex items-center justify-center text-white font-bold text-3xl mb-4">
              A
            </div>
            <h2 className="display-font text-4xl font-bold text-[#18242b]">Create Your Company</h2>
            <p className="mt-3 text-sm text-[#5d6468]">
              Set up a new Appleberry OS workspace with its own owner account and onboarding flow.
            </p>
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <Input label="Your full name" value={form.full_name} onChange={(value) => setForm((current) => ({ ...current, full_name: value }))} />
            <Input label="Company name" value={form.company_name} onChange={(value) => setForm((current) => ({ ...current, company_name: value }))} />
            <Input label="Owner email" type="email" value={form.email} onChange={(value) => setForm((current) => ({ ...current, email: value }))} />
            <Input label="Password" type="password" value={form.password} onChange={(value) => setForm((current) => ({ ...current, password: value }))} />
            <Input label="Confirm password" type="password" value={form.confirm_password} onChange={(value) => setForm((current) => ({ ...current, confirm_password: value }))} />

            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white appleberry-gradient hover:opacity-90 focus:outline-none disabled:opacity-50 transition-all shadow-[0_16px_30px_rgba(198,90,34,0.18)]"
            >
              {loading ? 'Creating workspace...' : 'Create Company Workspace'}
            </button>

            <div className="rounded-2xl border border-[#e6d7c6] bg-[#fff8ef] p-4 text-sm text-[#5d6468]">
              This creates a new company workspace with a 14-day trial and leaves messaging in test mode until you intentionally switch it live.
            </div>

            <p className="text-sm text-center text-[#5d6468]">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-[#214e5f] hover:text-[#183842]">
                Sign in
              </Link>
            </p>
          </form>
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
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full px-4 py-3 border border-[#dbc8b2] rounded-xl bg-white/85 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#c65a22]/20 focus:border-[#c65a22] sm:text-sm"
      />
    </div>
  );
}
