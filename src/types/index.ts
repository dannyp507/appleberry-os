export type Role = 'owner' | 'admin' | 'staff';

export type CompanyPlan = 'starter' | 'growth' | 'multi_branch';
export type CompanyStatus = 'trial' | 'active' | 'paused';
export type CompanyOnboardingStatus = 'pending' | 'in_progress' | 'complete';

export interface Company {
  id: string;
  name: string;
  slug?: string | null;
  owner_user_id: string;
  owner_email: string;
  plan: CompanyPlan;
  status: CompanyStatus;
  onboarding_status: CompanyOnboardingStatus;
  trial_ends_at?: string | null;
  phone?: string | null;
  website?: string | null;
  country?: string | null;
  business_type?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  role: Role;
  company_id?: string | null;
  permissions?: string[] | null;
  email?: string | null;
  phone?: string | null;
  branch?: string | null;
  title?: string | null;
  status?: string | null;
}

export interface Product {
  id: string;
  company_id?: string | null;
  name: string;
  category: string;
  sku: string | null;
  barcode: string | null;
  imei: string | null;
  cost_price: number;
  selling_price: number;
  stock: number;
  low_stock_threshold: number;
  created_at: string;
}

export interface DeviceInventoryItem {
  id: string;
  company_id?: string | null;
  name: string;
  brand?: string | null;
  model?: string | null;
  imei: string;
  serial_number?: string | null;
  condition?: string | null;
  status: 'in_stock' | 'reserved' | 'sold' | 'repair' | 'trade_in' | 'archived';
  source?: string | null;
  color?: string | null;
  storage?: string | null;
  buy_price?: number | null;
  sell_price?: number | null;
  notes?: string | null;
  acquired_at?: string | null;
  sold_at?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Customer {
  id: string;
  company_id?: string | null;
  name: string; // Keep for backward compatibility, but we'll use first/last name
  first_name: string;
  last_name: string | null;
  phone: string | null;
  secondary_phone: string | null;
  email: string | null;
  offers_email: boolean;
  company: string | null;
  fax: string | null;
  customer_type: string | null;
  email_marketing_opt_in?: boolean;
  whatsapp_marketing_opt_in?: boolean;
  marketing_opt_out_reason?: string | null;
  address_info?: {
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  };
  alert_message?: string | null;
  created_at: string;
}

export interface RepairProblem {
  id: string;
  company_id?: string | null;
  name: string;
  default_price?: number;
  created_at: string;
}

export interface RepairStatus {
  id: string;
  company_id?: string | null;
  name: string;
  color: string;
  order_index: number;
}

export interface Repair {
  id: string;
  company_id?: string | null;
  ticket_number?: string;
  customer_id: string;
  device_name: string;
  imei: string | null;
  issue_description: string | null;
  problem_id?: string | null;
  technician_id: string | null;
  cost: number;
  status_id: string;
  notes: string | null;
  subtotal?: number;
  global_discount?: number;
  total_amount?: number;
  paid_amount?: number;
  payments?: {
    method: string;
    amount: number;
    timestamp: string;
  }[];
  services_and_parts?: {
    id: string;
    name: string;
    type: 'service' | 'part';
    price: number;
    quantity: number;
  }[];
  ticket_details?: {
    passcode?: string;
    pattern?: string;
    backup_required?: boolean;
    data_loss_risk_accepted?: boolean;
  };
  form_type?: 'in' | 'out';
  created_at: string;
  updated_at: string;
  customer?: Customer;
  status?: RepairStatus;
}

export interface CommunicationSettings {
  mode?: 'test' | 'live';
  email: {
    host: string;
    port: string;
    secure: boolean;
    user: string;
    pass: string;
    fromName: string;
    fromEmail: string;
  };
  whatsapp: {
    provider: 'official' | 'unofficial';
    accessToken: string;
    phoneId: string;
    templateName: string;
    instanceId?: string;
    apiUrl?: string;
  };
}

export interface ShopSettings {
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  vatNumber: string;
  regNumber: string;
  logoUrl: string;
}

export interface Sale {
  id: string;
  company_id?: string | null;
  customer_id: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  external_invoice_number?: string | null;
  ticket_number?: string | null;
  device_name?: string | null;
  total_amount: number;
  profit: number;
  payment_method: 'cash' | 'card' | 'eft';
  payment_methods?: string[];
  staff_id: string;
  refunded_amount?: number;
  refund_status?: 'none' | 'partial' | 'full';
  refunded_item_quantities?: Record<string, number>;
  created_at: string;
}

export interface SaleItem {
  id: string;
  company_id?: string | null;
  sale_id: string;
  product_id: string;
  name?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  refunded_quantity?: number;
  product?: Product;
}

export type RefundType = 'full' | 'partial';

export interface RefundItem {
  sale_item_id?: string;
  product_id: string | null;
  name?: string | null;
  quantity: number;
  price: number;
}

export interface Refund {
  id: string;
  refund_id: string;
  company_id: string;
  sale_id: string;
  customer_id: string | null;
  refund_type: RefundType;
  items: RefundItem[];
  amount: number;
  reason: string;
  processed_by: string;
  created_at: string;
}

export type MarketingChannel = 'whatsapp' | 'email';
export type MarketingTemplateCategory = 'promotion' | 'pickup_reminder' | 'review_request' | 'win_back' | 'warranty_follow_up' | 'custom';
export type MarketingCampaignStatus = 'draft' | 'scheduled' | 'sent' | 'paused';
export type MarketingAutomationTrigger = 'repair_ready' | 'pickup_3_day' | 'review_request_after_sale';
export type MarketingAutomationStatus = 'active' | 'paused';

export interface MarketingTemplate {
  id: string;
  company_id?: string | null;
  name: string;
  channel: MarketingChannel;
  category: MarketingTemplateCategory;
  subject?: string | null;
  body: string;
  variables?: string[];
  created_at: string;
  updated_at?: string;
}

export interface MarketingCampaign {
  id: string;
  company_id?: string | null;
  name: string;
  channel: MarketingChannel;
  template_id?: string | null;
  template_name?: string | null;
  segment_id?: string | null;
  segment_name?: string | null;
  audience_label: string;
  audience_query?: string | null;
  estimated_recipients?: number | null;
  status: MarketingCampaignStatus;
  scheduled_for?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface MarketingSegment {
  id: string;
  company_id?: string | null;
  name: string;
  channel: MarketingChannel;
  description?: string | null;
  customer_type?: string | null;
  company_only?: boolean;
  search_text?: string | null;
  estimated_recipients?: number | null;
  created_at: string;
  updated_at?: string;
}

export interface MarketingAutomation {
  id: string;
  company_id?: string | null;
  name: string;
  trigger: MarketingAutomationTrigger;
  channel: MarketingChannel;
  template_id?: string | null;
  template_name?: string | null;
  status: MarketingAutomationStatus;
  notes?: string | null;
  last_run_at?: string | null;
  last_sent_count?: number | null;
  created_at: string;
  updated_at?: string;
}
