import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { sendPasswordResetEmail, sendEmailVerification, signInWithEmailAndPassword } from 'firebase/auth';
import { MailCheck, RefreshCcw } from 'lucide-react';
import { auth } from '../lib/firebase';
import { toast } from 'sonner';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const email = useMemo(() => searchParams.get('email') || '', [searchParams]);
  const verifiedFromLink = searchParams.get('verified') === '1';

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!verifiedFromLink) return;

    toast.success('Your email has been verified. Sign in to continue.');
    const timer = window.setTimeout(() => {
      navigate(`/login?verified=1&email=${encodeURIComponent(email)}`, { replace: true });
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [email, navigate, verifiedFromLink]);

  const handleCheckStatus = async () => {
    if (!email || !password) {
      toast.error('Enter the email and password you used to sign up.');
      return;
    }

    setLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      await result.user.reload();

      if (!result.user.emailVerified) {
        toast.error('That email is still not verified yet. Check your inbox and spam folder, then try again.');
        return;
      }

      toast.success('Email verified. You can finish setting up your workspace now.');
      navigate('/onboarding', { replace: true });
    } catch (error: any) {
      toast.error(error.message || 'Could not confirm verification yet.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email || !password) {
      toast.error('Enter the signup email and password first so we can resend the verification email.');
      return;
    }

    setResending(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(result.user, {
        url: `${window.location.origin}/verify-email?email=${encodeURIComponent(email)}&verified=1`,
        handleCodeInApp: false,
      });
      await auth.signOut();
      toast.success('Verification email sent again.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to resend verification email.');
    } finally {
      setResending(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      toast.error('No email found for this verification step.');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      toast.success('Password reset email sent.');
    } catch (error: any) {
      toast.error(error.message || 'Could not send password reset email.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center app-shell p-4 md:p-8">
      <div className="max-w-4xl w-full grid lg:grid-cols-[1fr_0.92fr] gap-6">
        <div className="hero-card rounded-[32px] p-8 md:p-10 hidden lg:block">
          <div className="w-18 h-18 rounded-[28px] brand-badge flex items-center justify-center text-white font-bold text-4xl mb-8">
            A
          </div>
          <p className="text-[11px] uppercase tracking-[0.32em] text-[#7b5c3c] font-semibold mb-4">Verify your owner email</p>
          <h1 className="display-font text-5xl font-bold text-[#18242b] leading-none">
            One quick inbox check before your workspace goes live.
          </h1>
          <div className="mt-8 space-y-3">
            {[
              'Open the verification email from Firebase.',
              'Click the verification link in that email.',
              'Come back here and confirm your status to continue onboarding.',
            ].map((item) => (
              <div key={item} className="rounded-2xl bg-white/70 border border-white/70 px-4 py-4 text-[#4f5a60]">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="app-panel rounded-[32px] p-8 md:p-10">
          <div className="text-center">
            <div className="w-16 h-16 rounded-[22px] brand-badge mx-auto flex items-center justify-center text-white font-bold text-3xl mb-4">
              <MailCheck className="w-8 h-8" />
            </div>
            <h2 className="display-font text-4xl font-bold text-[#18242b]">Verify Your Email</h2>
            <p className="mt-3 text-sm text-[#5d6468]">
              We sent a verification link to <span className="font-semibold text-[#214e5f]">{email || 'your signup email'}</span>.
            </p>
          </div>

          <div className="mt-8 space-y-5">
            {verifiedFromLink && (
              <div className="rounded-2xl border border-[#d6e6d7] bg-[#eef7ef] p-4 text-sm text-[#315f3a]">
                Email verified successfully. Redirecting you back to sign in.
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-[#334047]">Signup email</label>
              <input
                value={email}
                readOnly
                className="mt-1 block w-full px-4 py-3 border border-[#dbc8b2] rounded-xl bg-[#f8f2ea] shadow-sm sm:text-sm text-[#5d6468]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#334047]">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-4 py-3 border border-[#dbc8b2] rounded-xl bg-white/85 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#c65a22]/20 focus:border-[#c65a22] sm:text-sm"
                placeholder="Enter the password you used when signing up"
              />
            </div>

            <button
              type="button"
              onClick={handleCheckStatus}
              disabled={loading}
              className="group relative w-full flex justify-center py-3.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white appleberry-gradient hover:opacity-90 focus:outline-none disabled:opacity-50 transition-all shadow-[0_16px_30px_rgba(198,90,34,0.18)]"
            >
              {loading ? 'Checking verification...' : 'I’ve Verified My Email'}
            </button>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#dbc8b2] bg-white px-4 py-3 text-sm font-semibold text-[#214e5f] hover:bg-[#fff8ef] disabled:opacity-50"
              >
                <RefreshCcw className="w-4 h-4" />
                {resending ? 'Resending...' : 'Resend Email'}
              </button>
              <button
                type="button"
                onClick={handlePasswordReset}
                className="inline-flex items-center justify-center rounded-xl border border-[#dbc8b2] bg-white px-4 py-3 text-sm font-semibold text-[#214e5f] hover:bg-[#fff8ef]"
              >
                Reset Password
              </button>
            </div>

            <div className="rounded-2xl border border-[#e6d7c6] bg-[#fff8ef] p-4 text-sm text-[#5d6468]">
              We keep new company workspaces locked until the owner email is verified. That helps prevent fake signups and protects the platform.
            </div>

            <p className="text-sm text-center text-[#5d6468]">
              Already verified? <Link to="/login" className="font-semibold text-[#214e5f] hover:text-[#183842]">Go to login</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
