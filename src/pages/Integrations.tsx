import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Link, Settings, CheckCircle, XCircle } from 'lucide-react';
import { db } from '../lib/firebase';
import { useTenant } from '../lib/tenant';
import { toast } from 'sonner';

type Integration = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  configured: boolean;
  icon: string;
};

const availableIntegrations: Integration[] = [
  {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    description: 'Send automated messages and notifications',
    enabled: false,
    configured: false,
    icon: '💬',
  },
  {
    id: 'email',
    name: 'Email Service',
    description: 'Send transactional emails and receipts',
    enabled: false,
    configured: false,
    icon: '📧',
  },
  {
    id: 'payment',
    name: 'Payment Gateway',
    description: 'Accept online payments',
    enabled: false,
    configured: false,
    icon: '💳',
  },
  {
    id: 'sms',
    name: 'SMS Notifications',
    description: 'Send SMS alerts and reminders',
    enabled: false,
    configured: false,
    icon: '📱',
  },
  {
    id: 'analytics',
    name: 'Analytics',
    description: 'Track business metrics and insights',
    enabled: false,
    configured: false,
    icon: '📊',
  },
];

export default function Integrations() {
  const { companyId } = useTenant();
  const [integrations, setIntegrations] = useState<Integration[]>(availableIntegrations);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (companyId) {
      fetchIntegrations();
    }
  }, [companyId]);

  async function fetchIntegrations() {
    setLoading(true);
    try {
      const integrationsDoc = await getDoc(doc(db, 'integrations', companyId));
      if (integrationsDoc.exists()) {
        const savedIntegrations = integrationsDoc.data();
        setIntegrations(integrations.map(int => ({
          ...int,
          ...savedIntegrations[int.id],
        })));
      }
    } catch (error) {
      console.error('Error fetching integrations:', error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleIntegration(id: string, enabled: boolean) {
    if (!companyId) return;

    const updatedIntegrations = integrations.map(int =>
      int.id === id ? { ...int, enabled } : int
    );
    setIntegrations(updatedIntegrations);

    try {
      const integrationData = updatedIntegrations.reduce((acc, int) => {
        acc[int.id] = { enabled: int.enabled, configured: int.configured };
        return acc;
      }, {} as Record<string, any>);

      await updateDoc(doc(db, 'integrations', companyId), integrationData);
      toast.success(`${enabled ? 'Enabled' : 'Disabled'} ${integrations.find(int => int.id === id)?.name}`);
    } catch (error) {
      console.error('Error updating integration:', error);
      toast.error('Failed to update integration');
      // Revert on error
      setIntegrations(integrations);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
        <p className="text-sm text-gray-600">Connect third-party services to enhance your business</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration) => (
          <div key={integration.id} className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="text-2xl">{integration.icon}</div>
                <div>
                  <h3 className="font-medium text-gray-900">{integration.name}</h3>
                  <p className="text-sm text-gray-500">{integration.description}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {integration.configured ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-gray-400" />
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <label htmlFor={`toggle-${integration.id}`} className="text-sm font-medium text-gray-700">
                  {integration.enabled ? 'Enabled' : 'Disabled'}
                </label>
                <button
                  id={`toggle-${integration.id}`}
                  onClick={() => toggleIntegration(integration.id, !integration.enabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                    integration.enabled ? 'bg-primary' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      integration.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <button className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80">
                <Settings className="h-4 w-4" />
                Configure
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-blue-50 border border-blue-200 p-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-2">Need a Custom Integration?</h2>
        <p className="text-blue-700 mb-4">
          Don't see the integration you need? We can help you build custom integrations.
        </p>
        <button className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Link className="h-4 w-4" />
          Request Integration
        </button>
      </div>
    </div>
  );
}