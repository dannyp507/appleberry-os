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
  /** Alternative CSV column names (e.g. CellStore header variants) that autoMap will also try */
  aliases?: string[];
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
    { key: 'first_name', label: 'First Name', required: true, type: 'string', aliases: ['First name'] },
    { key: 'last_name', label: 'Last Name', required: false, type: 'string', aliases: ['Last name'] },
    { key: 'email', label: 'Email', required: false, type: 'email', aliases: ['Email Address', 'email_address'] },
    { key: 'offers_email', label: 'Offers Email', required: false, type: 'boolean' },
    { key: 'company', label: 'Company', required: false, type: 'string', aliases: ['Company Name', 'Business'] },
    { key: 'phone', label: 'Contact No', required: false, type: 'phone', aliases: ['Phone', 'Mobile', 'Cell', 'Telephone', 'Contact Number'] },
    { key: 'secondary_phone', label: 'Secondary phone', required: false, type: 'phone', aliases: ['Secondary Phone', 'Alt Phone'] },
    { key: 'fax', label: 'Fax', required: false, type: 'string' },
    { key: 'customer_type', label: 'Customer Type', required: false, type: 'string' },
    { key: 'address_line1', label: 'Shipping address one', required: false, type: 'string', aliases: ['Address', 'Street Address', 'Address Line 1'] },
    { key: 'address_line2', label: 'Shipping address two', required: false, type: 'string', aliases: ['Address Line 2'] },
    { key: 'city', label: 'Shipping city', required: false, type: 'string', aliases: ['City', 'Town'] },
    { key: 'state', label: 'Shipping state', required: false, type: 'string', aliases: ['State', 'Province'] },
    { key: 'zip', label: 'Shipping zip', required: false, type: 'string', aliases: ['Zip', 'Postal Code', 'Post Code'] },
    { key: 'country', label: 'Shipping country', required: false, type: 'string', aliases: ['Country'] },
    { key: 'checkbox', label: 'CHECKBOX', required: false, type: 'boolean' },
    { key: 'birthdate', label: 'Birthdate', required: false, type: 'date', aliases: ['Date of Birth', 'DOB'] },
    { key: 'notes', label: 'Notes', required: false, type: 'string', aliases: ['Note', 'Comments', 'Remarks'] },
  ],

  products: [
    { key: 'name', label: 'Product Name', required: true, type: 'string', aliases: ['Name', 'Item Name', 'Description'] },
    { key: 'category', label: 'Category name', required: false, type: 'string', aliases: ['Category', 'category_name', 'Type'] },
    { key: 'manufacturer', label: 'Manufacturer Name', required: false, type: 'string', aliases: ['Manufacturer', 'Brand', 'Vendor'] },
    { key: 'product_type', label: 'Product Type', required: false, type: 'string', aliases: ['Type'] },
    { key: 'model', label: 'Model', required: false, type: 'string' },
    { key: 'sku', label: 'SKU', required: false, type: 'string', aliases: ['Code', 'Product Code', 'Item Code', 'Part Number'] },
    { key: 'barcode', label: 'Barcode', required: false, type: 'string', aliases: ['UPC', 'EAN', 'GTIN'] },
    { key: 'cost_price', label: 'Cost Price', required: false, type: 'number', aliases: ['Cost', 'Purchase Price', 'Buy Price'] },
    { key: 'selling_price', label: 'Selling Price', required: true, type: 'number', aliases: ['Price', 'Sale Price', 'Retail Price', 'RRP'] },
    { key: 'stock', label: 'Current inventory', required: false, type: 'number', aliases: ['Current Stock', 'Stock', 'Quantity', 'Qty', 'On Hand', 'Stock Level', 'Current Stock Level'] },
    { key: 'reorder_level', label: 'Reorder Level', required: false, type: 'number', aliases: ['Min Stock', 'Reorder Point', 'Low Stock Level'] },
    { key: 'description', label: 'Description', required: false, type: 'string', aliases: ['Details', 'Notes', 'Product Description'] },
    { key: 'imei_required', label: 'IMEI Required', required: false, type: 'boolean', aliases: ['Serialised', 'Track IMEI'] },
    { key: 'status', label: 'Status', required: false, type: 'string', aliases: ['Active', 'Enabled'] },
  ],

  inventory: [
    // Alias of products — same schema, kept separate for clarity
    { key: 'name', label: 'Product Name', required: true, type: 'string', aliases: ['Name', 'Item Name'] },
    { key: 'category', label: 'Category name', required: false, type: 'string', aliases: ['Category', 'category_name'] },
    { key: 'sku', label: 'SKU', required: false, type: 'string', aliases: ['Code', 'Product Code'] },
    { key: 'barcode', label: 'Barcode', required: false, type: 'string' },
    { key: 'cost_price', label: 'Cost Price', required: false, type: 'number', aliases: ['Cost', 'Purchase Price'] },
    { key: 'selling_price', label: 'Selling Price', required: true, type: 'number', aliases: ['Price', 'Sale Price'] },
    { key: 'stock', label: 'Current inventory', required: false, type: 'number', aliases: ['Current Stock', 'Stock', 'Quantity', 'Qty', 'On Hand'] },
    { key: 'reorder_level', label: 'Reorder Level', required: false, type: 'number', aliases: ['Min Stock'] },
    { key: 'description', label: 'Description', required: false, type: 'string' },
  ],

  imei_devices: [
    { key: 'imei', label: 'IMEI Number', required: true, type: 'string', aliases: ['IMEI', 'Serial Number', 'Serial'] },
    { key: 'product_name', label: 'Product Name', required: false, type: 'string', aliases: ['Product', 'Name', 'Model'] },
    { key: 'product_id', label: 'Product ID', required: false, type: 'string' },
    { key: 'status', label: 'Status', required: false, type: 'string', aliases: ['Condition', 'State'] },
    { key: 'purchase_price', label: 'Purchase Price', required: false, type: 'number', aliases: ['Cost', 'Buy Price'] },
    { key: 'selling_price', label: 'Selling Price', required: false, type: 'number', aliases: ['Price'] },
    { key: 'notes', label: 'Notes', required: false, type: 'string' },
  ],

  repairs: [
    { key: 'external_id', label: 'Id', required: false, type: 'string', aliases: ['Rep #', 'Ticket #', 'Repair ID', 'Job #'] },
    { key: 'created_at', label: 'Date Added', required: false, type: 'date', aliases: ['Date Booked', 'Date Created', 'Booked Date', 'Created Date'] },
    { key: 'customer_name', label: 'Customer Name', required: true, type: 'string', aliases: ['Customer', 'Client Name', 'Client'] },
    { key: 'customer_phone', label: 'Customer Phone', required: false, type: 'phone', aliases: ['Phone', 'Contact No', 'Mobile', 'Customer Contact No'] },
    { key: 'customer_email', label: 'Customer Email', required: false, type: 'email', aliases: ['Email', 'Customer Email Address'] },
    { key: 'device_model', label: 'Device', required: true, type: 'string', aliases: ['Device Model', 'Model', 'Make/Model', 'Device/Model'] },
    { key: 'imei', label: 'IMEI', required: false, type: 'string', aliases: ['IMEI Number', 'Serial Number', 'Serial'] },
    { key: 'issue_description', label: 'Reported Issue', required: false, type: 'string', aliases: ['Issue', 'Problem', 'Fault', 'Reported Problem', 'Fault Description', 'Description'] },
    { key: 'estimated_cost', label: 'Estimated Cost', required: false, type: 'number', aliases: ['Estimate', 'Quote', 'Quoted Price'] },
    { key: 'final_price', label: 'Final Price', required: false, type: 'number', aliases: ['Price', 'Repair Cost', 'Total', 'Amount Charged'] },
    { key: 'status', label: 'Status', required: false, type: 'string', aliases: ['Repair Status', 'Job Status'] },
    { key: 'technician', label: 'Technician', required: false, type: 'string', aliases: ['Tech', 'Assigned To', 'Staff', 'Repairer'] },
    { key: 'notes', label: 'Notes', required: false, type: 'string', aliases: ['Note', 'Comments', 'Internal Notes'] },
    { key: 'completed_at', label: 'Completed Date', required: false, type: 'date', aliases: ['Date Completed', 'Collected Date', 'Collection Date'] },
  ],

  sales: [
    { key: 'invoice_number', label: 'Invoice #', required: true, type: 'string', aliases: ['Invoice Number', 'Sale #', 'Receipt #'] },
    { key: 'staff_name', label: 'Invoice Salesman', required: false, type: 'string', aliases: ['Salesman', 'Staff', 'Cashier', 'Served By'] },
    { key: 'created_at', label: 'POS Date', required: true, type: 'date', aliases: ['Date', 'Sale Date', 'Invoice Date', 'Transaction Date'] },
    { key: 'customer_name', label: 'Customer name', required: false, type: 'string', aliases: ['Customer', 'Client'] },
    { key: 'customer_company', label: 'Customer company', required: false, type: 'string', aliases: ['Company', 'Business'] },
    { key: 'customer_phone', label: 'Customer Phone Number', required: false, type: 'phone', aliases: ['Phone', 'Contact No'] },
    { key: 'customer_email', label: 'Customer Email', required: false, type: 'email', aliases: ['Email'] },
    { key: 'product_type', label: 'Product Type', required: false, type: 'string' },
    { key: 'manufacturer', label: 'Manufacturer name', required: false, type: 'string', aliases: ['Brand', 'Manufacturer'] },
    { key: 'category', label: 'Category name', required: false, type: 'string', aliases: ['Category'] },
    { key: 'product_name', label: 'Product Name', required: true, type: 'string', aliases: ['Product', 'Item', 'Description'] },
    { key: 'sku', label: 'SKU', required: false, type: 'string', aliases: ['Code', 'Product Code'] },
    { key: 'quantity', label: 'Qty Sold', required: true, type: 'number', aliases: ['Qty', 'Quantity', 'Units'] },
    { key: 'unit_price', label: 'Price', required: true, type: 'number', aliases: ['Unit Price', 'Selling Price', 'Rate'] },
    { key: 'discount', label: 'Discount', required: false, type: 'number', aliases: ['Disc', 'Discount Amount', 'Reduction'] },
    { key: 'total_amount', label: 'Total', required: true, type: 'number', aliases: ['Total Amount', 'Amount', 'Sale Total'] },
    { key: 'cost_price', label: 'Cost', required: false, type: 'number', aliases: ['Cost Price', 'Purchase Cost'] },
    { key: 'profit', label: 'Profit', required: false, type: 'number', aliases: ['Margin', 'Gross Profit'] },
    { key: 'payment_method', label: 'Payment Method', required: false, type: 'string', aliases: ['Payment', 'Paid By', 'Method'] },
  ],

  invoices: [
    { key: 'invoice_number', label: 'Invoice #', required: true, type: 'string', aliases: ['Invoice Number', 'Ref #', 'Reference'] },
    { key: 'created_at', label: 'Invoice Date', required: false, type: 'date', aliases: ['Date', 'Date Added', 'POS Date'] },
    { key: 'customer_name', label: 'Customer Name', required: false, type: 'string', aliases: ['Customer', 'Client', 'Bill To'] },
    { key: 'customer_phone', label: 'Customer Phone', required: false, type: 'phone', aliases: ['Phone', 'Contact No'] },
    { key: 'customer_email', label: 'Customer Email', required: false, type: 'email', aliases: ['Email'] },
    { key: 'subtotal', label: 'Subtotal', required: false, type: 'number', aliases: ['Sub Total', 'Before Tax'] },
    { key: 'tax', label: 'Tax', required: false, type: 'number', aliases: ['VAT', 'GST', 'Tax Amount'] },
    { key: 'discount', label: 'Discount', required: false, type: 'number', aliases: ['Disc', 'Reduction'] },
    { key: 'total_amount', label: 'Total', required: true, type: 'number', aliases: ['Total Amount', 'Amount', 'Grand Total', 'Invoice Total'] },
    { key: 'payment_method', label: 'Payment Method', required: false, type: 'string', aliases: ['Payment', 'Paid By'] },
    { key: 'status', label: 'Status', required: false, type: 'string', aliases: ['Payment Status', 'Paid'] },
    { key: 'notes', label: 'Notes', required: false, type: 'string', aliases: ['Note', 'Comments'] },
    { key: 'staff_name', label: 'Salesman', required: false, type: 'string', aliases: ['Invoice Salesman', 'Staff', 'Cashier'] },
  ],

  purchases: [
    { key: 'external_id', label: 'Id', required: false, type: 'string', aliases: ['PO #', 'Purchase Order #', 'Order #'] },
    { key: 'created_at', label: 'Date', required: false, type: 'date', aliases: ['Date Added', 'Order Date', 'Purchase Date'] },
    { key: 'supplier', label: 'Supplier', required: false, type: 'string', aliases: ['Vendor', 'Supplier Name', 'From'] },
    { key: 'product_name', label: 'Product Name', required: true, type: 'string', aliases: ['Product', 'Item', 'Description', 'Name'] },
    { key: 'sku', label: 'SKU', required: false, type: 'string', aliases: ['Code', 'Product Code'] },
    { key: 'quantity', label: 'Quantity', required: true, type: 'number', aliases: ['Qty', 'Units', 'Qty Purchased'] },
    { key: 'unit_cost', label: 'Unit Cost', required: true, type: 'number', aliases: ['Cost', 'Cost Price', 'Buy Price', 'Purchase Price'] },
    { key: 'total_cost', label: 'Total Cost', required: false, type: 'number', aliases: ['Total', 'Total Amount', 'Line Total'] },
    { key: 'status', label: 'Status', required: false, type: 'string', aliases: ['PO Status', 'Order Status'] },
    { key: 'notes', label: 'Notes', required: false, type: 'string', aliases: ['Note', 'Comments', 'Reference'] },
  ],

  expenses: [
    { key: 'external_id', label: 'Id', required: false, type: 'string' },
    { key: 'date', label: 'Date', required: true, type: 'date', aliases: ['Expense Date', 'Date Added', 'Transaction Date'] },
    { key: 'title', label: 'Expense', required: true, type: 'string', aliases: ['Expense Title', 'Description', 'Name', 'Details'] },
    { key: 'amount', label: 'Amount', required: true, type: 'number', aliases: ['Total', 'Cost', 'Expense Amount'] },
    { key: 'category', label: 'Category', required: false, type: 'string', aliases: ['Expense Category', 'Type', 'Expense Type'] },
    { key: 'payment_method', label: 'Payment Method', required: false, type: 'string', aliases: ['Payment', 'Paid By', 'Method'] },
    { key: 'reference', label: 'Reference', required: false, type: 'string', aliases: ['Ref', 'Receipt #', 'Invoice #', 'Note'] },
    { key: 'notes', label: 'Notes', required: false, type: 'string', aliases: ['Note', 'Comments'] },
    { key: 'staff_name', label: 'User', required: false, type: 'string', aliases: ['Created by User', 'Staff', 'Added By'] },
  ],

  payments: [
    { key: 'created_at', label: 'Date', required: true, type: 'date', aliases: ['Payment Date', 'Date Added', 'Transaction Date'] },
    { key: 'invoice_number', label: 'Invoice #', required: false, type: 'string', aliases: ['Invoice Number', 'Reference', 'Ref'] },
    { key: 'customer_name', label: 'Customer Name', required: false, type: 'string', aliases: ['Customer', 'Client'] },
    { key: 'amount', label: 'Amount', required: true, type: 'number', aliases: ['Payment Amount', 'Total', 'Paid'] },
    { key: 'payment_method', label: 'Payment Method', required: true, type: 'string', aliases: ['Method', 'Payment Type', 'Paid By', 'Tender'] },
    { key: 'reference', label: 'Reference', required: false, type: 'string', aliases: ['Receipt #', 'Transaction #', 'Auth Code'] },
    { key: 'notes', label: 'Notes', required: false, type: 'string', aliases: ['Note', 'Comments'] },
  ],

  stock_take: [
    { key: 'product_name', label: 'Product Name', required: true, type: 'string', aliases: ['Product', 'Name', 'Item', 'Description'] },
    { key: 'sku', label: 'SKU', required: false, type: 'string', aliases: ['Code', 'Product Code', 'Barcode'] },
    { key: 'category', label: 'Category', required: false, type: 'string', aliases: ['Category name'] },
    { key: 'expected_stock', label: 'Expected', required: false, type: 'number', aliases: ['System Count', 'On Hand', 'Stock Level', 'Expected Stock'] },
    { key: 'counted_stock', label: 'Counted', required: true, type: 'number', aliases: ['Physical Count', 'Actual Count', 'Physical Stock', 'Count'] },
    { key: 'variance', label: 'Variance', required: false, type: 'number', aliases: ['Difference', 'Discrepancy'] },
    { key: 'notes', label: 'Notes', required: false, type: 'string', aliases: ['Note', 'Comments'] },
  ],
};
