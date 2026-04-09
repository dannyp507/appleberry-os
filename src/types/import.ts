export type ImportDataType = 
  | 'customers' 
  | 'products' 
  | 'inventory' 
  | 'imei_devices' 
  | 'sales' 
  | 'purchases' 
  | 'repairs' 
  | 'invoices' 
  | 'expenses' 
  | 'payments' 
  | 'stock_take';

export interface ImportField {
  key: string;
  label: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean' | 'date' | 'email' | 'phone';
  description?: string;
}

export interface ColumnMapping {
  [dbField: string]: string; // dbField -> csvColumn
}

export interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: { row: number; message: string; data: any }[];
}

export const IMPORT_FIELDS: Record<ImportDataType, ImportField[]> = {
  customers: [
    { key: 'external_id', label: 'Id', required: false, type: 'string' },
    { key: 'created_at', label: 'Date Added', required: false, type: 'date' },
    { key: 'created_by', label: 'Created by User', required: false, type: 'string' },
    { key: 'first_name', label: 'First Name', required: true, type: 'string' },
    { key: 'last_name', label: 'Last Name', required: false, type: 'string' },
    { key: 'email', label: 'Email', required: false, type: 'email' },
    { key: 'offers_email', label: 'Offers Email', required: false, type: 'boolean' },
    { key: 'company', label: 'Company', required: false, type: 'string' },
    { key: 'phone', label: 'Contact No', required: false, type: 'phone' },
    { key: 'secondary_phone', label: 'Secondary phone', required: false, type: 'phone' },
    { key: 'fax', label: 'Fax', required: false, type: 'string' },
    { key: 'customer_type', label: 'Customer Type', required: false, type: 'string' },
    { key: 'address_line1', label: 'Shipping address one', required: false, type: 'string' },
    { key: 'address_line2', label: 'Shipping address two', required: false, type: 'string' },
    { key: 'city', label: 'Shipping city', required: false, type: 'string' },
    { key: 'state', label: 'Shipping state', required: false, type: 'string' },
    { key: 'zip', label: 'Shipping zip', required: false, type: 'string' },
    { key: 'country', label: 'Shipping country', required: false, type: 'string' },
    { key: 'checkbox', label: 'CHECKBOX', required: false, type: 'boolean' },
    { key: 'birthdate', label: 'Birthdate', required: false, type: 'date' },
  ],
  products: [
    { key: 'name', label: 'Product Name', required: true, type: 'string' },
    { key: 'category', label: 'Category', required: true, type: 'string' },
    { key: 'sku', label: 'SKU', required: false, type: 'string' },
    { key: 'barcode', label: 'Barcode', required: false, type: 'string' },
    { key: 'cost_price', label: 'Cost Price', required: true, type: 'number' },
    { key: 'selling_price', label: 'Selling Price', required: true, type: 'number' },
    { key: 'stock', label: 'Current Stock', required: true, type: 'number' },
    { key: 'imei_required', label: 'IMEI Required', required: false, type: 'boolean' },
  ],
  imei_devices: [
    { key: 'imei', label: 'IMEI Number', required: true, type: 'string' },
    { key: 'product_id', label: 'Product ID', required: true, type: 'string' },
    { key: 'status', label: 'Status', required: false, type: 'string' },
  ],
  repairs: [
    { key: 'customer_name', label: 'Customer Name', required: true, type: 'string' },
    { key: 'device_model', label: 'Device Model', required: true, type: 'string' },
    { key: 'imei', label: 'IMEI', required: false, type: 'string' },
    { key: 'issue_description', label: 'Issue', required: true, type: 'string' },
    { key: 'estimated_cost', label: 'Estimated Cost', required: false, type: 'number' },
    { key: 'status', label: 'Status', required: true, type: 'string' },
    { key: 'created_at', label: 'Date Booked', required: false, type: 'date' },
  ],
  sales: [
    { key: 'invoice_number', label: 'Invoice #', required: true, type: 'string' },
    { key: 'staff_name', label: 'Invoice Salesman', required: false, type: 'string' },
    { key: 'created_at', label: 'POS Date', required: true, type: 'date' },
    { key: 'customer_name', label: 'Customer name', required: false, type: 'string' },
    { key: 'customer_company', label: 'Customer company', required: false, type: 'string' },
    { key: 'customer_phone', label: 'Customer Phone Number', required: false, type: 'phone' },
    { key: 'customer_email', label: 'Customer Email', required: false, type: 'email' },
    { key: 'product_type', label: 'Product Type', required: false, type: 'string' },
    { key: 'manufacturer', label: 'Manufacturer name', required: false, type: 'string' },
    { key: 'category', label: 'Category name', required: false, type: 'string' },
    { key: 'product_name', label: 'Product Name', required: true, type: 'string' },
    { key: 'sku', label: 'SKU', required: false, type: 'string' },
    { key: 'quantity', label: 'Qty Sold', required: true, type: 'number' },
    { key: 'unit_price', label: 'Price', required: true, type: 'number' },
    { key: 'discount', label: 'Discount', required: false, type: 'number' },
    { key: 'total_amount', label: 'Total', required: true, type: 'number' },
    { key: 'cost_price', label: 'Cost', required: false, type: 'number' },
    { key: 'profit', label: 'Profit', required: false, type: 'number' },
  ],
  inventory: [],
  purchases: [],
  invoices: [],
  expenses: [
    { key: 'title', label: 'Expense Title', required: true, type: 'string' },
    { key: 'amount', label: 'Amount', required: true, type: 'number' },
    { key: 'category', label: 'Category', required: true, type: 'string' },
    { key: 'date', label: 'Date', required: true, type: 'date' },
  ],
  payments: [],
  stock_take: []
};
