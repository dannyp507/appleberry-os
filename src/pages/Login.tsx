import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { 
  sendEmailVerification,
  signInWithEmailAndPassword, 
  sendPasswordResetEmail
} from 'firebase/auth';
import { toast } from 'sonner';

type AuthMode = 'login' | 'reset';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const nextEmail = searchParams.get('email');
    const verified = searchParams.get('verified') === '1';

    if (nextEmail) {
      setEmail(nextEmail);
    }

    if (verified) {
      toast.success('Email verified. You can sign in now.');
    }
  }, [searchParams]);

  const getAuthErrorMessage = (error: any) => {
    if (!error?.code) {
      return error?.message || 'Something went wrong. Please try again.';
    }

    switch (error.code) {
      case 'auth/email-already-in-use':
        return 'This email is already registered. Please sign in instead.';
      case 'auth/invalid-credential':
        return 'Invalid email or password. Please try again.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters.';
      case 'auth/user-not-found':
        return 'No account found with this email.';
      default:
        return error.message || 'Something went wrong. Please try again.';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const normalizedEmail = email.trim();

    try {
      if (mode === 'login') {
        const result = await signInWithEmailAndPassword(auth, normalizedEmail, password);
        await result.user.reload();

        if (!result.user.emailVerified) {
          await sendEmailVerification(result.user);
          await auth.signOut();
          toast.error('Please verify your email first. We sent the verification email again.');
          navigate(`/verify-email?email=${encodeURIComponent(normalizedEmail)}`);
          return;
        }

        toast.success('Logged in successfully');
      } else if (mode === 'reset') {
        await sendPasswordResetEmail(auth, normalizedEmail);
        toast.success('Password reset email sent');
        setMode('login');
      }
    } catch (error: any) {
      toast.error(getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center app-shell p-4 md:p-8">
      <div className="max-w-5xl w-full grid lg:grid-cols-[1.15fr_0.85fr] gap-6">
        <div className="hero-card rounded-[32px] p-8 md:p-10 relative overflow-hidden hidden lg:block">
          <div className="absolute inset-0 soft-grid opacity-50" />
          <div className="relative">
            <div className="w-18 h-18 rounded-[28px] brand-badge flex items-center justify-center text-white font-bold text-4xl mb-8">
              A
            </div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-[#7b5c3c] font-semibold mb-4">Appleberry OS</p>
            <h1 className="display-font text-5xl font-bold text-[#18242b] leading-none max-w-xl">
              Run your repair business like an operating system, not a spreadsheet.
            </h1>
            <p className="mt-6 text-[#5d6468] max-w-xl text-lg leading-7">
              Service desks, stock control, staff permissions, invoices, transfers, and repair workflows designed to feel calm, fast, and trustworthy.
            </p>
            <div className="mt-10 grid grid-cols-3 gap-4 max-w-2xl">
              {[
                ['Sales', 'Take payments and close jobs'],
                ['Repairs', 'Track intake to collection'],
                ['Inventory', 'Move stock with control'],
              ].map(([title, desc]) => (
                <div key={title} className="rounded-2xl bg-white/70 border border-white/70 px-4 py-4">
                  <p className="font-semibold text-[#18242b]">{title}</p>
                  <p className="text-sm text-[#6a6f72] mt-2">{desc}</p>
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
            <h2 className="display-font text-4xl font-bold text-[#18242b]">Appleberry OS</h2>
            <p className="mt-3 text-sm text-[#5d6468]">
              {mode === 'login' && 'Sign in to your staff account'}
              {mode === 'reset' && 'Reset your password'}
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-[#334047]">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="mt-1 block w-full px-4 py-3 border border-[#dbc8b2] rounded-xl bg-white/85 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#c65a22]/20 focus:border-[#c65a22] sm:text-sm"
                  placeholder="staff@appleberryos.co.za"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {mode !== 'reset' && (
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-[#334047]">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    className="mt-1 block w-full px-4 py-3 border border-[#dbc8b2] rounded-xl bg-white/85 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#c65a22]/20 focus:border-[#c65a22] sm:text-sm"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              )}
            </div>

            {mode === 'login' && (
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setMode('reset')}
                  className="text-sm font-medium text-[#214e5f] hover:text-[#183842]"
                >
                  Forgot your password?
                </button>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-3.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white appleberry-gradient hover:opacity-90 focus:outline-none disabled:opacity-50 transition-all shadow-[0_16px_30px_rgba(198,90,34,0.18)]"
              >
                {loading ? 'Processing...' : (
                  mode === 'login' ? 'Sign in' : 'Send Reset Link'
                )}
              </button>
            </div>

            <div className="rounded-2xl border border-[#e6d7c6] bg-[#fff8ef] p-4 text-sm text-[#5d6468]">
              Staff accounts are invite-only. Ask an admin to send you an activation link if you do not have login details yet.
            </div>

            <p className="text-sm text-center text-[#5d6468]">
              Starting a new company?{' '}
              <Link to="/signup" className="font-semibold text-[#214e5f] hover:text-[#183842]">
                Create your workspace
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
