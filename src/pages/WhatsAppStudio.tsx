import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bot,
  CirclePlay,
  Download,
  ImagePlus,
  Link2,
  MessageCircleMore,
  Plus,
  RadioTower,
  Send,
  Sparkles,
  Tags,
  Upload,
  Zap,
} from 'lucide-react';
import { useTenant } from '../lib/tenant';

type TriggerType = 'keyword' | 'contains' | 'button' | 'fallback';
type StepType = 'send_text' | 'send_media' | 'ask_question' | 'call_ai' | 'call_api' | 'jump_flow';

type FlowStep = {
  id: string;
  title: string;
  type: StepType;
  content: string;
  enabled?: boolean;
  mediaUrl?: string;
  apiUrl?: string;
  nextFlowKeyword?: string;
};

type Flow = {
  id: string;
  name: string;
  triggerType: TriggerType;
  keywords: string[];
  enabled?: boolean;
  status: 'active' | 'draft';
  summary: string;
  steps: FlowStep[];
  source?: 'demo' | 'imported' | 'manual';
};

type Account = {
  id: string;
  name: string;
  phone: string;
  status: string;
  instanceId: string;
  token: string;
};

type SocialPosterChatbot = {
  name?: string;
  keywords?: string;
  type_search?: string;
  caption?: string | null;
  media?: string | null;
  nextBot?: string;
  api_url?: string;
  use_ai?: string;
  is_default?: string;
  status?: string;
  description?: string;
};

type SocialPosterExport = {
  version?: string;
  chatbots?: SocialPosterChatbot[];
  templates?: unknown[];
};

type SimulationResult = {
  flow: Flow | null;
  reason: string;
  matchedKeyword?: string;
  fallbackUsed: boolean;
  executedFlows: Flow[];
  executedSteps: FlowStep[];
};

type ChatPreviewMessage = {
  id: string;
  role: 'user' | 'bot' | 'system';
  title?: string;
  content: string;
  meta?: string;
};

type MediaAsset = {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string;
  size: number;
};

const demoAccounts: Account[] = [
  {
    id: 'acc-1',
    name: 'Appleberry Care Centre',
    phone: '27828861110@s.whatsapp.net',
    status: 'Connected',
    instanceId: '68AF28A69A5E2',
    token: '68a4********bd56',
  },
  {
    id: 'acc-2',
    name: 'TechCorp Support',
    phone: '27820001111@s.whatsapp.net',
    status: 'Sandbox',
    instanceId: 'SANDBOX-11',
    token: 'sand*********001',
  },
];

const starterFlows: Flow[] = [
  {
    id: 'flow-1',
    name: 'Pricing Enquiry',
    triggerType: 'keyword',
    keywords: ['pricing', 'prices', 'packages'],
    enabled: true,
    status: 'active',
    summary: 'Replies with package details and a booking CTA.',
    source: 'demo',
    steps: [
      { id: 'step-1', title: 'Send intro text', type: 'send_text', content: 'Thanks for messaging Appleberry. Here are our latest packages and pricing options.', enabled: true },
      { id: 'step-2', title: 'Send brochure', type: 'send_media', content: 'Attach pricing brochure or package image.', enabled: true, mediaUrl: 'https://example.com/pricing-brochure.png' },
      { id: 'step-3', title: 'Ask follow-up', type: 'ask_question', content: 'Would you like a booking link or a consultant callback?', enabled: true },
    ],
  },
  {
    id: 'flow-2',
    name: 'Human Handoff',
    triggerType: 'contains',
    keywords: ['agent', 'human', 'help'],
    enabled: true,
    status: 'active',
    summary: 'Escalates frustrated or urgent customers to a person.',
    source: 'demo',
    steps: [
      { id: 'step-4', title: 'Acknowledge request', type: 'send_text', content: 'No problem, I’m routing you to our support team now.', enabled: true },
      { id: 'step-5', title: 'Collect context', type: 'ask_question', content: 'Please share your order number or a short summary of the issue.', enabled: true },
    ],
  },
  {
    id: 'flow-3',
    name: 'Fallback AI Helper',
    triggerType: 'fallback',
    keywords: ['__fallback__'],
    enabled: false,
    status: 'draft',
    summary: 'Handles anything unmatched with AI assistance.',
    source: 'demo',
    steps: [
      { id: 'step-6', title: 'Generate AI reply', type: 'call_ai', content: 'Answer using the knowledge base and keep the tone helpful and brief.', enabled: true },
    ],
  },
];

const triggerMeta: Record<TriggerType, { label: string; hint: string; icon: typeof Tags }> = {
  keyword: { label: 'Keyword match', hint: 'Exact match for one of your saved keywords.', icon: Tags },
  contains: { label: 'Message contains', hint: 'Matches when a phrase appears anywhere in the message.', icon: MessageCircleMore },
  button: { label: 'Button or list tap', hint: 'Use after quick replies, lists, or menu selections.', icon: Zap },
  fallback: { label: 'Fallback', hint: 'Runs when no other flow catches the message.', icon: Sparkles },
};

const stepMeta: Record<StepType, { label: string; icon: typeof Send }> = {
  send_text: { label: 'Send text', icon: Send },
  send_media: { label: 'Send media', icon: ImagePlus },
  ask_question: { label: 'Ask question', icon: ArrowRight },
  call_ai: { label: 'AI reply', icon: Bot },
  call_api: { label: 'Call API', icon: RadioTower },
  jump_flow: { label: 'Jump to flow', icon: Link2 },
};

function inferTriggerType(bot: SocialPosterChatbot): TriggerType {
  if (bot.is_default === '1' || bot.keywords === '__fallback__') return 'fallback';
  if (bot.type_search === '2') {
    const raw = (bot.keywords || '').trim();
    if (/^\d+$/.test(raw)) return 'button';
    return 'contains';
  }
  return 'keyword';
}

function splitKeywords(raw: string | undefined) {
  return (raw || '')
    .split(',')
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

function buildStepsFromChatbot(bot: SocialPosterChatbot): FlowStep[] {
  const steps: FlowStep[] = [];

  if (bot.caption) {
    steps.push({
      id: `step-text-${Math.random().toString(36).slice(2, 8)}`,
      title: 'Send reply',
      type: bot.use_ai === '1' ? 'call_ai' : 'send_text',
      content: bot.caption,
      enabled: true,
    });
  }

  if (bot.media) {
    steps.push({
      id: `step-media-${Math.random().toString(36).slice(2, 8)}`,
      title: 'Send media',
      type: 'send_media',
      content: bot.caption || 'Send media attachment',
      enabled: true,
      mediaUrl: bot.media,
    });
  }

  if (bot.api_url) {
    steps.push({
      id: `step-api-${Math.random().toString(36).slice(2, 8)}`,
      title: 'Call API',
      type: 'call_api',
      content: 'Trigger external webhook or notification endpoint.',
      enabled: true,
      apiUrl: bot.api_url,
    });
  }

  if (bot.nextBot) {
    steps.push({
      id: `step-jump-${Math.random().toString(36).slice(2, 8)}`,
      title: 'Jump to next flow',
      type: 'jump_flow',
      content: `Continue to ${bot.nextBot}`,
      enabled: true,
      nextFlowKeyword: bot.nextBot,
    });
  }

  if (steps.length === 0) {
    steps.push({
      id: `step-empty-${Math.random().toString(36).slice(2, 8)}`,
      title: 'Empty reply',
      type: 'send_text',
      content: 'No caption was provided in the imported flow.',
      enabled: true,
    });
  }

  return steps;
}

function convertSocialPosterToFlows(payload: SocialPosterExport): Flow[] {
  return (payload.chatbots || []).map((bot, index) => ({
    id: `imported-flow-${index + 1}`,
    name: bot.name || `Imported flow ${index + 1}`,
    triggerType: inferTriggerType(bot),
    keywords: splitKeywords(bot.keywords),
    enabled: bot.status === '1',
    status: bot.status === '1' ? 'active' : 'draft',
    summary: bot.description || 'Imported from Social Poster export.',
    source: 'imported',
    steps: buildStepsFromChatbot(bot),
  }));
}

function convertFlowsToExport(flows: Flow[]): SocialPosterExport {
  return {
    version: '8.0.0',
    chatbots: flows.map((flow) => {
      const textStep = flow.steps.find((step) => step.enabled !== false && (step.type === 'send_text' || step.type === 'call_ai'));
      const mediaStep = flow.steps.find((step) => step.enabled !== false && step.type === 'send_media');
      const apiStep = flow.steps.find((step) => step.enabled !== false && step.type === 'call_api');
      const jumpStep = flow.steps.find((step) => step.enabled !== false && step.type === 'jump_flow');

      return {
        name: flow.name,
        keywords: flow.triggerType === 'fallback' ? '__fallback__' : flow.keywords.join(','),
        type_search: flow.triggerType === 'keyword' || flow.triggerType === 'fallback' ? '1' : '2',
        template: '0',
        type: '1',
        caption: textStep?.content || mediaStep?.content || '',
        media: mediaStep?.mediaUrl || null,
        run: '1',
        sent: null,
        send_to: '1',
        status: flow.status === 'active' && flow.enabled !== false ? '1' : '0',
        presenceTime: '0',
        presenceType: '0',
        nextBot: jumpStep?.nextFlowKeyword || '',
        description: flow.summary,
        inputname: '',
        save_data: '1',
        get_api_data: apiStep?.apiUrl ? '2' : '1',
        api_url: apiStep?.apiUrl || '',
        api_config: '{"method":"get"}',
        use_ai: textStep?.type === 'call_ai' ? '1' : '0',
        is_default: flow.triggerType === 'fallback' ? '1' : '0',
      };
    }),
    templates: [],
  };
}

function normalizeMessage(input: string) {
  return input.trim().toLowerCase();
}

function findFlowByKeywordReference(reference: string | undefined, flows: Flow[]) {
  if (!reference) return null;

  const normalizedReference = normalizeMessage(reference);
  return (
    flows.find((flow) => normalizeMessage(flow.name) === normalizedReference) ||
    flows.find((flow) => flow.keywords.some((keyword) => normalizeMessage(keyword) === normalizedReference)) ||
    null
  );
}

function buildExecutionPath(initialFlow: Flow, flows: Flow[]) {
  const executedFlows: Flow[] = [];
  const executedSteps: FlowStep[] = [];
  const visitedFlowIds = new Set<string>();
  let currentFlow: Flow | null = initialFlow;

  while (currentFlow && !visitedFlowIds.has(currentFlow.id)) {
    visitedFlowIds.add(currentFlow.id);
    executedFlows.push(currentFlow);

    for (const step of currentFlow.steps.filter((currentStep) => currentStep.enabled !== false)) {
      executedSteps.push(step);
    }

    const jumpStep = currentFlow.steps.find((step) => step.enabled !== false && step.type === 'jump_flow');
    currentFlow = jumpStep ? findFlowByKeywordReference(jumpStep.nextFlowKeyword, flows) : null;
  }

  return { executedFlows, executedSteps };
}

function findMatchingFlow(message: string, flows: Flow[]): SimulationResult {
  const normalizedMessage = normalizeMessage(message);
  const activeFlows = flows.filter((flow) => flow.status === 'active' && flow.enabled !== false);

  if (!normalizedMessage) {
    return {
      flow: null,
      reason: 'Type a message to see which trigger would fire.',
      fallbackUsed: false,
      executedFlows: [],
      executedSteps: [],
    };
  }

  const keywordFlow = activeFlows.find((flow) =>
    flow.triggerType === 'keyword' &&
    flow.keywords.some((keyword) => normalizeMessage(keyword) === normalizedMessage)
  );

  if (keywordFlow) {
    const matchedKeyword = keywordFlow.keywords.find((keyword) => normalizeMessage(keyword) === normalizedMessage);
    const executionPath = buildExecutionPath(keywordFlow, activeFlows);
    return {
      flow: keywordFlow,
      matchedKeyword,
      reason: `Exact keyword match on "${matchedKeyword}".`,
      fallbackUsed: false,
      executedFlows: executionPath.executedFlows,
      executedSteps: executionPath.executedSteps,
    };
  }

  const buttonFlow = activeFlows.find((flow) =>
    flow.triggerType === 'button' &&
    flow.keywords.some((keyword) => normalizeMessage(keyword) === normalizedMessage)
  );

  if (buttonFlow) {
    const matchedKeyword = buttonFlow.keywords.find((keyword) => normalizeMessage(keyword) === normalizedMessage);
    const executionPath = buildExecutionPath(buttonFlow, activeFlows);
    return {
      flow: buttonFlow,
      matchedKeyword,
      reason: `Button or menu option "${matchedKeyword}" matched exactly.`,
      fallbackUsed: false,
      executedFlows: executionPath.executedFlows,
      executedSteps: executionPath.executedSteps,
    };
  }

  const containsFlow = activeFlows.find((flow) =>
    flow.triggerType === 'contains' &&
    flow.keywords.some((keyword) => normalizedMessage.includes(normalizeMessage(keyword)))
  );

  if (containsFlow) {
    const matchedKeyword = containsFlow.keywords.find((keyword) => normalizedMessage.includes(normalizeMessage(keyword)));
    const executionPath = buildExecutionPath(containsFlow, activeFlows);
    return {
      flow: containsFlow,
      matchedKeyword,
      reason: `Message contains "${matchedKeyword}".`,
      fallbackUsed: false,
      executedFlows: executionPath.executedFlows,
      executedSteps: executionPath.executedSteps,
    };
  }

  const fallbackFlow = activeFlows.find((flow) => flow.triggerType === 'fallback');

  if (fallbackFlow) {
    const executionPath = buildExecutionPath(fallbackFlow, activeFlows);
    return {
      flow: fallbackFlow,
      reason: 'No keyword or contains trigger matched, so the fallback flow runs.',
      matchedKeyword: '__fallback__',
      fallbackUsed: true,
      executedFlows: executionPath.executedFlows,
      executedSteps: executionPath.executedSteps,
    };
  }

  return {
    flow: null,
    reason: 'No active flow matched this message, and no fallback flow is active.',
    fallbackUsed: false,
    executedFlows: [],
    executedSteps: [],
  };
}

function buildChatPreviewMessages(message: string, simulation: SimulationResult) {
  const preview: ChatPreviewMessage[] = [];

  if (message.trim()) {
    preview.push({
      id: 'user-message',
      role: 'user',
      title: 'Customer',
      content: message.trim(),
    });
  }

  if (!simulation.flow) {
    return preview;
  }

  simulation.executedSteps.forEach((step, index) => {
    const metaParts: string[] = [];
      if (step.type === 'send_media' && step.mediaUrl) metaParts.push('Media attachment');
      if (step.type === 'call_api' && step.apiUrl) metaParts.push(`API ${step.apiUrl}`);
      if (step.type === 'jump_flow' && step.nextFlowKeyword) metaParts.push(`Jump to ${step.nextFlowKeyword}`);
      if (step.type === 'call_ai') metaParts.push('AI reply block');
      if (step.enabled === false) metaParts.push('Disabled');

    preview.push({
      id: `${step.id}-${index}`,
      role: step.type === 'jump_flow' ? 'system' : 'bot',
      title: step.title,
      content: step.content,
      meta: metaParts.join(' • ') || stepMeta[step.type].label,
    });
  });

  return preview;
}

function isImageMedia(mediaUrl: string | undefined) {
  if (!mediaUrl) return false;
  return mediaUrl.startsWith('data:image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(mediaUrl);
}

function buildQuickReplyOptions(flows: Flow[], simulation?: SimulationResult) {
  const activeFlows = flows.filter((flow) => flow.status === 'active' && flow.enabled !== false);
  const options: string[] = [];
  const branchKeywords = new Set(
    simulation?.executedFlows.flatMap((flow) => flow.keywords.map((keyword) => normalizeMessage(keyword))) || []
  );
  const branchActive = Boolean(simulation?.flow);

  const candidateFlows = branchActive
    ? [
        ...activeFlows.filter((flow) => flow.triggerType === 'button'),
        ...activeFlows.filter(
          (flow) =>
            flow.triggerType !== 'button' &&
            flow.keywords.some((keyword) =>
              ['menu', 'human', 'agent', 'gift', 'stop', 'help'].includes(normalizeMessage(keyword)) ||
              branchKeywords.has(normalizeMessage(keyword))
            )
        ),
      ]
    : activeFlows;

  candidateFlows.forEach((flow) => {
    flow.keywords.forEach((keyword) => {
      const normalizedKeyword = keyword.trim();
      if (!normalizedKeyword || normalizedKeyword === '__fallback__') return;
      if (options.includes(normalizedKeyword)) return;

      const isMenuLike =
        flow.triggerType === 'button' ||
        /^\d+$/.test(normalizedKeyword) ||
        ['menu', 'human', 'agent', 'gift', 'stop', 'help', 'start', 'hello'].includes(normalizeMessage(normalizedKeyword));

      if (isMenuLike || options.length < 10) {
        options.push(normalizedKeyword);
      }
    });
  });

  if (branchActive && options.length === 0) {
    activeFlows.forEach((flow) => {
      flow.keywords.forEach((keyword) => {
        const normalizedKeyword = keyword.trim();
        if (!normalizedKeyword || normalizedKeyword === '__fallback__' || options.includes(normalizedKeyword)) return;
        if (flow.triggerType === 'button' || ['menu', 'human', 'agent'].includes(normalizeMessage(normalizedKeyword))) {
          options.push(normalizedKeyword);
        }
      });
    });
  }

  return options.slice(0, branchActive ? 8 : 12);
}

export default function WhatsAppStudio() {
  const { companyId } = useTenant();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const selectedFlowEditorRef = useRef<HTMLDivElement | null>(null);
  const hasMountedRef = useRef(false);
  const storageKey = useMemo(
    () => `appleberry-whatsapp-studio:${companyId || 'public-demo'}`,
    [companyId]
  );

  const [studioAccounts, setStudioAccounts] = useState<Account[]>(demoAccounts);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState(demoAccounts[0].id);
  const [flows, setFlows] = useState<Flow[]>(starterFlows);
  const [selectedFlowId, setSelectedFlowId] = useState(starterFlows[0].id);
  const [draftName, setDraftName] = useState('New Promo Flow');
  const [draftTrigger, setDraftTrigger] = useState<TriggerType>('keyword');
  const [draftKeywords, setDraftKeywords] = useState('promo, sale, free gift');
  const [draftMessage, setDraftMessage] = useState('Thank you for messaging us. Reply YES to claim today’s special offer.');
  const [newAccountName, setNewAccountName] = useState('New WhatsApp Account');
  const [newAccountPhone, setNewAccountPhone] = useState('27820000000@s.whatsapp.net');
  const [importSummary, setImportSummary] = useState<string>('No import loaded yet.');
  const [simulatedMessage, setSimulatedMessage] = useState('hello');
  const [submittedSimulationMessage, setSubmittedSimulationMessage] = useState('hello');
  const [aiPreview, setAiPreview] = useState('');
  const [aiError, setAiError] = useState('');
  const [isGeneratingAiPreview, setIsGeneratingAiPreview] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [aiFallbackEnabled, setAiFallbackEnabled] = useState(true);
  const [aiTonePrompt, setAiTonePrompt] = useState('Keep replies concise, friendly, and sales-aware. Prefer helpful menu guidance before escalating.');

  const selectedAccount = useMemo(
    () => studioAccounts.find((account) => account.id === selectedAccountId) ?? studioAccounts[0],
    [selectedAccountId, studioAccounts]
  );

  const selectedFlow = useMemo(
    () => flows.find((flow) => flow.id === selectedFlowId) ?? flows[0],
    [flows, selectedFlowId]
  );

  const simulation = useMemo(
    () => findMatchingFlow(submittedSimulationMessage, flows),
    [flows, submittedSimulationMessage]
  );

  const matchedAiStep = useMemo(
    () => simulation.executedSteps.find((step) => step.type === 'call_ai' && step.enabled !== false) ?? null,
    [simulation.executedSteps]
  );

  const chatPreviewMessages = useMemo(
    () => buildChatPreviewMessages(submittedSimulationMessage, simulation),
    [simulation, submittedSimulationMessage]
  );

  const quickReplyOptions = useMemo(
    () => buildQuickReplyOptions(flows, simulation),
    [flows, simulation]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;

      const parsed = JSON.parse(raw) as {
        accounts?: Account[];
        mediaAssets?: MediaAsset[];
        flows?: Flow[];
        selectedAccountId?: string;
        selectedFlowId?: string;
        importSummary?: string;
        geminiApiKey?: string;
        aiFallbackEnabled?: boolean;
        aiTonePrompt?: string;
      };

      const persistedAccounts = Array.isArray(parsed.accounts) && parsed.accounts.length > 0 ? parsed.accounts : demoAccounts;
      const persistedMediaAssets = Array.isArray(parsed.mediaAssets) ? parsed.mediaAssets : [];
      const persistedFlows = Array.isArray(parsed.flows) && parsed.flows.length > 0 ? parsed.flows : starterFlows;

      setStudioAccounts(persistedAccounts);
      setMediaAssets(persistedMediaAssets);
      setFlows(persistedFlows);
      setSelectedAccountId(parsed.selectedAccountId && persistedAccounts.some((account) => account.id === parsed.selectedAccountId) ? parsed.selectedAccountId : persistedAccounts[0].id);
      setSelectedFlowId(parsed.selectedFlowId && persistedFlows.some((flow) => flow.id === parsed.selectedFlowId) ? parsed.selectedFlowId : persistedFlows[0].id);
      setImportSummary(parsed.importSummary || 'No import loaded yet.');
      setGeminiApiKey(parsed.geminiApiKey || '');
      setAiFallbackEnabled(parsed.aiFallbackEnabled ?? true);
      setAiTonePrompt(parsed.aiTonePrompt || 'Keep replies concise, friendly, and sales-aware. Prefer helpful menu guidance before escalating.');
    } catch (error) {
      console.error('Failed to load WhatsApp Studio state', error);
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined' || studioAccounts.length === 0 || flows.length === 0) return;

    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        accounts: studioAccounts,
        mediaAssets,
        flows,
        selectedAccountId,
        selectedFlowId,
        importSummary,
        geminiApiKey,
        aiFallbackEnabled,
        aiTonePrompt,
      })
    );
  }, [aiFallbackEnabled, aiTonePrompt, flows, geminiApiKey, importSummary, mediaAssets, selectedAccountId, selectedFlowId, storageKey, studioAccounts]);

  useEffect(() => {
    if (!selectedFlow || !selectedFlowEditorRef.current) return;

    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    selectedFlowEditorRef.current.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, [selectedFlow]);

  function addDraftFlow() {
    const nextFlow: Flow = {
      id: `flow-${Date.now()}`,
      name: draftName,
      triggerType: draftTrigger,
      keywords: draftKeywords.split(',').map((keyword) => keyword.trim()).filter(Boolean),
      status: 'draft',
      summary: 'Freshly created from the studio.',
      source: 'manual',
      steps: [
        {
          id: `step-${Date.now()}`,
          title: 'Opening reply',
          type: 'send_text',
          content: draftMessage,
          enabled: true,
        },
      ],
    };

    setFlows((current) => [nextFlow, ...current]);
    setSelectedFlowId(nextFlow.id);
  }

  function addAccount() {
    const nextAccount: Account = {
      id: `acc-${Date.now()}`,
      name: newAccountName,
      phone: newAccountPhone,
      status: 'Connected',
      instanceId: `INSTANCE-${Math.floor(Math.random() * 100000)}`,
      token: 'demo********token',
    };

    setStudioAccounts((current) => [nextAccount, ...current]);
    setSelectedAccountId(nextAccount.id);
    setNewAccountName('New WhatsApp Account');
    setNewAccountPhone('27820000000@s.whatsapp.net');
  }

  async function handleMediaUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const nextAssets = await Promise.all(
      files.map(
        (file) =>
          new Promise<MediaAsset>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              resolve({
                id: `media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                name: file.name,
                mimeType: file.type || 'application/octet-stream',
                dataUrl: String(reader.result || ''),
                size: file.size,
              });
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          })
      )
    );

    setMediaAssets((current) => [...nextAssets, ...current]);
    event.target.value = '';
  }

  function resetDemo() {
    setStudioAccounts(demoAccounts);
    setFlows(starterFlows);
    setSelectedAccountId(demoAccounts[0].id);
    setSelectedFlowId(starterFlows[0].id);
    setImportSummary('No import loaded yet.');
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(storageKey);
    }
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const raw = await file.text();
      const payload = JSON.parse(raw) as SocialPosterExport;
      const importedFlows = convertSocialPosterToFlows(payload);

      if (importedFlows.length === 0) {
        setImportSummary('Import finished, but no chatbot flows were found.');
        return;
      }

      setFlows(importedFlows);
      setSelectedFlowId(importedFlows[0].id);
      setImportSummary(`Imported ${importedFlows.length} flows from ${file.name}.`);
    } catch (error) {
      console.error('Failed to import flow file', error);
      setImportSummary(`Import failed for ${file.name}. Make sure it is valid JSON.`);
    } finally {
      event.target.value = '';
    }
  }

  function exportFlows() {
    const payload = convertFlowsToExport(flows);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `whatsapp-studio-export-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    window.URL.revokeObjectURL(url);
    setImportSummary(`Exported ${flows.length} flows in Social Poster-style JSON.`);
  }

  function updateSelectedFlow(updater: (flow: Flow) => Flow) {
    if (!selectedFlow) return;
    setFlows((current) => current.map((flow) => (flow.id === selectedFlow.id ? updater(flow) : flow)));
  }

  function updateSelectedStep(stepId: string, updater: (step: FlowStep) => FlowStep) {
    updateSelectedFlow((flow) => ({
      ...flow,
      steps: flow.steps.map((step) => (step.id === stepId ? updater(step) : step)),
    }));
  }

  function addStepToSelectedFlow() {
    if (!selectedFlow) return;
    updateSelectedFlow((flow) => ({
      ...flow,
      steps: [
        ...flow.steps,
        {
          id: `step-${Date.now()}`,
          title: 'New block',
          type: 'send_text',
          content: 'Write the message or action for this block.',
          enabled: true,
        },
      ],
    }));
  }

  function addTypedStepToSelectedFlow(type: StepType) {
    if (!selectedFlow) return;

    const defaults: Record<StepType, Omit<FlowStep, 'id'>> = {
      send_text: {
        title: 'Text reply',
        type: 'send_text',
        content: 'Write the text reply for this block.',
        enabled: true,
      },
      send_media: {
        title: 'Media reply',
        type: 'send_media',
        content: 'Add a caption for the media block.',
        enabled: true,
        mediaUrl: 'https://',
      },
      ask_question: {
        title: 'Ask a question',
        type: 'ask_question',
        content: 'Ask the customer for the next piece of information.',
        enabled: true,
      },
      call_ai: {
        title: 'AI reply',
        type: 'call_ai',
        content: 'Answer using the configured AI prompt and keep it concise.',
        enabled: true,
      },
      call_api: {
        title: 'API action',
        type: 'call_api',
        content: 'Call an external webhook or API.',
        enabled: true,
        apiUrl: 'https://api.example.com/webhook',
      },
      jump_flow: {
        title: 'Jump to flow',
        type: 'jump_flow',
        content: 'Continue into another flow.',
        enabled: true,
        nextFlowKeyword: '',
      },
    };

    updateSelectedFlow((flow) => ({
      ...flow,
      steps: [
        ...flow.steps,
        {
          id: `step-${Date.now()}`,
          ...defaults[type],
        },
      ],
    }));
  }

  function removeStepFromSelectedFlow(stepId: string) {
    if (!selectedFlow) return;
    updateSelectedFlow((flow) => ({
      ...flow,
      steps: flow.steps.filter((step) => step.id !== stepId),
    }));
  }

  function attachMediaToStep(stepId: string, asset: MediaAsset) {
    updateSelectedStep(stepId, (currentStep) => ({
      ...currentStep,
      mediaUrl: asset.dataUrl,
      content:
        currentStep.type === 'send_media' && currentStep.content === 'Add a caption for the media block.'
          ? asset.name
          : currentStep.content,
    }));
  }

  function deleteMediaAsset(assetId: string) {
    const assetToDelete = mediaAssets.find((asset) => asset.id === assetId);
    setMediaAssets((current) => current.filter((asset) => asset.id !== assetId));

    if (!assetToDelete) return;

    setFlows((current) =>
      current.map((flow) => ({
        ...flow,
        steps: flow.steps.map((step) =>
          step.mediaUrl === assetToDelete.dataUrl
            ? { ...step, mediaUrl: undefined }
            : step
        ),
      }))
    );
  }

  function moveStepInSelectedFlow(stepId: string, direction: 'up' | 'down') {
    if (!selectedFlow) return;

    updateSelectedFlow((flow) => {
      const currentIndex = flow.steps.findIndex((step) => step.id === stepId);
      if (currentIndex === -1) return flow;

      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= flow.steps.length) return flow;

      const nextSteps = [...flow.steps];
      const [movedStep] = nextSteps.splice(currentIndex, 1);
      nextSteps.splice(targetIndex, 0, movedStep);

      return {
        ...flow,
        steps: nextSteps,
      };
    });
  }

  function deleteSelectedFlow() {
    if (!selectedFlow) return;

    setFlows((current) => {
      const nextFlows = current.filter((flow) => flow.id !== selectedFlow.id);
      if (nextFlows.length > 0) {
        setSelectedFlowId(nextFlows[0].id);
      }
      return nextFlows.length > 0 ? nextFlows : starterFlows;
    });
  }

  function submitSimulationMessage() {
    setSubmittedSimulationMessage(simulatedMessage);
    setAiPreview('');
    setAiError('');
  }

  function runQuickReplyOption(option: string) {
    setSimulatedMessage(option);
    setSubmittedSimulationMessage(option);
    setAiPreview('');
    setAiError('');
  }

  async function generateAiPreview() {
    if (!matchedAiStep || !simulation.flow) return;

    setIsGeneratingAiPreview(true);
    setAiError('');
    setAiPreview('');

    try {
      const response = await fetch('/api/whatsapp-studio/ai-preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: submittedSimulationMessage,
          flowName: simulation.flow.name,
          aiInstruction: matchedAiStep.content,
          accountName: selectedAccount.name,
          keywords: simulation.flow.keywords,
          apiKey: geminiApiKey || undefined,
          aiTonePrompt,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to generate AI preview.');
      }

      setAiPreview(payload.text || '');
    } catch (error: any) {
      setAiError(error?.message || 'Failed to generate AI preview.');
    } finally {
      setIsGeneratingAiPreview(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="hero-card rounded-[28px] p-6 md:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8c6a48]">WhatsApp Studio</p>
            <h1 className="mb-3 text-4xl font-bold text-[#16242b] md:text-5xl">Import Social Poster flows, simplify them, and keep them editable.</h1>
            <p className="max-w-2xl text-sm leading-7 text-[#4c5f67] md:text-base">
              This workspace now stores your accounts and flows locally, imports Social Poster chatbot JSON, and exports cleaned flows back out from the same screen.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[22px] border border-[#dcc8b2] bg-white/85 px-4 py-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.22em] text-[#8a6d51]">Accounts</p>
              <p className="mt-2 text-3xl font-semibold text-[#1a2b33]">{studioAccounts.length}</p>
            </div>
            <div className="rounded-[22px] border border-[#dcc8b2] bg-white/85 px-4 py-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.22em] text-[#8a6d51]">Flows</p>
              <p className="mt-2 text-3xl font-semibold text-[#1a2b33]">{flows.length}</p>
            </div>
            <div className="rounded-[22px] border border-[#dcc8b2] bg-white/85 px-4 py-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.22em] text-[#8a6d51]">Automation blocks</p>
              <p className="mt-2 text-3xl font-semibold text-[#1a2b33]">{flows.reduce((total, flow) => total + flow.steps.length, 0)}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-[#dcc8b2] bg-white/85 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8a6d51]">Import / Export</p>
            <h2 className="display-font text-2xl font-bold text-[#18242b]">Flow transfer desk</h2>
            <p className="mt-2 text-sm text-[#5d7078]">{importSummary}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={handleImport} className="hidden" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-2xl border border-[#d7c7b5] bg-[#fff7ef] px-4 py-3 text-sm font-semibold text-[#214e5f]"
            >
              <Upload className="h-4 w-4" />
              Import Social Poster JSON
            </button>
            <button
              type="button"
              onClick={exportFlows}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#214e5f] px-4 py-3 text-sm font-semibold text-white"
            >
              <Download className="h-4 w-4" />
              Export flows
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-[#dcc8b2] bg-white/85 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8a6d51]">Media library</p>
            <h2 className="display-font text-2xl font-bold text-[#18242b]">Upload and reuse media</h2>
            <p className="mt-2 text-sm text-[#5d7078]">
              Upload images or documents into the studio, then choose them inside any media block instead of pasting a URL.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <input
              ref={mediaInputRef}
              type="file"
              accept="image/*,application/pdf,video/*"
              multiple
              onChange={handleMediaUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => mediaInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#214e5f] px-4 py-3 text-sm font-semibold text-white"
            >
              <Upload className="h-4 w-4" />
              Upload media
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {mediaAssets.length > 0 ? (
            mediaAssets.map((asset) => (
              <article key={asset.id} className="rounded-[22px] border border-[#e2d5c6] bg-[#fffaf5] p-4">
                {asset.mimeType.startsWith('image/') ? (
                  <img src={asset.dataUrl} alt={asset.name} className="h-36 w-full rounded-2xl object-cover" />
                ) : (
                  <div className="flex h-36 items-center justify-center rounded-2xl bg-white text-sm font-semibold text-[#214e5f]">
                    {asset.mimeType.includes('pdf') ? 'PDF' : 'File'}
                  </div>
                )}
                <p className="mt-3 truncate text-sm font-semibold text-[#18242b]">{asset.name}</p>
                <p className="mt-1 text-xs text-[#6d7b83]">{Math.round(asset.size / 1024)} KB</p>
                <button
                  type="button"
                  onClick={() => deleteMediaAsset(asset.id)}
                  className="mt-3 rounded-xl border border-[#e3d2c1] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#8a5f33]"
                >
                  Delete media
                </button>
              </article>
            ))
          ) : (
            <div className="rounded-[22px] border border-dashed border-[#d6c5b2] bg-[#fffaf5] p-4 text-sm text-[#6a7b83]">
              No media uploaded yet. Add a file here and then pick it from any `send_media` block.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[28px] border border-[#dcc8b2] bg-[linear-gradient(135deg,#fffaf5_0%,#f2f8fb_100%)] p-5 shadow-sm">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8a6d51]">Flow simulator</p>
            <h2 className="display-font mt-2 text-2xl font-bold text-[#18242b]">Test an incoming WhatsApp message</h2>
            <p className="mt-2 text-sm leading-6 text-[#5d7078]">
              Type a message like <span className="font-semibold text-[#214e5f]">hello</span>, <span className="font-semibold text-[#214e5f]">menu</span>, <span className="font-semibold text-[#214e5f]">1</span>, <span className="font-semibold text-[#214e5f]">gift</span>, or <span className="font-semibold text-[#214e5f]">human</span> and see which imported flow fires first.
            </p>
            <textarea
              value={simulatedMessage}
              onChange={(event) => setSimulatedMessage(event.target.value)}
              className="mt-4 min-h-[130px] w-full rounded-[24px] border border-[#dac9b6] bg-white px-4 py-4 text-sm text-[#18242b] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]"
              placeholder="Type a test message to simulate an inbound WhatsApp message"
            />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={submitSimulationMessage}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#214e5f] px-4 py-3 text-sm font-semibold text-white"
              >
                <Send className="h-4 w-4" />
                Send test message
              </button>
              <p className="text-sm text-[#5d7078]">
                Last tested message:
                <span className="ml-2 font-semibold text-[#214e5f]">
                  {submittedSimulationMessage || 'None yet'}
                </span>
              </p>
            </div>

            <div className="mt-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8a6d51]">Quick test buttons</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {quickReplyOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => runQuickReplyOption(option)}
                    className="rounded-full border border-[#d8c6b0] bg-[#fffaf5] px-3 py-2 text-sm font-semibold text-[#214e5f]"
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-[#d6c5b2] bg-white/90 p-5 shadow-[0_16px_32px_rgba(54,62,71,0.08)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8a6d51]">Simulation result</p>
                <h3 className="mt-2 text-xl font-semibold text-[#18242b]">
                  {simulation.flow ? simulation.flow.name : 'No flow matched'}
                </h3>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                  simulation.fallbackUsed
                    ? 'bg-[#fff2df] text-[#bd651f]'
                    : simulation.flow
                      ? 'bg-[#edf5ee] text-[#3e7e58]'
                      : 'bg-[#eef2f4] text-[#60717a]'
                }`}
              >
                {simulation.fallbackUsed ? 'fallback' : simulation.flow ? simulation.flow.triggerType : 'idle'}
              </span>
            </div>

            <p className="mt-3 text-sm leading-6 text-[#5d7078]">{simulation.reason}</p>

            <div className="mt-4 space-y-3 text-sm text-[#5d7078]">
              <p><span className="font-semibold text-[#214e5f]">Selected account:</span> {selectedAccount.name}</p>
              <p><span className="font-semibold text-[#214e5f]">Matched keyword:</span> {simulation.matchedKeyword || 'None'}</p>
              <p><span className="font-semibold text-[#214e5f]">Flow path:</span> {simulation.executedFlows.map((flow) => flow.name).join(' -> ') || 'None'}</p>
              <p><span className="font-semibold text-[#214e5f]">Flows chained:</span> {simulation.executedFlows.length || 0}</p>
              <p><span className="font-semibold text-[#214e5f]">Steps to run:</span> {simulation.executedSteps.length || 0}</p>
            </div>

            <div className="mt-5 rounded-[22px] border border-[#e2d5c6] bg-[#f6efe6] p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8a6d51]">Chat preview</p>
                  <h4 className="mt-1 text-base font-semibold text-[#18242b]">Conversation-style execution</h4>
                </div>
              </div>

              <div className="space-y-3 rounded-[20px] bg-[#efe6d8] p-3">
                {chatPreviewMessages.length > 0 ? (
                  chatPreviewMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.role === 'user'
                          ? 'justify-end'
                          : message.role === 'system'
                            ? 'justify-center'
                            : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[88%] rounded-[18px] px-4 py-3 shadow-sm ${
                          message.role === 'user'
                            ? 'bg-[#d9fdd3] text-[#1c2d28]'
                            : message.role === 'system'
                              ? 'bg-[#fff3dc] text-[#7d6a55]'
                              : 'bg-white text-[#24333b]'
                        }`}
                      >
                        {message.title && (
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">
                            {message.title}
                          </p>
                        )}
                        {message.meta?.includes('Media attachment') && simulation.executedSteps.find((step) => `${step.id}-${chatPreviewMessages.findIndex((previewItem) => previewItem.id === message.id)}` === message.id)?.mediaUrl && (
                          isImageMedia(simulation.executedSteps.find((step) => `${step.id}-${chatPreviewMessages.findIndex((previewItem) => previewItem.id === message.id)}` === message.id)?.mediaUrl) ? (
                            <img
                              src={simulation.executedSteps.find((step) => `${step.id}-${chatPreviewMessages.findIndex((previewItem) => previewItem.id === message.id)}` === message.id)?.mediaUrl}
                              alt={message.title || 'Media preview'}
                              className="mt-2 max-h-52 w-full rounded-2xl object-cover"
                            />
                          ) : (
                            <div className="mt-2 rounded-2xl border border-[#e2d5c6] bg-white/80 px-3 py-3 text-xs font-semibold text-[#214e5f]">
                              Attached file ready to send
                            </div>
                          )
                        )}
                        <p className="mt-1 text-sm leading-6 whitespace-pre-wrap">{message.content}</p>
                        {message.meta && (
                          <p className="mt-2 text-[11px] opacity-70">{message.meta}</p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[18px] border border-dashed border-[#d6c5b2] bg-white/70 p-4 text-sm text-[#6a7b83]">
                    No conversation preview yet. Send a test message to see the bot execution path here.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {simulation.flow ? (
                simulation.executedSteps.map((step, index) => {
                  const meta = stepMeta[step.type];
                  const Icon = meta.icon;
                  return (
                    <article key={step.id} className="rounded-[20px] border border-[#e2d5c6] bg-[#fffaf5] p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[#214e5f]">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-[#f2e8db] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a5f33]">
                              Step {index + 1}
                            </span>
                            <h4 className="text-sm font-semibold text-[#18242b]">{step.title}</h4>
                          </div>
                          {step.mediaUrl && (
                            isImageMedia(step.mediaUrl) ? (
                              <img
                                src={step.mediaUrl}
                                alt={step.title}
                                className="mt-3 max-h-52 w-full rounded-2xl object-cover"
                              />
                            ) : (
                              <div className="mt-3 rounded-2xl border border-[#e2d5c6] bg-white px-3 py-3 text-xs font-semibold text-[#214e5f]">
                                Attached file ready to send
                              </div>
                            )
                          )}
                          <p className="mt-2 text-sm leading-6 text-[#5d7078]">{step.content}</p>
                          {step.mediaUrl && <p className="mt-2 text-xs text-[#7d6a55]">Media attached to this step</p>}
                          {step.apiUrl && <p className="mt-2 text-xs text-[#7d6a55]">API: {step.apiUrl}</p>}
                          {step.nextFlowKeyword && <p className="mt-2 text-xs text-[#7d6a55]">Next flow: {step.nextFlowKeyword}</p>}
                        </div>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="rounded-[20px] border border-dashed border-[#d6c5b2] bg-[#fffaf5] p-4 text-sm text-[#6a7b83]">
                  No execution path yet. Activate a fallback flow if you want every unmatched message to get a response.
                </div>
              )}
            </div>

            <div className="mt-5 rounded-[20px] border border-[#e2d5c6] bg-[#f8fbfc] p-4">
              <div className="mb-5 rounded-[20px] border border-[#d8e4e8] bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8a6d51]">Bot settings</p>
                <h4 className="mt-1 text-base font-semibold text-[#18242b]">AI configuration</h4>

                <div className="mt-4">
                  <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8a6d51]">Gemini API key</label>
                  <input
                    type="password"
                    value={geminiApiKey}
                    onChange={(event) => setGeminiApiKey(event.target.value)}
                    placeholder="Paste your Gemini API key for this browser session"
                    className="mt-2 w-full rounded-2xl border border-[#dac9b6] bg-white px-4 py-3 text-sm text-[#18242b]"
                  />
                  <p className="mt-2 text-xs leading-5 text-[#6b7a82]">
                    Saved locally in this browser for studio testing. It is not added to the exported flow JSON.
                  </p>
                </div>

                <div className="mt-4">
                  <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8a6d51]">Bot AI prompt</label>
                  <textarea
                    value={aiTonePrompt}
                    onChange={(event) => setAiTonePrompt(event.target.value)}
                    className="mt-2 min-h-[110px] w-full rounded-[22px] border border-[#dac9b6] bg-[#fffaf5] px-4 py-3 text-sm text-[#18242b]"
                  />
                </div>

                <label className="mt-4 flex items-center justify-between rounded-2xl border border-[#dac9b6] bg-[#fffaf5] px-4 py-3 text-sm text-[#18242b]">
                  <span className="font-semibold">AI fallback enabled</span>
                  <input
                    type="checkbox"
                    checked={aiFallbackEnabled}
                    onChange={(event) => setAiFallbackEnabled(event.target.checked)}
                    className="h-4 w-4"
                  />
                </label>
              </div>

              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8a6d51]">AI test</p>
                  <h4 className="mt-1 text-base font-semibold text-[#18242b]">Gemini preview for AI blocks</h4>
                </div>
                <button
                  type="button"
                  onClick={generateAiPreview}
                  disabled={!aiFallbackEnabled || !matchedAiStep || isGeneratingAiPreview}
                  className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${
                    !aiFallbackEnabled || !matchedAiStep || isGeneratingAiPreview
                      ? 'cursor-not-allowed bg-[#dfe7ea] text-[#708089]'
                      : 'bg-[#214e5f] text-white'
                  }`}
                >
                  <Bot className="h-4 w-4" />
                  {isGeneratingAiPreview ? 'Testing AI...' : 'Test AI reply'}
                </button>
              </div>

              <p className="mt-3 text-sm leading-6 text-[#5d7078]">
                {!aiFallbackEnabled
                  ? 'AI fallback is turned off in Bot settings. Turn it back on when you want Gemini-powered fallback behavior again.'
                  : matchedAiStep
                    ? 'Run the matched AI block against the simulated inbound message using your bot settings and Gemini key.'
                    : 'No AI block is present in the matched flow yet. Import or create a flow with an AI step to test it here.'}
              </p>

              {aiError && (
                <div className="mt-4 rounded-2xl border border-[#e8c8bf] bg-[#fff4f1] px-4 py-3 text-sm text-[#9a4a35]">
                  {aiError}
                </div>
              )}

              {aiPreview && (
                <div className="mt-4 rounded-2xl border border-[#d8e6dc] bg-[#f4fbf5] px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#4a7a5d]">Gemini reply preview</p>
                  <p className="mt-3 text-sm leading-7 text-[#214433]">{aiPreview}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_380px]">
        <aside className="section-card rounded-[28px] p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8a6d51]">Accounts</p>
              <h2 className="display-font text-2xl font-bold text-[#18242b]">WhatsApp</h2>
            </div>
            <button
              type="button"
              onClick={addAccount}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#d8c6b0] bg-white/80 text-[#214e5f]"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>

          <div className="mb-4 space-y-3 rounded-[22px] border border-[#e2d5c6] bg-[#fffaf5] p-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8a6d51]">Account name</label>
              <input
                value={newAccountName}
                onChange={(event) => setNewAccountName(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[#dac9b6] bg-white px-4 py-3 text-sm text-[#18242b]"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8a6d51]">WhatsApp number</label>
              <input
                value={newAccountPhone}
                onChange={(event) => setNewAccountPhone(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[#dac9b6] bg-white px-4 py-3 text-sm text-[#18242b]"
              />
            </div>
            <button
              type="button"
              onClick={addAccount}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#dff3e7] px-4 py-3 text-sm font-semibold text-[#30714e]"
            >
              <Plus className="h-4 w-4" />
              Add account to studio
            </button>
          </div>

          <div className="space-y-3">
            {studioAccounts.map((account) => (
              <button
                key={account.id}
                type="button"
                onClick={() => setSelectedAccountId(account.id)}
                className={`w-full rounded-[22px] border px-4 py-4 text-left transition ${
                  account.id === selectedAccountId
                    ? 'border-[#7ab697] bg-[#edf8f0] shadow-[0_12px_24px_rgba(55,115,78,0.10)]'
                    : 'border-[#e2d5c6] bg-white/85'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#192931]">{account.name}</p>
                    <p className="mt-1 text-xs text-[#677982]">{account.phone}</p>
                  </div>
                  <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#3c7e56]">
                    {account.status}
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-[24px] bg-[#1f4554] p-4 text-white">
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/70">Selected account</p>
            <p className="mt-2 text-lg font-semibold">{selectedAccount.name}</p>
            <p className="mt-3 text-sm text-white/75">Instance {selectedAccount.instanceId}</p>
            <p className="mt-1 text-sm text-white/75">Token {selectedAccount.token}</p>
            <button
              type="button"
              onClick={resetDemo}
              className="mt-4 inline-flex rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/80"
            >
              Reset demo data
            </button>
          </div>
        </aside>

        <main className="space-y-6">
          <div className="section-card rounded-[28px] p-5">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8a6d51]">Automation flows</p>
                <h2 className="display-font text-3xl font-bold text-[#18242b]">Triggers and keywords</h2>
              </div>
              <button
                type="button"
                onClick={addDraftFlow}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#214e5f] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(33,78,95,0.18)]"
              >
                <CirclePlay className="h-4 w-4" />
                Create draft flow
              </button>
            </div>

            <div className="grid gap-4">
              {flows.map((flow) => {
                const meta = triggerMeta[flow.triggerType];
                const Icon = meta.icon;
                return (
                  <button
                    key={flow.id}
                    type="button"
                    onClick={() => setSelectedFlowId(flow.id)}
                    className={`rounded-[24px] border p-5 text-left transition ${
                      flow.id === selectedFlowId
                        ? 'border-[#214e5f] bg-[linear-gradient(135deg,#fffaf5_0%,#f2f8fb_100%)] shadow-[0_14px_34px_rgba(33,78,95,0.12)]'
                        : 'border-[#e2d5c6] bg-white/85'
                    }`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="rounded-2xl bg-[#eef4f6] p-2 text-[#214e5f]">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="text-xl font-semibold text-[#18242b]">{flow.name}</h3>
                            <p className="text-sm text-[#5d7078]">{flow.summary}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {flow.keywords.map((keyword) => (
                            <span key={keyword} className="rounded-full bg-[#fff2df] px-3 py-1 text-xs font-semibold text-[#bd651f]">
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col items-start gap-2 lg:items-end">
                        <span className="rounded-full bg-[#edf5ee] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#3e7e58]">
                          {flow.status}
                        </span>
                        <p className="text-xs text-[#6d7b83]">{meta.label}</p>
                        <p className="text-xs uppercase tracking-[0.16em] text-[#a08364]">{flow.source || 'manual'}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedFlow && (
            <div ref={selectedFlowEditorRef} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
              <section className="section-card rounded-[28px] p-5">
                <div className="mb-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8a6d51]">Selected flow</p>
                  <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <h2 className="display-font text-3xl font-bold text-[#18242b]">{selectedFlow.name}</h2>
                    <button
                      type="button"
                      onClick={deleteSelectedFlow}
                      className="inline-flex items-center justify-center rounded-2xl border border-[#e3d2c1] px-4 py-2.5 text-sm font-semibold text-[#8a5f33]"
                    >
                      Delete flow
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-[#61727a]">
                    You are now editing this flow. Change the trigger, update block content, add media or API actions, reorder lines, or remove any block you no longer want.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[22px] border border-[#e1d3c5] bg-white/85 p-4">
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a6d51]">Flow name</label>
                    <input
                      value={selectedFlow.name}
                      onChange={(event) => updateSelectedFlow((flow) => ({ ...flow, name: event.target.value }))}
                      className="mt-3 w-full rounded-2xl border border-[#dac9b6] bg-[#fffaf5] px-4 py-3 text-sm text-[#18242b]"
                    />
                  </div>

                  <div className="rounded-[22px] border border-[#e1d3c5] bg-white/85 p-4">
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a6d51]">Flow status</label>
                    <select
                      value={selectedFlow.status}
                      onChange={(event) =>
                        updateSelectedFlow((flow) => ({
                          ...flow,
                          status: event.target.value as Flow['status'],
                        }))
                      }
                      className="mt-3 w-full rounded-2xl border border-[#dac9b6] bg-[#fffaf5] px-4 py-3 text-sm text-[#18242b]"
                    >
                      <option value="active">Active</option>
                      <option value="draft">Draft</option>
                    </select>
                    <label className="mt-4 flex items-center justify-between rounded-2xl border border-[#dac9b6] bg-[#fffaf5] px-4 py-3 text-sm text-[#18242b]">
                      <span className="font-semibold">Flow enabled</span>
                      <input
                        type="checkbox"
                        checked={selectedFlow.enabled !== false}
                        onChange={(event) =>
                          updateSelectedFlow((flow) => ({
                            ...flow,
                            enabled: event.target.checked,
                            status: event.target.checked ? flow.status : 'draft',
                          }))
                        }
                        className="h-4 w-4"
                      />
                    </label>
                  </div>

                  <div className="rounded-[22px] border border-[#e1d3c5] bg-white/85 p-4">
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a6d51]">Trigger type</label>
                    <select
                      value={selectedFlow.triggerType}
                      onChange={(event) => {
                        const next = event.target.value as TriggerType;
                        updateSelectedFlow((flow) => ({ ...flow, triggerType: next }));
                      }}
                      className="mt-3 w-full rounded-2xl border border-[#dac9b6] bg-[#fffaf5] px-4 py-3 text-sm text-[#18242b]"
                    >
                      {Object.entries(triggerMeta).map(([key, meta]) => (
                        <option key={key} value={key}>{meta.label}</option>
                      ))}
                    </select>
                    <p className="mt-3 text-sm text-[#61727a]">{triggerMeta[selectedFlow.triggerType].hint}</p>
                  </div>

                  <div className="rounded-[22px] border border-[#e1d3c5] bg-white/85 p-4">
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a6d51]">Keywords</label>
                    <textarea
                      value={selectedFlow.keywords.join(', ')}
                      onChange={(event) => {
                        const keywords = event.target.value.split(',').map((value) => value.trim()).filter(Boolean);
                        updateSelectedFlow((flow) => ({ ...flow, keywords }));
                      }}
                      className="mt-3 min-h-[128px] w-full rounded-[22px] border border-[#dac9b6] bg-[#fffaf5] px-4 py-3 text-sm text-[#18242b]"
                    />
                    <p className="mt-3 text-sm text-[#61727a]">Separate multiple trigger words with commas. Example: <span className="font-medium text-[#214e5f]">pricing, packages, quote</span></p>
                  </div>
                </div>

                <div className="mt-4 rounded-[22px] border border-[#e1d3c5] bg-white/85 p-4">
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a6d51]">Flow summary</label>
                  <textarea
                    value={selectedFlow.summary}
                    onChange={(event) => updateSelectedFlow((flow) => ({ ...flow, summary: event.target.value }))}
                    className="mt-3 min-h-[110px] w-full rounded-[22px] border border-[#dac9b6] bg-[#fffaf5] px-4 py-3 text-sm text-[#18242b]"
                  />
                </div>

                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8a6d51]">Response blocks</p>
                      <h3 className="text-lg font-semibold text-[#18242b]">What happens after the trigger fires</h3>
                    </div>
                    <button
                      type="button"
                      onClick={addStepToSelectedFlow}
                      className="inline-flex items-center gap-2 rounded-2xl bg-[#214e5f] px-4 py-2.5 text-sm font-semibold text-white"
                    >
                      <Plus className="h-4 w-4" />
                      Add block
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => addTypedStepToSelectedFlow('send_text')} className="rounded-2xl border border-[#dac9b6] bg-[#fffaf5] px-3 py-2 text-xs font-semibold text-[#214e5f]">Add text</button>
                    <button type="button" onClick={() => addTypedStepToSelectedFlow('send_media')} className="rounded-2xl border border-[#dac9b6] bg-[#fffaf5] px-3 py-2 text-xs font-semibold text-[#214e5f]">Add media</button>
                    <button type="button" onClick={() => addTypedStepToSelectedFlow('call_ai')} className="rounded-2xl border border-[#dac9b6] bg-[#fffaf5] px-3 py-2 text-xs font-semibold text-[#214e5f]">Add AI</button>
                    <button type="button" onClick={() => addTypedStepToSelectedFlow('call_api')} className="rounded-2xl border border-[#dac9b6] bg-[#fffaf5] px-3 py-2 text-xs font-semibold text-[#214e5f]">Add API</button>
                    <button type="button" onClick={() => addTypedStepToSelectedFlow('jump_flow')} className="rounded-2xl border border-[#dac9b6] bg-[#fffaf5] px-3 py-2 text-xs font-semibold text-[#214e5f]">Add jump</button>
                  </div>

                  <div className="space-y-3">
                    {selectedFlow.steps.map((step, index) => {
                      const meta = stepMeta[step.type];
                      const Icon = meta.icon;
                      return (
                        <article key={step.id} className="rounded-[24px] border border-[#e2d5c6] bg-white/90 p-4 shadow-[0_10px_25px_rgba(44,51,56,0.05)]">
                          <div className="flex items-start gap-4">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#eff5f6] text-[#214e5f]">
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full bg-[#f2e8db] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a5f33]">
                                    Step {index + 1}
                                  </span>
                                  <h4 className="text-base font-semibold text-[#18242b]">{step.title}</h4>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeStepFromSelectedFlow(step.id)}
                                  className="rounded-xl border border-[#e3d2c1] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#8a5f33]"
                                >
                                  Remove
                                </button>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => moveStepInSelectedFlow(step.id, 'up')}
                                  className="rounded-xl border border-[#e3d2c1] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#214e5f]"
                                >
                                  Move up
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveStepInSelectedFlow(step.id, 'down')}
                                  className="rounded-xl border border-[#e3d2c1] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#214e5f]"
                                >
                                  Move down
                                </button>
                              </div>

                              <div className="mt-4 grid gap-4 md:grid-cols-2">
                                <div>
                                  <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8a6d51]">Block title</label>
                                  <input
                                    value={step.title}
                                    onChange={(event) => updateSelectedStep(step.id, (currentStep) => ({ ...currentStep, title: event.target.value }))}
                                    className="mt-2 w-full rounded-2xl border border-[#dac9b6] bg-[#fffaf5] px-4 py-3 text-sm text-[#18242b]"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8a6d51]">Block type</label>
                                  <select
                                    value={step.type}
                                    onChange={(event) =>
                                      updateSelectedStep(step.id, (currentStep) => ({
                                        ...currentStep,
                                        type: event.target.value as StepType,
                                      }))
                                    }
                                    className="mt-2 w-full rounded-2xl border border-[#dac9b6] bg-[#fffaf5] px-4 py-3 text-sm text-[#18242b]"
                                  >
                                    {Object.entries(stepMeta).map(([key, value]) => (
                                      <option key={key} value={key}>
                                        {value.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              <div className="mt-4 flex flex-wrap gap-3">
                                <label className="flex items-center gap-3 rounded-2xl border border-[#dac9b6] bg-[#fffaf5] px-4 py-3 text-sm text-[#18242b]">
                                  <span className="font-semibold">Block enabled</span>
                                  <input
                                    type="checkbox"
                                    checked={step.enabled !== false}
                                    onChange={(event) =>
                                      updateSelectedStep(step.id, (currentStep) => ({
                                        ...currentStep,
                                        enabled: event.target.checked,
                                      }))
                                    }
                                    className="h-4 w-4"
                                  />
                                </label>
                                {step.type === 'call_ai' && (
                                  <label className="flex items-center gap-3 rounded-2xl border border-[#dac9b6] bg-[#fffaf5] px-4 py-3 text-sm text-[#18242b]">
                                    <span className="font-semibold">AI on</span>
                                    <input
                                      type="checkbox"
                                      checked={step.enabled !== false}
                                      onChange={(event) =>
                                        updateSelectedStep(step.id, (currentStep) => ({
                                          ...currentStep,
                                          enabled: event.target.checked,
                                        }))
                                      }
                                      className="h-4 w-4"
                                    />
                                  </label>
                                )}
                              </div>

                              <div className="mt-4">
                                <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8a6d51]">Content</label>
                                <textarea
                                  value={step.content}
                                  onChange={(event) => updateSelectedStep(step.id, (currentStep) => ({ ...currentStep, content: event.target.value }))}
                                  className="mt-2 min-h-[120px] w-full rounded-[22px] border border-[#dac9b6] bg-[#fffaf5] px-4 py-3 text-sm text-[#18242b]"
                                />
                              </div>

                              <div className="mt-4 grid gap-4 md:grid-cols-2">
                                <div>
                                  <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8a6d51]">Media URL</label>
                                  <input
                                    value={step.mediaUrl || ''}
                                    onChange={(event) =>
                                      updateSelectedStep(step.id, (currentStep) => ({
                                        ...currentStep,
                                        mediaUrl: event.target.value || undefined,
                                      }))
                                    }
                                    placeholder="https://..."
                                    className="mt-2 w-full rounded-2xl border border-[#dac9b6] bg-[#fffaf5] px-4 py-3 text-sm text-[#18242b]"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8a6d51]">API URL</label>
                                  <input
                                    value={step.apiUrl || ''}
                                    onChange={(event) =>
                                      updateSelectedStep(step.id, (currentStep) => ({
                                        ...currentStep,
                                        apiUrl: event.target.value || undefined,
                                      }))
                                    }
                                    placeholder="https://api.example.com/webhook"
                                    className="mt-2 w-full rounded-2xl border border-[#dac9b6] bg-[#fffaf5] px-4 py-3 text-sm text-[#18242b]"
                                  />
                                </div>
                              </div>

                              {step.type === 'send_media' && (
                                <div className="mt-4 rounded-[20px] border border-[#e2d5c6] bg-[#fffaf5] p-4">
                                  {step.mediaUrl && (
                                    <div className="mb-4">
                                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8a6d51]">Attached media preview</p>
                                      {isImageMedia(step.mediaUrl) ? (
                                        <img
                                          src={step.mediaUrl}
                                          alt={step.title}
                                          className="mt-2 max-h-56 w-full rounded-2xl object-cover"
                                        />
                                      ) : (
                                        <div className="mt-2 rounded-2xl border border-[#e2d5c6] bg-white px-4 py-4 text-sm font-semibold text-[#214e5f]">
                                          File attached to this media block
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8a6d51]">Choose from media library</p>
                                      <p className="mt-1 text-sm text-[#61727a]">Pick an uploaded file instead of using an external URL.</p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => mediaInputRef.current?.click()}
                                      className="rounded-2xl border border-[#dac9b6] px-3 py-2 text-xs font-semibold text-[#214e5f]"
                                    >
                                      Upload new
                                    </button>
                                  </div>

                                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                                    {mediaAssets.length > 0 ? (
                                      mediaAssets.map((asset) => (
                                        <button
                                          key={asset.id}
                                          type="button"
                                          onClick={() => attachMediaToStep(step.id, asset)}
                                          className={`rounded-[18px] border p-3 text-left ${
                                            step.mediaUrl === asset.dataUrl
                                              ? 'border-[#7ab697] bg-[#edf8f0]'
                                              : 'border-[#e2d5c6] bg-white'
                                          }`}
                                        >
                                          <p className="truncate text-sm font-semibold text-[#18242b]">{asset.name}</p>
                                          <p className="mt-1 text-xs text-[#6d7b83]">{asset.mimeType || 'file'}</p>
                                        </button>
                                      ))
                                    ) : (
                                      <div className="rounded-[18px] border border-dashed border-[#d6c5b2] bg-white p-4 text-sm text-[#6a7b83]">
                                        Upload media first, then it will appear here for one-click selection.
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              <div className="mt-4">
                                <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8a6d51]">Next flow keyword or name</label>
                                <input
                                  value={step.nextFlowKeyword || ''}
                                  onChange={(event) =>
                                    updateSelectedStep(step.id, (currentStep) => ({
                                      ...currentStep,
                                      nextFlowKeyword: event.target.value || undefined,
                                    }))
                                  }
                                  placeholder="menu"
                                  className="mt-2 w-full rounded-2xl border border-[#dac9b6] bg-[#fffaf5] px-4 py-3 text-sm text-[#18242b]"
                                />
                              </div>

                              <div className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#214e5f]">{meta.label}</div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              </section>

              <aside className="space-y-6">
                <div className="section-card rounded-[28px] p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8a6d51]">Quick composer</p>
                  <h2 className="display-font mt-2 text-2xl font-bold text-[#18242b]">Draft a new automation</h2>

                  <div className="mt-5 space-y-4">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a6d51]">Flow name</label>
                      <input
                        value={draftName}
                        onChange={(event) => setDraftName(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-[#dac9b6] bg-[#fffaf5] px-4 py-3 text-sm text-[#18242b]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a6d51]">Trigger</label>
                      <select
                        value={draftTrigger}
                        onChange={(event) => setDraftTrigger(event.target.value as TriggerType)}
                        className="mt-2 w-full rounded-2xl border border-[#dac9b6] bg-[#fffaf5] px-4 py-3 text-sm text-[#18242b]"
                      >
                        {Object.entries(triggerMeta).map(([key, meta]) => (
                          <option key={key} value={key}>{meta.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a6d51]">Keywords</label>
                      <input
                        value={draftKeywords}
                        onChange={(event) => setDraftKeywords(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-[#dac9b6] bg-[#fffaf5] px-4 py-3 text-sm text-[#18242b]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a6d51]">Opening response</label>
                      <textarea
                        value={draftMessage}
                        onChange={(event) => setDraftMessage(event.target.value)}
                        className="mt-2 min-h-[150px] w-full rounded-[22px] border border-[#dac9b6] bg-[#fffaf5] px-4 py-3 text-sm text-[#18242b]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={addDraftFlow}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#c65a22] px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(198,90,34,0.22)]"
                    >
                      <RadioTower className="h-4 w-4" />
                      Add draft flow
                    </button>
                  </div>
                </div>

                <div className="section-card rounded-[28px] p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8a6d51]">Import mapping</p>
                  <ul className="mt-4 space-y-3 text-sm leading-6 text-[#5d7078]">
                    <li><span className="font-semibold text-[#214e5f]">keywords</span> become cleaner trigger values.</li>
                    <li><span className="font-semibold text-[#214e5f]">caption</span> becomes a text or AI block.</li>
                    <li><span className="font-semibold text-[#214e5f]">media</span> becomes a media block.</li>
                    <li><span className="font-semibold text-[#214e5f]">nextBot</span> becomes a jump-to-flow block.</li>
                    <li><span className="font-semibold text-[#214e5f]">api_url</span> becomes an API call block.</li>
                  </ul>
                </div>
              </aside>
            </div>
          )}
        </main>

        <aside className="section-card rounded-[28px] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8a6d51]">Selected account</p>
          <h2 className="display-font mt-2 text-2xl font-bold text-[#18242b]">{selectedAccount.name}</h2>

          <div className="mt-5 rounded-[24px] border border-[#e2d5c6] bg-white/90 p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[#8a6d51]">Profile</p>
                <h3 className="mt-1 text-lg font-semibold text-[#18242b]">{selectedAccount.phone}</h3>
              </div>
              <span className="rounded-full bg-[#edf5ee] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#3e7e58]">
                {selectedAccount.status}
              </span>
            </div>
            <div className="space-y-3 text-sm text-[#5d7078]">
              <p><span className="font-semibold text-[#214e5f]">Instance:</span> {selectedAccount.instanceId}</p>
              <p><span className="font-semibold text-[#214e5f]">Token:</span> {selectedAccount.token}</p>
              <p><span className="font-semibold text-[#214e5f]">Flows in studio:</span> {flows.length}</p>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
