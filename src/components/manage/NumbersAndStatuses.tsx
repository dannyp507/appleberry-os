import { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, updateDoc, where, writeBatch } from 'firebase/firestore';
import { toast } from 'sonner';
import { Hash, ListChecks, Save } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useTenant } from '../../lib/tenant';
import { companyQuery, requireCompanyId } from '../../lib/db';
import { formatDocumentNumber, getNextNumbers, setNextNumbers } from '../../lib/numbering';
import { DEFAULT_REPAIR_STATUSES, LEGACY_STATUS_RENAMES } from '../../lib/repairStatus';
import { RepairStatus } from '../../types';

const normalize = (name?: string | null) => (name || '').trim().toLowerCase();

export default function NumbersAndStatuses() {
  const { companyId, profile } = useTenant();
  const canEdit = profile?.role === 'owner' || profile?.role === 'admin';

  const [nextRepair, setNextRepair] = useState('1');
  const [nextInvoice, setNextInvoice] = useState('1');
  const [statuses, setStatuses] = useState<RepairStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingNumbers, setSavingNumbers] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    load();
  }, [companyId]);

  async function load() {
    try {
      const workspaceId = requireCompanyId(companyId);
      const [numbers, statusSnap] = await Promise.all([
        getNextNumbers(workspaceId),
        getDocs(companyQuery('repair_status_options', workspaceId, orderBy('order_index'))),
      ]);
      setNextRepair(String(numbers.repair));
      setNextInvoice(String(numbers.invoice));
      setStatuses(statusSnap.docs.map((statusDoc) => ({ id: statusDoc.id, ...statusDoc.data() } as RepairStatus)));
    } catch (error) {
      console.error('Error loading numbering and statuses:', error);
      toast.error('Failed to load numbering and statuses');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveNumbers() {
    const repair = Number(nextRepair);
    const invoice = Number(nextInvoice);
    if (!Number.isInteger(repair) || repair < 1 || !Number.isInteger(invoice) || invoice < 1) {
      toast.error('Next numbers must be whole numbers of 1 or more.');
      return;
    }
    setSavingNumbers(true);
    try {
      await setNextNumbers(requireCompanyId(companyId), { repair, invoice });
      toast.success(`Next ticket ${formatDocumentNumber('repair', repair)}, next invoice ${formatDocumentNumber('invoice', invoice)}`);
    } catch (error) {
      console.error('Error saving numbering:', error);
      toast.error('Failed to save numbering');
    } finally {
      setSavingNumbers(false);
    }
  }

  // Renames the earlier Appleberry defaults to Cellstore's names and adds the missing ones.
  // Renaming keeps each status id, so existing tickets keep their status. If the Cellstore
  // name already exists (e.g. from a Cellstore import), tickets are moved onto it instead.
  async function handleSwitchToCellstore() {
    if (!window.confirm('Rename repair statuses to the Cellstore names (New, Assigned, Estimate, Waiting on Customer, Finished, Invoiced, Cancelled, Closed)? Existing tickets keep their place.')) {
      return;
    }
    setSwitching(true);
    try {
      const workspaceId = requireCompanyId(companyId);
      let current = [...statuses];
      const byName = (name: string) => current.find((status) => normalize(status.name) === normalize(name));

      for (const status of statuses) {
        const target = LEGACY_STATUS_RENAMES[normalize(status.name)];
        if (!target) continue;

        const existingTarget = byName(target);
        if (existingTarget && existingTarget.id !== status.id) {
          const repairsSnap = await getDocs(companyQuery('repairs', workspaceId, where('status_id', '==', status.id)));
          for (let i = 0; i < repairsSnap.docs.length; i += 400) {
            const batch = writeBatch(db);
            repairsSnap.docs.slice(i, i + 400).forEach((repairDoc) => {
              batch.update(repairDoc.ref, { status_id: existingTarget.id, updated_at: new Date().toISOString() });
            });
            await batch.commit();
          }
          await deleteDoc(doc(db, 'repair_status_options', status.id));
          current = current.filter((item) => item.id !== status.id);
        } else {
          await updateDoc(doc(db, 'repair_status_options', status.id), { name: target });
          current = current.map((item) => (item.id === status.id ? { ...item, name: target } : item));
        }
      }

      for (const preset of DEFAULT_REPAIR_STATUSES) {
        const existing = byName(preset.name);
        if (existing) {
          await updateDoc(doc(db, 'repair_status_options', existing.id), {
            name: preset.name,
            color: preset.color,
            order_index: preset.order_index,
          });
        } else {
          await addDoc(collection(db, 'repair_status_options'), {
            ...preset,
            company_id: workspaceId,
            created_at: new Date().toISOString(),
          });
        }
      }

      toast.success('Repair statuses now match Cellstore');
      await load();
    } catch (error) {
      console.error('Error switching statuses:', error);
      toast.error('Failed to update statuses');
    } finally {
      setSwitching(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const matchesCellstore =
    DEFAULT_REPAIR_STATUSES.every((preset) => statuses.some((status) => normalize(status.name) === normalize(preset.name))) &&
    !statuses.some((status) => LEGACY_STATUS_RENAMES[normalize(status.name)]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Hash className="w-6 h-6 text-primary" />
          Ticket and Invoice Numbers
        </h2>
        <p className="text-gray-500 mt-1">
          New repair tickets are numbered t1, t2, t3… and invoices s1, s2, s3…. To carry on from Cellstore, set these to one more than your last Cellstore ticket and invoice.
        </p>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Next Repair Number</span>
            <div className="flex items-center rounded-lg border border-gray-200 focus-within:ring-2 focus-within:ring-primary/20">
              <span className="pl-4 text-gray-400 font-semibold">t</span>
              <input
                type="number"
                min={1}
                step={1}
                disabled={!canEdit}
                className="w-full px-2 py-2 rounded-lg outline-none disabled:bg-gray-50"
                value={nextRepair}
                onChange={(e) => setNextRepair(e.target.value)}
              />
            </div>
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Next Invoice Number</span>
            <div className="flex items-center rounded-lg border border-gray-200 focus-within:ring-2 focus-within:ring-primary/20">
              <span className="pl-4 text-gray-400 font-semibold">s</span>
              <input
                type="number"
                min={1}
                step={1}
                disabled={!canEdit}
                className="w-full px-2 py-2 rounded-lg outline-none disabled:bg-gray-50"
                value={nextInvoice}
                onChange={(e) => setNextInvoice(e.target.value)}
              />
            </div>
          </label>
        </div>

        {canEdit ? (
          <button
            onClick={handleSaveNumbers}
            disabled={savingNumbers}
            className="mt-6 flex items-center gap-2 bg-primary text-white px-6 py-2 rounded-lg font-bold hover:opacity-90 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {savingNumbers ? 'Saving...' : 'Save Numbers'}
          </button>
        ) : (
          <p className="mt-4 text-sm text-gray-500">Only an owner or admin can change numbering.</p>
        )}
      </div>

      <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ListChecks className="w-6 h-6 text-primary" />
          Repair Statuses
        </h2>
        <p className="text-gray-500 mt-1">
          Cellstore uses New, Assigned, Estimate, Waiting on Customer, Finished, Invoiced, Cancelled and Closed. Tickets move to Invoiced when they are paid at the Cash Register.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {statuses.map((status) => (
            <span
              key={status.id}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1 text-sm font-medium text-gray-700"
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color }} />
              {status.name}
            </span>
          ))}
          {statuses.length === 0 && <p className="text-sm text-gray-500">No statuses yet.</p>}
        </div>

        {matchesCellstore ? (
          <p className="mt-6 text-sm font-semibold text-green-700">Statuses match Cellstore.</p>
        ) : canEdit ? (
          <button
            onClick={handleSwitchToCellstore}
            disabled={switching}
            className="mt-6 flex items-center gap-2 bg-primary text-white px-6 py-2 rounded-lg font-bold hover:opacity-90 transition-all disabled:opacity-50"
          >
            {switching ? 'Updating...' : 'Use Cellstore Status Names'}
          </button>
        ) : (
          <p className="mt-6 text-sm text-gray-500">Ask an owner or admin to switch statuses to the Cellstore names.</p>
        )}
      </div>
    </div>
  );
}
