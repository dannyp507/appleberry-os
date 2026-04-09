import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { Plus, Trash2, Save, X, AlertCircle } from 'lucide-react';
import { RepairProblem } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { toast } from 'sonner';
import { useTenant } from '../../lib/tenant';
import { filterByCompany, withCompanyId } from '../../lib/companyData';

export default function ManageProblems() {
  const { companyId } = useTenant();
  const [problems, setProblems] = useState<RepairProblem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');

  useEffect(() => {
    fetchProblems();
  }, [companyId]);

  async function fetchProblems() {
    try {
      const q = query(collection(db, 'repair_problems'), orderBy('name'));
      const snapshot = await getDocs(q);
      setProblems(filterByCompany(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RepairProblem)), companyId));
    } catch (error) {
      console.error('Error fetching problems:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!newName) return;
    try {
      const price = parseFloat(newPrice) || 0;
      const docRef = await addDoc(collection(db, 'repair_problems'), {
        ...withCompanyId(companyId, {}),
        name: newName,
        default_price: price,
        created_at: new Date().toISOString()
      });
      setProblems([...problems, { id: docRef.id, company_id: companyId || null, name: newName, default_price: price, created_at: new Date().toISOString() }].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName('');
      setNewPrice('');
      setIsAdding(false);
      toast.success('Problem added successfully');
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  async function handleUpdate(id: string, updates: Partial<RepairProblem>) {
    try {
      await updateDoc(doc(db, 'repair_problems', id), updates);
      setProblems(problems.map(p => p.id === id ? { ...p, ...updates } : p));
      toast.success('Problem updated');
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this problem?')) return;
    try {
      await deleteDoc(doc(db, 'repair_problems', id));
      setProblems(problems.filter(p => p.id !== id));
      toast.success('Problem deleted');
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading problems...</div>;
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Manage Repair Problems</h2>
          <p className="text-sm text-gray-500">Define common issues and their standard service prices.</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="bg-primary text-white px-4 py-2 rounded-lg font-bold hover:opacity-90 transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Problem
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-600 font-bold">
            <tr>
              <th className="px-6 py-4">Problem Name</th>
              <th className="px-6 py-4">Standard Price</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isAdding && (
              <tr className="bg-primary/5 animate-in fade-in slide-in-from-top-1">
                <td className="px-6 py-4">
                  <input
                    type="text"
                    placeholder="e.g. Software Update"
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    autoFocus
                  />
                </td>
                <td className="px-6 py-4">
                  <div className="relative w-32">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">R</span>
                    <input
                      type="number"
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                      value={newPrice}
                      onChange={e => setNewPrice(e.target.value)}
                    />
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setIsAdding(false)} className="p-2 text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                    <button onClick={handleAdd} className="p-2 text-green-600 hover:bg-green-50 rounded-lg">
                      <Save className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )}
            {problems.length === 0 && !isAdding ? (
              <tr>
                <td colSpan={3} className="px-6 py-12 text-center text-gray-400 italic">
                  No problems defined yet. Click 'Add Problem' to start.
                </td>
              </tr>
            ) : (
              problems.map(problem => (
                <tr key={problem.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-4">
                    <input
                      type="text"
                      className="w-full bg-transparent border-b border-transparent hover:border-gray-200 focus:border-primary focus:outline-none py-1 transition-all font-medium text-gray-900"
                      value={problem.name}
                      onChange={e => handleUpdate(problem.id, { name: e.target.value })}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="relative w-32">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">R</span>
                      <input
                        type="number"
                        className="w-full pl-7 pr-3 py-1 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-primary focus:outline-none transition-all font-bold text-primary"
                        value={problem.default_price || ''}
                        onChange={e => handleUpdate(problem.id, { default_price: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDelete(problem.id)}
                      className="p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-500">
        <AlertCircle className="w-3 h-3" />
        Setting a price here will automatically add it to the repair ticket when the problem is selected.
      </div>
    </div>
  );
}
