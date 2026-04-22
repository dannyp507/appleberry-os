import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, runTransaction, where, writeBatch } from 'firebase/firestore';
import { AlertTriangle, CheckCircle2, ClipboardList, FileSpreadsheet, Package, Search, Upload, X } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import { auth, db } from '../lib/firebase';
import { formatCurrency, safeFormatDate } from '../lib/utils';
import { toast } from 'sonner';
import { useTenant } from '../lib/tenant';
import { withCompanyId } from '../lib/companyData';
import { companyQuery, requireCompanyId } from '../lib/db';

type StockTakeEntry = {
  id: string;
  company_id?: string | null;
  sku: string | null;
  reference: string | null;
  manufacturer: string | null;
  product_name: string;
  category: string | null;
  current_stock: number;
  counted: number;
  difference: number;
  cost: number;
  total: number;
  notes: string | null;
  completed_at: string | null;
  session_key: string;
  session_name: string;
  product_id?: string | null;
  import_batch?: string | null;
  adjustment_processed_at?: string | null;
  adjustment_processed_by?: string | null;
  adjustment_status?: 'posted' | 'skipped_unmatched' | 'reversed' | null;
  posted_stock?: number | null;
  approved_at?: string | null;
  approved_by?: string | null;
  reversal_processed_at?: string | null;
  reversal_processed_by?: string | null;
  reversed_stock?: number | null;
};

type StockTakeSession = {
  sessionKey: string;
  sessionName: string;
  completedAt: string | null;
  lines: number;
  netDifference: number;
  valueImpact: number;
  matchedProducts: number;
  unmatchedProducts: number;
  postedAt: string | null;
  postedLines: number;
  approvedAt: string | null;
  approvedLines: number;
  reversedAt: string | null;
  reversedLines: number;
};

const parseNumber = (value: unknown) => {
  const raw = String(value ?? '').trim().replace(/,/g, '');
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const parseDate = (value: unknown) => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

export default function StockTake() {
  const { company } = useTenant();
  const companyId = company?.id || null;
  const [entries, setEntries] = useState<StockTakeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSessionKey, setSelectedSessionKey] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importMode, setImportMode] = useState<'dry' | 'live'>('dry');
  const [previewRows, setPreviewRows] = useState<StockTakeEntry[]>([]);
  const [importing, setImporting] = useState(false);
  const [posting, setPosting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetchStockTakes();
    fetchCurrentUserRole();
  }, [companyId]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv'],
    },
    multiple: false,
  } as any);

  async function fetchStockTakes() {
    setLoading(true);
    try {
      const snapshot = await getDocs(companyQuery('stock_takes', companyId, orderBy('completed_at', 'desc')));
      const data = snapshot.docs.map((entryDoc) => {
        const payload = entryDoc.data() as Partial<StockTakeEntry>;
        return {
          ...payload,
          id: entryDoc.id,
        } as StockTakeEntry;
      });
      setEntries(data);
      setSelectedSessionKey((current) => current || data[0]?.session_key || null);
    } catch (error: any) {
      console.error('Error loading stock take entries:', error);
      toast.error(error.message || 'Failed to load stock take history');
    } finally {
      setLoading(false);
    }
  }

  async function fetchCurrentUserRole() {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        setIsAdmin(false);
        return;
      }

      const profileSnapshot = await getDoc(doc(db, 'profiles', uid));
      if (profileSnapshot.exists()) {
        setIsAdmin(['admin', 'owner'].includes(profileSnapshot.data().role));
        return;
      }

      const fallbackQueries = [
        getDocs(query(collection(db, 'profiles'), where('auth_uid', '==', uid), limit(1)))
      ];

      for (const lookup of fallbackQueries) {
        const snapshot = await lookup;
        if (!snapshot.empty) {
          setIsAdmin(['admin', 'owner'].includes(snapshot.docs[0].data().role));
          return;
        }
      }

      setIsAdmin(false);
    } catch (error) {
      console.error('Error loading current user role:', error);
      setIsAdmin(false);
    }
  }

  const sessions = useMemo<StockTakeSession[]>(() => {
    const grouped = new Map<string, StockTakeSession>();
    entries.forEach((entry) => {
      const existing = grouped.get(entry.session_key) || {
        sessionKey: entry.session_key,
        sessionName: entry.session_name,
        completedAt: entry.completed_at,
        lines: 0,
        netDifference: 0,
        valueImpact: 0,
        matchedProducts: 0,
        unmatchedProducts: 0,
        postedAt: null,
        postedLines: 0,
        approvedAt: null,
        approvedLines: 0,
        reversedAt: null,
        reversedLines: 0,
      };
      existing.lines += 1;
      existing.netDifference += Number(entry.difference || 0);
      existing.valueImpact += Number(entry.total || 0);
      if (entry.product_id) existing.matchedProducts += 1;
      else existing.unmatchedProducts += 1;
      if (entry.adjustment_processed_at) {
        existing.postedLines += 1;
        if (!existing.postedAt || entry.adjustment_processed_at > existing.postedAt) {
          existing.postedAt = entry.adjustment_processed_at;
        }
      }
      if (entry.approved_at) {
        existing.approvedLines += 1;
        if (!existing.approvedAt || entry.approved_at > existing.approvedAt) {
          existing.approvedAt = entry.approved_at;
        }
      }
      if (entry.reversal_processed_at) {
        existing.reversedLines += 1;
        if (!existing.reversedAt || entry.reversal_processed_at > existing.reversedAt) {
          existing.reversedAt = entry.reversal_processed_at;
        }
      }
      if (!existing.completedAt && entry.completed_at) existing.completedAt = entry.completed_at;
      grouped.set(entry.session_key, existing);
    });
    return Array.from(grouped.values()).sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));
  }, [entries]);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.sessionKey === selectedSessionKey) || null,
    [sessions, selectedSessionKey]
  );

  const sessionEntries = useMemo(() => {
    const baseRows = selectedSessionKey ? entries.filter((entry) => entry.session_key === selectedSessionKey) : [];
    const queryText = search.trim().toLowerCase();
    if (!queryText) return baseRows;
    return baseRows.filter((entry) =>
      [entry.product_name, entry.sku, entry.category, entry.reference, entry.notes]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(queryText))
    );
  }, [entries, selectedSessionKey, search]);

  const stats = useMemo(() => {
    const totalLines = entries.length;
    const varianceLines = entries.filter((entry) => entry.difference !== 0).length;
    const totalVariance = entries.reduce((sum, entry) => sum + Number(entry.difference || 0), 0);
    const totalValueImpact = entries.reduce((sum, entry) => sum + Number(entry.total || 0), 0);
    return { totalLines, varianceLines, totalVariance, totalValueImpact };
  }, [entries]);

  async function approveSession() {
    if (!selectedSessionKey || !selectedSession || posting) return;

    const sessionRows = entries.filter((entry) => entry.session_key === selectedSessionKey);
    if (sessionRows.length === 0) {
      toast.error('No stock take lines found for this session');
      return;
    }

    if (selectedSession.approvedAt) {
      toast.info('This stock take session has already been approved');
      return;
    }

    setPosting(true);
    try {
      const now = new Date().toISOString();
      const currentUserId = auth.currentUser?.uid || null;
      let batch = writeBatch(db);
      let writes = 0;

      const commitBatchIfNeeded = async (force = false) => {
        if (writes === 0) return;
        if (force || writes >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          writes = 0;
        }
      };

      for (const row of sessionRows) {
        batch.update(doc(db, 'stock_takes', row.id), {
          approved_at: now,
          approved_by: currentUserId,
        });
        writes += 1;
        await commitBatchIfNeeded();
      }

      await commitBatchIfNeeded(true);
      toast.success(`Approved ${sessionRows.length} stock take lines for posting`);
      await fetchStockTakes();
    } catch (error: any) {
      console.error('Error approving stock take session:', error);
      toast.error(error.message || 'Failed to approve stock take session');
    } finally {
      setPosting(false);
    }
  }

  async function postAdjustments() {
    if (!selectedSessionKey || posting) return;

    const sessionRows = entries.filter((entry) => entry.session_key === selectedSessionKey);
    if (sessionRows.length === 0) {
      toast.error('No stock take lines found for this session');
      return;
    }

    if (sessionRows.every((entry) => entry.adjustment_processed_at)) {
      toast.info('This stock take session has already been posted');
      return;
    }

    if (sessionRows.some((entry) => entry.reversal_processed_at)) {
      toast.error('This stock take session was already reversed. Import a fresh count to post again.');
      return;
    }

    if (!sessionRows.every((entry) => entry.approved_at)) {
      toast.error('Approve this stock take session before posting adjustments');
      return;
    }

    const confirmed = window.confirm(
      `Post stock adjustments for "${selectedSession?.sessionName || 'this session'}"? This will update live product stock counts for matched items.`
    );
    if (!confirmed) return;

    const duplicateProducts = new Set<string>();
    const productTargets = new Map<string, { counted: number; rowIds: string[] }>();

    for (const row of sessionRows.filter((entry) => entry.product_id)) {
      const productId = row.product_id as string;
      const existing = productTargets.get(productId);
      if (!existing) {
        productTargets.set(productId, { counted: row.counted, rowIds: [row.id] });
        continue;
      }

      if (existing.counted !== row.counted) {
        duplicateProducts.add(productId);
      }
      existing.rowIds.push(row.id);
    }

    if (duplicateProducts.size > 0) {
      toast.error('This session contains duplicate matched products with conflicting counts. Split or clean the session before posting.');
      return;
    }

    setPosting(true);

    try {
      const now = new Date().toISOString();
      const currentUserId = auth.currentUser?.uid || null;
      const workspaceId = requireCompanyId(companyId);

      for (const [productId, target] of productTargets.entries()) {
        const relatedRows = sessionRows.filter((row) => target.rowIds.includes(row.id));

        await runTransaction(db, async (transaction) => {
          const productRef = doc(db, 'products', productId);
          const productSnap = await transaction.get(productRef);

          if (!productSnap.exists()) {
            throw new Error(`Matched product ${productId} no longer exists.`);
          }

          const productData = productSnap.data() as any;
          if (productData.company_id !== workspaceId) {
            throw new Error('A matched product does not belong to this company workspace.');
          }

          const previousStock = Number(productData.stock || 0);
          const adjustmentQuantity = target.counted - previousStock;

          transaction.update(productRef, {
            stock: target.counted,
            updated_at: now,
            last_stock_take_at: now,
            last_stock_take_session_key: selectedSessionKey,
            last_stock_take_reference: selectedSession?.sessionName || null,
          });

          transaction.set(doc(collection(db, 'inventory_movements')), withCompanyId(workspaceId, {
            type: 'stock_take_adjustment',
            product_id: productId,
            product_name: productData.name || relatedRows[0]?.product_name || 'Product',
            quantity: adjustmentQuantity,
            previous_stock: previousStock,
            new_stock: target.counted,
            reference_id: selectedSessionKey,
            reference_type: 'stock_take',
            created_at: now,
            created_by: currentUserId,
          }));

          for (const row of relatedRows) {
            transaction.update(doc(db, 'stock_takes', row.id), {
              adjustment_processed_at: now,
              adjustment_processed_by: currentUserId,
              adjustment_status: 'posted',
              posted_stock: row.counted,
              reversal_processed_at: null,
              reversal_processed_by: null,
              reversed_stock: null,
            });
          }
        });
      }

      const unmatchedRows = sessionRows.filter((row) => !row.product_id);
      if (unmatchedRows.length > 0) {
        let batch = writeBatch(db);
        let writes = 0;

        for (const row of unmatchedRows) {
          batch.update(doc(db, 'stock_takes', row.id), {
            adjustment_processed_at: now,
            adjustment_processed_by: currentUserId,
            adjustment_status: 'skipped_unmatched',
            posted_stock: null,
            reversal_processed_at: null,
            reversal_processed_by: null,
            reversed_stock: null,
          });
          writes += 1;

          if (writes >= 400) {
            await batch.commit();
            batch = writeBatch(db);
            writes = 0;
          }
        }

        if (writes > 0) {
          await batch.commit();
        }
      }

      const unmatchedCount = sessionRows.filter((entry) => !entry.product_id).length;
      toast.success(
        unmatchedCount > 0
          ? `Posted ${productTargets.size} stock adjustments. ${unmatchedCount} unmatched lines were kept as audit only.`
          : `Posted ${productTargets.size} stock adjustments successfully.`
      );
      await fetchStockTakes();
    } catch (error: any) {
      console.error('Error posting stock adjustments:', error);
      toast.error(error.message || 'Failed to post stock adjustments');
    } finally {
      setPosting(false);
    }
  }

  async function reverseAdjustments() {
    if (!selectedSessionKey || !selectedSession || posting) return;

    const sessionRows = entries.filter((entry) => entry.session_key === selectedSessionKey);
    if (sessionRows.length === 0) {
      toast.error('No stock take lines found for this session');
      return;
    }

    if (!sessionRows.some((entry) => entry.adjustment_processed_at)) {
      toast.error('This stock take session has not been posted yet');
      return;
    }

    if (sessionRows.some((entry) => entry.reversal_processed_at)) {
      toast.info('This stock take session has already been reversed');
      return;
    }

    const confirmed = window.confirm(
      `Reverse stock adjustments for "${selectedSession.sessionName}"? This will restore matched products to their original pre-post stock values from this stock take session.`
    );
    if (!confirmed) return;

    const productTargets = new Map<string, { originalStock: number; rowIds: string[] }>();
    const conflictingOriginals = new Set<string>();

    for (const row of sessionRows.filter((entry) => entry.product_id && entry.adjustment_status === 'posted')) {
      const productId = row.product_id as string;
      const existing = productTargets.get(productId);
      if (!existing) {
        productTargets.set(productId, { originalStock: row.current_stock, rowIds: [row.id] });
        continue;
      }

      if (existing.originalStock !== row.current_stock) {
        conflictingOriginals.add(productId);
      }
      existing.rowIds.push(row.id);
    }

    if (conflictingOriginals.size > 0) {
      toast.error('This session has conflicting original stock values for the same product and cannot be safely reversed.');
      return;
    }

    setPosting(true);
    try {
      const now = new Date().toISOString();
      const currentUserId = auth.currentUser?.uid || null;
      const workspaceId = requireCompanyId(companyId);

      for (const [productId, target] of productTargets.entries()) {
        const relatedRows = sessionRows.filter((row) => target.rowIds.includes(row.id));

        await runTransaction(db, async (transaction) => {
          const productRef = doc(db, 'products', productId);
          const productSnap = await transaction.get(productRef);

          if (!productSnap.exists()) {
            throw new Error(`Matched product ${productId} no longer exists.`);
          }

          const productData = productSnap.data() as any;
          if (productData.company_id !== workspaceId) {
            throw new Error('A matched product does not belong to this company workspace.');
          }

          const previousStock = Number(productData.stock || 0);
          const reversalQuantity = target.originalStock - previousStock;

          transaction.update(productRef, {
            stock: target.originalStock,
            updated_at: now,
            stock_take_reversed_at: now,
            stock_take_reversed_session_key: selectedSessionKey,
            stock_take_reversed_reference: selectedSession.sessionName,
          });

          transaction.set(doc(collection(db, 'inventory_movements')), withCompanyId(workspaceId, {
            type: 'stock_take_reversal',
            product_id: productId,
            product_name: productData.name || relatedRows[0]?.product_name || 'Product',
            quantity: reversalQuantity,
            previous_stock: previousStock,
            new_stock: target.originalStock,
            reference_id: selectedSessionKey,
            reference_type: 'stock_take',
            created_at: now,
            created_by: currentUserId,
          }));

          for (const row of relatedRows) {
            transaction.update(doc(db, 'stock_takes', row.id), {
              reversal_processed_at: now,
              reversal_processed_by: currentUserId,
              adjustment_status: 'reversed',
              reversed_stock: row.current_stock,
            });
          }
        });
      }

      const unmatchedRows = sessionRows.filter((row) => !row.product_id || row.adjustment_status !== 'posted');
      if (unmatchedRows.length > 0) {
        let batch = writeBatch(db);
        let writes = 0;

        for (const row of unmatchedRows) {
          batch.update(doc(db, 'stock_takes', row.id), {
            reversal_processed_at: now,
            reversal_processed_by: currentUserId,
            adjustment_status: row.adjustment_status,
            reversed_stock: null,
          });
          writes += 1;

          if (writes >= 400) {
            await batch.commit();
            batch = writeBatch(db);
            writes = 0;
          }
        }

        if (writes > 0) {
          await batch.commit();
        }
      }
      toast.success(`Reversed ${productTargets.size} stock adjustments successfully.`);
      await fetchStockTakes();
    } catch (error: any) {
      console.error('Error reversing stock adjustments:', error);
      toast.error(error.message || 'Failed to reverse stock adjustments');
    } finally {
      setPosting(false);
    }
  }

  const preparePreview = async () => {
    if (!selectedFile) return;

    setImporting(true);
    try {
      Papa.parse(selectedFile, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const rows = results.data as Record<string, string>[];
          const productsSnapshot = await getDocs(companyQuery('products', companyId));
          const productMap = new Map<string, { id: string; name?: string }>();

          productsSnapshot.docs.forEach((productDoc) => {
            const product = productDoc.data() as any;
            [product.sku, product.external_id, product.barcode]
              .filter(Boolean)
              .forEach((key) => productMap.set(String(key).trim().toLowerCase(), { id: productDoc.id, name: product.name }));
          });

          const prepared = rows
            .map((row, index) => {
              const sku = String(row['SKU'] || '').trim() || null;
              const completedAt = parseDate(row['Completed Date']);
              const reference = String(row['Reference'] || '').trim() || 'Imported Stock Take';
              const sessionKey = `${reference}__${completedAt || 'unknown'}`;
              const matchedProduct = sku ? productMap.get(sku.toLowerCase()) : null;
              return {
                id: `preview-${index}`,
                sku,
                reference,
                manufacturer: String(row['Manufacturer'] || '').trim() || null,
                product_name: String(row['Product Name'] || '').trim() || 'Unknown Product',
                category: String(row['Category'] || '').trim() || null,
                current_stock: parseNumber(row['Current Stock']),
                counted: parseNumber(row['Counted']),
                difference: parseNumber(row['Difference']),
                cost: parseNumber(row['Cost']),
                total: parseNumber(row['Total']),
                notes: String(row['Notes'] || '').trim() || null,
                completed_at: completedAt,
                session_key: sessionKey,
                session_name: reference,
                product_id: matchedProduct?.id || null,
                import_batch: selectedFile.name,
              } satisfies StockTakeEntry;
            })
            .filter((row) => row.product_name);

          setPreviewRows(prepared.slice(0, 50));

          if (importMode === 'live') {
            let batch = writeBatch(db);
            let count = 0;

            for (const row of prepared) {
              const ref = doc(collection(db, 'stock_takes'));
              const { id: _previewId, ...rowData } = row;
              batch.set(ref, {
                ...withCompanyId(requireCompanyId(companyId), {}),
                ...rowData,
                imported: true,
                created_at: new Date().toISOString(),
              });
              count += 1;
              if (count === 400) {
                await batch.commit();
                batch = writeBatch(db);
                count = 0;
              }
            }

            if (count > 0) {
              await batch.commit();
            }

            toast.success(`Imported ${prepared.length} stock take rows`);
            setIsImportOpen(false);
            setSelectedFile(null);
            setPreviewRows([]);
            await fetchStockTakes();
          } else {
            toast.success(`Dry run ready: ${prepared.length} stock take rows detected`);
          }

          setImporting(false);
        },
        error: (error) => {
          toast.error(error.message || 'Failed to parse stock take CSV');
          setImporting(false);
        },
      });
    } catch (error: any) {
      toast.error(error.message || 'Failed to prepare stock take import');
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#7b5c3c] font-semibold mb-2">Audit & Variance</p>
          <h1 className="display-font text-4xl font-bold text-[#18242b]">Stock Take</h1>
          <p className="text-[#5d6468] mt-2">Import stock count sessions, review variances, and track inventory adjustments over time.</p>
        </div>
        <button
          onClick={() => setIsImportOpen(true)}
          className="appleberry-gradient text-white px-4 py-2.5 rounded-xl font-semibold inline-flex items-center gap-2 hover:opacity-90"
        >
          <Upload className="w-4 h-4" />
          Import Stock Take CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Imported Lines" value={stats.totalLines.toString()} icon={ClipboardList} tone="blue" />
        <StatCard title="Variance Lines" value={stats.varianceLines.toString()} icon={AlertTriangle} tone="amber" />
        <StatCard title="Net Unit Variance" value={stats.totalVariance.toString()} icon={Package} tone="purple" />
        <StatCard title="Value Impact" value={formatCurrency(stats.totalValueImpact)} icon={FileSpreadsheet} tone="green" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-6">
        <div className="section-card rounded-[24px] overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Stock Take Sessions</h2>
            <p className="text-sm text-gray-500">Grouped by reference and completed date.</p>
          </div>
          <div className="max-h-[620px] overflow-y-auto divide-y divide-gray-100">
            {loading ? (
              <div className="p-6 text-gray-400">Loading sessions...</div>
            ) : sessions.length === 0 ? (
              <div className="p-6 text-gray-400">No stock take imports yet.</div>
            ) : (
              sessions.map((session) => (
                <button
                  key={session.sessionKey}
                  onClick={() => setSelectedSessionKey(session.sessionKey)}
                  className={`w-full text-left px-5 py-4 transition-colors ${selectedSessionKey === session.sessionKey ? 'bg-primary/5' : 'hover:bg-gray-50'}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-gray-900">{session.sessionName}</p>
                      <p className="text-xs text-gray-500">{safeFormatDate(session.completedAt, 'dd MMM yyyy HH:mm', 'Unknown date')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {session.postedAt && (
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700">
                          Posted
                        </span>
                      )}
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${session.netDifference === 0 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                        {session.netDifference === 0 ? 'Balanced' : `${session.netDifference > 0 ? '+' : ''}${session.netDifference}`}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-gray-500">
                    <div><span className="font-semibold text-gray-900">{session.lines}</span> lines</div>
                    <div><span className="font-semibold text-gray-900">{session.matchedProducts}</span> matched</div>
                    <div><span className="font-semibold text-gray-900">{formatCurrency(session.valueImpact)}</span></div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="section-card rounded-[24px] overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Session Lines</h2>
              <p className="text-sm text-gray-500">Review counted stock, differences, and cost impact line by line.</p>
              {selectedSession && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 font-medium">
                    {selectedSession.lines} lines
                  </span>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-green-50 text-green-700 font-medium">
                    {selectedSession.matchedProducts} matched
                  </span>
                  {selectedSession.unmatchedProducts > 0 && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-medium">
                      {selectedSession.unmatchedProducts} unmatched
                    </span>
                  )}
                  {selectedSession.approvedAt && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-medium">
                      Approved {safeFormatDate(selectedSession.approvedAt, 'dd MMM yyyy HH:mm')}
                    </span>
                  )}
                  {selectedSession.reversedAt && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 font-medium">
                      Reversed {safeFormatDate(selectedSession.reversedAt, 'dd MMM yyyy HH:mm')}
                    </span>
                  )}
                  {selectedSession.postedAt && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-medium">
                      Posted {safeFormatDate(selectedSession.postedAt, 'dd MMM yyyy HH:mm')}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex w-full lg:w-auto flex-col sm:flex-row gap-3 lg:items-center">
              <div className="relative w-full lg:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search product, SKU, category..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              {isAdmin && (
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={approveSession}
                    disabled={!selectedSession || posting || Boolean(selectedSession?.approvedAt)}
                    className="px-4 py-2.5 rounded-xl font-semibold bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {posting && !selectedSession?.approvedAt ? 'Working...' : selectedSession?.approvedAt ? 'Approved' : 'Approve Session'}
                  </button>
                  <button
                    onClick={postAdjustments}
                    disabled={!selectedSession || posting || !Boolean(selectedSession?.approvedAt) || Boolean(selectedSession?.postedAt) || Boolean(selectedSession?.reversedAt)}
                    className="px-4 py-2.5 rounded-xl font-semibold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {posting && Boolean(selectedSession?.approvedAt) ? 'Posting...' : selectedSession?.postedAt ? 'Already Posted' : 'Post Adjustments'}
                  </button>
                  <button
                    onClick={reverseAdjustments}
                    disabled={!selectedSession || posting || !Boolean(selectedSession?.postedAt) || Boolean(selectedSession?.reversedAt)}
                    className="px-4 py-2.5 rounded-xl font-semibold bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {posting && Boolean(selectedSession?.postedAt) ? 'Reversing...' : selectedSession?.reversedAt ? 'Already Reversed' : 'Reverse Posting'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto max-h-[620px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white border-b border-gray-100">
                <tr className="text-left text-gray-500 uppercase text-[11px] tracking-wider">
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3 text-right">System</th>
                  <th className="px-4 py-3 text-right">Counted</th>
                  <th className="px-4 py-3 text-right">Difference</th>
                  <th className="px-4 py-3 text-right">Impact</th>
                  <th className="px-4 py-3">Approval</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {sessionEntries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-400">Select a session or import a stock take file to begin.</td>
                  </tr>
                ) : (
                  sessionEntries.map((entry) => (
                    <tr key={entry.id} className="border-b border-gray-50 hover:bg-gray-50/70">
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{entry.product_name}</p>
                          <p className="text-xs text-gray-500">{entry.category || 'No category'}{entry.notes ? ` • ${entry.notes}` : ''}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-gray-600">{entry.sku || 'No SKU'}</td>
                      <td className="px-4 py-4 text-right text-gray-600">{entry.current_stock}</td>
                      <td className="px-4 py-4 text-right text-gray-600">{entry.counted}</td>
                      <td className={`px-4 py-4 text-right font-semibold ${entry.difference === 0 ? 'text-green-600' : entry.difference > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {entry.difference > 0 ? '+' : ''}{entry.difference}
                      </td>
                      <td className={`px-4 py-4 text-right font-semibold ${entry.total >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                        {formatCurrency(entry.total)}
                      </td>
                      <td className="px-4 py-4">
                        {entry.approved_at ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-full">
                            Approved
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {entry.adjustment_status === 'reversed' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-1 rounded-full">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Reversed
                          </span>
                        ) : entry.adjustment_status === 'posted' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 px-2 py-1 rounded-full">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Posted
                          </span>
                        ) : entry.adjustment_status === 'skipped_unmatched' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Unmatched
                          </span>
                        ) : entry.product_id ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded-full">
                            Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                            Audit only
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isImportOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="app-panel rounded-[28px] w-full max-w-3xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-[#e6d7c6] flex items-center justify-between bg-[#fbf4eb]">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Import Stock Take CSV</h2>
                <p className="text-sm text-gray-500">Bring in CellStore stock count sessions without touching current inventory levels.</p>
              </div>
              <button onClick={() => { setIsImportOpen(false); setSelectedFile(null); setPreviewRows([]); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="flex bg-gray-100 p-1 rounded-lg w-fit">
                <button
                  onClick={() => setImportMode('dry')}
                  className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${importMode === 'dry' ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}
                >
                  Dry Run
                </button>
                <button
                  onClick={() => setImportMode('live')}
                  className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${importMode === 'live' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}
                >
                  Live Import
                </button>
              </div>

              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${isDragActive ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-primary/50 hover:bg-gray-50'}`}
              >
                <input {...getInputProps()} />
                <Upload className="w-8 h-8 mx-auto text-gray-400 mb-3" />
                <p className="font-semibold text-gray-900">{selectedFile ? selectedFile.name : 'Drop your stock take CSV here'}</p>
                <p className="text-sm text-gray-500 mt-2">Expected columns: SKU, Reference, Product Name, Current Stock, Counted, Difference, Cost, Total, Completed Date</p>
              </div>

              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-500">
                  {importMode === 'live'
                    ? 'Live import stores the stock take history in Appleberry OS.'
                    : 'Dry run previews the file without saving any rows.'}
                </div>
                <button
                  onClick={preparePreview}
                  disabled={!selectedFile || importing}
                  className="appleberry-gradient text-white px-5 py-2.5 rounded-xl font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {importing ? 'Processing...' : importMode === 'live' ? 'Start Live Import' : 'Run Dry Run'}
                </button>
              </div>

              {previewRows.length > 0 && (
                <div className="border border-gray-100 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 text-sm font-semibold text-gray-900">
                    Preview (first {previewRows.length} rows)
                  </div>
                  <div className="max-h-80 overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white border-b border-gray-100">
                        <tr className="text-left text-gray-500 uppercase text-[11px] tracking-wider">
                          <th className="px-4 py-3">Product</th>
                          <th className="px-4 py-3">SKU</th>
                          <th className="px-4 py-3 text-right">Diff</th>
                          <th className="px-4 py-3 text-right">Impact</th>
                          <th className="px-4 py-3">Match</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row) => (
                          <tr key={row.id} className="border-b border-gray-50">
                            <td className="px-4 py-3">{row.product_name}</td>
                            <td className="px-4 py-3 text-gray-600">{row.sku || 'No SKU'}</td>
                            <td className="px-4 py-3 text-right">{row.difference}</td>
                            <td className="px-4 py-3 text-right">{formatCurrency(row.total)}</td>
                            <td className="px-4 py-3">
                              {row.product_id ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 px-2 py-1 rounded-full">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Matched
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  No match
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
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
      <p className="text-sm text-[#6a6f72]">{title}</p>
      <p className="text-2xl font-bold text-[#18242b]">{value}</p>
    </div>
  );
}
