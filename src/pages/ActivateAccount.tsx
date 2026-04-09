import { FormEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { collection, doc, getDocs, limit, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { AlertCircle, CheckCircle2, KeyRound, LockKeyhole, Mail } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { toast } from 'sonner';
import { getDefaultPermissions } from '../lib/permissions';

type StaffInvite = {
  id: string;
  token: string;
  email: string;
  full_name?: string | null;
  role?: 'owner' | 'admin' | 'staff';
  company_id?: string | null;
  permissions?: string[] | null;
  profile_id?: string | null;
  temp_password?: string | null;
  expires_at?: string | null;
  accepted_at?: string | null;
  phone?: string | null;
  branch?: string | null;
  title?: string | null;
  status?: string | null;
};

export default function ActivateAccount() {
  const [searchParams] = useSearchParams();
  const rawToken = searchParams.get('token') || '';
  const token = rawToken.split(/\s+/)[0].trim();

  const [invite, setInvite] = useState<StaffInvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    const loadInvite = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const snapshot = await getDocs(
          query(collection(db, 'staff_invites'), where('token', '==', token), limit(1))
        );

        if (!snapshot.empty) {
          const inviteDoc = snapshot.docs[0];
          setInvite({ id: inviteDoc.id, ...inviteDoc.data() } as StaffInvite);
        }
      } catch (error) {
        console.error('Failed to load invite', error);
      } finally {
        setLoading(false);
      }
    };

    loadInvite();
  }, [token]);

  const handleActivate = async (e: FormEvent) => {
    e.preventDefault();
    if (!invite) return;

    if (!tempPassword || tempPassword !== invite.temp_password) {
      toast.error('The temporary password does not match the invite.');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    if (invite.accepted_at) {
      toast.error('This invite has already been used.');
      return;
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      toast.error('This invite has expired. Please ask an admin to send a new one.');
      return;
    }

    setSubmitting(true);
    try {
      const { user } = await createUserWithEmailAndPassword(auth, invite.email, password);
      const canonicalProfilePayload = {
        full_name: invite.full_name || 'Staff Member',
        role: invite.role || 'staff',
        company_id: invite.company_id || null,
        permissions: invite.permissions || getDefaultPermissions(invite.role || 'staff'),
        email: invite.email,
        branch: invite.branch || null,
        title: invite.title || null,
        phone: invite.phone || null,
        status: invite.status || 'active',
        auth_uid: user.uid,
        invite_accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (invite.profile_id) {
        await updateDoc(doc(db, 'profiles', invite.profile_id), {
          ...canonicalProfilePayload,
        });
      }

      await setDoc(doc(db, 'profiles', user.uid), {
        ...canonicalProfilePayload,
        created_at: new Date().toISOString(),
      }, { merge: true });

      await updateDoc(doc(db, 'staff_invites', invite.id), {
        accepted_at: new Date().toISOString(),
        auth_uid: user.uid,
      });

      toast.success('Your account is ready. You are now signed in.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to activate account.');
    } finally {
      setSubmitting(false);
    }
  };

  const invalidInvite = !loading && (!token || !invite);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-8 py-8 border-b border-gray-100 bg-gray-50/70">
          <div className="w-14 h-14 rounded-2xl appleberry-gradient text-white flex items-center justify-center text-2xl font-bold mb-4">
            A
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Activate Staff Account</h1>
          <p className="text-sm text-gray-500 mt-2">Use your invite link, temporary password, and choose your own secure password.</p>
        </div>

        <div className="p-8">
          {loading ? (
            <div className="text-center text-gray-500 py-10">Loading invite...</div>
          ) : invalidInvite ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-700 space-y-3">
              <div className="flex items-center gap-2 font-semibold"><AlertCircle className="w-4 h-4" /> Invite not found</div>
              <p>This activation link is invalid or has already been removed. Ask your admin to send a new invite.</p>
              <Link to="/login" className="inline-flex text-primary font-medium hover:underline">Back to login</Link>
            </div>
          ) : invite?.accepted_at ? (
            <div className="rounded-2xl border border-green-100 bg-green-50 p-5 text-sm text-green-700 space-y-3">
              <div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="w-4 h-4" /> Invite already used</div>
              <p>This invite has already been accepted. You can sign in with your email and password now.</p>
              <Link to="/login" className="inline-flex text-primary font-medium hover:underline">Go to login</Link>
            </div>
          ) : (
            <form onSubmit={handleActivate} className="space-y-5">
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-2">
                <p className="text-sm font-semibold text-gray-900">{invite?.full_name || 'New Staff Member'}</p>
                <div className="flex items-center gap-2 text-sm text-gray-600"><Mail className="w-4 h-4" /> {invite?.email}</div>
                <div className="flex items-center gap-2 text-sm text-gray-600"><KeyRound className="w-4 h-4" /> Temporary password sent by admin</div>
              </div>

              <Field label="Temporary Password" value={tempPassword} onChange={setTempPassword} type="text" placeholder="Enter the temp password from your invite" />
              <Field label="New Password" value={password} onChange={setPassword} type="password" placeholder="Create a secure password" />
              <Field label="Confirm New Password" value={confirmPassword} onChange={setConfirmPassword} type="password" placeholder="Repeat your new password" />

              <button
                type="submit"
                disabled={submitting}
                className="w-full appleberry-gradient text-white py-3 rounded-xl font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? 'Activating account...' : 'Activate Account'}
              </button>

              <p className="text-xs text-gray-500 text-center">
                After activation you’ll be signed in automatically and can change your password later from Firebase reset if needed.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>
    </div>
  );
}
