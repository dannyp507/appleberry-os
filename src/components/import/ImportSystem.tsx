import React, { useState, useCallback } from 'react';
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft, 
  Settings, 
  Play, 
  Download,
  Loader2,
  X,
  Table as TableIcon
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { cn, formatCurrency } from '../../lib/utils';
import { 
  ImportDataType, 
  ImportField, 
  ColumnMapping, 
  ImportResult, 
  IMPORT_FIELDS 
} from '../../types/import';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { toast } from 'sonner';
import { useTenant } from '../../lib/tenant';
import { isCompanyScopedRecord, withCompanyId } from '../../lib/companyData';

type Step = 'upload' | 'type' | 'mapping' | 'preview' | 'importing' | 'results';

export default function ImportSystem() {
  const { company } = useTenant();
  const companyId = company?.id || null;
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataType, setDataType] = useState<ImportDataType>('customers');
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [importMode, setImportMode] = useState<'dry' | 'live'>('dry');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ImportResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const parseImportedDate = (rawValue: unknown) => {
    if (rawValue === undefined || rawValue === null) return null;

    const dateStr = String(rawValue).replace(/\u00a0/g, ' ').trim();
    if (!dateStr) return null;

    const dateTimeMatch = dateStr.match(/^(\d{2})-(\d{2})-(\d{2,4})(?:\s+(\d{1,2}):(\d{2})\s*(am|pm))?$/i);
    if (dateTimeMatch) {
      const [, dayRaw, monthRaw, yearRaw, hourRaw, minuteRaw, meridiemRaw] = dateTimeMatch;
      const day = parseInt(dayRaw, 10);
      const month = parseInt(monthRaw, 10) - 1;
      let year = parseInt(yearRaw, 10);
      if (year < 100) year += 2000;
      let hours = hourRaw ? parseInt(hourRaw, 10) : 0;
      const minutes = minuteRaw ? parseInt(minuteRaw, 10) : 0;

      if (meridiemRaw) {
        const meridiem = meridiemRaw.toLowerCase();
        if (meridiem === 'pm' && hours < 12) hours += 12;
        if (meridiem === 'am' && hours === 12) hours = 0;
      }

      const parsed = new Date(year, month, day, hours, minutes);
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    }

    const fallback = new Date(dateStr);
    return Number.isNaN(fallback.getTime()) ? null : fallback.toISOString();
  };

  const parseImportedNumber = (rawValue: unknown) => {
    if (rawValue === undefined || rawValue === null) return null;
    const stringValue = String(rawValue).replace(/\u00a0/g, ' ').trim();
    if (!stringValue) return null;
    const normalized = stringValue.replace(/,/g, '').replace(/[^0-9.-]/g, '');
    if (!normalized || normalized === '-' || normalized === '.') return null;
    const parsed = Number(normalized);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const normalizeText = (rawValue: unknown) => {
    if (rawValue === undefined || rawValue === null) return '';
    return String(rawValue).replace(/\u00a0/g, ' ').trim();
  };

  // 1. File Upload Handling
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
            
            // Auto-detect CellStore Customers
            if (fileHeaders.includes('Offers Email') && fileHeaders.includes('Contact No')) {
              setDataType('customers');
              autoMap('customers', fileHeaders);
              setStep('preview');
              toast.success('CellStore Customer file detected! Auto-mapped all fields.');
            } else if (fileHeaders.includes('Invoice #') && fileHeaders.includes('Qty Sold')) {
              setDataType('sales');
              autoMap('sales', fileHeaders);
              setStep('preview');
              toast.success('CellStore POS sales file detected! Historical sales are ready for preview.');
            } else {
              setStep('type');
            }
          }
        });
      } else {
        const workbook = XLSX.read(content, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        setData(jsonData);
        if (jsonData.length > 0) {
          const fileHeaders = Object.keys(jsonData[0] as object);
          setHeaders(fileHeaders);

          // Auto-detect CellStore Customers
          if (fileHeaders.includes('Offers Email') && fileHeaders.includes('Contact No')) {
            setDataType('customers');
            autoMap('customers', fileHeaders);
            setStep('preview');
            toast.success('CellStore Customer file detected! Auto-mapped all fields.');
          } else if (fileHeaders.includes('Invoice #') && fileHeaders.includes('Qty Sold')) {
            setDataType('sales');
            autoMap('sales', fileHeaders);
            setStep('preview');
            toast.success('CellStore POS sales file detected! Historical sales are ready for preview.');
          } else {
            setStep('type');
          }
        } else {
          setStep('type');
        }
      }
    };

    if (selectedFile.name.endsWith('.csv')) {
      reader.readAsText(selectedFile);
    } else {
      reader.readAsBinaryString(selectedFile);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    } as any,
    multiple: false
  } as any);

  // 2. Mapping Logic
  const autoMap = (type: ImportDataType, fileHeaders: string[]) => {
    const fields = IMPORT_FIELDS[type];
    const newMapping: ColumnMapping = {};
    fields.forEach(field => {
      const match = fileHeaders.find(h => 
        h.toLowerCase().replace(/[^a-z0-9]/g, '') === 
        field.label.toLowerCase().replace(/[^a-z0-9]/g, '') ||
        h.toLowerCase().replace(/[^a-z0-9]/g, '') === 
        field.key.toLowerCase().replace(/[^a-z0-9]/g, '')
      );
      if (match) newMapping[field.key] = match;
    });
    setMapping(newMapping);
  };

  const handleDataTypeSelect = (type: ImportDataType) => {
    setDataType(type);
    autoMap(type, headers);
    setStep('mapping');
  };

  // 3. Validation & Transformation
  const validateRow = (row: any, fields: ImportField[], mapping: ColumnMapping) => {
    const errors: string[] = [];
    const transformed: any = {};

    fields.forEach(field => {
      const csvColumn = mapping[field.key];
      let value = csvColumn ? row[csvColumn] : undefined;

      if (typeof value === 'string') {
        value = value.replace(/\u00a0/g, ' ').trim();
      }

      if (value === '') {
        value = undefined;
      }

      if (field.required && (value === undefined || value === '')) {
        errors.push(`Missing required field: ${field.label}`);
      }

      if (value !== undefined) {
        // Transformation Layer
        if (field.type === 'number') {
          const parsedNumber = parseImportedNumber(value);
          if (parsedNumber === null) {
            errors.push(`Invalid number in ${field.label}`);
          } else {
            value = parsedNumber;
          }
        } else if (field.type === 'date') {
          const parsedDate = parseImportedDate(value);
          if (!parsedDate) {
            errors.push(`Invalid date in ${field.label}`);
          } else {
            value = parsedDate;
          }
        } else if (field.type === 'boolean') {
          const v = String(value).toLowerCase().trim();
          value = v === 'yes' || v === 'true' || v === '1' || v === 'y';
        } else if (field.type === 'email') {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
            errors.push(`Invalid email in ${field.label}`);
          }
        } else if (field.type === 'phone') {
          value = String(value).replace(/[^0-9+]/g, '');
        }
        transformed[field.key] = value;
      }
    });

    return { errors, transformed };
  };

  // 4. Import Execution
  const runImport = async () => {
    setIsProcessing(true);
    setStep('importing');

    if (dataType === 'sales') {
      await runHistoricalSalesImport();
      return;
    }

    const fields = IMPORT_FIELDS[dataType];
    const importResults: ImportResult = { total: data.length, success: 0, failed: 0, errors: [] };
    
    const batchSize = 20;
    for (let i = 0; i < data.length; i += batchSize) {
      const chunk = data.slice(i, i + batchSize);
      const batch = importMode === 'live' ? writeBatch(db) : null;

      for (let j = 0; j < chunk.length; j++) {
        const rowIndex = i + j;
        const row = chunk[j];
        const { errors, transformed } = validateRow(row, fields, mapping);

        if (errors.length > 0) {
          importResults.failed++;
          importResults.errors.push({ row: rowIndex + 1, message: errors.join(', '), data: row });
        } else {
          if (importMode === 'live' && batch) {
            const docRef = doc(collection(db, dataType));

            let payload = {
              ...withCompanyId(companyId, {}),
              ...transformed,
              created_at: transformed.created_at || new Date().toISOString(),
              imported: true,
              import_batch: file?.name
            };

            if (dataType === 'customers') {
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
                import_batch: file?.name
              };
            }

            batch.set(docRef, payload);
          }
          importResults.success++;
        }
      }

      if (importMode === 'live' && batch) {
        await batch.commit();
      }
      
      setProgress(Math.round(((i + chunk.length) / data.length) * 100));
    }

    setResults(importResults);
    setStep('results');
    setIsProcessing(false);
    if (importMode === 'live') {
      toast.success(`Import complete: ${importResults.success} succeeded, ${importResults.failed} failed`);
    } else {
      toast.info(`Dry run complete: ${importResults.success} would succeed, ${importResults.failed} would fail`);
    }
  };

  const runHistoricalSalesImport = async () => {
    const importResults: ImportResult = { total: 0, success: 0, failed: 0, errors: [] };

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
        const firstRow = rows[0];
        const createdAt = parseImportedDate(firstRow['POS Date']) || new Date().toISOString();
        const customerName = normalizeText(firstRow['Customer name']);
        const customerEmail = normalizeText(firstRow['Customer Email']).toLowerCase();
        const customerPhone = normalizeText(firstRow['Customer Phone Number']).replace(/[^0-9+]/g, '');
        const customerCompany = normalizeText(firstRow['Customer company']);

        let customer: any = null;
        if (customerEmail && customerByEmail.has(customerEmail)) {
          customer = customerByEmail.get(customerEmail);
        } else if (customerPhone && customerByPhone.has(customerPhone)) {
          customer = customerByPhone.get(customerPhone);
        } else if (customerName && customerName.toLowerCase() !== 'unassigned' && customerByName.has(customerName.toLowerCase())) {
          customer = customerByName.get(customerName.toLowerCase());
        }

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
              city: null,
              state: null,
              zip: null,
            },
            created_at: createdAt,
            imported: true,
            import_batch: file?.name
          };
          batch.set(customerRef, customerPayload);
          customer = { id: customerRef.id, ...customerPayload };
          if (customerEmail) customerByEmail.set(customerEmail, customer);
          if (customerPhone) customerByPhone.set(customerPhone, customer);
          customerByName.set(customerName.toLowerCase(), customer);
          operationCount++;
        }

        const subtotal = rows.reduce((sum, row) => {
          const price = parseImportedNumber(row['Price']) || 0;
          const qty = parseImportedNumber(row['Qty Sold']) || 0;
          return sum + price * qty;
        }, 0);
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
            subtotal,
            global_discount: globalDiscount,
            total_amount: totalAmount,
            profit,
            payment_method: 'imported',
            payment_methods: ['imported'],
            payments: [{ method: 'imported', amount: totalAmount, timestamp: createdAt }],
            staff_id: null,
            staff_name: staffName,
            created_at: createdAt,
            imported: true,
            import_batch: file?.name,
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
              sale_id: saleRef.id,
              product_id: product?.id || null,
              external_sku: sku || null,
              name: productName || 'Imported Product',
              product_name: productName || 'Imported Product',
              category: normalizeText(row['Category name']) || normalizeText(row['Product Type']) || null,
              manufacturer: normalizeText(row['Manufacturer name']) || null,
              quantity,
              original_price: originalPrice,
              unit_price: unitPrice,
              discount: lineDiscount,
              total_price: lineTotal,
              cost_price: costPrice,
              profit: lineProfit,
              created_at: createdAt,
              imported: true,
              import_batch: file?.name,
            };

            const saleItemRef = doc(collection(db, `sales/${saleRef.id}/items`));
            batch.set(saleItemRef, itemPayload);
            operationCount++;

            const saleItemIndexRef = doc(collection(db, 'sale_items'));
            batch.set(saleItemIndexRef, itemPayload);
            operationCount++;
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

      if (importMode === 'live' && batch && operationCount > 0) {
        await batch.commit();
      }

      setResults(importResults);
      setStep('results');
      setIsProcessing(false);
      if (importMode === 'live') {
        toast.success(`Historical sales import complete: ${importResults.success} invoices imported`);
      } else {
        toast.info(`Dry run complete: ${importResults.success} invoices are ready to import`);
      }
    } catch (error: any) {
      console.error('Historical sales import error:', error);
      setResults(importResults);
      setStep('results');
      setIsProcessing(false);
      toast.error(`Sales import failed: ${error.message}`);
    }
  };

  // Render Helpers
  const renderStepIndicator = () => (
    <div className="flex items-center justify-between mb-8 px-4">
      {['Upload', 'Type', 'Mapping', 'Preview', 'Results'].map((s, i) => {
        const stepIndex = ['upload', 'type', 'mapping', 'preview', 'results'].indexOf(step);
        const isActive = i <= stepIndex;
        return (
          <React.Fragment key={s}>
            <div className="flex flex-col items-center gap-2">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                isActive ? "bg-primary text-white" : "bg-gray-100 text-gray-400"
              )}>
                {i + 1}
              </div>
              <span className={cn("text-[10px] font-bold uppercase tracking-wider", isActive ? "text-primary" : "text-gray-400")}>
                {s}
              </span>
            </div>
            {i < 4 && <div className={cn("flex-1 h-px mx-4", i < stepIndex ? "bg-primary" : "bg-gray-100")} />}
          </React.Fragment>
        );
      })}
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
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
            <button onClick={() => { setFile(null); setStep('upload'); }} className="hover:text-red-500">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="p-8">
        {renderStepIndicator()}

        {step === 'upload' && (
          <div {...getRootProps()} className={cn(
            "border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer",
            isDragActive ? "border-primary bg-primary/5" : "border-gray-200 hover:border-primary/50 hover:bg-gray-50"
          )}>
            <input {...getInputProps()} />
            <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 mx-auto mb-4">
              <Upload className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Click or drag file to upload</h3>
            <p className="text-sm text-gray-500 max-w-xs mx-auto mb-6">
              Support .csv, .xlsx, and .xls files. Maximum file size 10MB.
            </p>
            <div className="flex items-center justify-center gap-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Auto-detection</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Mapping templates</span>
            </div>
          </div>
        )}

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

        {step === 'mapping' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Map Columns</h3>
              <button 
                onClick={() => autoMap(dataType, headers)}
                className="text-xs font-bold text-primary hover:underline"
              >
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
                    <p className="text-xs text-gray-500">Database field: {field.key}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300" />
                  <div className="flex-1">
                    <select
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                      value={mapping[field.key] || ''}
                      onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                    >
                      <option value="">-- Select CSV Column --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between pt-6">
              <button onClick={() => setStep('type')} className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button 
                onClick={() => setStep('preview')}
                className="appleberry-gradient text-white px-8 py-2.5 rounded-xl font-bold hover:opacity-90 shadow-lg shadow-primary/20"
              >
                Preview Data
              </button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Preview (First 20 Rows)</h3>
              <div className="flex items-center gap-4">
                <div className="flex bg-gray-100 p-1 rounded-lg">
                  <button 
                    onClick={() => setImportMode('dry')}
                    className={cn("px-4 py-1.5 text-xs font-bold rounded-md transition-all", importMode === 'dry' ? "bg-white text-primary shadow-sm" : "text-gray-500")}
                  >
                    Dry Run
                  </button>
                  <button 
                    onClick={() => setImportMode('live')}
                    className={cn("px-4 py-1.5 text-xs font-bold rounded-md transition-all", importMode === 'live' ? "bg-white text-red-600 shadow-sm" : "text-gray-500")}
                  >
                    Live Import
                  </button>
                </div>
              </div>
            </div>

            <div className="border border-gray-100 rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 font-bold text-gray-400 uppercase tracking-wider text-[10px]">Status</th>
                    {IMPORT_FIELDS[dataType].map(f => (
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
                        {IMPORT_FIELDS[dataType].map(f => (
                          <td key={f.key} className={cn("px-4 py-3 font-mono text-[11px]", errors.some(e => e.includes(f.label)) ? "text-red-500 bg-red-50" : "text-gray-600")}>
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
                className={cn(
                  "flex items-center gap-2 text-white px-8 py-2.5 rounded-xl font-bold hover:opacity-90 shadow-lg transition-all",
                  importMode === 'live' ? "bg-red-600 shadow-red-600/20" : "bg-primary shadow-primary/20"
                )}
              >
                <Play className="w-4 h-4" />
                {importMode === 'live' ? 'Start Live Import' : 'Run Simulation'}
              </button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="py-12 text-center space-y-6">
            <div className="relative w-24 h-24 mx-auto">
              <Loader2 className="w-24 h-24 text-primary animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center font-bold text-lg">
                {progress}%
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                {importMode === 'live' ? 'Importing Data...' : 'Simulating Import...'}
              </h3>
              <p className="text-sm text-gray-500">Processing row {Math.round((progress / 100) * data.length)} of {data.length}</p>
            </div>
            <div className="max-w-md mx-auto h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {step === 'results' && results && (
          <div className="space-y-8">
            <div className="grid grid-cols-3 gap-6">
              <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 text-center">
                <p className="text-sm text-gray-500 font-medium mb-1">Total Rows</p>
                <p className="text-3xl font-bold text-gray-900">{results.total}</p>
              </div>
              <div className="bg-green-50 p-6 rounded-2xl border border-green-100 text-center">
                <p className="text-sm text-green-600 font-medium mb-1">Success</p>
                <p className="text-3xl font-bold text-green-700">{results.success}</p>
              </div>
              <div className="bg-red-50 p-6 rounded-2xl border border-red-100 text-center">
                <p className="text-sm text-red-600 font-medium mb-1">Failed</p>
                <p className="text-3xl font-bold text-red-700">{results.failed}</p>
              </div>
            </div>

            {results.errors.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900">Error Report</h3>
                  <button className="flex items-center gap-2 text-xs font-bold text-primary hover:underline">
                    <Download className="w-3.5 h-3.5" /> Download Error CSV
                  </button>
                </div>
                <div className="max-h-60 overflow-y-auto border border-gray-100 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 font-bold text-gray-400 uppercase">Row</th>
                        <th className="px-4 py-2 font-bold text-gray-400 uppercase">Error Message</th>
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
                onClick={() => { setFile(null); setStep('upload'); setResults(null); setProgress(0); }}
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
