export type GlobalRole = 'super_admin' | 'workspace_owner' | 'manager' | 'agent' | 'viewer';

export type WorkspacePlanCode =
  | 'starter'
  | 'growth'
  | 'pro'
  | 'enterprise';

export type WhatsappProviderType =
  | 'cloud_api'
  | 'whatsapp_web'
  | 'future_provider';

export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';
