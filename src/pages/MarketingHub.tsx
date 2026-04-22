import { FormEvent, useEffect, useMemo, useState } from 'react';
import { addDoc, collection, doc, getDoc, getDocs, orderBy, query, updateDoc } from 'firebase/firestore';
import { BarChart3, CalendarClock, Mail, Megaphone, MessageSquareMore, Plus, Save, Send, Sparkles, Tag, Users } from 'lucide-react';
import { db } from '../lib/firebase';
import { CommunicationSettings, Customer, MarketingAutomation, MarketingAutomationStatus, MarketingAutomationTrigger, MarketingCampaign, MarketingCampaignStatus, MarketingChannel, MarketingSegment, MarketingTemplate, MarketingTemplateCategory, RepairStatus, Sale, ShopSettings } from '../types';
import { toast } from 'sonner';
import axios from 'axios';
import { useTenant } from '../lib/tenant';
import { filterByCompany, isCompanyScopedRecord, withCompanyId } from '../lib/companyData';
import { getCompanySettingsDocId } from '../lib/company';
import { companyQuery, requireCompanyId } from '../lib/db';

type MarketingDelivery = {
  id: string;
  company_id?: string | null;
  automation_id?: string | null;
  automation_name?: string | null;
  campaign_id?: string | null;
  campaign_name?: string | null;
  template_id?: string | null;
  channel: MarketingChannel;
  customer_id?: string | null;
  repair_id?: string | null;
  target: string;
  status: string;
  sent_at?: string | null;
};

const defaultTemplate = {
  name: '',
  channel: 'whatsapp' as MarketingChannel,
  category: 'promotion' as MarketingTemplateCategory,
  subject: '',
  body: '',
  variables: '{customer_name}, {ticket_number}, {branch_name}',
};

const defaultCampaign = {
  name: '',
  channel: 'whatsapp' as MarketingChannel,
  segment_id: '',
  audience_label: '',
  audience_query: '',
  template_id: '',
  status: 'draft' as MarketingCampaignStatus,
  scheduled_for: '',
  notes: '',
  estimated_recipients: '',
};

const defaultSegment = {
  name: '',
  channel: 'whatsapp' as MarketingChannel,
  description: '',
  customer_type: '',
  company_only: false,
  search_text: '',
};

const defaultTestSend = {
  template_id: '',
  customer_id: '',
  manual_target: '',
  customer_search: '',
};

const defaultAutomation = {
  name: '',
  trigger: 'repair_ready' as MarketingAutomationTrigger,
  channel: 'whatsapp' as MarketingChannel,
  template_id: '',
  status: 'active' as MarketingAutomationStatus,
  notes: '',
};

const ideaCards = [
  {
    title: 'Pickup nudges',
    copy: 'Auto-remind customers when repairs are ready, then follow up after 2 and 5 days if they still have not collected.',
  },
  {
    title: 'Win-back campaigns',
    copy: 'Target customers who have not visited in 60 to 90 days with a repair or accessory comeback offer.',
  },
  {
    title: 'Review requests',
    copy: 'Trigger WhatsApp or email messages after paid collection to grow your Google reviews consistently.',
  },
  {
    title: 'Warranty follow-up',
    copy: 'Proactively message customers before coverage expires and offer checkups, accessories, or upgrade paths.',
  },
];

function normalizePhone(rawPhone: string) {
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.startsWith('27')) return digits;
  if (digits.startsWith('0')) return `27${digits.slice(1)}`;
  return digits;
}

function interpolateTemplate(template: MarketingTemplate, values: Record<string, string>) {
  const replace = (input: string | null | undefined) =>
    (input || '').replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => values[key] || '');

  return {
    subject: replace(template.subject),
    body: replace(template.body),
  };
}

function canReceiveMarketing(customer: Customer, channel: MarketingChannel) {
  if (channel === 'email') {
    return !!customer.email && customer.email_marketing_opt_in !== false;
  }

  return !!customer.phone && customer.whatsapp_marketing_opt_in !== false;
}

export default function MarketingHub() {
  const { companyId } = useTenant();
  const [templates, setTemplates] = useState<MarketingTemplate[]>([]);
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [segments, setSegments] = useState<MarketingSegment[]>([]);
  const [automations, setAutomations] = useState<MarketingAutomation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [deliveries, setDeliveries] = useState<MarketingDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savingCampaign, setSavingCampaign] = useState(false);
  const [savingSegment, setSavingSegment] = useState(false);
  const [savingAutomation, setSavingAutomation] = useState(false);
  const [templateForm, setTemplateForm] = useState(defaultTemplate);
  const [campaignForm, setCampaignForm] = useState(defaultCampaign);
  const [segmentForm, setSegmentForm] = useState(defaultSegment);
  const [automationForm, setAutomationForm] = useState(defaultAutomation);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [editingAutomationId, setEditingAutomationId] = useState<string | null>(null);
  const [sendingCampaignId, setSendingCampaignId] = useState<string | null>(null);
  const [runningAutomationId, setRunningAutomationId] = useState<string | null>(null);
  const [testSendForm, setTestSendForm] = useState(defaultTestSend);
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    void fetchMarketingData();
  }, [companyId]);

  async function fetchMarketingData() {
    setLoading(true);
    try {
      const [templateSnap, campaignSnap, segmentSnap, automationSnap, deliverySnap] = await Promise.all([
        getDocs(companyQuery('marketing_templates', companyId, orderBy('created_at', 'desc'))),
        getDocs(companyQuery('marketing_campaigns', companyId, orderBy('created_at', 'desc'))),
        getDocs(companyQuery('marketing_segments', companyId, orderBy('created_at', 'desc'))),
        getDocs(companyQuery('marketing_automations', companyId, orderBy('created_at', 'desc'))),
        getDocs(companyQuery('marketing_deliveries', companyId, orderBy('sent_at', 'desc'))),
      ]);
      const customerSnap = await getDocs(companyQuery('customers', companyId, orderBy('first_name')));

      setTemplates(templateSnap.docs.map((templateDoc) => ({ id: templateDoc.id, ...templateDoc.data() } as MarketingTemplate)));
      setCampaigns(campaignSnap.docs.map((campaignDoc) => ({ id: campaignDoc.id, ...campaignDoc.data() } as MarketingCampaign)));
      setSegments(segmentSnap.docs.map((segmentDoc) => ({ id: segmentDoc.id, ...segmentDoc.data() } as MarketingSegment)));
      setAutomations(automationSnap.docs.map((automationDoc) => ({ id: automationDoc.id, ...automationDoc.data() } as MarketingAutomation)));
      setCustomers(customerSnap.docs.map((customerDoc) => ({ id: customerDoc.id, ...customerDoc.data() } as Customer)));
      setDeliveries(filterByCompany(deliverySnap.docs.map((deliveryDoc) => ({ id: deliveryDoc.id, ...deliveryDoc.data() } as MarketingDelivery)), companyId));
    } catch (error: any) {
      toast.error(error.message || 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    const whatsappTemplates = templates.filter((template) => template.channel === 'whatsapp').length;
    const emailTemplates = templates.filter((template) => template.channel === 'email').length;
    const scheduledCampaigns = campaigns.filter((campaign) => campaign.status === 'scheduled').length;
    const sentCampaigns = campaigns.filter((campaign) => campaign.status === 'sent').length;

    return {
      templates: templates.length,
      segments: segments.length,
      automations: automations.length,
      whatsappTemplates,
      emailTemplates,
      scheduledCampaigns,
      sentCampaigns,
      deliveries: deliveries.length,
    };
  }, [automations, campaigns, deliveries, segments, templates]);

  const customerLookup = useMemo(() => {
    return new Map(customers.map((customer) => [customer.id, customer]));
  }, [customers]);

  const selectedTestTemplate = useMemo(
    () => templates.find((template) => template.id === testSendForm.template_id) || null,
    [templates, testSendForm.template_id]
  );

  const selectedTestCustomer = useMemo(
    () => customers.find((customer) => customer.id === testSendForm.customer_id) || null,
    [customers, testSendForm.customer_id]
  );

  const filteredTestCustomers = useMemo(() => {
    const visibleCustomers = customers.filter((customer) => {
      if (!selectedTestTemplate) return true;
      return canReceiveMarketing(customer, selectedTestTemplate.channel);
    });

    const queryText = testSendForm.customer_search.trim().toLowerCase();
    if (!queryText) return visibleCustomers.slice(0, 50);

    return visibleCustomers
      .filter((customer) => {
        const fullName = customer.name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
        return (
          fullName.toLowerCase().includes(queryText) ||
          (customer.phone || '').toLowerCase().includes(queryText) ||
          (customer.email || '').toLowerCase().includes(queryText) ||
          (customer.company || '').toLowerCase().includes(queryText)
        );
      })
      .slice(0, 50);
  }, [customers, selectedTestTemplate, testSendForm.customer_search]);

  const testTarget = useMemo(() => {
    if (testSendForm.manual_target.trim()) return testSendForm.manual_target.trim();
    if (!selectedTestTemplate) return '';
    return selectedTestTemplate.channel === 'whatsapp'
      ? (selectedTestCustomer?.phone || '')
      : (selectedTestCustomer?.email || '');
  }, [selectedTestCustomer, selectedTestTemplate, testSendForm.manual_target]);

  const testPreview = useMemo(() => {
    if (!selectedTestTemplate) return null;
    return interpolateTemplate(selectedTestTemplate, {
      customer_name: selectedTestCustomer?.name || selectedTestCustomer?.first_name || 'Customer',
      ticket_number: 'RPR-TEST-001',
      branch_name: 'Appleberry OS',
      device_name: 'iPhone 13',
      company_name: 'Appleberry OS',
    });
  }, [selectedTestCustomer, selectedTestTemplate]);

  const getSegmentMatches = (segment: Pick<MarketingSegment, 'channel' | 'customer_type' | 'company_only' | 'search_text'>, baseCustomers = customers) => {
    const normalizedSearch = (segment.search_text || '').trim().toLowerCase();

    return baseCustomers.filter((customer) => {
      if (!canReceiveMarketing(customer, segment.channel)) return false;
      if (segment.customer_type && customer.customer_type !== segment.customer_type) return false;
      if (segment.company_only && !customer.company) return false;
      if (!normalizedSearch) return true;

      const fullName = customer.name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
      return (
        fullName.toLowerCase().includes(normalizedSearch) ||
        (customer.phone || '').toLowerCase().includes(normalizedSearch) ||
        (customer.email || '').toLowerCase().includes(normalizedSearch) ||
        (customer.company || '').toLowerCase().includes(normalizedSearch)
      );
    });
  };

  const sendThroughChannel = async (
    settings: CommunicationSettings,
    channel: MarketingChannel,
    target: string,
    subject: string,
    body: string
  ) => {
    if (channel === 'email') {
      await axios.post('/api/send-email', {
        to: target,
        subject,
        text: body,
        html: `<p>${body.replace(/\n/g, '<br />')}</p>`,
        settings: settings.email,
        companyId,
      });
      return;
    }

    await axios.post('/api/send-whatsapp', {
      phone: normalizePhone(target),
      message: body,
      settings: settings.whatsapp,
      companyId,
    });
  };

  const alreadySentByAutomation = (automationId: string, customerId: string | null, repairId: string | null) => {
    return deliveries.some((delivery) =>
      delivery.automation_id === automationId &&
      delivery.customer_id === customerId &&
      (delivery.repair_id || null) === (repairId || null)
    );
  };

  const handleTemplateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSavingTemplate(true);

    const payload = {
      name: templateForm.name,
      channel: templateForm.channel,
      category: templateForm.category,
      subject: templateForm.channel === 'email' ? (templateForm.subject || null) : null,
      body: templateForm.body,
      variables: templateForm.variables
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingTemplateId) {
        await updateDoc(doc(db, 'marketing_templates', editingTemplateId), payload);
        toast.success('Template updated');
      } else {
        await addDoc(collection(db, 'marketing_templates'), withCompanyId(requireCompanyId(companyId), {
          ...payload,
          created_at: new Date().toISOString(),
        }));
        toast.success('Template saved');
      }

      setTemplateForm(defaultTemplate);
      setEditingTemplateId(null);
      await fetchMarketingData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save template');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleCampaignSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSavingCampaign(true);

    const selectedTemplate = templates.find((template) => template.id === campaignForm.template_id);
    const selectedSegment = segments.find((segment) => segment.id === campaignForm.segment_id);

    const payload = {
      name: campaignForm.name,
      channel: campaignForm.channel,
      segment_id: campaignForm.segment_id || null,
      segment_name: selectedSegment?.name || null,
      audience_label: campaignForm.audience_label,
      audience_query: campaignForm.audience_query || null,
      template_id: campaignForm.template_id || null,
      template_name: selectedTemplate?.name || null,
      status: campaignForm.status,
      scheduled_for: campaignForm.scheduled_for || null,
      notes: campaignForm.notes || null,
      estimated_recipients: campaignForm.estimated_recipients ? Number(campaignForm.estimated_recipients) : null,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingCampaignId) {
        await updateDoc(doc(db, 'marketing_campaigns', editingCampaignId), payload);
        toast.success('Campaign updated');
      } else {
        await addDoc(collection(db, 'marketing_campaigns'), withCompanyId(requireCompanyId(companyId), {
          ...payload,
          created_at: new Date().toISOString(),
        }));
        toast.success('Campaign saved');
      }

      setCampaignForm(defaultCampaign);
      setEditingCampaignId(null);
      await fetchMarketingData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save campaign');
    } finally {
      setSavingCampaign(false);
    }
  };

  const handleSegmentSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSavingSegment(true);

    const estimatedRecipients = getSegmentMatches(segmentForm).length;
    const payload = {
      name: segmentForm.name,
      channel: segmentForm.channel,
      description: segmentForm.description || null,
      customer_type: segmentForm.customer_type || null,
      company_only: segmentForm.company_only,
      search_text: segmentForm.search_text || null,
      estimated_recipients: estimatedRecipients,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingSegmentId) {
        await updateDoc(doc(db, 'marketing_segments', editingSegmentId), payload);
        toast.success('Segment updated');
      } else {
        await addDoc(collection(db, 'marketing_segments'), withCompanyId(requireCompanyId(companyId), {
          ...payload,
          created_at: new Date().toISOString(),
        }));
        toast.success('Segment saved');
      }

      setSegmentForm(defaultSegment);
      setEditingSegmentId(null);
      await fetchMarketingData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save segment');
    } finally {
      setSavingSegment(false);
    }
  };

  const handleAutomationSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSavingAutomation(true);

    const selectedTemplate = templates.find((template) => template.id === automationForm.template_id);
    const payload = {
      name: automationForm.name,
      trigger: automationForm.trigger,
      channel: automationForm.channel,
      template_id: automationForm.template_id || null,
      template_name: selectedTemplate?.name || null,
      status: automationForm.status,
      notes: automationForm.notes || null,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingAutomationId) {
        await updateDoc(doc(db, 'marketing_automations', editingAutomationId), payload);
        toast.success('Automation updated');
      } else {
        await addDoc(collection(db, 'marketing_automations'), withCompanyId(requireCompanyId(companyId), {
          ...payload,
          created_at: new Date().toISOString(),
        }));
        toast.success('Automation saved');
      }

      setAutomationForm(defaultAutomation);
      setEditingAutomationId(null);
      await fetchMarketingData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save automation');
    } finally {
      setSavingAutomation(false);
    }
  };

  const resolveCampaignRecipients = async (campaign: MarketingCampaign) => {
    const [customersSnap, repairsSnap, statusesSnap, shopSnap] = await Promise.all([
      getDocs(companyQuery('customers', companyId)),
      getDocs(companyQuery('repairs', companyId)),
      getDocs(companyQuery('repair_status_options', companyId)),
      getDoc(doc(db, 'settings', getCompanySettingsDocId('shop', companyId || 'global'))),
    ]);

    const customers = filterByCompany(customersSnap.docs.map((customerDoc) => ({ id: customerDoc.id, ...customerDoc.data() } as any)), companyId);
    const repairs = filterByCompany(repairsSnap.docs.map((repairDoc) => ({ id: repairDoc.id, ...repairDoc.data() } as any)), companyId);
    const statuses = filterByCompany(statusesSnap.docs.map((statusDoc) => ({ id: statusDoc.id, ...statusDoc.data() } as RepairStatus)), companyId);
    const shop = (shopSnap.exists() ? shopSnap.data() : null) as ShopSettings | null;

    const queryText = (campaign.audience_query || '').toLowerCase();
    const branchName = shop?.name || 'Appleberry OS';
    const linkedSegment = campaign.segment_id ? segments.find((segment) => segment.id === campaign.segment_id) : null;

    if (linkedSegment) {
      return getSegmentMatches(linkedSegment, customers as Customer[]).map((customer) => ({
        customerId: customer.id,
        repairId: null,
        channelTarget: linkedSegment.channel === 'whatsapp' ? customer.phone : customer.email,
        values: {
          customer_name: customer.name || customer.first_name || 'Customer',
          ticket_number: '',
          branch_name: branchName,
          device_name: '',
          company_name: branchName,
        },
      }));
    }

    if (queryText.includes('ready_for_collection')) {
      const minDaysMatch = queryText.match(/ready_age_days\s*>=\s*(\d+)/i);
      const minDays = minDaysMatch ? Number(minDaysMatch[1]) : 0;
      const readyStatusIds = statuses
        .filter((status) => status.name.toLowerCase().includes('ready'))
        .map((status) => status.id);

      const recipients = repairs
        .filter((repair) => readyStatusIds.includes(repair.status_id))
        .filter((repair) => {
          const updatedAt = repair.updated_at ? new Date(repair.updated_at).getTime() : Date.now();
          const ageDays = Math.floor((Date.now() - updatedAt) / (1000 * 60 * 60 * 24));
          return ageDays >= minDays;
        })
        .map((repair) => {
          const customer = customers.find((item) => item.id === repair.customer_id);
          if (!customer) return null;
          if (!canReceiveMarketing(customer, campaign.channel)) return null;
          return {
            customerId: customer.id,
            repairId: repair.id,
            channelTarget: campaign.channel === 'whatsapp' ? customer.phone : customer.email,
            values: {
              customer_name: customer.name || customer.first_name || 'Customer',
              ticket_number: repair.ticket_number || repair.id.slice(0, 8),
              branch_name: branchName,
              device_name: repair.device_name || 'your device',
              company_name: branchName,
            },
          };
        })
        .filter(Boolean) as Array<{ customerId: string; repairId: string; channelTarget: string; values: Record<string, string> }>;

      return recipients;
    }

    const recipients = customers
      .filter((customer) => canReceiveMarketing(customer, campaign.channel))
      .map((customer) => ({
        customerId: customer.id,
        repairId: null,
        channelTarget: campaign.channel === 'whatsapp' ? customer.phone : customer.email,
        values: {
          customer_name: customer.name || customer.first_name || 'Customer',
          ticket_number: '',
          branch_name: branchName,
          device_name: '',
          company_name: branchName,
        },
      }));

    return recipients;
  };

  const resolveAutomationRecipients = async (automation: MarketingAutomation) => {
    const [customersSnap, repairsSnap, statusesSnap, salesSnap, shopSnap] = await Promise.all([
      getDocs(companyQuery('customers', companyId)),
      getDocs(companyQuery('repairs', companyId)),
      getDocs(companyQuery('repair_status_options', companyId)),
      getDocs(companyQuery('sales', companyId)),
      getDoc(doc(db, 'settings', getCompanySettingsDocId('shop', companyId || 'global'))),
    ]);

    const liveCustomers = filterByCompany(customersSnap.docs.map((customerDoc) => ({ id: customerDoc.id, ...customerDoc.data() } as Customer)), companyId);
    const repairs = filterByCompany(repairsSnap.docs.map((repairDoc) => ({ id: repairDoc.id, ...repairDoc.data() } as any)), companyId);
    const statuses = filterByCompany(statusesSnap.docs.map((statusDoc) => ({ id: statusDoc.id, ...statusDoc.data() } as RepairStatus)), companyId);
    const sales = filterByCompany(salesSnap.docs.map((saleDoc) => ({ id: saleDoc.id, ...saleDoc.data() } as Sale)), companyId);
    const shop = (shopSnap.exists() ? shopSnap.data() : null) as ShopSettings | null;
    const branchName = shop?.name || 'Appleberry OS';

    if (automation.trigger === 'review_request_after_sale') {
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      return sales
        .filter((sale) => !!sale.customer_id)
        .filter((sale) => new Date(sale.created_at).getTime() >= sevenDaysAgo)
        .map((sale) => {
          const customer = liveCustomers.find((item) => item.id === sale.customer_id);
          if (!customer || !canReceiveMarketing(customer, automation.channel)) return null;
          return {
            customerId: customer.id,
            repairId: null,
            channelTarget: automation.channel === 'whatsapp' ? customer.phone : customer.email,
            values: {
              customer_name: customer.name || customer.first_name || 'Customer',
              ticket_number: sale.id.slice(0, 8),
              branch_name: branchName,
              device_name: '',
              company_name: branchName,
            },
          };
        })
        .filter(Boolean) as Array<{ customerId: string; repairId: string | null; channelTarget: string; values: Record<string, string> }>;
    }

    const readyStatusIds = statuses
      .filter((status) => status.name.toLowerCase().includes('ready'))
      .map((status) => status.id);

    const minimumDays = automation.trigger === 'pickup_3_day' ? 3 : 0;

    return repairs
      .filter((repair) => readyStatusIds.includes(repair.status_id))
      .filter((repair) => {
        const updatedAt = repair.updated_at ? new Date(repair.updated_at).getTime() : Date.now();
        const ageDays = Math.floor((Date.now() - updatedAt) / (1000 * 60 * 60 * 24));
        return ageDays >= minimumDays;
      })
      .map((repair) => {
        const customer = liveCustomers.find((item) => item.id === repair.customer_id);
        if (!customer || !canReceiveMarketing(customer, automation.channel)) return null;
        return {
          customerId: customer.id,
          repairId: repair.id,
          channelTarget: automation.channel === 'whatsapp' ? customer.phone : customer.email,
          values: {
            customer_name: customer.name || customer.first_name || 'Customer',
            ticket_number: repair.ticket_number || repair.id.slice(0, 8),
            branch_name: branchName,
            device_name: repair.device_name || 'your device',
            company_name: branchName,
          },
        };
      })
      .filter(Boolean) as Array<{ customerId: string; repairId: string | null; channelTarget: string; values: Record<string, string> }>;
  };

  const handleSendCampaign = async (campaign: MarketingCampaign) => {
    const template = templates.find((item) => item.id === campaign.template_id);
    if (!template) {
      toast.error('Select a template before sending this campaign.');
      return;
    }

    setSendingCampaignId(campaign.id);

    try {
      const settingsSnap = await getDoc(doc(db, 'settings', getCompanySettingsDocId('communication', companyId || 'global')));
      if (!settingsSnap.exists()) {
        toast.error('Communication settings are not configured.');
        return;
      }
      const settings = settingsSnap.data() as CommunicationSettings;
      const recipients = await resolveCampaignRecipients(campaign);

      if (recipients.length === 0) {
        toast.error('No matching recipients found for this campaign.');
        return;
      }

      const confirmed = window.confirm(`Send "${campaign.name}" to ${recipients.length} ${campaign.channel === 'whatsapp' ? 'WhatsApp contacts' : 'email recipients'} now?`);
      if (!confirmed) return;

      let sentCount = 0;

      for (const recipient of recipients) {
        const rendered = interpolateTemplate(template, recipient.values);
        await sendThroughChannel(settings, campaign.channel, recipient.channelTarget, rendered.subject || campaign.name, rendered.body);

        sentCount += 1;

        await addDoc(collection(db, 'marketing_deliveries'), withCompanyId(requireCompanyId(companyId), {
          automation_id: null,
          automation_name: null,
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          template_id: template.id,
          channel: campaign.channel,
          customer_id: recipient.customerId,
          repair_id: recipient.repairId,
          target: recipient.channelTarget,
          status: 'sent',
          sent_at: new Date().toISOString(),
        }));
      }

      await updateDoc(doc(db, 'marketing_campaigns', campaign.id), {
        status: 'sent',
        estimated_recipients: recipients.length,
        sent_count: sentCount,
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      toast.success(`Campaign sent to ${sentCount} recipients.`);
      await fetchMarketingData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to send campaign');
    } finally {
      setSendingCampaignId(null);
    }
  };

  const handleRunAutomation = async (automation: MarketingAutomation) => {
    const template = templates.find((item) => item.id === automation.template_id);
    if (!template) {
      toast.error('Select a template for this automation first.');
      return;
    }

    setRunningAutomationId(automation.id);

    try {
      const settingsSnap = await getDoc(doc(db, 'settings', getCompanySettingsDocId('communication', companyId || 'global')));
      if (!settingsSnap.exists()) {
        toast.error('Communication settings are not configured.');
        return;
      }

      const settings = settingsSnap.data() as CommunicationSettings;
      const recipients = await resolveAutomationRecipients(automation);

      if (recipients.length === 0) {
        toast.error('No matching recipients found for this automation.');
        return;
      }

      const confirmed = window.confirm(`Run automation "${automation.name}" for ${recipients.length} matching recipients now?`);
      if (!confirmed) return;

      let sentCount = 0;

      for (const recipient of recipients) {
        if (alreadySentByAutomation(automation.id, recipient.customerId, recipient.repairId)) {
          continue;
        }

        const rendered = interpolateTemplate(template, recipient.values);
        await sendThroughChannel(settings, automation.channel, recipient.channelTarget, rendered.subject || automation.name, rendered.body);

        await addDoc(collection(db, 'marketing_deliveries'), withCompanyId(requireCompanyId(companyId), {
          automation_id: automation.id,
          automation_name: automation.name,
          campaign_id: null,
          campaign_name: null,
          template_id: template.id,
          channel: automation.channel,
          customer_id: recipient.customerId,
          repair_id: recipient.repairId,
          target: recipient.channelTarget,
          status: 'automated',
          sent_at: new Date().toISOString(),
        }));

        sentCount += 1;
      }

      await updateDoc(doc(db, 'marketing_automations', automation.id), {
        last_run_at: new Date().toISOString(),
        last_sent_count: sentCount,
        updated_at: new Date().toISOString(),
      });

      toast.success(`Automation ran successfully. ${sentCount} new messages sent.`);
      await fetchMarketingData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to run automation');
    } finally {
      setRunningAutomationId(null);
    }
  };

  const handleSendTest = async () => {
    if (!selectedTestTemplate) {
      toast.error('Select a template first.');
      return;
    }

    if (!selectedTestCustomer && !testSendForm.manual_target.trim()) {
      toast.error('Pick a customer or enter a manual test destination.');
      return;
    }

    if (!testTarget) {
      toast.error(`No ${selectedTestTemplate.channel === 'whatsapp' ? 'phone number' : 'email address'} available for this test.`);
      return;
    }

    setSendingTest(true);

    try {
      const settingsSnap = await getDoc(doc(db, 'settings', getCompanySettingsDocId('communication', companyId || 'global')));
      if (!settingsSnap.exists()) {
        toast.error('Communication settings are not configured.');
        return;
      }

      const settings = settingsSnap.data() as CommunicationSettings;
      const rendered = interpolateTemplate(selectedTestTemplate, {
        customer_name: selectedTestCustomer?.name || selectedTestCustomer?.first_name || 'Customer',
        ticket_number: 'RPR-TEST-001',
        branch_name: 'Appleberry OS',
        device_name: 'iPhone 13',
        company_name: 'Appleberry OS',
      });

      const confirmed = window.confirm(
        `Send a test ${selectedTestTemplate.channel === 'whatsapp' ? 'WhatsApp' : 'email'} to ${testTarget}?`
      );
      if (!confirmed) return;

      if (selectedTestTemplate.channel === 'email') {
        await axios.post('/api/send-email', {
          to: testTarget,
          subject: rendered.subject || `${selectedTestTemplate.name} test`,
          text: rendered.body,
          html: `<p>${rendered.body.replace(/\n/g, '<br />')}</p>`,
          settings: settings.email,
          companyId,
        });
      } else {
        await axios.post('/api/send-whatsapp', {
          phone: normalizePhone(testTarget),
          message: rendered.body,
          settings: settings.whatsapp,
          companyId,
        });
      }

      await addDoc(collection(db, 'marketing_deliveries'), withCompanyId(requireCompanyId(companyId), {
        campaign_id: null,
        campaign_name: 'Test send',
        template_id: selectedTestTemplate.id,
        channel: selectedTestTemplate.channel,
        customer_id: selectedTestCustomer?.id || null,
        repair_id: null,
        target: testTarget,
        status: 'test',
        sent_at: new Date().toISOString(),
      }));

      toast.success(`Test ${selectedTestTemplate.channel === 'whatsapp' ? 'message' : 'email'} sent to ${testTarget}.`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to send test message');
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#7b5c3c] font-semibold mb-2">CRM & Growth</p>
          <h1 className="display-font text-4xl font-bold text-[#18242b]">Campaigns</h1>
          <p className="text-[#5d6468] mt-2 max-w-3xl">
            Create reusable WhatsApp and email templates, plan outreach campaigns, and turn Appleberry OS into a revenue engine instead of just a counter tool.
          </p>
        </div>
        <div className="rounded-[22px] bg-[#13252e] px-5 py-4 text-white shadow-[0_18px_30px_rgba(17,34,41,0.18)]">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/55">Coming next</p>
          <p className="mt-2 text-sm text-white/90">Smart segments, opt-out controls, automation triggers, and campaign performance tracking.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard title="Templates" value={stats.templates.toString()} icon={Sparkles} />
        <StatCard title="Segments" value={stats.segments.toString()} icon={Tag} />
        <StatCard title="Automations" value={stats.automations.toString()} icon={CalendarClock} />
        <StatCard title="WhatsApp" value={stats.whatsappTemplates.toString()} icon={MessageSquareMore} />
        <StatCard title="Email" value={stats.emailTemplates.toString()} icon={Mail} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="section-card rounded-[28px] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-[#7b5c3c] font-semibold">Templates</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#18242b]">{editingTemplateId ? 'Edit Template' : 'Create Template'}</h2>
            </div>
            <button
              onClick={() => {
                setTemplateForm(defaultTemplate);
                setEditingTemplateId(null);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-[#d9c4ae] bg-white px-4 py-2 text-sm font-semibold text-[#214e5f] hover:bg-[#fbf4eb]"
            >
              <Plus className="h-4 w-4" />
              New
            </button>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleTemplateSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Template name" value={templateForm.name} onChange={(value) => setTemplateForm({ ...templateForm, name: value })} placeholder="Pickup reminder - ready now" required />
              <Select
                label="Channel"
                value={templateForm.channel}
                onChange={(value) => setTemplateForm({ ...templateForm, channel: value as MarketingChannel })}
                options={[
                  ['whatsapp', 'WhatsApp'],
                  ['email', 'Email'],
                ]}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Select
                label="Category"
                value={templateForm.category}
                onChange={(value) => setTemplateForm({ ...templateForm, category: value as MarketingTemplateCategory })}
                options={[
                  ['promotion', 'Promotion'],
                  ['pickup_reminder', 'Pickup reminder'],
                  ['review_request', 'Review request'],
                  ['win_back', 'Win-back'],
                  ['warranty_follow_up', 'Warranty follow-up'],
                  ['custom', 'Custom'],
                ]}
              />
              <Input
                label="Email subject"
                value={templateForm.subject}
                onChange={(value) => setTemplateForm({ ...templateForm, subject: value })}
                placeholder="Your repair is ready for collection"
                disabled={templateForm.channel !== 'email'}
              />
            </div>

            <TextArea
              label="Message body"
              value={templateForm.body}
              onChange={(value) => setTemplateForm({ ...templateForm, body: value })}
              placeholder="Hi {customer_name}, your repair {ticket_number} is ready for collection at {branch_name}."
              required
            />

            <Input
              label="Variables"
              value={templateForm.variables}
              onChange={(value) => setTemplateForm({ ...templateForm, variables: value })}
              placeholder="{customer_name}, {ticket_number}, {branch_name}"
            />

            <button
              type="submit"
              disabled={savingTemplate}
              className="appleberry-gradient inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {savingTemplate ? 'Saving...' : editingTemplateId ? 'Update Template' : 'Save Template'}
            </button>
          </form>
        </div>

        <div className="section-card rounded-[28px] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-[#7b5c3c] font-semibold">Campaigns</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#18242b]">{editingCampaignId ? 'Edit Campaign' : 'Plan Campaign'}</h2>
            </div>
            <button
              onClick={() => {
                setCampaignForm(defaultCampaign);
                setEditingCampaignId(null);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-[#d9c4ae] bg-white px-4 py-2 text-sm font-semibold text-[#214e5f] hover:bg-[#fbf4eb]"
            >
              <Plus className="h-4 w-4" />
              New
            </button>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleCampaignSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Campaign name" value={campaignForm.name} onChange={(value) => setCampaignForm({ ...campaignForm, name: value })} placeholder="Ready for collection follow-up" required />
              <Select
                label="Channel"
                value={campaignForm.channel}
                onChange={(value) => setCampaignForm({ ...campaignForm, channel: value as MarketingChannel })}
                options={[
                  ['whatsapp', 'WhatsApp'],
                  ['email', 'Email'],
                ]}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Select
                label="Segment"
                value={campaignForm.segment_id}
                onChange={(value) => {
                  const selectedSegment = segments.find((segment) => segment.id === value);
                  setCampaignForm({
                    ...campaignForm,
                    segment_id: value,
                    channel: selectedSegment?.channel || campaignForm.channel,
                    audience_label: selectedSegment?.name || campaignForm.audience_label,
                    estimated_recipients: selectedSegment?.estimated_recipients ? String(selectedSegment.estimated_recipients) : campaignForm.estimated_recipients,
                  });
                }}
                options={[
                  ['', 'No segment selected'],
                  ...segments.map((segment) => [segment.id, `${segment.name} (${segment.channel})`] as [string, string]),
                ]}
              />
              <Input label="Audience label" value={campaignForm.audience_label} onChange={(value) => setCampaignForm({ ...campaignForm, audience_label: value })} placeholder="Uncollected repairs over 3 days" required />
            </div>

            <Select
              label="Template"
              value={campaignForm.template_id}
              onChange={(value) => setCampaignForm({ ...campaignForm, template_id: value })}
              options={[
                ['', 'No template selected'],
                ...templates
                  .filter((template) => template.channel === campaignForm.channel)
                  .map((template) => [template.id, template.name] as [string, string]),
              ]}
            />

            <TextArea
              label="Audience query or rule"
              value={campaignForm.audience_query}
              onChange={(value) => setCampaignForm({ ...campaignForm, audience_query: value })}
              placeholder="status = ready_for_collection AND ready_age_days >= 3"
            />

            <div className="rounded-[18px] border border-[#d7bc9f] bg-[#f6eadb] px-4 py-4 text-sm text-[#34454d] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
              <p className="font-semibold text-[#18242b] mb-2">Audience query ideas</p>
              <p><code>status = ready_for_collection AND ready_age_days &gt;= 3</code> for repair pickup reminders.</p>
              <p><code>all_customers</code> or leave blank to target all customers with the selected channel.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Input label="Estimated recipients" value={campaignForm.estimated_recipients} onChange={(value) => setCampaignForm({ ...campaignForm, estimated_recipients: value })} placeholder="240" />
              <Input label="Scheduled for" value={campaignForm.scheduled_for} onChange={(value) => setCampaignForm({ ...campaignForm, scheduled_for: value })} placeholder="2026-04-12 09:00" />
              <Select
                label="Status"
                value={campaignForm.status}
                onChange={(value) => setCampaignForm({ ...campaignForm, status: value as MarketingCampaignStatus })}
                options={[
                  ['draft', 'Draft'],
                  ['scheduled', 'Scheduled'],
                  ['paused', 'Paused'],
                  ['sent', 'Sent'],
                ]}
              />
            </div>

            <TextArea
              label="Notes"
              value={campaignForm.notes}
              onChange={(value) => setCampaignForm({ ...campaignForm, notes: value })}
              placeholder="Use for warranty campaign targeting customers with battery repairs in the last 9 months."
            />

            <button
              type="submit"
              disabled={savingCampaign}
              className="appleberry-gradient inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {savingCampaign ? 'Saving...' : editingCampaignId ? 'Update Campaign' : 'Save Campaign'}
            </button>
          </form>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="section-card rounded-[28px] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-[#7b5c3c] font-semibold">Segments</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#18242b]">{editingSegmentId ? 'Edit Segment' : 'Build Segment'}</h2>
            </div>
            <button
              onClick={() => {
                setSegmentForm(defaultSegment);
                setEditingSegmentId(null);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-[#d9c4ae] bg-white px-4 py-2 text-sm font-semibold text-[#214e5f] hover:bg-[#fbf4eb]"
            >
              <Plus className="h-4 w-4" />
              New
            </button>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSegmentSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Segment name" value={segmentForm.name} onChange={(value) => setSegmentForm({ ...segmentForm, name: value })} placeholder="VIP retail customers" required />
              <Select
                label="Channel"
                value={segmentForm.channel}
                onChange={(value) => setSegmentForm({ ...segmentForm, channel: value as MarketingChannel })}
                options={[
                  ['whatsapp', 'WhatsApp'],
                  ['email', 'Email'],
                ]}
              />
            </div>

            <TextArea
              label="Description"
              value={segmentForm.description}
              onChange={(value) => setSegmentForm({ ...segmentForm, description: value })}
              placeholder="Use this for opted-in retail customers that look like good accessory buyers."
            />

            <div className="grid gap-4 md:grid-cols-2">
              <Select
                label="Customer type"
                value={segmentForm.customer_type}
                onChange={(value) => setSegmentForm({ ...segmentForm, customer_type: value })}
                options={[
                  ['', 'Any customer type'],
                  ['retail', 'Retail'],
                  ['repair', 'Repair'],
                  ['business', 'Business'],
                  ['vip', 'VIP'],
                ]}
              />
              <Input
                label="Search match"
                value={segmentForm.search_text}
                onChange={(value) => setSegmentForm({ ...segmentForm, search_text: value })}
                placeholder="battery, samsung, apple, accessories"
              />
            </div>

            <label className="rounded-xl border border-[#dbc8b2] bg-[#fbf4eb] px-4 py-3 flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={segmentForm.company_only}
                onChange={(e) => setSegmentForm({ ...segmentForm, company_only: e.target.checked })}
              />
              <div>
                <p className="font-medium text-[#18242b]">Only customers with a company</p>
                <p className="text-sm text-[#5d6468] mt-1">Useful for business accounts, B2B follow-ups, and account-managed customers.</p>
              </div>
            </label>

            <div className="rounded-[18px] border border-[#d7bc9f] bg-[#f6eadb] px-4 py-4 text-sm text-[#34454d]">
              <p className="font-semibold text-[#18242b]">Segment preview</p>
              <p className="mt-2">{getSegmentMatches(segmentForm).length} matching customers right now.</p>
            </div>

            <button
              type="submit"
              disabled={savingSegment}
              className="appleberry-gradient inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {savingSegment ? 'Saving...' : editingSegmentId ? 'Update Segment' : 'Save Segment'}
            </button>
          </form>
        </div>

        <div className="section-card rounded-[28px] p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#dfe8eb] text-[#214e5f]">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-2xl font-semibold text-[#18242b]">Saved Segments</h3>
              <p className="text-sm text-[#5d6468] mt-1">Reusable audiences for campaigns, follow-ups, promotions, and retention pushes.</p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {loading ? (
              <div className="text-sm text-[#5d6468]">Loading segments...</div>
            ) : segments.length === 0 ? (
              <EmptyState title="No segments yet" copy="Build your first smart audience instead of sending broad messages to everyone." />
            ) : (
              segments.map((segment) => (
                <button
                  key={segment.id}
                  type="button"
                  onClick={() => {
                    setEditingSegmentId(segment.id);
                    setSegmentForm({
                      name: segment.name,
                      channel: segment.channel,
                      description: segment.description || '',
                      customer_type: segment.customer_type || '',
                      company_only: !!segment.company_only,
                      search_text: segment.search_text || '',
                    });
                  }}
                  className="w-full rounded-[22px] border border-[#e6d7c6] bg-white/85 p-4 text-left transition hover:-translate-y-0.5 hover:bg-white"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-[#18242b]">{segment.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[#7b5c3c]">
                        {segment.channel} · {segment.customer_type || 'any type'}{segment.company_only ? ' · company only' : ''}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#e9f1f4] px-3 py-1 text-xs font-semibold text-[#214e5f]">
                      {segment.estimated_recipients || 0} matches
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#5d6468]">{segment.description || 'No description yet.'}</p>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="section-card rounded-[28px] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-[#7b5c3c] font-semibold">Automations</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#18242b]">{editingAutomationId ? 'Edit Automation' : 'Build Automation'}</h2>
            </div>
            <button
              onClick={() => {
                setAutomationForm(defaultAutomation);
                setEditingAutomationId(null);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-[#d9c4ae] bg-white px-4 py-2 text-sm font-semibold text-[#214e5f] hover:bg-[#fbf4eb]"
            >
              <Plus className="h-4 w-4" />
              New
            </button>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleAutomationSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Automation name" value={automationForm.name} onChange={(value) => setAutomationForm({ ...automationForm, name: value })} placeholder="3-day pickup reminder" required />
              <Select
                label="Trigger"
                value={automationForm.trigger}
                onChange={(value) => setAutomationForm({ ...automationForm, trigger: value as MarketingAutomationTrigger })}
                options={[
                  ['repair_ready', 'Repair ready now'],
                  ['pickup_3_day', 'Pickup reminder after 3 days'],
                  ['review_request_after_sale', 'Review request after sale'],
                ]}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Select
                label="Channel"
                value={automationForm.channel}
                onChange={(value) => setAutomationForm({ ...automationForm, channel: value as MarketingChannel })}
                options={[
                  ['whatsapp', 'WhatsApp'],
                  ['email', 'Email'],
                ]}
              />
              <Select
                label="Template"
                value={automationForm.template_id}
                onChange={(value) => setAutomationForm({ ...automationForm, template_id: value })}
                options={[
                  ['', 'No template selected'],
                  ...templates.filter((template) => template.channel === automationForm.channel).map((template) => [template.id, template.name] as [string, string]),
                ]}
              />
              <Select
                label="Status"
                value={automationForm.status}
                onChange={(value) => setAutomationForm({ ...automationForm, status: value as MarketingAutomationStatus })}
                options={[
                  ['active', 'Active'],
                  ['paused', 'Paused'],
                ]}
              />
            </div>

            <TextArea
              label="Notes"
              value={automationForm.notes}
              onChange={(value) => setAutomationForm({ ...automationForm, notes: value })}
              placeholder="Use this for follow-up reminders once a repair has been ready for a few days."
            />

            <div className="rounded-[18px] border border-[#d7bc9f] bg-[#f6eadb] px-4 py-4 text-sm text-[#34454d]">
              <p className="font-semibold text-[#18242b]">How this works</p>
              <p className="mt-2">Automations can be saved, paused, and safely run on demand. Each run skips recipients already logged for that automation.</p>
            </div>

            <button
              type="submit"
              disabled={savingAutomation}
              className="appleberry-gradient inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {savingAutomation ? 'Saving...' : editingAutomationId ? 'Update Automation' : 'Save Automation'}
            </button>
          </form>
        </div>

        <div className="section-card rounded-[28px] p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#dfe8eb] text-[#214e5f]">
              <CalendarClock className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-2xl font-semibold text-[#18242b]">Saved Automations</h3>
              <p className="text-sm text-[#5d6468] mt-1">Operational nudges and review requests you can run safely now, and schedule properly later.</p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {loading ? (
              <div className="text-sm text-[#5d6468]">Loading automations...</div>
            ) : automations.length === 0 ? (
              <EmptyState title="No automations yet" copy="Start with repair-ready alerts, 3-day pickup nudges, or post-sale review requests." />
            ) : (
              automations.map((automation) => (
                <div key={automation.id} className="rounded-[22px] border border-[#e6d7c6] bg-white/85 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-[#18242b]">{automation.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[#7b5c3c]">
                        {automation.channel} · {automation.trigger.replaceAll('_', ' ')} · {automation.status}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#e9f1f4] px-3 py-1 text-xs font-semibold text-[#214e5f]">
                      {automation.last_sent_count || 0} last sent
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#5d6468]">{automation.notes || 'No notes yet.'}</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAutomationId(automation.id);
                        setAutomationForm({
                          name: automation.name,
                          trigger: automation.trigger,
                          channel: automation.channel,
                          template_id: automation.template_id || '',
                          status: automation.status,
                          notes: automation.notes || '',
                        });
                      }}
                      className="rounded-xl border border-[#d9c4ae] bg-white px-4 py-2 text-sm font-semibold text-[#214e5f] hover:bg-[#fbf4eb]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRunAutomation(automation)}
                      disabled={runningAutomationId === automation.id || automation.status !== 'active'}
                      className="appleberry-gradient inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" />
                      {runningAutomationId === automation.id ? 'Running...' : 'Run Now'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="section-card rounded-[28px] p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#dfe8eb] text-[#214e5f]">
            <Send className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-2xl font-semibold text-[#18242b]">Test Send</h3>
            <p className="text-sm text-[#4f5a60] mt-1">Pick yourself or any customer, preview the message, and send one safe test before running a campaign.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <Select
              label="Template"
              value={testSendForm.template_id}
              onChange={(value) =>
                setTestSendForm({
                  ...testSendForm,
                  template_id: value,
                  customer_id: '',
                  customer_search: '',
                  manual_target: '',
                })
              }
              options={[
                ['', 'Select a template'],
                ...templates.map((template) => [template.id, `${template.name} (${template.channel})`] as [string, string]),
              ]}
            />

            <Input
              label="Search customer"
              value={testSendForm.customer_search}
              onChange={(value) => setTestSendForm({ ...testSendForm, customer_search: value })}
              placeholder="Type name, phone, email, or company"
            />

            <Select
              label="Customer"
              value={testSendForm.customer_id}
              onChange={(value) => setTestSendForm({ ...testSendForm, customer_id: value })}
              options={[
                ['', 'Choose a customer'],
                ...filteredTestCustomers.map((customer) => [
                    customer.id,
                    `${customer.name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Customer'}${customer.phone ? ` · ${customer.phone}` : customer.email ? ` · ${customer.email}` : ''}`,
                  ] as [string, string]),
              ]}
            />

            <p className="text-xs text-[#7b6e62]">
              Showing up to {filteredTestCustomers.length} matching customers for quick testing.
            </p>

            <Input
              label={selectedTestTemplate?.channel === 'email' ? 'Manual test email override' : 'Manual test phone override'}
              value={testSendForm.manual_target}
              onChange={(value) => setTestSendForm({ ...testSendForm, manual_target: value })}
              placeholder={selectedTestTemplate?.channel === 'email' ? 'name@example.com' : '0821234567'}
            />

            <div className="rounded-[18px] border border-[#d7bc9f] bg-[#f6eadb] px-4 py-4 text-sm text-[#34454d]">
              <p className="font-semibold text-[#18242b]">Resolved destination</p>
              <p className="mt-2 break-all">{testTarget || 'Pick a template and customer to resolve the destination.'}</p>
            </div>

            <button
              type="button"
              onClick={() => void handleSendTest()}
              disabled={sendingTest}
              className="appleberry-gradient inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {sendingTest ? 'Sending Test...' : 'Send Test'}
            </button>
          </div>

          <div className="rounded-[24px] border border-[#d7bc9f] bg-[#fff9f2] p-5">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#7b5c3c] font-semibold">Preview</p>
            <h4 className="mt-2 text-xl font-semibold text-[#18242b]">
              {selectedTestTemplate?.name || 'Select a template to preview'}
            </h4>
            {selectedTestTemplate?.channel === 'email' && (
              <div className="mt-4 rounded-[16px] bg-white px-4 py-3 border border-[#e4cfb6]">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#8a7358]">Subject</p>
                <p className="mt-1 text-sm font-semibold text-[#18242b]">{testPreview?.subject || 'No subject yet'}</p>
              </div>
            )}
            <div className="mt-4 rounded-[20px] bg-white px-5 py-4 border border-[#e4cfb6] min-h-[220px]">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#8a7358]">Message</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#34454d]">
                {testPreview?.body || 'Your rendered message preview will appear here.'}
              </p>
            </div>
            <p className="mt-4 text-sm text-[#5d6468]">
              We use sample values like <span className="font-semibold text-[#18242b]">RPR-TEST-001</span> and <span className="font-semibold text-[#18242b]">iPhone 13</span> for previewing placeholders before the real send.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="section-card rounded-[28px] p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#efe0ce] text-[#c65a22]">
              <Tag className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-2xl font-semibold text-[#18242b]">Marketing Ideas We Can Build Next</h3>
              <p className="text-sm text-[#5d6468] mt-1">These are the highest-value campaign automations for repair businesses.</p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {ideaCards.map((idea) => (
              <div key={idea.title} className="rounded-[22px] border border-[#d7bc9f] bg-[#fffaf4] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                <p className="text-lg font-semibold text-[#18242b]">{idea.title}</p>
                <p className="mt-2 text-sm leading-6 text-[#34454d]">{idea.copy}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="section-card rounded-[28px] p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#dfe8eb] text-[#214e5f]">
              <Megaphone className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-2xl font-semibold text-[#18242b]">Saved Templates</h3>
              <p className="text-sm text-[#5d6468] mt-1">Edit an existing template or use one as the base for a live campaign later.</p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {loading ? (
              <div className="text-sm text-[#5d6468]">Loading templates...</div>
            ) : templates.length === 0 ? (
              <EmptyState title="No templates yet" copy="Start with pickup reminders, review requests, promos, or warranty campaigns." />
            ) : (
              templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => {
                    setEditingTemplateId(template.id);
                    setTemplateForm({
                      name: template.name,
                      channel: template.channel,
                      category: template.category,
                      subject: template.subject || '',
                      body: template.body,
                      variables: (template.variables || []).join(', '),
                    });
                  }}
                  className="w-full rounded-[22px] border border-[#e6d7c6] bg-white/85 p-4 text-left transition hover:-translate-y-0.5 hover:bg-white"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-[#18242b]">{template.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[#7b5c3c]">{template.channel} · {template.category.replace('_', ' ')}</p>
                    </div>
                    <span className="rounded-full bg-[#f3e5d4] px-3 py-1 text-xs font-semibold text-[#214e5f]">{template.variables?.length || 0} vars</span>
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#5d6468]">{template.body}</p>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="section-card rounded-[28px] p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#efe0ce] text-[#c65a22]">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-2xl font-semibold text-[#18242b]">Campaign Pipeline</h3>
            <p className="text-sm text-[#5d6468] mt-1">See what is drafted, scheduled, and already sent, then launch campaigns from one clean control panel.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {loading ? (
            <div className="text-sm text-[#5d6468]">Loading campaigns...</div>
          ) : campaigns.length === 0 ? (
            <EmptyState title="No campaigns yet" copy="Create your first audience plan for pickup reminders, promotions, or reactivation flows." />
          ) : (
            campaigns.map((campaign) => (
              <div
                key={campaign.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setEditingCampaignId(campaign.id);
                  setCampaignForm({
                    name: campaign.name,
                    channel: campaign.channel,
                    segment_id: campaign.segment_id || '',
                    audience_label: campaign.audience_label,
                    audience_query: campaign.audience_query || '',
                    template_id: campaign.template_id || '',
                    status: campaign.status,
                    scheduled_for: campaign.scheduled_for || '',
                    notes: campaign.notes || '',
                    estimated_recipients: campaign.estimated_recipients ? String(campaign.estimated_recipients) : '',
                  });
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setEditingCampaignId(campaign.id);
                    setCampaignForm({
                      name: campaign.name,
                      channel: campaign.channel,
                      segment_id: campaign.segment_id || '',
                      audience_label: campaign.audience_label,
                      audience_query: campaign.audience_query || '',
                      template_id: campaign.template_id || '',
                      status: campaign.status,
                      scheduled_for: campaign.scheduled_for || '',
                      notes: campaign.notes || '',
                      estimated_recipients: campaign.estimated_recipients ? String(campaign.estimated_recipients) : '',
                    });
                  }
                }}
                className="rounded-[22px] border border-[#e6d7c6] bg-white/85 p-5 text-left transition hover:-translate-y-0.5 hover:bg-white cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-[#18242b]">{campaign.name}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[#7b5c3c]">{campaign.channel} · {campaign.status}</p>
                  </div>
                  <span className="rounded-full bg-[#dfe8eb] px-3 py-1 text-xs font-semibold text-[#214e5f]">
                    {campaign.estimated_recipients || 0} recipients
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <CampaignFact label="Audience" value={campaign.audience_label} />
                  <CampaignFact label="Segment" value={campaign.segment_name || 'No segment'} />
                  <CampaignFact label="Template" value={campaign.template_name || 'No template'} />
                  <CampaignFact label="Schedule" value={campaign.scheduled_for || 'Not scheduled'} />
                  <CampaignFact label="Notes" value={campaign.notes || 'No notes yet'} />
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleSendCampaign(campaign);
                    }}
                    disabled={sendingCampaignId === campaign.id}
                    className="appleberry-gradient inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    {sendingCampaignId === campaign.id ? 'Sending...' : 'Send Now'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="section-card rounded-[28px] p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#efe0ce] text-[#c65a22]">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-2xl font-semibold text-[#18242b]">Delivery History</h3>
              <p className="text-sm text-[#5d6468] mt-1">Track every test send and campaign delivery so you always know what went out and when.</p>
            </div>
          </div>
          <div className="rounded-[18px] border border-[#d7bc9f] bg-[#fff7ee] px-4 py-3 text-right">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[#8a7358]">Logged sends</p>
            <p className="mt-1 text-2xl font-bold text-[#18242b]">{stats.deliveries}</p>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-[22px] border border-[#e6d7c6] bg-white/90">
          <div className="grid grid-cols-[1.1fr_0.8fr_1.2fr_1fr_1fr_1fr] gap-3 border-b border-[#eee0cf] bg-[#fbf4eb] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b7e73]">
            <div>Recipient</div>
            <div>Channel</div>
            <div>Target</div>
            <div>Source</div>
            <div>Status</div>
            <div>Sent</div>
          </div>

          <div className="divide-y divide-[#f0e6da]">
            {loading ? (
              <div className="px-5 py-4 text-sm text-[#5d6468]">Loading delivery history...</div>
            ) : deliveries.length === 0 ? (
              <div className="px-5 py-6 text-sm text-[#5d6468]">No deliveries yet. Send a test message or campaign and it will appear here.</div>
            ) : (
              deliveries.slice(0, 20).map((delivery) => {
                const linkedCustomer = delivery.customer_id ? customerLookup.get(delivery.customer_id) : null;
                const recipientName =
                  linkedCustomer?.name ||
                  `${linkedCustomer?.first_name || ''} ${linkedCustomer?.last_name || ''}`.trim() ||
                  'Direct test';

                return (
                  <div
                    key={delivery.id}
                    className="grid grid-cols-[1.1fr_0.8fr_1.2fr_1fr_1fr_1fr] gap-3 px-5 py-4 text-sm text-[#34454d]"
                  >
                    <div>
                      <p className="font-semibold text-[#18242b]">{recipientName}</p>
                      {linkedCustomer?.company && <p className="mt-1 text-xs text-[#7b6e62]">{linkedCustomer.company}</p>}
                    </div>
                    <div>
                      <span className="rounded-full bg-[#e9f1f4] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#214e5f]">
                        {delivery.channel}
                      </span>
                    </div>
                    <div className="break-all text-[#4f5a60]">{delivery.target}</div>
                    <div>
                      <p className="font-medium text-[#18242b]">{delivery.campaign_name || 'Test send'}</p>
                      <p className="mt-1 text-xs text-[#7b6e62]">{delivery.template_id ? 'Template linked' : 'Direct send'}</p>
                    </div>
                    <div>
                      <span className="rounded-full bg-[#f3e5d4] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#8c4e1b]">
                        {delivery.status}
                      </span>
                    </div>
                    <div className="text-[#4f5a60]">{formatDeliveryTime(delivery.sent_at)}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDeliveryTime(value?: string | null) {
  if (!value) return 'Just now';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function StatCard({ title, value, icon: Icon }: { title: string; value: string; icon: any }) {
  return (
    <div className="section-card rounded-[24px] p-5">
      <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#efe0ce] text-[#c65a22]">
        <Icon className="h-6 w-6" />
      </div>
      <p className="mt-4 text-sm text-[#5d6468]">{title}</p>
      <p className="mt-1 text-3xl font-bold text-[#18242b]">{value}</p>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#4f5a60] mb-1.5">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className="w-full rounded-xl border border-[#dbc8b2] bg-white px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-[#f4eee5] disabled:text-[#948779]"
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#4f5a60] mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-[#dbc8b2] bg-white px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue || optionLabel} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#4f5a60] mb-1.5">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        rows={4}
        className="w-full rounded-xl border border-[#dbc8b2] bg-white px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    </div>
  );
}

function CampaignFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#fbf4eb] px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[#8b7e73]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#18242b]">{value}</p>
    </div>
  );
}

function EmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="rounded-[22px] border border-dashed border-[#d9c4ae] bg-[#fbf4eb] p-8 text-center">
      <p className="text-lg font-semibold text-[#18242b]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[#5d6468]">{copy}</p>
    </div>
  );
}
