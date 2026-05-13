import React, { useState, useCallback } from 'react';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Play,
  Download,
  Loader2,
  X,
  Table as TableIcon,
  CopyX,
  RefreshCw,
  Layers,
  SkipForward,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';

import { cn } from '../../lib/utils';
import {
  ImportDataType,
  ImportField,
  ColumnMapping,
  ImportResult,
  IMPORT_FIELDS,
} from '../../types/import';
import { db } from '../../lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc,
} from 'firebase/firestore';
import { toast } from 'sonner';
import { useTenant } from '../../lib/tenant';
import { isCompanyScopedRecord, withCompanyId } from '../../lib/companyData';
import axios from 'axios';
import { getAuthHeaders } from '../../lib/authHeaders';

// ─── Types ───────────────────────────────────────────────────────────────────

type Step = 'upload' | 'type' | 'mapping' | 'preview' | 'duplicates' | 'importing' | 'results';
type DuplicateDecision = 'replace' | 'skip' | 'keep_both';

interface DuplicateItem {
  rowIndex: number;
  existingDocId: string;
  incoming: Record<string, any>;
  existingData: Record<string, any>;
  uniqueKey: string;
  decision: DuplicateDecision;
}

interface NewRecord {
  rowIndex: number;
  transformed: Record<string, any>;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ImportSystem() {
  const { company } = useTenant();
  const companyId = company?.id || null;

  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataType, setDataType] = useState<ImportDataType>('customers');
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [importMode, setImportMode] = useState<'dry' | 'live'>('live');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ImportResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Duplicate review state
  const [duplicates, setDuplicates] = useState<DuplicateItem[]>([]);
  const [newRecords, setNewRecords] = useState<NewRecord[]>([]);
  const [invalidRows, setInvalidRows] = useState<ImportResult['errors']>([]);
  const [expandedDup, setExpandedDup] = useState<number | null>(null);
  const [scanning, setScanning] = useState(false);

  // ── Date / Number Parsers ────────────────────────────────────────────────

  const parseImportedDate = (rawValue: unknown) => {
    if (rawValue === undefined || rawValue === null) return null;
    const dateStr = String(rawValue).replace(/ /g, ' ').trim();
    if (!dateStr) return null;
    const m = dateStr.match(/^(\d{2})-(\d{2})-(\d{2,4})(?:\s+(\d{1,2}):(\d{2})\s*(am|pm))?$/i);
    if (m) {
      const [, dayRaw, monthRaw, yearRaw, hourRaw, minRaw, merRaw] = m;
      let year = parseInt(yearRaw, 10);
      if (year < 100) year += 2000;
      let hours = hourRaw ? parseInt(hourRaw, 10) : 0;
      const minutes = minRaw ? parseInt(minRaw, 10) : 0;
      if (merRaw) {
        const mer = merRaw.toLowerCase();
        if (mer === 'pm' && hours < 12) hours += 12;
        if (mer === 'am' && hours === 12) hours = 0;
      }
      const parsed = new Date(year, parseInt(monthRaw, 10) - 1, parseInt(dayRaw, 10), hours, minutes);
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    }
    const fallback = new Date(dateStr);
    return Number.isNaN(fallback.getTime()) ? null : fallback.toISOString();
  };

  const parseImportedNumber = (rawValue: unknown) => {
    if (rawValue === undefined || rawValue === null) return null;
    const s = String(rawValue).replace(/ /g, ' ').trim();
    if (!s) return null;
    const n = Number(s.replace(/,/g, '').replace(/[^0-9.-]/g, ''));
    return Number.isNaN(n) ? null : n;
  };

  const normalizeText = (rawValue: unknown) =>
    rawValue === undefined || rawValue === null ? '' : String(rawValue).replace(/ /g, ' ').trim();

  // ── File Upload ──────────────────────────────────────────────────────────

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (selectedFile.name.endsWith('.csv')) {
        Papa.parse(content as string, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            setData(results.data);
            const fileHeaders = results.meta.fields || [];
            setHeaders(fileHeaders);
            if (fileHeaders.includes('Offers Email') && fileHeaders.includes('Contact No')) {
              setDataType('customers'); autoMap('customers', fileHeaders); setStep('preview');
              toast.success('CellStore Customer file detected! Auto-mapped all fields.');
            } else if (fileHeaders.includes('Invoice #') && fileHeaders.includes('Qty Sold')) {
              setDataType('sales'); autoMap('sales', fileHeaders); setStep('preview');
              toast.success('CellStore POS sales file detected!');
            } else if (fileHeaders.includes('Current inventory') || (fileHeaders.includes('Category name') && fileHeaders.some(h => ['Product name', 'Product Name', 'SKU'].includes(h)))) {
              setDataType('products'); autoMap('products', fileHeaders); setStep('preview');
              toast.success('CellStore Product Inventory file detected!');
            } else if (fileHeaders.includes('Ticket #') || fileHeaders.includes('Tech Assigned') || fileHeaders.includes('IMEI/Serial No.')) {
              setDataType('repairs'); autoMap('repairs', fileHeaders); setStep('preview');
              toast.success('CellStore Repairs file detected!');
            } else if (fileHeaders.includes('Bill Amount') || fileHeaders.includes('Expense Type') || fileHeaders.includes('Vendor Name')) {
              setDataType('expenses'); autoMap('expenses', fileHeaders); setStep('preview');
              toast.success('CellStore Expenses file detected!');
            } else if (fileHeaders.includes('Add / Sub') || (fileHeaders.includes('Date Added') && fileHeaders.includes('Reason') && fileHeaders.includes('Amount'))) {
              setDataType('expenses'); autoMap('expenses', fileHeaders); setStep('preview');
              toast.success('CellStore Petty Cash file detected!');
            } else if (fileHeaders.includes('Payment Type') && fileHeaders.includes('Invoice No') && fileHeaders.includes('Drawer')) {
              setDataType('payments'); autoMap('payments', fileHeaders); setStep('preview');
              toast.success('CellStore Payments file detected!');
            } else if (fileHeaders.includes('Current Stock') && fileHeaders.includes('Counted') && fileHeaders.includes('Difference')) {
              setDataType('stock_take'); autoMap('stock_take', fileHeaders); setStep('preview');
              toast.success('CellStore Stock Take file detected!');
            } else if (fileHeaders.includes('PO #') || fileHeaders.includes('Suppiler Name') || fileHeaders.includes('Qty Purchased')) {
              setDataType('purchases'); autoMap('purchases', fileHeaders); setStep('preview');
              toast.success('CellStore Purchase Order file detected!');
            } else if (fileHeaders.includes('Invoice No') && fileHeaders.includes('Sales Person') && fileHeaders.includes('Taxable')) {
              setDataType('invoices'); autoMap('invoices', fileHeaders); setStep('preview');
              toast.success('CellStore Invoice file detected!');
            } else if (fileHeaders.includes('Serial number') || fileHeaders.includes('Lot #') || fileHeaders.includes('PO number')) {
              setDataType('imei_devices'); autoMap('imei_devices', fileHeaders); setStep('preview');
              toast.success('IMEI/Serial Device file detected!');
            } else {
              setStep('type');
            }
          },
        });
      } else {
        toast.error('Only CSV files are supported.');
        setFile(null);
      }
    };
    reader.readAsText(selectedFile);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] } as any,
    multiple: false,
  } as any);

  // ── Column Mapping ───────────────────────────────────────────────────────

  const autoMap = (type: ImportDataType, fileHeaders: string[]) => {
    const fields = IMPORT_FIELDS[type];
    const newMapping: ColumnMapping = {};
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    fields.forEach((field) => {
      const candidates = [field.label, field.key, ...(field.aliases || [])].map(normalize);
      const match = fileHeaders.find((h) => candidates.includes(normalize(h)));
      if (match) newMapping[field.key] = match;
    });
    setMapping(newMapping);
  };

  const handleDataTypeSelect = (type: ImportDataType) => {
    setDataType(type);
    autoMap(type, headers);
    setStep('mapping');
  };

  // ── Row Validation ───────────────────────────────────────────────────────

  const validateRow = (row: any, fields: ImportField[], map: ColumnMapping) => {
    const errors: string[] = [];
    const transformed: any = {};
    fields.forEach((field) => {
      const csvColumn = map[field.key];
      let value: any = csvColumn ? row[csvColumn] : undefined;
      if (typeof value === 'string') value = value.replace(/ /g, ' ').trim();
      if (value === '') value = undefined;
      if (field.required && (value === undefined || value === '')) {
        errors.push(`Missing required field: ${field.label}`);
      }
      if (value !== undefined) {
        if (field.type === 'number') {
          const n = parseImportedNumber(value);
          if (n === null) errors.push(`Invalid number in ${field.label}`);
          else value = n;
        } else if (field.type === 'date') {
          const d = parseImportedDate(value);
          if (!d) errors.push(`Invalid date in ${field.label}`);
          else value = d;
        } else if (field.type === 'boolean') {
          const v = String(value).toLowerCase().trim();
          value = v === 'yes' || v === 'true' || v === '1' || v === 'y';
        } else if (field.type === 'email') {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)))
            errors.push(`Invalid email in ${field.label}`);
        } else if (field.type === 'phone') {
          value = String(value).replace(/[^0-9+]/g, '');
        }
        transformed[field.key] = value;
      }
    });
    return { errors, transformed };
  };

  // ── Deduplication ────────────────────────────────────────────────────────

  const getUniqueKey = (type: ImportDataType, t: any): string | null => {
    switch (type) {
      case 'customers':
        if (t.external_id) return `id:${String(t.external_id).trim()}`;
        return [t.first_name, t.last_name, t.phone].filter(Boolean).join('|').toLowerCase() || null;
      case 'products':
      case 'inventory':
        if (t.sku) return `sku:${String(t.sku).toLowerCase().trim()}`;
        return t.name ? `name:${String(t.name).toLowerCase().trim()}` : null;
      case 'repairs':
        return t.external_id ? `ticket:${String(t.external_id).trim()}` : null;
      case 'expenses':
        return t.date && t.amount != null && t.title
          ? `${String(t.date).substring(0, 10)}|${t.amount}|${String(t.title).toLowerCase().trim()}`
          : null;
      case 'payments':
        return t.invoice_number && t.payment_method && t.amount != null
          ? `${t.invoice_number}|${t.payment_method}|${t.amount}`
          : null;
      case 'purchases':
        return t.external_id ? `po:${String(t.external_id).trim()}` : null;
      case 'invoices':
        return t.invoice_number ? `inv:${String(t.invoice_number).trim()}` : null;
      case 'imei_devices':
        return t.imei ? `imei:${String(t.imei).trim()}` : null;
      case 'stock_take':
        return null;
      default:
        return null;
    }
  };

  /**
   * Fetch existing docs via the server-side scan endpoint.
   * Admin SDK on Railway → much faster than client Firestore reads.
   */
  const loadExistingDocs = async (
    type: ImportDataType
  ): Promise<Map<string, { id: string; data: Record<string, any> }>> => {
    const map = new Map<string, { id: string; data: Record<string, any> }>();
    if (!companyId) return map;
    try {
      const colName = type === 'inventory' ? 'products' : type;
      const resp = await axios.post('/api/import/scan',
        { collection: colName },
        { headers: await getAuthHeaders() }
      );
      const docs: any[] = resp.data.docs || [];
      docs.forEach((data) => {
        let key: string | null = null;
        switch (type) {
          case 'customers':
            key = data.external_id
              ? `id:${String(data.external_id).trim()}`
              : [data.first_name, data.last_name, data.phone].filter(Boolean).join('|').toLowerCase() || null;
            break;
          case 'products':
          case 'inventory':
            key = data.sku
              ? `sku:${String(data.sku).toLowerCase().trim()}`
              : data.name
              ? `name:${String(data.name).toLowerCase().trim()}`
              : null;
            break;
          case 'repairs':
            key = data.external_id ? `ticket:${String(data.external_id).trim()}` : null;
            break;
          case 'expenses':
            key = data.date && data.amount != null && data.title
              ? `${String(data.date).substring(0, 10)}|${data.amount}|${String(data.title).toLowerCase().trim()}`
              : null;
            break;
          case 'payments':
            key = data.invoice_number && data.payment_method && data.amount != null
              ? `${data.invoice_number}|${data.payment_method}|${data.amount}`
              : null;
            break;
          case 'purchases':
            key = data.external_id ? `po:${String(data.external_id).trim()}` : null;
            break;
          case 'invoices':
            key = data.invoice_number ? `inv:${String(data.invoice_number).trim()}` : null;
            break;
          case 'imei_devices':
            key = data.imei ? `imei:${String(data.imei).trim()}` : null;
            break;
        }
        if (key) map.set(key, { id: data.id, data });
      });
    } catch (e) {
      console.warn('Server scan failed, skipping dedup:', e);
    }
    return map;
  };

  // ── Step 1: Scan — find duplicates before importing ──────────────────────

  const scanForDuplicates = async () => {
    if (importMode === 'dry') {
      // Dry run — skip the duplicate review UI, run simulation directly
      await runImportWithDecisions([], [], []);
      return;
    }

    setScanning(true);

    try {
      const fields = IMPORT_FIELDS[dataType];
      const existingDocs = await loadExistingDocs(dataType);

      const foundDuplicates: DuplicateItem[] = [];
      const foundNew: NewRecord[] = [];
      const foundInvalid: ImportResult['errors'] = [];
      const seenKeys = new Set<string>();

      data.forEach((row, rowIndex) => {
        const { errors, transformed } = validateRow(row, fields, mapping);
        if (errors.length > 0) {
          foundInvalid.push({ row: rowIndex + 1, message: errors.join(', '), data: row });
          return;
        }

        const uniqueKey = getUniqueKey(dataType, transformed);

        if (uniqueKey && existingDocs.has(uniqueKey)) {
          const existing = existingDocs.get(uniqueKey)!;
          foundDuplicates.push({
            rowIndex,
            existingDocId: existing.id,
            incoming: transformed,
            existingData: existing.data,
            uniqueKey,
            decision: 'skip', // default: preserve existing
          });
        } else if (uniqueKey && seenKeys.has(uniqueKey)) {
          // Duplicate within the CSV itself
          foundDuplicates.push({
            rowIndex,
            existingDocId: '',
            incoming: transformed,
            existingData: {},
            uniqueKey,
            decision: 'skip',
          });
        } else {
          if (uniqueKey) seenKeys.add(uniqueKey);
          foundNew.push({ rowIndex, transformed });
        }
      });

      setDuplicates(foundDuplicates);
      setNewRecords(foundNew);
      setInvalidRows(foundInvalid);

      if (foundDuplicates.length === 0) {
        // No duplicates at all — go straight to import
        toast.success(`No duplicates found. Importing ${foundNew.length} new records.`);
        await runImportWithDecisions(foundDuplicates, foundNew, foundInvalid);
      } else {
        setStep('duplicates');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to scan for duplicates');
    } finally {
      setScanning(false);
    }
  };

  // ── Apply a bulk decision to all duplicates ──────────────────────────────

  const applyBulkDecision = (decision: DuplicateDecision) => {
    setDuplicates((prev) => prev.map((d) => ({ ...d, decision })));
  };

  const updateDuplicateDecision = (rowIndex: number, decision: DuplicateDecision) => {
    setDuplicates((prev) =>
      prev.map((d) => (d.rowIndex === rowIndex ? { ...d, decision } : d))
    );
  };

  // ── Step 2: Execute import via server-side Admin SDK (fast) ─────────────

  const runImportWithDecisions = async (
    resolvedDuplicates: DuplicateItem[],
    resolvedNew: NewRecord[],
    resolvedInvalid: ImportResult['errors']
  ) => {
    setIsProcessing(true);
    setStep('importing');

    if (dataType === 'sales') {
      await runHistoricalSalesImport();
      return;
    }

    const importResults: ImportResult = {
      total: data.length,
      success: 0,
      skipped: resolvedDuplicates.filter(d => d.decision === 'skip').length,
      failed: resolvedInvalid.length,
      errors: [...resolvedInvalid],
    };

    try {
      if (importMode === 'dry') {
        importResults.success = resolvedNew.length + resolvedDuplicates.filter(d => d.decision !== 'skip').length;
        setResults(importResults);
        setStep('results');
        toast.info(`Simulation: ${importResults.success} would import, ${importResults.failed} would fail`);
        return;
      }

      setProgress(10);

      // Build the records array for the server
      const allRecords = [
        ...resolvedNew.map(r => ({
          uniqueKey: getUniqueKey(dataType, r.transformed),
          payload: buildPayload(r.transformed, dataType),
        })),
        ...resolvedDuplicates
          .filter(d => d.decision !== 'skip')
          .map(d => ({
            uniqueKey: d.uniqueKey,
            payload: buildPayload(d.incoming, dataType),
          })),
      ];

      // Build the decisions map for the server
      const duplicateDecisions: Record<string, { decision: DuplicateDecision; existingDocId?: string }> = {};
      resolvedDuplicates.forEach(d => {
        if (d.decision !== 'skip') {
          duplicateDecisions[d.uniqueKey] = { decision: d.decision, existingDocId: d.existingDocId || undefined };
        }
      });

      setProgress(20);

      // Send to server — one HTTP call, server writes in 499-doc Admin SDK batches
      const colName = dataType === 'inventory' ? 'products' : dataType;
      const resp = await axios.post('/api/import', {
        collection: colName,
        records: allRecords,
        mode: 'live',
        duplicateDecisions,
      }, { headers: await getAuthHeaders() });

      setProgress(100);

      importResults.success = resp.data.written ?? allRecords.length;
      importResults.skipped += resp.data.skipped ?? 0;

      setResults(importResults);
      setStep('results');
      toast.success(`Import complete: ${importResults.success} saved, ${importResults.skipped} skipped, ${importResults.failed} failed`);
    } catch (err: any) {
      console.error('Import error:', err);
      importResults.errors.push({ row: 0, message: err.response?.data?.error || err.message || 'Server import failed', data: {} });
      importResults.failed++;
      setResults(importResults);
      setStep('results');
      toast.error(err.response?.data?.error || err.message || 'Import failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Build the Firestore payload for a single record ──────────────────────

  const buildPayload = (transformed: Record<string, any>, type: ImportDataType) => {
    let payload: Record<string, any> = {
      ...withCompanyId(companyId, {}),
      ...transformed,
      created_at: transformed.created_at || new Date().toISOString(),
      imported: true,
      import_batch: file?.name,
    };

    if (type === 'customers') {
      const fullName = `${transformed.first_name || ''} ${transformed.last_name || ''}`.trim();
      payload = {
        ...withCompanyId(companyId, {}),
        external_id: transformed.external_id || null,
        created_at: transformed.created_at || new Date().toISOString(),
        created_by: transformed.created_by || null,
        first_name: transformed.first_name || 'Unknown',
        last_name: transformed.last_name || null,
        name: fullName || transformed.first_name || 'Unknown Customer',
        email: transformed.email || null,
        offers_email: transformed.offers_email || false,
        company: transformed.company || null,
        phone: transformed.phone || null,
        secondary_phone: transformed.secondary_phone || null,
        fax: transformed.fax || null,
        customer_type: transformed.customer_type || null,
        address_info: {
          address: [transformed.address_line1, transformed.address_line2].filter(Boolean).join(', ') || null,
          city: transformed.city || null,
          state: transformed.state || null,
          zip: transformed.zip || null,
        },
        country: transformed.country || null,
        checkbox: transformed.checkbox || false,
        birthdate: transformed.birthdate || null,
        imported: true,
        import_batch: file?.name,
      };
    }

    if (type === 'repairs' && !transformed.device_model && (transformed.brand || transformed.model)) {
      payload.device_model = [transformed.brand, transformed.model].filter(Boolean).join(' ');
    }

    if (type === 'products' || type === 'inventory') {
      const rawStock = parseFloat(payload.stock);
      payload.stock = Math.max(0, isNaN(rawStock) ? 0 : rawStock);
      payload.cost_price = Math.max(0, parseFloat(payload.cost_price) || 0);
      payload.selling_price = Math.max(0, parseFloat(payload.selling_price) || 0);
    }

    return payload;
  };

  // ── Legacy: kept for the sales import path ───────────────────────────────

  const runImport = async () => {
    await scanForDuplicates();
  };

  const runHistoricalSalesImport = async () => {
    const importResults: ImportResult = { total: 0, success: 0, skipped: 0, failed: 0, errors: [] };
    try {
      const groupedRows = new Map<string, any[]>();
      data.forEach((row) => {
        const invoiceNumber = normalizeText(row['Invoice #']);
        if (!invoiceNumber) {
          importResults.failed++;
          importResults.errors.push({ row: importResults.failed, message: 'Missing invoice number', data: row });
          return;
        }
        const existing = groupedRows.get(invoiceNumber) || [];
        existing.push(row);
        groupedRows.set(invoiceNumber, existing);
      });

      const groupedSales = Array.from(groupedRows.entries());
      importResults.total = groupedSales.length;

      const existingSalesKeys = new Set<string>();
      if (importMode === 'live' && companyId) {
        const snap = await getDocs(query(collection(db, 'sales'), where('company_id', '==', companyId)));
        snap.docs.forEach((d) => {
          const inv = (d.data() as any).external_invoice_number;
          if (inv) existingSalesKeys.add(String(inv).trim());
        });
      }

      const [productsSnapshot, customersSnapshot] = await Promise.all([
        getDocs(collection(db, 'products')),
        getDocs(collection(db, 'customers')),
      ]);

      const productBySku = new Map<string, any>();
      const productByName = new Map<string, any>();
      productsSnapshot.docs.forEach((productDoc) => {
        const product = { id: productDoc.id, ...productDoc.data() } as any;
        if (!isCompanyScopedRecord(product, companyId)) return;
        const skuKey = normalizeText(product.sku || product.external_id);
        if (skuKey) productBySku.set(skuKey.toLowerCase(), product);
        const nameKey = normalizeText(product.name);
        if (nameKey) productByName.set(nameKey.toLowerCase(), product);
      });

      const customerByEmail = new Map<string, any>();
      const customerByPhone = new Map<string, any>();
      const customerByName = new Map<string, any>();
      customersSnapshot.docs.forEach((customerDoc) => {
        const customer = { id: customerDoc.id, ...customerDoc.data() } as any;
        if (!isCompanyScopedRecord(customer, companyId)) return;
        const emailKey = normalizeText(customer.email).toLowerCase();
        const phoneKey = normalizeText(customer.phone);
        const nameKey = normalizeText(customer.name).toLowerCase();
        if (emailKey) customerByEmail.set(emailKey, customer);
        if (phoneKey) customerByPhone.set(phoneKey, customer);
        if (nameKey) customerByName.set(nameKey, customer);
      });

      let operationCount = 0;
      let batch = importMode === 'live' ? writeBatch(db) : null;

      for (const [index, [invoiceNumber, rows]] of groupedSales.entries()) {
        if (importMode === 'live' && existingSalesKeys.has(invoiceNumber.trim())) {
          importResults.skipped++;
          setProgress(Math.round(((index + 1) / groupedSales.length) * 100));
          continue;
        }
        const firstRow = rows[0];
        const createdAt = parseImportedDate(firstRow['POS Date']) || new Date().toISOString();
        const customerName = normalizeText(firstRow['Customer name']);
        const customerEmail = normalizeText(firstRow['Customer Email']).toLowerCase();
        const customerPhone = normalizeText(firstRow['Customer Phone Number']).replace(/[^0-9+]/g, '');
        const customerCompany = normalizeText(firstRow['Customer company']);

        let customer: any = null;
        if (customerEmail && customerByEmail.has(customerEmail)) customer = customerByEmail.get(customerEmail);
        else if (customerPhone && customerByPhone.has(customerPhone)) customer = customerByPhone.get(customerPhone);
        else if (customerName && customerName.toLowerCase() !== 'unassigned' && customerByName.has(customerName.toLowerCase()))
          customer = customerByName.get(customerName.toLowerCase());

        if (!customer && customerName && customerName.toLowerCase() !== 'unassigned' && importMode === 'live' && batch) {
          const customerRef = doc(collection(db, 'customers'));
          const customerPayload = {
            ...withCompanyId(companyId, {}),
            first_name: customerName.split(' ')[0] || customerName,
            last_name: customerName.split(' ').slice(1).join(' ') || null,
            name: customerName,
            email: customerEmail || null,
            phone: customerPhone || null,
            secondary_phone: null,
            company: customerCompany || null,
            fax: null,
            customer_type: normalizeText(firstRow['Customer Type']) || null,
            address_info: {
              address: normalizeText(firstRow['Customer Address']) || null,
              city: null, state: null, zip: null,
            },
            created_at: createdAt,
            imported: true,
            import_batch: file?.name,
          };
          batch.set(customerRef, customerPayload);
          customer = { id: customerRef.id, ...customerPayload };
          if (customerEmail) customerByEmail.set(customerEmail, customer);
          if (customerPhone) customerByPhone.set(customerPhone, customer);
          customerByName.set(customerName.toLowerCase(), customer);
          operationCount++;
        }

        const subtotal = rows.reduce((sum, row) => sum + (parseImportedNumber(row['Price']) || 0) * (parseImportedNumber(row['Qty Sold']) || 0), 0);
        const globalDiscount = rows.reduce((sum, row) => sum + (parseImportedNumber(row['Discount']) || 0), 0);
        const totalAmount = rows.reduce((sum, row) => sum + (parseImportedNumber(row['Total']) || 0), 0);
        const profit = rows.reduce((sum, row) => sum + (parseImportedNumber(row['Profit']) || 0), 0);
        const staffName = normalizeText(firstRow['Invoice Salesman']) || 'Imported Sale';

        if (importMode === 'live' && batch) {
          const saleRef = doc(collection(db, 'sales'));
          batch.set(saleRef, {
            ...withCompanyId(companyId, {}),
            external_invoice_number: invoiceNumber,
            customer_id: customer?.id || null,
            customer_name: customerName && customerName.toLowerCase() !== 'unassigned' ? customerName : null,
            subtotal, global_discount: globalDiscount, total_amount: totalAmount, profit,
            payment_method: 'imported', payment_methods: ['imported'],
            payments: [{ method: 'imported', amount: totalAmount, timestamp: createdAt }],
            staff_id: null, staff_name: staffName,
            created_at: createdAt, imported: true, import_batch: file?.name,
          });
          operationCount++;

          rows.forEach((row) => {
            const productName = normalizeText(row['Product Name']);
            const sku = normalizeText(row['SKU']);
            const product = (sku && productBySku.get(sku.toLowerCase())) || productByName.get(productName.toLowerCase()) || null;
            const quantity = parseImportedNumber(row['Qty Sold']) || 0;
            const originalPrice = parseImportedNumber(row['Price']) || 0;
            const lineDiscount = parseImportedNumber(row['Discount']) || 0;
            const lineTotal = parseImportedNumber(row['Total']) || 0;
            const costPrice = parseImportedNumber(row['Cost']) || 0;
            const lineProfit = parseImportedNumber(row['Profit']) || 0;
            const unitPrice = quantity > 0 ? lineTotal / quantity : lineTotal;

            const itemPayload = {
              ...withCompanyId(companyId, {}),
              sale_id: saleRef.id, product_id: product?.id || null, external_sku: sku || null,
              name: productName || 'Imported Product', product_name: productName || 'Imported Product',
              category: normalizeText(row['Category name']) || normalizeText(row['Product Type']) || null,
              manufacturer: normalizeText(row['Manufacturer name']) || null,
              quantity, original_price: originalPrice, unit_price: unitPrice,
              discount: lineDiscount, total_price: lineTotal, cost_price: costPrice,
              profit: lineProfit, created_at: createdAt, imported: true, import_batch: file?.name,
            };

            const saleItemRef = doc(collection(db, `sales/${saleRef.id}/items`));
            batch!.set(saleItemRef, itemPayload);
            operationCount++;

            const saleItemIndexRef = doc(collection(db, 'sale_items'));
            batch!.set(saleItemIndexRef, itemPayload);
            operationCount++;

            if (operationCount >= 350) {
              // flush and restart batch (handled below)
            }
          });

          if (operationCount >= 350) {
            await batch.commit();
            batch = writeBatch(db);
            operationCount = 0;
          }
        }

        importResults.success++;
        setProgress(Math.round(((index + 1) / groupedSales.length) * 100));
      }

      if (importMode === 'live' && batch && operationCount > 0) await batch.commit();

      setResults(importResults);
      setStep('results');
      setIsProcessing(false);
      if (importMode === 'live') toast.success(`Sales import complete: ${importResults.success} invoices imported`);
      else toast.info(`Dry run complete: ${importResults.success} invoices ready to import`);
    } catch (error: any) {
      console.error('Sales import error:', error);
      setResults(importResults);
      setStep('results');
      setIsProcessing(false);
      toast.error(`Sales import failed: ${error.message}`);
    }
  };

  // ── Step Indicator ───────────────────────────────────────────────────────

  const renderStepIndicator = () => {
    const steps = ['Upload', 'Type', 'Mapping', 'Preview', 'Duplicates', 'Results'];
    const stepKeys = ['upload', 'type', 'mapping', 'preview', 'duplicates', 'results'];
    const stepIndex = stepKeys.indexOf(step === 'importing' ? 'results' : step);
    return (
      <div className="flex items-center justify-between mb-8 px-2">
        {steps.map((s, i) => (
          <React.Fragment key={s}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                  i <= stepIndex ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'
                )}
              >
                {i + 1}
              </div>
              <span
                className={cn(
                  'text-[9px] font-bold uppercase tracking-wider',
                  i <= stepIndex ? 'text-primary' : 'text-gray-400'
                )}
              >
                {s}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn('flex-1 h-px mx-2', i < stepIndex ? 'bg-primary' : 'bg-gray-100')} />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900">Data Import Wizard</h2>
            <p className="text-xs text-gray-500">Migrate your CellStore data to Appleberry OS</p>
          </div>
        </div>
        {file && (
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500 bg-white px-3 py-1.5 rounded-lg border border-gray-200">
            <FileText className="w-3.5 h-3.5" />
            {file.name}
            <button
              onClick={() => { setFile(null); setStep('upload'); setDuplicates([]); setNewRecords([]); }}
              className="hover:text-red-500"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="p-8">
        {renderStepIndicator()}

        {/* ── UPLOAD ─────────────────────────────────────────────────────── */}
        {step === 'upload' && (
          <div
            {...getRootProps()}
            className={cn(
              'border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer',
              isDragActive ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-primary/50 hover:bg-gray-50'
            )}
          >
            <input {...getInputProps()} />
            <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 mx-auto mb-4">
              <Upload className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Click or drag file to upload</h3>
            <p className="text-sm text-gray-500 max-w-xs mx-auto mb-6">
              CSV files only. Export spreadsheets to CSV before importing. Maximum file size 10MB.
            </p>
            <div className="flex items-center justify-center gap-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Auto-detection</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Duplicate review</span>
            </div>
          </div>
        )}

        {/* ── TYPE SELECT ────────────────────────────────────────────────── */}
        {step === 'type' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">What are you importing?</h3>
              <div className="bg-blue-50 px-4 py-2 rounded-lg border border-blue-100 flex items-center gap-2 text-blue-700 text-xs font-medium">
                <AlertCircle className="w-4 h-4" />
                Recommended Order: Customers → Products → IMEI → Sales → Repairs
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {(Object.keys(IMPORT_FIELDS) as ImportDataType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => handleDataTypeSelect(type)}
                  className="flex flex-col items-center gap-3 p-6 rounded-xl border border-gray-100 hover:border-primary hover:bg-primary/5 transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:text-primary transition-colors">
                    <TableIcon className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-bold capitalize">{type.replace('_', ' ')}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── MAPPING ────────────────────────────────────────────────────── */}
        {step === 'mapping' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Map Columns</h3>
              <button onClick={() => autoMap(dataType, headers)} className="text-xs font-bold text-primary hover:underline">
                Reset Auto-mapping
              </button>
            </div>
            <div className="space-y-3">
              {IMPORT_FIELDS[dataType].map((field) => (
                <div key={field.key} className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50/30">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900">{field.label}</span>
                      {field.required && <span className="text-[10px] font-bold text-red-500 uppercase">Required</span>}
                    </div>
                    <p className="text-xs text-gray-500">Field: {field.key}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300" />
                  <div className="flex-1">
                    <select
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                      value={mapping[field.key] || ''}
                      onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                    >
                      <option value="">-- Select CSV Column --</option>
                      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between pt-6">
              <button onClick={() => setStep('type')} className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={() => setStep('preview')} className="appleberry-gradient text-white px-8 py-2.5 rounded-xl font-bold hover:opacity-90">
                Preview Data
              </button>
            </div>
          </div>
        )}

        {/* ── PREVIEW ────────────────────────────────────────────────────── */}
        {step === 'preview' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Preview (First 20 Rows)</h3>
              <div className="flex items-center gap-4">
                <div className="flex bg-gray-100 p-1 rounded-lg">
                  <button
                    onClick={() => setImportMode('dry')}
                    className={cn('px-4 py-1.5 text-xs font-bold rounded-md transition-all', importMode === 'dry' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500')}
                  >
                    Test Only (no save)
                  </button>
                  <button
                    onClick={() => setImportMode('live')}
                    className={cn('px-4 py-1.5 text-xs font-bold rounded-md transition-all', importMode === 'live' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500')}
                  >
                    ✓ Live Import
                  </button>
                </div>
              </div>
            </div>

            <div className="border border-gray-100 rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 font-bold text-gray-400 uppercase tracking-wider text-[10px]">Status</th>
                    {IMPORT_FIELDS[dataType].map((f) => (
                      <th key={f.key} className="px-4 py-3 font-bold text-gray-900">{f.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.slice(0, 20).map((row, i) => {
                    const { errors, transformed } = validateRow(row, IMPORT_FIELDS[dataType], mapping);
                    return (
                      <tr key={i} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          {errors.length > 0 ? (
                            <div className="group relative">
                              <AlertCircle className="w-4 h-4 text-red-500" />
                              <div className="absolute left-6 top-0 hidden group-hover:block bg-red-600 text-white text-[10px] p-2 rounded shadow-xl z-10 w-48">
                                {errors.join(', ')}
                              </div>
                            </div>
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          )}
                        </td>
                        {IMPORT_FIELDS[dataType].map((f) => (
                          <td key={f.key} className={cn('px-4 py-3 font-mono text-[11px]', errors.some((e) => e.includes(f.label)) ? 'text-red-500 bg-red-50' : 'text-gray-600')}>
                            {transformed[f.key] !== undefined ? String(transformed[f.key]) : '-'}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between pt-6">
              <button onClick={() => setStep('mapping')} className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={runImport}
                disabled={scanning}
                className={cn(
                  'flex items-center gap-2 text-white px-8 py-2.5 rounded-xl font-bold hover:opacity-90 shadow-lg transition-all disabled:opacity-70',
                  importMode === 'live' ? 'bg-primary shadow-primary/20' : 'bg-orange-500 shadow-orange-500/20'
                )}
              >
                {scanning ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Scanning for duplicates…</>
                ) : (
                  <><Play className="w-4 h-4" /> {importMode === 'live' ? 'Check & Import' : 'Run Simulation'}</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── DUPLICATE REVIEW ───────────────────────────────────────────── */}
        {step === 'duplicates' && (
          <div className="space-y-6">
            {/* Summary banner */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-2xl bg-green-50 border border-green-100 p-4 text-center">
                <p className="text-xs font-bold text-green-600 uppercase tracking-wider mb-1">New Records</p>
                <p className="text-3xl font-bold text-green-700">{newRecords.length}</p>
                <p className="text-xs text-green-600 mt-1">Will be added</p>
              </div>
              <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 text-center">
                <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">Duplicates Found</p>
                <p className="text-3xl font-bold text-amber-700">{duplicates.length}</p>
                <p className="text-xs text-amber-600 mt-1">Need your decision</p>
              </div>
              <div className="rounded-2xl bg-red-50 border border-red-100 p-4 text-center">
                <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-1">Invalid Rows</p>
                <p className="text-3xl font-bold text-red-700">{invalidRows.length}</p>
                <p className="text-xs text-red-600 mt-1">Will be skipped</p>
              </div>
            </div>

            {/* Bulk decision bar */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <p className="font-bold text-gray-900 mb-1">Apply to all {duplicates.length} duplicates at once:</p>
              <p className="text-xs text-gray-500 mb-4">You can still override individual records below.</p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => applyBulkDecision('replace')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Replace All — overwrite with new data
                </button>
                <button
                  onClick={() => applyBulkDecision('skip')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-600 text-white font-bold text-sm hover:bg-gray-700 transition-colors"
                >
                  <SkipForward className="w-4 h-4" />
                  Skip All — keep existing records
                </button>
                <button
                  onClick={() => applyBulkDecision('keep_both')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 text-white font-bold text-sm hover:bg-purple-700 transition-colors"
                >
                  <Layers className="w-4 h-4" />
                  Keep Both — add new alongside existing
                </button>
              </div>
            </div>

            {/* Duplicate decision summary */}
            <div className="flex gap-4 text-xs font-semibold">
              <span className="text-blue-600">{duplicates.filter(d => d.decision === 'replace').length} replacing</span>
              <span className="text-gray-500">{duplicates.filter(d => d.decision === 'skip').length} skipping</span>
              <span className="text-purple-600">{duplicates.filter(d => d.decision === 'keep_both').length} keeping both</span>
            </div>

            {/* Per-record list */}
            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
              {duplicates.map((dup) => {
                const isExpanded = expandedDup === dup.rowIndex;
                const decisionColors: Record<DuplicateDecision, string> = {
                  replace: 'border-blue-200 bg-blue-50/60',
                  skip: 'border-gray-200 bg-gray-50/60',
                  keep_both: 'border-purple-200 bg-purple-50/60',
                };
                const labelForKey = (key: string) =>
                  IMPORT_FIELDS[dataType].find((f) => f.key === key)?.label || key;
                const previewFields = Object.keys(dup.incoming).slice(0, 3);

                return (
                  <div key={dup.rowIndex} className={cn('rounded-2xl border p-4 transition-colors', decisionColors[dup.decision])}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <CopyX className="w-4 h-4 text-amber-500 shrink-0" />
                          <p className="text-sm font-bold text-gray-900 truncate">
                            Row {dup.rowIndex + 1} — {dup.uniqueKey}
                          </p>
                        </div>
                        <p className="text-xs text-gray-500">
                          {previewFields.map((k) => `${labelForKey(k)}: ${dup.incoming[k] ?? '—'}`).join(' · ')}
                        </p>
                      </div>

                      {/* Decision buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => updateDuplicateDecision(dup.rowIndex, 'replace')}
                          title="Replace existing record with new data"
                          className={cn(
                            'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all',
                            dup.decision === 'replace'
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'
                          )}
                        >
                          <RefreshCw className="w-3 h-3" /> Replace
                        </button>
                        <button
                          onClick={() => updateDuplicateDecision(dup.rowIndex, 'skip')}
                          title="Keep existing record, ignore incoming"
                          className={cn(
                            'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all',
                            dup.decision === 'skip'
                              ? 'bg-gray-600 text-white border-gray-600'
                              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                          )}
                        >
                          <SkipForward className="w-3 h-3" /> Skip
                        </button>
                        <button
                          onClick={() => updateDuplicateDecision(dup.rowIndex, 'keep_both')}
                          title="Add new record alongside existing"
                          className={cn(
                            'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all',
                            dup.decision === 'keep_both'
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'bg-white text-purple-600 border-purple-200 hover:bg-purple-50'
                          )}
                        >
                          <Layers className="w-3 h-3" /> Both
                        </button>
                        <button
                          onClick={() => setExpandedDup(isExpanded ? null : dup.rowIndex)}
                          className="p-1.5 rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-gray-600"
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded comparison */}
                    {isExpanded && (
                      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-gray-200 pt-4">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Existing (in database)</p>
                          <div className="space-y-1">
                            {Object.entries(dup.existingData)
                              .filter(([k]) => !['company_id', 'imported', 'import_batch'].includes(k))
                              .slice(0, 10)
                              .map(([k, v]) => (
                                <div key={k} className="flex gap-2 text-xs">
                                  <span className="text-gray-400 shrink-0 w-28 truncate">{labelForKey(k)}</span>
                                  <span className="text-gray-700 font-mono truncate">{String(v ?? '—')}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400 mb-2">Incoming (from CSV)</p>
                          <div className="space-y-1">
                            {Object.entries(dup.incoming).slice(0, 10).map(([k, v]) => {
                              const changed = String(v) !== String(dup.existingData[k] ?? '');
                              return (
                                <div key={k} className="flex gap-2 text-xs">
                                  <span className="text-gray-400 shrink-0 w-28 truncate">{labelForKey(k)}</span>
                                  <span className={cn('font-mono truncate', changed ? 'text-blue-600 font-bold' : 'text-gray-700')}>
                                    {String(v ?? '—')}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Action bar */}
            <div className="flex justify-between items-center pt-4 border-t border-gray-100">
              <button onClick={() => setStep('preview')} className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <div className="flex items-center gap-3">
                <p className="text-sm text-gray-500">
                  {newRecords.length} new + {duplicates.filter(d => d.decision !== 'skip').length} duplicates = {newRecords.length + duplicates.filter(d => d.decision !== 'skip').length} total writes
                </p>
                <button
                  onClick={() => runImportWithDecisions(duplicates, newRecords, invalidRows)}
                  className="appleberry-gradient flex items-center gap-2 text-white px-8 py-2.5 rounded-xl font-bold hover:opacity-90 shadow-lg shadow-primary/20"
                >
                  <Play className="w-4 h-4" />
                  Proceed with Import
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── IMPORTING ──────────────────────────────────────────────────── */}
        {step === 'importing' && (
          <div className="py-12 text-center space-y-6">
            <div className="relative w-24 h-24 mx-auto">
              <Loader2 className="w-24 h-24 text-primary animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center font-bold text-lg">{progress}%</div>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                {importMode === 'live' ? 'Importing Data…' : 'Simulating Import…'}
              </h3>
              <p className="text-sm text-gray-500">Processing record {Math.round((progress / 100) * data.length)} of {data.length}</p>
            </div>
            <div className="max-w-md mx-auto h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* ── RESULTS ────────────────────────────────────────────────────── */}
        {step === 'results' && results && (
          <div className="space-y-8">
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 text-center">
                <p className="text-sm text-gray-500 font-medium mb-1">Total Rows</p>
                <p className="text-3xl font-bold text-gray-900">{results.total}</p>
              </div>
              <div className="bg-green-50 p-6 rounded-2xl border border-green-100 text-center">
                <p className="text-sm text-green-600 font-medium mb-1">Imported</p>
                <p className="text-3xl font-bold text-green-700">{results.success}</p>
              </div>
              <div className="bg-orange-50 p-6 rounded-2xl border border-orange-100 text-center">
                <p className="text-sm text-orange-600 font-medium mb-1">Skipped</p>
                <p className="text-3xl font-bold text-orange-700">{results.skipped}</p>
              </div>
              <div className="bg-red-50 p-6 rounded-2xl border border-red-100 text-center">
                <p className="text-sm text-red-600 font-medium mb-1">Failed</p>
                <p className="text-3xl font-bold text-red-700">{results.failed}</p>
              </div>
            </div>

            {results.errors.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-900">Error Report</h3>
                <div className="max-h-60 overflow-y-auto border border-gray-100 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 font-bold text-gray-400 uppercase">Row</th>
                        <th className="px-4 py-2 font-bold text-gray-400 uppercase">Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {results.errors.map((err, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2 font-mono text-gray-500">{err.row}</td>
                          <td className="px-4 py-2 text-red-600 font-medium">{err.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-center pt-6">
              <button
                onClick={() => { setFile(null); setStep('upload'); setResults(null); setProgress(0); setDuplicates([]); setNewRecords([]); setInvalidRows([]); }}
                className="appleberry-gradient text-white px-12 py-3 rounded-xl font-bold hover:opacity-90 shadow-lg shadow-primary/20"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
