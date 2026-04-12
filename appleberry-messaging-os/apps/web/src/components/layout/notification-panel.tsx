'use client';

import { BarChart2, Bot, CheckCheck, Users2, Wifi, X, ZapOff } from 'lucide-react';
import { useState } from 'react';

type NotificationType = 'campaign' | 'account' | 'contact' | 'bot' | 'error';

type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
};

const ICON_MAP: Record<NotificationType, React.ElementType> = {
  campaign: BarChart2,
  account: Wifi,
  contact: Users2,
  bot: Bot,
  error: ZapOff,
};

const COLOR_MAP: Record<NotificationType, string> = {
  campaign: 'bg-emerald-50 text-emerald-500',
  account: 'bg-sky-50 text-sky-500',
  contact: 'bg-violet-50 text-violet-500',
  bot: 'bg-indigo-50 text-indigo-500',
  error: 'bg-rose-50 text-rose-500',
};

const SEED_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    type: 'campaign',
    title: 'Campaign complete',
    body: 'Summer Promo finished — 12,883 messages sent, 98.4% delivered.',
    timestamp: '2 min ago',
    read: false,
  },
  {
    id: '2',
    type: 'account',
    title: 'Account connected',
    body: 'Vodacom Superstore Midlands is now online and healthy.',
    timestamp: '14 min ago',
    read: false,
  },
  {
    id: '3',
    type: 'contact',
    title: 'Contacts imported',
    body: '4,200 contacts successfully imported from CSV.',
    timestamp: '1 hr ago',
    read: true,
  },
  {
    id: '4',
    type: 'bot',
    title: 'Chatbot triggered',
    body: 'Flow "Support Onboarding" was triggered 341 times today.',
    timestamp: '3 hr ago',
    read: true,
  },
  {
    id: '5',
    type: 'error',
    title: 'Account degraded',
    body: 'NEW PHONE NUMBER health dropped to 62%. Check connection.',
    timestamp: '5 hr ago',
    read: true,
  },
];

function timeAgo(ts: string): string {
  return ts;
}

interface NotificationPanelProps {
  onClose: () => void;
}

export function NotificationPanel({ onClose }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<Notification[]>(SEED_NOTIFICATIONS);

  const unreadCount = notifications.filter((n) => !n.read).length;

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div className="absolute right-0 top-full z-50 mt-2 w-[360px] overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
            {unreadCount > 0 && (
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-semibold text-white">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
              <CheckCheck className="h-8 w-8 text-emerald-400" />
              <p className="text-sm font-medium text-slate-700">You're all caught up</p>
              <p className="text-xs text-slate-400">No new notifications right now.</p>
            </div>
          ) : (
            notifications.map((notification) => {
              const Icon = ICON_MAP[notification.type];
              const colorClass = COLOR_MAP[notification.type];

              return (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => markRead(notification.id)}
                  className={`w-full text-left flex items-start gap-3 px-4 py-3 transition hover:bg-slate-50 ${
                    !notification.read ? 'bg-indigo-50/40' : ''
                  }`}
                >
                  <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${colorClass}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900 truncate">{notification.title}</p>
                      {!notification.read && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 leading-snug line-clamp-2">{notification.body}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{timeAgo(notification.timestamp)}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
