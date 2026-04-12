'use client';

import {
  Bot,
  CheckCheck,
  ChevronDown,
  Paperclip,
  Search,
  Send,
  StickyNote,
  UserCheck,
  X,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

import { DashboardShell } from '../../components/layout/dashboard-shell';
import { useSendMessage, useTakeoverThread, useUpdateThread } from '../../hooks/use-inbox';

// ─── Types ────────────────────────────────────────────────────────────────────

type ThreadStatus = 'open' | 'closed' | 'bot_active' | 'pending';

type Thread = {
  id: string;
  contactName: string;
  contactPhone: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  status: ThreadStatus;
  assignedAgent: string | null;
  accountId: string;
};

type Message = {
  id: string;
  threadId: string;
  direction: 'inbound' | 'outbound';
  body: string;
  sentAt: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  isBot: boolean;
  isNote: boolean;
};

type FilterTab = 'all' | 'open' | 'bot_active' | 'assigned' | 'unread';

// ─── Static mock data ─────────────────────────────────────────────────────────

const MOCK_THREADS: Thread[] = [
  {
    id: 't1',
    contactName: 'Nandi from Meta Ads',
    contactPhone: '+27 82 123 4567',
    lastMessage: 'Thanks! I will check the pricing page now.',
    lastMessageAt: '2 min ago',
    unreadCount: 3,
    status: 'bot_active',
    assignedAgent: null,
    accountId: 'acc1',
  },
  {
    id: 't2',
    contactName: 'Sipho Support',
    contactPhone: '+27 71 987 6543',
    lastMessage: 'My order still hasn\'t arrived, can you help?',
    lastMessageAt: '7 min ago',
    unreadCount: 1,
    status: 'open',
    assignedAgent: 'AP',
    accountId: 'acc2',
  },
  {
    id: 't3',
    contactName: 'Lebo Wholesale',
    contactPhone: '+27 63 456 7890',
    lastMessage: 'Please send the invoice for March.',
    lastMessageAt: '14 min ago',
    unreadCount: 0,
    status: 'pending',
    assignedAgent: 'LK',
    accountId: 'acc1',
  },
  {
    id: 't4',
    contactName: 'Thabo Mokoena',
    contactPhone: '+27 84 321 0987',
    lastMessage: 'Got it, thank you so much!',
    lastMessageAt: '1 hr ago',
    unreadCount: 0,
    status: 'closed',
    assignedAgent: 'AP',
    accountId: 'acc3',
  },
  {
    id: 't5',
    contactName: 'Zanele Dlamini',
    contactPhone: '+27 76 654 3210',
    lastMessage: 'Hi, I need help with registration.',
    lastMessageAt: '2 hr ago',
    unreadCount: 2,
    status: 'open',
    assignedAgent: null,
    accountId: 'acc2',
  },
  {
    id: 't6',
    contactName: 'Marcus van Wyk',
    contactPhone: '+27 61 789 0123',
    lastMessage: 'Bot: Your tracking number is ZA98234.',
    lastMessageAt: '3 hr ago',
    unreadCount: 0,
    status: 'bot_active',
    assignedAgent: null,
    accountId: 'acc1',
  },
  {
    id: 't7',
    contactName: 'Priya Naidoo',
    contactPhone: '+27 83 012 3456',
    lastMessage: 'Do you have stock in Cape Town?',
    lastMessageAt: '5 hr ago',
    unreadCount: 0,
    status: 'open',
    assignedAgent: 'LK',
    accountId: 'acc3',
  },
];

const MOCK_MESSAGES: Record<string, Message[]> = {
  t1: [
    { id: 'm1', threadId: 't1', direction: 'inbound', body: 'Hi! I saw your ad on Facebook.', sentAt: '09:02', status: 'read', isBot: false, isNote: false },
    { id: 'm2', threadId: 't1', direction: 'outbound', body: 'Hello! Welcome to Appleberry. How can I help you today?', sentAt: '09:02', status: 'read', isBot: true, isNote: false },
    { id: 'm3', threadId: 't1', direction: 'inbound', body: 'I\'m interested in the premium plan pricing.', sentAt: '09:03', status: 'read', isBot: false, isNote: false },
    { id: 'm4', threadId: 't1', direction: 'outbound', body: 'Great choice! Our premium plan starts at R 1,499/month and includes up to 50,000 messages. Would you like more details?', sentAt: '09:03', status: 'delivered', isBot: true, isNote: false },
    { id: 'm5', threadId: 't1', direction: 'inbound', body: 'Thanks! I will check the pricing page now.', sentAt: '09:05', status: 'read', isBot: false, isNote: false },
  ],
  t2: [
    { id: 'm1', threadId: 't2', direction: 'inbound', body: 'Hi, my order #ZA9923 placed last week hasn\'t arrived yet.', sentAt: '08:51', status: 'read', isBot: false, isNote: false },
    { id: 'm2', threadId: 't2', direction: 'outbound', body: 'Hi Sipho! Let me look that up for you right away.', sentAt: '08:52', status: 'read', isBot: false, isNote: false },
    { id: 'm3', threadId: 't2', direction: 'outbound', body: 'Internal note: Order seems to be stuck at Durban warehouse. Check with logistics.', sentAt: '08:53', status: 'read', isBot: false, isNote: true },
    { id: 'm4', threadId: 't2', direction: 'inbound', body: 'My order still hasn\'t arrived, can you help?', sentAt: '08:58', status: 'read', isBot: false, isNote: false },
  ],
  t3: [
    { id: 'm1', threadId: 't3', direction: 'inbound', body: 'Good morning! Could you please send the March invoice?', sentAt: '07:45', status: 'read', isBot: false, isNote: false },
    { id: 'm2', threadId: 't3', direction: 'inbound', body: 'Please send the invoice for March.', sentAt: '08:30', status: 'read', isBot: false, isNote: false },
  ],
};

const AGENTS = ['AP', 'LK', 'TM', 'ZD', 'MV'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function statusColor(status: ThreadStatus): string {
  const map: Record<ThreadStatus, string> = {
    open: 'bg-emerald-400',
    closed: 'bg-slate-300',
    bot_active: 'bg-indigo-400',
    pending: 'bg-amber-400',
  };
  return map[status];
}

function statusLabel(status: ThreadStatus): string {
  const map: Record<ThreadStatus, string> = {
    open: 'Open',
    closed: 'Closed',
    bot_active: 'Bot Active',
    pending: 'Pending',
  };
  return map[status];
}

function statusBadgeClass(status: ThreadStatus): string {
  const map: Record<ThreadStatus, string> = {
    open: 'bg-emerald-100 text-emerald-700',
    closed: 'bg-slate-100 text-slate-500',
    bot_active: 'bg-indigo-100 text-indigo-700',
    pending: 'bg-amber-100 text-amber-700',
  };
  return map[status];
}

function MessageStatusIcon({ status }: { status: Message['status'] }) {
  if (status === 'read') return <CheckCheck className="h-3 w-3 text-sky-400" />;
  if (status === 'delivered') return <CheckCheck className="h-3 w-3 text-slate-300" />;
  if (status === 'sent') return <CheckCheck className="h-3 w-3 text-slate-300" />;
  return <X className="h-3 w-3 text-rose-400" />;
}

// ─── Thread List Item ─────────────────────────────────────────────────────────

function ThreadItem({
  thread,
  selected,
  onClick,
}: {
  thread: Thread;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left flex items-start gap-3 px-4 py-3 transition ${
        selected ? 'bg-indigo-50 border-r-2 border-indigo-500' : 'hover:bg-slate-50'
      }`}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-slate-800 text-xs font-semibold text-white">
          {getInitials(thread.contactName)}
        </div>
        <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${statusColor(thread.status)}`} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <p className="truncate text-sm font-medium text-slate-900">{thread.contactName}</p>
          <span className="shrink-0 text-[11px] text-slate-400">{thread.lastMessageAt}</span>
        </div>
        <p className="truncate text-xs text-slate-400">{thread.contactPhone}</p>
        <p className="mt-0.5 truncate text-xs text-slate-500">{thread.lastMessage}</p>
      </div>

      {/* Badges */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        {thread.unreadCount > 0 && (
          <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-semibold text-white">
            {thread.unreadCount}
          </span>
        )}
        {thread.assignedAgent && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-sky-100 text-[9px] font-bold text-sky-600">
            {thread.assignedAgent}
          </span>
        )}
      </div>
    </button>
  );
}

// ─── Conversation Panel ───────────────────────────────────────────────────────

function ConversationPanel({ thread }: { thread: Thread | null }) {
  const [messageInput, setMessageInput] = useState('');
  const [isNote, setIsNote] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(thread?.assignedAgent ?? '');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sendMutation = useSendMessage(thread?.id ?? '');
  const updateMutation = useUpdateThread(thread?.id ?? '');
  const takeoverMutation = useTakeoverThread(thread?.id ?? '');

  const messages: Message[] = thread ? (MOCK_MESSAGES[thread.id] ?? []) : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    setSelectedAgent(thread?.assignedAgent ?? '');
    setIsNote(false);
    setMessageInput('');
  }, [thread?.id]);

  if (!thread) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-slate-50">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm border border-slate-200">
          <Send className="h-6 w-6 text-slate-300" />
        </div>
        <p className="text-sm font-medium text-slate-500">Select a conversation</p>
        <p className="text-xs text-slate-400">Pick a thread from the left to start messaging</p>
      </div>
    );
  }

  function handleSend() {
    if (!messageInput.trim() || !thread) return;
    sendMutation.mutate({ body: messageInput.trim(), isNote });
    setMessageInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleTakeover() {
    takeoverMutation.mutate();
  }

  function handleAssign() {
    updateMutation.mutate({ assignedAgent: selectedAgent || null });
  }

  // Group messages by date
  const grouped: { date: string; messages: Message[] }[] = [];
  for (const msg of messages) {
    const dateLabel = 'Today';
    const last = grouped[grouped.length - 1];
    if (last && last.date === dateLabel) {
      last.messages.push(msg);
    } else {
      grouped.push({ date: dateLabel, messages: [msg] });
    }
  }

  return (
    <div className="flex flex-1 flex-col min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-slate-800 text-xs font-semibold text-white">
            {getInitials(thread.contactName)}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{thread.contactName}</p>
            <p className="text-xs text-slate-400">{thread.contactPhone}</p>
          </div>
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(thread.status)}`}>
            {statusLabel(thread.status)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Assign agent */}
          <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1.5">
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              onBlur={handleAssign}
              className="bg-transparent text-xs text-slate-600 outline-none"
            >
              <option value="">Unassigned</option>
              {AGENTS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <ChevronDown className="h-3 w-3 text-slate-400" />
          </div>

          {/* Takeover */}
          {thread.status === 'bot_active' && (
            <button
              type="button"
              onClick={handleTakeover}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-600 transition"
            >
              <UserCheck className="h-3.5 w-3.5" />
              Take Over
            </button>
          )}

          {/* Close thread */}
          {thread.status !== 'closed' && (
            <button
              type="button"
              onClick={() => updateMutation.mutate({ status: 'closed' })}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              <X className="h-3.5 w-3.5" />
              Close
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 bg-slate-50">
        {grouped.map((group) => (
          <div key={group.date}>
            <div className="flex items-center justify-center mb-3">
              <span className="rounded-full bg-white border border-slate-200 px-3 py-0.5 text-[11px] text-slate-400 shadow-sm">
                {group.date}
              </span>
            </div>
            <div className="space-y-2">
              {group.messages.map((msg) => {
                const isOutbound = msg.direction === 'outbound';
                const isNoteMsg = msg.isNote;

                return (
                  <div
                    key={msg.id}
                    className={`flex items-end gap-2 ${isOutbound ? 'justify-end' : 'justify-start'}`}
                  >
                    {/* Bot icon for inbound bot messages */}
                    {!isOutbound && (
                      <div className="mb-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500">
                        <Bot className="h-3.5 w-3.5" />
                      </div>
                    )}

                    <div className={`max-w-[70%] ${isOutbound ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                      {isNoteMsg && (
                        <div className="flex items-center gap-1 text-[10px] text-amber-600 font-medium">
                          <StickyNote className="h-3 w-3" />
                          Internal note
                        </div>
                      )}
                      <div
                        className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          isNoteMsg
                            ? 'bg-amber-50 border border-amber-200 text-amber-800'
                            : isOutbound
                            ? 'bg-emerald-500 text-white'
                            : 'bg-white border border-slate-200 text-slate-800'
                        }`}
                      >
                        {msg.body}
                      </div>
                      <div className={`flex items-center gap-1 ${isOutbound ? 'flex-row-reverse' : ''}`}>
                        <span className="text-[10px] text-slate-400">{msg.sentAt}</span>
                        {isOutbound && <MessageStatusIcon status={msg.status} />}
                        {msg.isBot && !isNoteMsg && (
                          <span className="text-[10px] text-indigo-400 font-medium">Bot</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className={`border-t border-slate-200 bg-white p-4 ${isNote ? 'bg-amber-50/40' : ''}`}>
        {/* Note toggle */}
        <div className="mb-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsNote(false)}
            className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
              !isNote ? 'bg-emerald-100 text-emerald-700' : 'text-slate-400 hover:bg-slate-100'
            }`}
          >
            Reply
          </button>
          <button
            type="button"
            onClick={() => setIsNote(true)}
            className={`flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-medium transition ${
              isNote ? 'bg-amber-100 text-amber-700' : 'text-slate-400 hover:bg-slate-100'
            }`}
          >
            <StickyNote className="h-3 w-3" />
            Internal note
          </button>
        </div>

        <div className={`flex items-end gap-2 rounded-2xl border px-3 py-2 ${
          isNote ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'
        }`}>
          <textarea
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isNote ? 'Add an internal note…' : 'Type a message…'}
            rows={2}
            className={`flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-slate-400 ${
              isNote ? 'placeholder:text-amber-400' : ''
            }`}
          />
          <div className="flex items-center gap-1 shrink-0">
            <button type="button" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 transition">
              <Paperclip className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={!messageInput.trim() || sendMutation.isPending}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition disabled:opacity-50 ${
                isNote ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'
              }`}
            >
              <Send className="h-3.5 w-3.5" />
              {sendMutation.isPending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InboxPage() {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  const FILTER_TABS: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'open', label: 'Open' },
    { key: 'bot_active', label: 'Bot Active' },
    { key: 'assigned', label: 'Assigned to Me' },
    { key: 'unread', label: 'Unread' },
  ];

  const filteredThreads = MOCK_THREADS.filter((t) => {
    const matchesSearch =
      t.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.contactPhone.includes(searchQuery) ||
      t.lastMessage.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeFilter === 'open') return t.status === 'open';
    if (activeFilter === 'bot_active') return t.status === 'bot_active';
    if (activeFilter === 'assigned') return t.assignedAgent !== null;
    if (activeFilter === 'unread') return t.unreadCount > 0;
    return true;
  });

  const selectedThread = filteredThreads.find((t) => t.id === selectedThreadId) ?? null;

  return (
    <DashboardShell title="Inbox" eyebrow="Live Operations">
      {/* Break out of DashboardShell padding to use full area */}
      <div className="-mx-4 -my-5 lg:-mx-6 flex h-[calc(100vh-120px)] overflow-hidden">

        {/* ── Left Panel: Thread List ──────────────────────────────────────── */}
        <div className="flex w-[340px] shrink-0 flex-col border-r border-slate-200 bg-white">
          {/* Search */}
          <div className="border-b border-slate-200 p-3">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search threads…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-3 py-2">
            {FILTER_TABS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveFilter(key)}
                className={`shrink-0 rounded-xl px-3 py-1 text-xs font-medium transition ${
                  activeFilter === key
                    ? 'bg-indigo-500 text-white'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Thread list */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredThreads.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
                <Search className="h-8 w-8 text-slate-200" />
                <p className="text-sm text-slate-400">No threads found</p>
              </div>
            ) : (
              filteredThreads.map((thread) => (
                <ThreadItem
                  key={thread.id}
                  thread={thread}
                  selected={thread.id === selectedThreadId}
                  onClick={() => setSelectedThreadId(thread.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Right Panel: Conversation ────────────────────────────────────── */}
        <ConversationPanel thread={selectedThread} />
      </div>
    </DashboardShell>
  );
}
