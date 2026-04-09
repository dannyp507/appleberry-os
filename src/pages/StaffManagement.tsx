import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import { Plus, Users, Shield, Wrench, Search, Mail, Phone, Building2, Briefcase, Trash2, Edit2, UserCheck, Send } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { Profile, Role } from '../types';
import { safeFormatDate } from '../lib/utils';
import { toast } from 'sonner';
import { ALL_PERMISSIONS, PERMISSION_GROUPS, PermissionKey, PermissionPreset, PRESET_PERMISSIONS, getDefaultPermissions, normalizePermissions } from '../lib/permissions';
import { getCompanySettingsDocId } from '../lib/company';
import axios from 'axios';

type StaffStatus = 'active' | 'inactive';

type StaffProfile = Profile & {
  email?: string | null;
  phone?: string | null;
  branch?: string | null;
  title?: string | null;
  status?: StaffStatus;
  last_active_at?: string | null;
  created_at?: string;
  auth_uid?: string | null;
};

const defaultForm = {
  full_name: '',
  role: 'staff' as Role,
  email: '',
  phone: '',
  branch: '',
  title: '',
  status: 'active' as StaffStatus,
  permissionPreset: 'cashier' as PermissionPreset,
  permissions: getDefaultPermissions('staff') as PermissionKey[],
};

const getRequestErrorMessage = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    return (
      (typeof error.response?.data?.error === 'string' && error.response.data.error) ||
      (typeof error.response?.data?.message === 'string' && error.response.data.message) ||
      error.message
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
};

const normalizeWhatsAppPhone = (phone: string) => phone.replace(/\D/g, '');

export default function StaffManagement() {
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffProfile | null>(null);
  const [formData, setFormData] = useState(defaultForm);
  const [sendingInviteId, setSendingInviteId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    loadAdminCompany();
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [companyId]);

  async function loadAdminCompany() {
    if (!auth.currentUser) return;
    try {
      const adminProfile = await getDoc(doc(db, 'profiles', auth.currentUser.uid));
      if (adminProfile.exists()) {
        setCompanyId((adminProfile.data().company_id as string | null) || null);
      }
    } catch (error) {
      console.error('Failed to load admin company', error);
    }
  }

  async function fetchStaff() {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'profiles'));
      const profiles = snapshot.docs
        .map((profileDoc) => ({ id: profileDoc.id, ...profileDoc.data() } as StaffProfile))
        .filter((member) => {
          if (!companyId) return true;
          return member.company_id === companyId;
        })
        .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
      setStaff(profiles);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load staff');
    } finally {
      setLoading(false);
    }
  }

  const filteredStaff = useMemo(() => {
    const query = search.toLowerCase();
    return staff.filter((member) => {
      if (!query) return true;
      return [member.full_name, member.email, member.phone, member.branch, member.title, member.role]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [staff, search]);

  const stats = useMemo(() => {
    const active = staff.filter((member) => (member.status || 'active') === 'active').length;
    const admins = staff.filter((member) => member.role === 'admin').length;
    const technicians = staff.filter((member) => (member.title || '').toLowerCase().includes('tech')).length;
    const branches = new Set(staff.map((member) => member.branch).filter(Boolean)).size;
    return { total: staff.length, active, admins, technicians, branches };
  }, [staff]);

  const handleOpenModal = (member?: StaffProfile) => {
    if (member) {
      setEditingStaff(member);
      setFormData({
        full_name: member.full_name || '',
        role: member.role,
        email: member.email || '',
        phone: member.phone || '',
        branch: member.branch || '',
        title: member.title || '',
        status: member.status || 'active',
        permissionPreset: 'custom',
        permissions: normalizePermissions(member.role, member.permissions),
      });
    } else {
      setEditingStaff(null);
      setFormData(defaultForm);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      full_name: formData.full_name,
      role: formData.role,
      permissions: formData.role === 'admin' ? ALL_PERMISSIONS : formData.permissions,
      email: formData.email || null,
      phone: formData.phone || null,
      branch: formData.branch || null,
      title: formData.title || null,
      company_id: companyId,
      status: formData.status,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingStaff) {
        await updateDoc(doc(db, 'profiles', editingStaff.id), payload);
        toast.success('Staff member updated');
      } else {
        await addDoc(collection(db, 'profiles'), {
          ...payload,
          created_at: new Date().toISOString(),
          last_active_at: null,
        });
        toast.success('Staff member added');
      }
      setIsModalOpen(false);
      setFormData(defaultForm);
      fetchStaff();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save staff member');
    }
  };

  const handleRoleChange = (role: Role) => {
    setFormData((current) => ({
      ...current,
      role,
      permissionPreset: role === 'admin' ? 'custom' : current.permissionPreset,
      permissions: role === 'admin' ? ALL_PERMISSIONS : current.permissions,
    }));
  };

  const handlePresetChange = (preset: PermissionPreset) => {
    setFormData((current) => ({
      ...current,
      permissionPreset: preset,
      permissions: preset === 'custom' ? current.permissions : PRESET_PERMISSIONS[preset],
    }));
  };

  const togglePermission = (permission: PermissionKey) => {
    setFormData((current) => {
      const nextPermissions = current.permissions.includes(permission)
        ? current.permissions.filter((item) => item !== permission)
        : [...current.permissions, permission];

      return {
        ...current,
        permissionPreset: 'custom',
        permissions: nextPermissions,
      };
    });
  };

  const createTempPassword = () => `AB-${Math.random().toString(36).slice(2, 6).toUpperCase()}${Math.random().toString(10).slice(2, 6)}`;

  const sendInvite = async (member: StaffProfile, options?: { suppressErrorToast?: boolean }) => {
    if (!member.email) {
      toast.error('Add an email before sending an invite.');
      return;
    }

    setSendingInviteId(member.id);
    try {
      const inviteCompanyId = member.company_id || companyId || null;
      const communicationSnap = await getDoc(
        doc(db, 'settings', getCompanySettingsDocId('communication', inviteCompanyId || 'global')),
      );
      const communicationSettings = communicationSnap.exists() ? communicationSnap.data() as any : null;
      const token = crypto.randomUUID();
      const tempPassword = createTempPassword();
      const inviteLink = `${window.location.origin}/activate?token=${token}`;

      await addDoc(collection(db, 'staff_invites'), {
        token,
        profile_id: member.id,
        email: member.email,
        full_name: member.full_name || null,
        role: member.role,
        company_id: inviteCompanyId,
        permissions: member.role === 'admin' ? ALL_PERMISSIONS : normalizePermissions(member.role, member.permissions),
        branch: member.branch || null,
        title: member.title || null,
        phone: member.phone || null,
        status: member.status || 'active',
        temp_password: tempPassword,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
        accepted_at: null,
      });

      const sendTasks: Promise<{ channel: 'email' | 'whatsapp' }>[] = [];

      if (communicationSettings?.email?.host) {
        sendTasks.push(axios.post('/api/send-email', {
          to: member.email,
          subject: 'Your Appleberry OS staff invite',
          text: `Hello ${member.full_name || 'there'},\n\nYou have been invited to Appleberry OS.\nActivation link: ${inviteLink}\nTemporary password: ${tempPassword}\n\nPlease use the link to create your own password.`,
          html: `<p>Hello ${member.full_name || 'there'},</p><p>You have been invited to Appleberry OS.</p><p><strong>Activation link:</strong> <a href="${inviteLink}">${inviteLink}</a></p><p><strong>Temporary password:</strong> ${tempPassword}</p><p>Please use the link to create your own password.</p>`,
          companyId: inviteCompanyId,
          settings: communicationSettings.email,
        }, { timeout: 15000 }).then(() => ({ channel: 'email' as const })));
      }

      if (communicationSettings?.whatsapp && member.phone) {
        const normalizedPhone = normalizeWhatsAppPhone(String(member.phone));
        if (normalizedPhone.length < 10) {
          throw new Error('Staff WhatsApp number looks invalid. Use the full mobile number with country code.');
        }

        sendTasks.push(axios.post('/api/send-whatsapp', {
          phone: normalizedPhone,
          message: `Hello ${member.full_name || ''}, you have been invited to Appleberry OS. Activate here: ${inviteLink} Temp password: ${tempPassword}`,
          companyId: inviteCompanyId,
          settings: communicationSettings.whatsapp,
        }, { timeout: 15000 }).then(() => ({ channel: 'whatsapp' as const })));
      }

      if (sendTasks.length === 0) {
        throw new Error('No delivery channel is configured. Add SMTP or WhatsApp settings first.');
      }

      const deliveryResults = await Promise.allSettled(sendTasks);
      const deliveredChannels = deliveryResults
        .filter((result): result is PromiseFulfilledResult<{ channel: 'email' | 'whatsapp' }> => result.status === 'fulfilled')
        .map((result) => result.value.channel);
      const failedMessages = deliveryResults
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map((result) => getRequestErrorMessage(result.reason));

      await updateDoc(doc(db, 'profiles', member.id), {
        invite_sent_at: new Date().toISOString(),
      });

      if (deliveredChannels.length > 0) {
        toast.success(`Invite sent via ${deliveredChannels.join(' and ')}.`);
      }

      if (failedMessages.length > 0) {
        if (!options?.suppressErrorToast) {
          toast.error(failedMessages[0]);
        }
        throw new Error(failedMessages[0]);
      }
    } catch (error: any) {
      if (!options?.suppressErrorToast) {
        toast.error(getRequestErrorMessage(error) || 'Failed to send invite');
      }
      throw error;
    } finally {
      setSendingInviteId(null);
    }
  };

  const handleDelete = async (member: StaffProfile) => {
    const confirmed = window.confirm(`Delete ${member.full_name || 'this staff member'} from staff management?`);
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, 'profiles', member.id));
      toast.success('Staff member removed');
      fetchStaff();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete staff member');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#7b5c3c] font-semibold mb-2">People & Permissions</p>
          <h1 className="display-font text-4xl font-bold text-[#18242b]">Staff Management</h1>
          <p className="text-[#5d6468] mt-2">Manage your internal team directory, roles, branch assignment, and staffing overview.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="appleberry-gradient text-white px-4 py-2.5 rounded-xl font-semibold inline-flex items-center gap-2 hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          Add Staff Member
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Staff" value={stats.total.toString()} icon={Users} tone="blue" />
        <StatCard title="Active Staff" value={stats.active.toString()} icon={UserCheck} tone="green" />
        <StatCard title="Admins" value={stats.admins.toString()} icon={Shield} tone="amber" />
        <StatCard title="Branch Coverage" value={stats.branches.toString()} icon={Building2} tone="purple" />
      </div>

      <div className="section-card rounded-[24px] p-4 space-y-4">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, branch, title, or role"
              className="w-full pl-10 pr-4 py-2.5 bg-white/90 border border-[#dbc8b2] rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div className="text-sm text-[#6d6862]">
            Note: this manages staff profiles for operations and assignment. Secure account provisioning can be added later.
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e4d2bd] text-left text-[#6a5f57] uppercase text-[11px] tracking-wider bg-[#f7efe5]">
                <th className="px-4 py-3">Staff Member</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Permissions</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Activity</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index} className="animate-pulse border-b border-gray-50">
                    <td colSpan={7} className="px-4 py-4"><div className="h-4 bg-gray-100 rounded" /></td>
                  </tr>
                ))
              ) : filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center text-gray-400">
                    <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>No staff profiles found</p>
                  </td>
                </tr>
              ) : (
                filteredStaff.map((member) => (
                  <tr key={member.id} className="border-b border-[#efe2d3] hover:bg-[#fbf4eb] transition-colors">
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-semibold text-[#18242b]">{member.full_name || 'Unnamed staff member'}</p>
                        <p className="text-xs text-[#6d6862]">{member.title || 'General staff role'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={member.role === 'admin' ? 'inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700' : 'inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700'}>
                        {member.role === 'admin' ? 'Admin' : 'Staff'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {member.role === 'admin' ? (
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">Full access</span>
                      ) : (
                        <span className="text-xs text-gray-500">{normalizePermissions(member.role, member.permissions).length} enabled</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-[#4f5a60]">{member.branch || 'Main branch'}</td>
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-[#4f5a60]"><Mail className="w-3.5 h-3.5" /> {member.email || 'No email'}</div>
                        <div className="flex items-center gap-2 text-[#6d6862]"><Phone className="w-3.5 h-3.5" /> {member.phone || 'No phone'}</div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div>
                        <span className={(member.status || 'active') === 'active' ? 'inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700' : 'inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600'}>
                          {(member.status || 'active') === 'active' ? 'Active' : 'Inactive'}
                        </span>
                        <p className="text-xs text-[#6d6862] mt-1">Last active {safeFormatDate(member.last_active_at || member.created_at, 'dd MMM yyyy HH:mm', 'Not tracked')}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(member)}
                          className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-[#33434b] bg-[#f1e4d4] rounded-lg hover:bg-[#e7d5c0]"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          onClick={() => sendInvite(member)}
                          disabled={sendingInviteId === member.id || !member.email}
                          className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-primary bg-primary/10 rounded-lg hover:bg-primary/20 disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5" />
                          {sendingInviteId === member.id ? 'Sending...' : 'Invite'}
                        </button>
                        <button
                          onClick={() => handleDelete(member)}
                          className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="section-card rounded-[24px] p-6">
          <h3 className="text-lg font-semibold text-[#18242b] mb-4">Operational Readiness</h3>
          <div className="space-y-4">
            <ReadinessRow icon={Shield} title="Admin coverage" value={`${stats.admins} admin account${stats.admins === 1 ? '' : 's'}`} hint="At least one admin should manage settings and reports." />
            <ReadinessRow icon={Wrench} title="Technician profiles" value={`${stats.technicians} technician-tagged staff`} hint="Use titles like Technician to make assignment and reporting clearer." />
            <ReadinessRow icon={Building2} title="Branch assignment" value={`${stats.branches} branch${stats.branches === 1 ? '' : 'es'} configured`} hint="Branch data becomes more valuable once multi-branch support is added." />
          </div>
        </div>

        <div className="section-card rounded-[24px] p-6">
          <h3 className="text-lg font-semibold text-[#18242b] mb-4">SaaS Upgrade Ideas</h3>
          <div className="space-y-3 text-sm text-[#4f5a60]">
            <p>1. Add permission groups so cashiers, technicians, and owners see different modules.</p>
            <p>2. Add branch-level staff assignment and working hours.</p>
            <p>3. Add attendance, shifts, and technician productivity metrics.</p>
            <p>4. Add secure staff invites so profiles turn into login accounts without using shared credentials.</p>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="app-panel rounded-[28px] w-full max-w-5xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-[#e6d7c6] flex items-center justify-between bg-[#fbf4eb]">
              <div>
                <h2 className="text-xl font-bold text-[#18242b]">{editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}</h2>
                <p className="text-sm text-[#6d6862]">Manage directory details, role, branch, operational status, and page-by-page permissions.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Full Name" value={formData.full_name} onChange={(value) => setFormData({ ...formData, full_name: value })} required />
                <Field label="Job Title" value={formData.title} onChange={(value) => setFormData({ ...formData, title: value })} placeholder="Technician, Cashier, Manager" icon={Briefcase} />
                <Field label="Email" value={formData.email} onChange={(value) => setFormData({ ...formData, email: value })} placeholder="staff@company.co.za" type="email" icon={Mail} />
                <Field label="Phone" value={formData.phone} onChange={(value) => setFormData({ ...formData, phone: value })} placeholder="+27 ..." type="tel" icon={Phone} />
                <Field label="Branch" value={formData.branch} onChange={(value) => setFormData({ ...formData, branch: value })} placeholder="Main Branch" icon={Building2} />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => handleRoleChange(e.target.value as Role)}
                    className="w-full px-3 py-2.5 border border-[#dbc8b2] rounded-xl bg-white"
                  >
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as StaffStatus })}
                    className="w-full px-3 py-2.5 border border-[#dbc8b2] rounded-xl bg-white"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {formData.role !== 'admin' && (
                <div className="rounded-2xl border border-[#e6d7c6] bg-[#fbf4eb] p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Permission Preset</label>
                      <select
                        value={formData.permissionPreset}
                        onChange={(e) => handlePresetChange(e.target.value as PermissionPreset)}
                        className="w-full px-3 py-2.5 border border-[#dbc8b2] rounded-xl bg-white"
                      >
                        <option value="cashier">Cashier</option>
                        <option value="technician">Technician</option>
                        <option value="manager">Manager</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                    <div className="text-sm text-gray-500">
                      Tick the modules this staff member should be allowed to use.
                    </div>
                  </div>

                  {PERMISSION_GROUPS.map((group) => (
                    <div key={group.title} className="rounded-2xl border border-[#e6d7c6] bg-white/90 p-4">
                      <h3 className="text-sm font-semibold text-[#18242b] mb-3">{group.title}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {group.items.map((permission) => (
                          <label key={permission.key} className="flex items-start gap-3 rounded-xl border border-[#eee1d2] p-3 hover:bg-[#fbf4eb] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.permissions.includes(permission.key)}
                              onChange={() => togglePermission(permission.key)}
                              className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <div>
                              <p className="text-sm font-medium text-[#18242b]">{permission.label}</p>
                              <p className="text-xs text-[#6d6862]">{permission.description}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {formData.role === 'admin' && (
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
                  Admin accounts automatically receive full access. You do not need to tick individual permissions for them.
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-[#e6d7c6]">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 border border-[#d9c4ae] rounded-xl text-gray-600 font-medium hover:bg-[#fbf4eb]">Cancel</button>
                <button type="submit" className="px-5 py-2.5 appleberry-gradient text-white rounded-xl font-semibold hover:opacity-90">{editingStaff ? 'Save Changes' : 'Add Staff Member'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon: Icon, tone }: { title: string; value: string; icon: any; tone: 'blue' | 'green' | 'amber' | 'purple' }) {
  const toneClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-violet-50 text-violet-600',
  };

  return (
    <div className="section-card rounded-[24px] p-5">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${toneClasses[tone]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <p className="text-sm text-[#6d6862]">{title}</p>
      <p className="text-2xl font-bold text-[#18242b]">{value}</p>
    </div>
  );
}

function ReadinessRow({ icon: Icon, title, value, hint }: { icon: any; title: string; value: string; hint: string }) {
  return (
    <div className="flex gap-4 items-start p-4 bg-[#fbf4eb] rounded-xl border border-[#eadaca]">
      <div className="w-10 h-10 rounded-xl bg-white border border-[#eadaca] flex items-center justify-center text-primary">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="font-semibold text-[#18242b]">{title}</p>
        <p className="text-sm text-[#33434b]">{value}</p>
        <p className="text-xs text-[#6d6862] mt-1">{hint}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  icon: Icon,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  icon?: any;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#4f5a60] mb-1">{label}</label>
      <div className="relative">
        {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />}
        <input
          required={required}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full ${Icon ? 'pl-10' : 'pl-3'} pr-3 py-2.5 border border-[#dbc8b2] rounded-xl bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary`}
        />
      </div>
    </div>
  );
}
