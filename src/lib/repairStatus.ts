// One place that decides what a repair status name means, so renaming statuses
// cannot silently change the dashboard, reports or WhatsApp automations.

// Defaults match the status names staff already use in Cellstore.
export const DEFAULT_REPAIR_STATUSES = [
  { name: 'New', color: '#2f6f9f', order_index: 1 },
  { name: 'Assigned', color: '#4d7787', order_index: 2 },
  { name: 'Estimate', color: '#8b5cf6', order_index: 3 },
  { name: 'Waiting on Customer', color: '#d98a3a', order_index: 4 },
  { name: 'Finished', color: '#2b8a57', order_index: 5 },
  { name: 'Invoiced', color: '#6d6862', order_index: 6 },
  { name: 'Cancelled', color: '#b91c1c', order_index: 7 },
  { name: 'Closed', color: '#52525b', order_index: 8 },
];

// Earlier Appleberry OS defaults, mapped to the Cellstore name that does the same job.
export const LEGACY_STATUS_RENAMES: Record<string, string> = {
  'booked in': 'New',
  'awaiting quote approval': 'Estimate',
  'in progress': 'Assigned',
  'ready for collection': 'Finished',
  collected: 'Invoiced',
};

export const INVOICED_STATUS_NAME = 'Invoiced';

const CLOSED_KEYWORDS = ['invoiced', 'cancel', 'closed', 'collected', 'void', 'complete', 'done'];
const READY_KEYWORDS = ['finished', 'ready'];

const normalize = (name?: string | null) => (name || '').trim().toLowerCase();

// Closed = off the Open queue. Finished stays open until it is invoiced, as in Cellstore.
export function isClosedStatusName(name?: string | null) {
  const value = normalize(name);
  return Boolean(value) && CLOSED_KEYWORDS.some((keyword) => value.includes(keyword));
}

// Ready = waiting for the customer to collect; drives the pickup reminders.
export function isReadyStatusName(name?: string | null) {
  const value = normalize(name);
  return READY_KEYWORDS.some((keyword) => value.includes(keyword));
}
