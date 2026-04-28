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
  skipped: number;
  failed: number;
  errors: { row: number; message: string; data: any }[];
}

export const IMPORT_FIELDS: Record<ImportDataType, ImportField[]> = {
  // ── CUSTOMERS ─────────────────────────────────────────────────────────────
  // CellStore columns: Id, Date Added, Created by User, First name, Last name,
  //   Email, Offers Email, Company, Contact No, Secondary phone, Fax,
  //   Customer Type, Shipping address one, Shipping address two, Shipping city,
  //   Shipping state, Shipping zip, Shipping country, CHECKBOX, Birthdate, Notes
  customers: [
    { key: 'external_id',      label: 'Id',                   required: false, type: 'string' },
    { key: 'created_at',       label: 'Date Added',           required: false, type: 'date' },
    { key: 'created_by',       label: 'Created by User',      required: false, type: 'string' },
    { key: 'first_name',       label: 'First name',           required: true,  type: 'string',  aliases: ['First Name'] },
    { key: 'last_name',        label: 'Last name',            required: false, type: 'string',  aliases: ['Last Name'] },
    { key: 'email',            label: 'Email',                required: false, type: 'email',   aliases: ['Email Address', 'email_address'] },
    { key: 'offers_email',     label: 'Offers Email',         required: false, type: 'boolean' },
    { key: 'company',          label: 'Company',              required: false, type: 'string',  aliases: ['Company Name', 'Business'] },
    { key: 'phone',            label: 'Contact No',           required: false, type: 'phone',   aliases: ['Phone', 'Mobile', 'Cell', 'Telephone', 'Contact Number'] },
    { key: 'secondary_phone',  label: 'Secondary phone',      required: false, type: 'phone',   aliases: ['Secondary Phone', 'Alt Phone'] },
    { key: 'fax',              label: 'Fax',                  required: false, type: 'string' },
    { key: 'customer_type',    label: 'Customer Type',        required: false, type: 'string' },
    { key: 'address_line1',    label: 'Shipping address one', required: false, type: 'string',  aliases: ['Address', 'Street Address', 'Address Line 1'] },
    { key: 'address_line2',    label: 'Shipping address two', required: false, type: 'string',  aliases: ['Address Line 2'] },
    { key: 'city',             label: 'Shipping city',        required: false, type: 'string',  aliases: ['City', 'Town'] },
    { key: 'state',            label: 'Shipping state',       required: false, type: 'string',  aliases: ['State', 'Province'] },
    { key: 'zip',              label: 'Shipping zip',         required: false, type: 'string',  aliases: ['Zip', 'Postal Code', 'Post Code'] },
    { key: 'country',          label: 'Shipping country',     required: false, type: 'string',  aliases: ['Country'] },
    { key: 'checkbox',         label: 'CHECKBOX',             required: false, type: 'boolean' },
    { key: 'birthdate',        label: 'Birthdate',            required: false, type: 'date',    aliases: ['Date of Birth', 'DOB'] },
    { key: 'notes',            label: 'Notes',                required: false, type: 'string',  aliases: ['Note', 'Comments', 'Remarks'] },
  ],

  // ── PRODUCTS / INVENTORY ──────────────────────────────────────────────────
  // CellStore columns: Sub-Domain, Id, Product Type, Category name,
  //   Manufacturer name, Product name, Color Name, Storage, Physical Condition,
  //   SKU, Cost price, Selling Price, Current inventory
  products: [
    { key: 'name',              label: 'Product name',      required: true,  type: 'string',  aliases: ['Product Name', 'Name', 'Item Name', 'Description'] },
    { key: 'product_type',      label: 'Product Type',      required: false, type: 'string',  aliases: ['Type'] },
    { key: 'category',          label: 'Category name',     required: false, type: 'string',  aliases: ['Category', 'category_name'] },
    { key: 'manufacturer',      label: 'Manufacturer name', required: false, type: 'string',  aliases: ['Manufacturer', 'Manufacturer Name', 'Brand', 'Vendor'] },
    { key: 'color_name',        label: 'Color Name',        required: false, type: 'string',  aliases: ['Color', 'Colour'] },
    { key: 'storage',           label: 'Storage',           required: false, type: 'string' },
    { key: 'physical_condition',label: 'Physical Condition',required: false, type: 'string',  aliases: ['Condition', 'Grade'] },
    { key: 'sku',               label: 'SKU',               required: false, type: 'string',  aliases: ['Code', 'Product Code', 'Item Code', 'Part Number'] },
    { key: 'cost_price',        label: 'Cost price',        required: false, type: 'number',  aliases: ['Cost Price', 'Cost', 'Purchase Price', 'Buy Price'] },
    { key: 'selling_price',     label: 'Selling Price',     required: true,  type: 'number',  aliases: ['Price', 'Sale Price', 'Retail Price', 'RRP'] },
    { key: 'stock',             label: 'Current inventory', required: false, type: 'number',  aliases: ['Current Stock', 'Stock', 'Quantity', 'Qty', 'On Hand', 'Stock Level'] },
    { key: 'reorder_level',     label: 'Reorder Level',     required: false, type: 'number',  aliases: ['Min Stock', 'Reorder Point', 'Low Stock Level'] },
    { key: 'barcode',           label: 'Barcode',           required: false, type: 'string',  aliases: ['UPC', 'EAN', 'GTIN'] },
    { key: 'description',       label: 'Description',       required: false, type: 'string',  aliases: ['Details', 'Notes', 'Product Description'] },
    { key: 'status',            label: 'Status',            required: false, type: 'string',  aliases: ['Active', 'Enabled'] },
  ],

  // Alias of products — same schema kept separate for UI label
  inventory: [
    { key: 'name',              label: 'Product name',      required: true,  type: 'string',  aliases: ['Product Name', 'Name', 'Item Name'] },
    { key: 'product_type',      label: 'Product Type',      required: false, type: 'string' },
    { key: 'category',          label: 'Category name',     required: false, type: 'string',  aliases: ['Category', 'category_name'] },
    { key: 'manufacturer',      label: 'Manufacturer name', required: false, type: 'string',  aliases: ['Manufacturer', 'Manufacturer Name', 'Brand'] },
    { key: 'color_name',        label: 'Color Name',        required: false, type: 'string' },
    { key: 'storage',           label: 'Storage',           required: false, type: 'string' },
    { key: 'physical_condition',label: 'Physical Condition',required: false, type: 'string' },
    { key: 'sku',               label: 'SKU',               required: false, type: 'string',  aliases: ['Code', 'Product Code'] },
    { key: 'cost_price',        label: 'Cost price',        required: false, type: 'number',  aliases: ['Cost Price', 'Cost', 'Purchase Price'] },
    { key: 'selling_price',     label: 'Selling Price',     required: true,  type: 'number',  aliases: ['Price', 'Sale Price'] },
    { key: 'stock',             label: 'Current inventory', required: false, type: 'number',  aliases: ['Current Stock', 'Stock', 'Quantity', 'Qty', 'On Hand'] },
    { key: 'reorder_level',     label: 'Reorder Level',     required: false, type: 'number',  aliases: ['Min Stock'] },
    { key: 'description',       label: 'Description',       required: false, type: 'string' },
  ],

  // ── IMEI / SERIALISED DEVICES ─────────────────────────────────────────────
  // CellStore columns: Serial number, Physical Condition, Lot #, PO number, …
  imei_devices: [
    { key: 'imei',              label: 'Serial number',     required: true,  type: 'string',  aliases: ['IMEI', 'IMEI Number', 'Serial Number', 'Serial No', 'Serial'] },
    { key: 'product_name',      label: 'Product Name',      required: false, type: 'string',  aliases: ['Product', 'Name', 'Model', 'Description'] },
    { key: 'product_id',        label: 'Product ID',        required: false, type: 'string' },
    { key: 'physical_condition',label: 'Physical Condition',required: false, type: 'string',  aliases: ['Condition', 'Grade', 'Status'] },
    { key: 'lot_number',        label: 'Lot #',             required: false, type: 'string',  aliases: ['Lot Number', 'Lot', 'Batch'] },
    { key: 'po_number',         label: 'PO number',         required: false, type: 'string',  aliases: ['PO #', 'Purchase Order', 'PO Number'] },
    { key: 'purchase_price',    label: 'Purchase Price',    required: false, type: 'number',  aliases: ['Cost', 'Buy Price', 'Cost Price'] },
    { key: 'selling_price',     label: 'Selling Price',     required: false, type: 'number',  aliases: ['Price'] },
    { key: 'notes',             label: 'Notes',             required: false, type: 'string' },
  ],

  // ── REPAIRS ───────────────────────────────────────────────────────────────
  // CellStore columns: Sub-Domain, Ticket #, Tech Assigned, Problem,
  //   IMEI/Serial No., Brand, Model, More Details, Created, Status, Last Update
  // NOTE: CellStore does NOT export customer name in the repairs CSV.
  //   Brand + Model together identify the device.
  repairs: [
    { key: 'external_id',       label: 'Ticket #',          required: false, type: 'string',  aliases: ['Rep #', 'Repair ID', 'Job #', 'Id'] },
    { key: 'created_at',        label: 'Created',           required: false, type: 'date',    aliases: ['Date Booked', 'Date Added', 'Date Created', 'Booked Date'] },
    { key: 'brand',             label: 'Brand',             required: false, type: 'string',  aliases: ['Make', 'Manufacturer'] },
    { key: 'model',             label: 'Model',             required: false, type: 'string',  aliases: ['Device Model', 'Device'] },
    { key: 'device_model',      label: 'Device',            required: false, type: 'string',  aliases: ['Make/Model', 'Device/Model'] },
    { key: 'imei',              label: 'IMEI/Serial No.',   required: false, type: 'string',  aliases: ['IMEI', 'IMEI Number', 'Serial Number', 'Serial'] },
    { key: 'issue_description', label: 'Problem',           required: false, type: 'string',  aliases: ['Reported Issue', 'Issue', 'Fault', 'Fault Description', 'Reported Problem', 'Description'] },
    { key: 'technician',        label: 'Tech Assigned',     required: false, type: 'string',  aliases: ['Technician', 'Tech', 'Assigned To', 'Staff', 'Repairer'] },
    { key: 'notes',             label: 'More Details',      required: false, type: 'string',  aliases: ['Notes', 'Note', 'Comments', 'Internal Notes'] },
    { key: 'status',            label: 'Status',            required: false, type: 'string',  aliases: ['Repair Status', 'Job Status'] },
    { key: 'updated_at',        label: 'Last Update',       required: false, type: 'date',    aliases: ['Last Updated', 'Updated Date'] },
    { key: 'customer_name',     label: 'Customer Name',     required: false, type: 'string',  aliases: ['Customer', 'Client Name', 'Client'] },
    { key: 'customer_phone',    label: 'Customer Phone',    required: false, type: 'phone',   aliases: ['Phone', 'Contact No', 'Mobile', 'Customer Contact No'] },
    { key: 'customer_email',    label: 'Customer Email',    required: false, type: 'email',   aliases: ['Email', 'Customer Email Address'] },
    { key: 'estimated_cost',    label: 'Estimated Cost',    required: false, type: 'number',  aliases: ['Estimate', 'Quote', 'Quoted Price'] },
    { key: 'final_price',       label: 'Final Price',       required: false, type: 'number',  aliases: ['Price', 'Repair Cost', 'Total', 'Amount Charged'] },
    { key: 'completed_at',      label: 'Completed Date',    required: false, type: 'date',    aliases: ['Date Completed', 'Collected Date', 'Collection Date'] },
  ],

  // ── HISTORICAL POS SALES ──────────────────────────────────────────────────
  // CellStore columns: Invoice #, Invoice Salesman, POS Date, Customer name,
  //   Customer company, Customer Phone Number, Customer Email, Product Type,
  //   Manufacturer name, Category name, Product Name, SKU, Qty Sold, Price,
  //   Discount, Total, Cost, Profit, Payment Method
  sales: [
    { key: 'invoice_number',    label: 'Invoice #',            required: true,  type: 'string',  aliases: ['Invoice Number', 'Sale #', 'Receipt #'] },
    { key: 'staff_name',        label: 'Invoice Salesman',     required: false, type: 'string',  aliases: ['Salesman', 'Staff', 'Cashier', 'Served By', 'Sales Person'] },
    { key: 'created_at',        label: 'POS Date',             required: true,  type: 'date',    aliases: ['Date', 'Sale Date', 'Invoice Date', 'Transaction Date'] },
    { key: 'customer_name',     label: 'Customer name',        required: false, type: 'string',  aliases: ['Customer Name', 'Customer', 'Client'] },
    { key: 'customer_company',  label: 'Customer company',     required: false, type: 'string',  aliases: ['Company', 'Business', 'Customer Company'] },
    { key: 'customer_phone',    label: 'Customer Phone Number',required: false, type: 'phone',   aliases: ['Phone', 'Contact No', 'Customer Phone'] },
    { key: 'customer_email',    label: 'Customer Email',       required: false, type: 'email',   aliases: ['Email'] },
    { key: 'product_type',      label: 'Product Type',         required: false, type: 'string' },
    { key: 'manufacturer',      label: 'Manufacturer name',    required: false, type: 'string',  aliases: ['Brand', 'Manufacturer', 'Manufacturer Name'] },
    { key: 'category',          label: 'Category name',        required: false, type: 'string',  aliases: ['Category'] },
    { key: 'product_name',      label: 'Product Name',         required: true,  type: 'string',  aliases: ['Product', 'Item', 'Description'] },
    { key: 'sku',               label: 'SKU',                  required: false, type: 'string',  aliases: ['Code', 'Product Code'] },
    { key: 'quantity',          label: 'Qty Sold',             required: true,  type: 'number',  aliases: ['Qty', 'Quantity', 'Units'] },
    { key: 'unit_price',        label: 'Price',                required: true,  type: 'number',  aliases: ['Unit Price', 'Selling Price', 'Rate'] },
    { key: 'discount',          label: 'Discount',             required: false, type: 'number',  aliases: ['Disc', 'Discount Amount', 'Reduction'] },
    { key: 'total_amount',      label: 'Total',                required: true,  type: 'number',  aliases: ['Total Amount', 'Amount', 'Sale Total'] },
    { key: 'cost_price',        label: 'Cost',                 required: false, type: 'number',  aliases: ['Cost Price', 'Purchase Cost'] },
    { key: 'profit',            label: 'Profit',               required: false, type: 'number',  aliases: ['Margin', 'Gross Profit'] },
    { key: 'payment_method',    label: 'Payment Method',       required: false, type: 'string',  aliases: ['Payment', 'Paid By', 'Method'] },
  ],

  // ── INVOICES ──────────────────────────────────────────────────────────────
  // CellStore columns: Sub-Domain, Date, Time, Invoice No, Customer Name,
  //   Customer Email, Customer Phone Number, Customer Address, Sales Person,
  //   Taxable, Taxes, Non Taxable, Total
  invoices: [
    { key: 'invoice_number',    label: 'Invoice No',           required: true,  type: 'string',  aliases: ['Invoice #', 'Invoice Number', 'Ref #', 'Reference', 'Order No'] },
    { key: 'created_at',        label: 'Date',                 required: false, type: 'date',    aliases: ['Invoice Date', 'Date Added', 'POS Date', 'Order Date'] },
    { key: 'time',              label: 'Time',                 required: false, type: 'string',  description: 'Separate time column (combined with Date on import)' },
    { key: 'customer_name',     label: 'Customer Name',        required: false, type: 'string',  aliases: ['Customer', 'Client', 'Bill To'] },
    { key: 'customer_email',    label: 'Customer Email',       required: false, type: 'email',   aliases: ['Email'] },
    { key: 'customer_phone',    label: 'Customer Phone Number',required: false, type: 'phone',   aliases: ['Customer Phone', 'Phone', 'Contact No'] },
    { key: 'customer_address',  label: 'Customer Address',     required: false, type: 'string',  aliases: ['Address', 'Shipping Address'] },
    { key: 'staff_name',        label: 'Sales Person',         required: false, type: 'string',  aliases: ['Salesman', 'Invoice Salesman', 'Staff', 'Cashier'] },
    { key: 'subtotal',          label: 'Taxable',              required: false, type: 'number',  aliases: ['Subtotal', 'Sub Total', 'Before Tax', 'Non Taxable'] },
    { key: 'tax',               label: 'Taxes',                required: false, type: 'number',  aliases: ['Tax', 'VAT', 'GST', 'Tax Amount'] },
    { key: 'total_amount',      label: 'Total',                required: true,  type: 'number',  aliases: ['Total Amount', 'Amount', 'Grand Total', 'Invoice Total'] },
    { key: 'payment_method',    label: 'Payment Method',       required: false, type: 'string',  aliases: ['Payment', 'Paid By'] },
    { key: 'status',            label: 'Status',               required: false, type: 'string',  aliases: ['Payment Status', 'Paid'] },
    { key: 'notes',             label: 'Notes',                required: false, type: 'string',  aliases: ['Note', 'Comments'] },
  ],

  // ── PURCHASE ORDERS ───────────────────────────────────────────────────────
  // CellStore columns: Sub-Domain, PO #, Suppiler Name (note typo!), PO Date,
  //   Product Type, Manufacturer name, Category name, Product Name,
  //   Qty Purchased, Cost, Total
  purchases: [
    { key: 'external_id',       label: 'PO #',                 required: false, type: 'string',  aliases: ['Id', 'Purchase Order #', 'Order #'] },
    { key: 'supplier',          label: 'Suppiler Name',         required: false, type: 'string',  aliases: ['Supplier Name', 'Supplier', 'Vendor', 'From'] },
    { key: 'created_at',        label: 'PO Date',              required: false, type: 'date',    aliases: ['Date', 'Date Added', 'Order Date', 'Purchase Date'] },
    { key: 'product_type',      label: 'Product Type',         required: false, type: 'string',  aliases: ['Type'] },
    { key: 'manufacturer',      label: 'Manufacturer name',    required: false, type: 'string',  aliases: ['Manufacturer', 'Manufacturer Name', 'Brand'] },
    { key: 'category',          label: 'Category name',        required: false, type: 'string',  aliases: ['Category'] },
    { key: 'product_name',      label: 'Product Name',         required: true,  type: 'string',  aliases: ['Product', 'Item', 'Description', 'Name'] },
    { key: 'sku',               label: 'SKU',                  required: false, type: 'string',  aliases: ['Code', 'Product Code'] },
    { key: 'quantity',          label: 'Qty Purchased',        required: true,  type: 'number',  aliases: ['Quantity', 'Qty', 'Units'] },
    { key: 'unit_cost',         label: 'Cost',                 required: true,  type: 'number',  aliases: ['Unit Cost', 'Cost Price', 'Buy Price', 'Purchase Price'] },
    { key: 'total_cost',        label: 'Total',                required: false, type: 'number',  aliases: ['Total Cost', 'Total Amount', 'Line Total'] },
    { key: 'status',            label: 'Status',               required: false, type: 'string',  aliases: ['PO Status', 'Order Status'] },
    { key: 'notes',             label: 'Notes',                required: false, type: 'string',  aliases: ['Note', 'Comments', 'Reference'] },
  ],

  // ── EXPENSES ──────────────────────────────────────────────────────────────
  // CellStore "expenses" columns: Sub-Domain, Expense Type, Vendor Name,
  //   Bill Date, Bill Number, Bill Amount, Bill Paid Date, Reference
  // CellStore "petty_cash" columns: Sub-Domain, Date Added, Add / Sub,
  //   Amount, Reason  ← both file types route to this schema
  expenses: [
    { key: 'external_id',       label: 'Id',                   required: false, type: 'string' },
    { key: 'date',              label: 'Bill Date',            required: true,  type: 'date',    aliases: ['Date', 'Date Added', 'Expense Date', 'Transaction Date'] },
    { key: 'title',             label: 'Vendor Name',          required: true,  type: 'string',  aliases: ['Expense', 'Expense Title', 'Description', 'Name', 'Details', 'Reason'] },
    { key: 'amount',            label: 'Bill Amount',          required: true,  type: 'number',  aliases: ['Amount', 'Total', 'Cost', 'Expense Amount'] },
    { key: 'category',          label: 'Expense Type',         required: false, type: 'string',  aliases: ['Category', 'Expense Category', 'Type'] },
    { key: 'reference',         label: 'Bill Number',          required: false, type: 'string',  aliases: ['Reference', 'Ref', 'Receipt #', 'Invoice #', 'Note'] },
    { key: 'paid_date',         label: 'Bill Paid Date',       required: false, type: 'date',    aliases: ['Paid Date', 'Payment Date'] },
    { key: 'payment_method',    label: 'Payment Method',       required: false, type: 'string',  aliases: ['Payment', 'Paid By', 'Method', 'Add / Sub'] },
    { key: 'notes',             label: 'Notes',                required: false, type: 'string',  aliases: ['Note', 'Comments'] },
    { key: 'staff_name',        label: 'User',                 required: false, type: 'string',  aliases: ['Created by User', 'Staff', 'Added By', 'User Name'] },
  ],

  // ── PAYMENTS ──────────────────────────────────────────────────────────────
  // CellStore columns: Sub-Domain, Date/Time, Invoice No, Customer Name,
  //   Payment Type, Amount, Drawer, User Name
  payments: [
    { key: 'created_at',        label: 'Date/Time',            required: true,  type: 'date',    aliases: ['Date', 'Payment Date', 'Date Added', 'Transaction Date'] },
    { key: 'invoice_number',    label: 'Invoice No',           required: false, type: 'string',  aliases: ['Invoice #', 'Invoice Number', 'Reference', 'Ref'] },
    { key: 'customer_name',     label: 'Customer Name',        required: false, type: 'string',  aliases: ['Customer', 'Client'] },
    { key: 'payment_method',    label: 'Payment Type',         required: true,  type: 'string',  aliases: ['Payment Method', 'Method', 'Paid By', 'Tender'] },
    { key: 'amount',            label: 'Amount',               required: true,  type: 'number',  aliases: ['Payment Amount', 'Total', 'Paid'] },
    { key: 'drawer',            label: 'Drawer',               required: false, type: 'string',  aliases: ['Cash Drawer', 'Till'] },
    { key: 'staff_name',        label: 'User Name',            required: false, type: 'string',  aliases: ['User', 'Staff', 'Cashier', 'Created by User'] },
    { key: 'reference',         label: 'Reference',            required: false, type: 'string',  aliases: ['Receipt #', 'Transaction #', 'Auth Code'] },
    { key: 'notes',             label: 'Notes',                required: false, type: 'string',  aliases: ['Note', 'Comments'] },
  ],

  // ── STOCK TAKE ────────────────────────────────────────────────────────────
  // CellStore columns: Sub-Domain, SKU, Reference, Manufacturer, Product Name,
  //   Category, Current Stock, Counted, Difference, Cost, Total, Notes, Completed Date
  stock_take: [
    { key: 'sku',               label: 'SKU',                  required: false, type: 'string',  aliases: ['Code', 'Product Code', 'Barcode'] },
    { key: 'reference',         label: 'Reference',            required: false, type: 'string',  aliases: ['Ref', 'Ref #'] },
    { key: 'manufacturer',      label: 'Manufacturer',         required: false, type: 'string',  aliases: ['Manufacturer name', 'Brand'] },
    { key: 'product_name',      label: 'Product Name',         required: true,  type: 'string',  aliases: ['Product', 'Name', 'Item', 'Description'] },
    { key: 'category',          label: 'Category',             required: false, type: 'string',  aliases: ['Category name'] },
    { key: 'expected_stock',    label: 'Current Stock',        required: false, type: 'number',  aliases: ['Expected', 'System Count', 'On Hand', 'Stock Level', 'Expected Stock'] },
    { key: 'counted_stock',     label: 'Counted',              required: true,  type: 'number',  aliases: ['Physical Count', 'Actual Count', 'Physical Stock', 'Count'] },
    { key: 'variance',          label: 'Difference',           required: false, type: 'number',  aliases: ['Variance', 'Discrepancy'] },
    { key: 'cost',              label: 'Cost',                 required: false, type: 'number',  aliases: ['Unit Cost', 'Cost Price'] },
    { key: 'total',             label: 'Total',                required: false, type: 'number',  aliases: ['Total Cost', 'Total Value'] },
    { key: 'notes',             label: 'Notes',                required: false, type: 'string',  aliases: ['Note', 'Comments'] },
    { key: 'completed_at',      label: 'Completed Date',       required: false, type: 'date',    aliases: ['Date Completed', 'Completion Date'] },
  ],
};
