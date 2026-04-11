import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FlowNodeType, FlowStatus, Prisma, Workspace } from '@prisma/client';
import { randomUUID } from 'crypto';

import { toPrismaJson } from '../../common/prisma/json';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateFlowDto } from './dto/create-flow.dto';
import { ImportFlowDto } from './dto/import-flow.dto';
import { ToggleFlowAiDto } from './dto/toggle-flow-ai.dto';
import { UpdateFlowDto } from './dto/update-flow.dto';

type LegacyWorkflowPayload = {
  version?: string;
  chatbots?: LegacyChatbot[];
  templates?: unknown[];
};

type LegacyChatbot = {
  name?: string;
  keywords?: string;
  type_search?: string;
  template?: string;
  type?: string;
  caption?: string;
  media?: string | null;
  run?: string;
  sent?: string | null;
  send_to?: string;
  status?: string;
  presenceTime?: string;
  presenceType?: string;
  nextBot?: string;
  description?: string;
  inputname?: string;
  save_data?: string;
  get_api_data?: string;
  api_url?: string;
  api_config?: string | Record<string, unknown>;
  use_ai?: string;
  is_default?: string;
};

type ImportedNode = {
  id: string;
  label: string;
  type: FlowNodeType;
  config: Record<string, unknown>;
  positionX: number;
  positionY: number;
};

type ImportedEdge = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  condition?: Record<string, unknown>;
};

@Injectable()
export class FlowsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(workspace: Workspace) {
    const flows = await this.prisma.chatbotFlow.findMany({
      where: { workspaceId: workspace.id },
      include: {
        nodes: true,
        _count: { select: { nodes: true, edges: true, runs: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    return flows.map((flow: any) => this.serializeFlow(flow));
  }

  async create(workspace: Workspace, dto: CreateFlowDto) {
    const flow = await this.prisma.chatbotFlow.create({
      data: {
        workspaceId: workspace.id,
        name: dto.name,
        description: dto.description,
        status: dto.status ?? FlowStatus.DRAFT,
        settings: toPrismaJson({
          source: 'appleberry_native',
          aiAssistantActive: dto.aiAssistantActive ?? false,
          importSummary: {
            chatbotCount: 0,
            templateCount: 0,
            triggerCount: 0,
          },
        }),
        nodes: {
          create: [
            {
              id: randomUUID(),
              type: FlowNodeType.KEYWORD_ROUTER,
              label: 'Keyword Trigger Router',
              positionX: 80,
              positionY: 160,
              config: toPrismaJson({
                routes: [],
                source: 'manual_builder',
              }),
            },
          ],
        },
      },
      include: {
        nodes: true,
        edges: true,
        _count: { select: { nodes: true, edges: true, runs: true } },
      },
    });

    return this.serializeFlow(flow);
  }

  async getById(workspace: Workspace, id: string) {
    const flow = await this.findFlowOrThrow(workspace, id);
    return this.serializeFlow(flow, true);
  }

  async update(workspace: Workspace, id: string, dto: UpdateFlowDto) {
    await this.findFlowOrThrow(workspace, id);

    const flow = await this.prisma.chatbotFlow.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        status: dto.status,
      },
      include: {
        nodes: true,
        edges: true,
        _count: { select: { nodes: true, edges: true, runs: true } },
      },
    });

    return this.serializeFlow(flow, true);
  }

  async importLegacyWorkflow(workspace: Workspace, dto: ImportFlowDto) {
    const payload = this.asLegacyPayload(dto.payload);
    if (!payload.chatbots?.length) {
      throw new BadRequestException('Workflow payload must include at least one chatbot definition');
    }

    const imported = this.mapLegacyWorkflow(payload);
    const flow = await this.prisma.chatbotFlow.create({
      data: {
        workspaceId: workspace.id,
        name: dto.name?.trim() || this.deriveFlowName(payload),
        description: dto.description?.trim() || 'Imported keyword-trigger WhatsApp workflow',
        status: FlowStatus.DRAFT,
        settings: toPrismaJson(imported.settings),
        nodes: {
          create: imported.nodes.map((node) => ({
            id: node.id,
            type: node.type,
            label: node.label,
            config: toPrismaJson(node.config),
            positionX: node.positionX,
            positionY: node.positionY,
          })),
        },
        edges: {
          create: imported.edges.map((edge) => ({
            id: edge.id,
            sourceNodeId: edge.sourceNodeId,
            targetNodeId: edge.targetNodeId,
            condition: edge.condition === undefined ? undefined : toPrismaJson(edge.condition),
          })),
        },
      },
      include: {
        nodes: true,
        edges: true,
        _count: { select: { nodes: true, edges: true, runs: true } },
      },
    });

    return this.serializeFlow(flow, true);
  }

  async exportLegacyWorkflow(workspace: Workspace, id: string) {
    const flow = await this.findFlowOrThrow(workspace, id);
    const payload = this.buildLegacyExport(flow);

    return {
      id: flow.id,
      name: flow.name,
      filename: `${this.slugify(flow.name)}.json`,
      payload,
    };
  }

  async toggleAiAssistant(workspace: Workspace, id: string, dto: ToggleFlowAiDto) {
    const flow = await this.findFlowOrThrow(workspace, id);
    const nextSettings = this.withAiAssistantSetting(flow.settings, dto.enabled);
    const aiNodes = flow.nodes.filter((node: any) => node.type === FlowNodeType.AI_REPLY);

    await this.prisma.$transaction([
      this.prisma.chatbotFlow.update({
        where: { id: flow.id },
        data: { settings: nextSettings },
      }),
      ...aiNodes.map((node) =>
        this.prisma.chatbotNode.update({
          where: { id: node.id },
          data: {
            config: toPrismaJson({
              ...this.asRecord(node.config),
              active: dto.enabled,
            }),
          },
        }),
      ),
    ]);

    return this.getById(workspace, id);
  }

  async remove(workspace: Workspace, id: string) {
    await this.findFlowOrThrow(workspace, id);

    await this.prisma.$transaction([
      this.prisma.chatbotEdge.deleteMany({ where: { chatbotFlowId: id } }),
      this.prisma.chatbotNode.deleteMany({ where: { chatbotFlowId: id } }),
      this.prisma.chatbotRun.deleteMany({ where: { chatbotFlowId: id } }),
      this.prisma.chatbotFlow.delete({ where: { id } }),
    ]);

    return { id, deleted: true };
  }

  private async findFlowOrThrow(workspace: Workspace, id: string) {
    const flow = await this.prisma.chatbotFlow.findFirst({
      where: {
        id,
        workspaceId: workspace.id,
      },
      include: {
        nodes: true,
        edges: true,
        _count: { select: { nodes: true, edges: true, runs: true } },
      },
    });

    if (!flow) {
      throw new NotFoundException('Flow not found');
    }

    return flow;
  }

  private serializeFlow(flow: any, includeGraph = false) {
    const settings = this.asRecord(flow.settings);
    const aiAssistantActive = Boolean(settings.aiAssistantActive);
    const importSummary = this.asRecord(settings.importSummary);
    const visibleSettings = {
      ...settings,
    };

    delete visibleSettings.originalPayload;

    return {
      ...flow,
      aiAssistantActive,
      importSummary,
      settings: visibleSettings,
      nodes: includeGraph
        ? flow.nodes.map((node: any) => ({
            ...node,
            config: this.asRecord(node.config),
          }))
        : undefined,
      edges: includeGraph
        ? flow.edges.map((edge: any) => ({
            ...edge,
            condition: edge.condition ? this.asRecord(edge.condition) : null,
          }))
        : undefined,
    };
  }

  private asLegacyPayload(value: Record<string, unknown>) {
    return value as LegacyWorkflowPayload;
  }

  private mapLegacyWorkflow(payload: LegacyWorkflowPayload) {
    const routerNodeId = randomUUID();
    const nodes: ImportedNode[] = [
      {
        id: routerNodeId,
        label: 'Keyword Trigger Router',
        type: FlowNodeType.KEYWORD_ROUTER,
        positionX: 80,
        positionY: 140,
        config: {
          routes: [],
          source: 'legacy_whatsapp_keyword_builder',
        },
      },
    ];
    const edges: ImportedEdge[] = [];
    const botLookup = new Map<string, ImportedNode>();

    payload.chatbots?.forEach((bot, index) => {
      const id = randomUUID();
      const keywords = this.parseKeywords(bot.keywords);
      const type = this.inferNodeType(bot);
      const isFallback = keywords.includes('__fallback__') || bot.is_default === '1';
      const matchTypeCode = bot.type_search ?? '1';
      const apiConfig = this.parseApiConfig(bot.api_config);
      const config: Record<string, unknown> = {
        importIndex: index,
        source: 'legacy_whatsapp_keyword_builder',
        keywords,
        keywordsRaw: bot.keywords ?? '',
        matchType: matchTypeCode === '2' ? 'contains_any' : 'exact_any',
        matchTypeCode,
        message: bot.caption ?? '',
        prompt: bot.use_ai === '1' ? bot.caption ?? '' : undefined,
        mediaUrl: bot.media ?? null,
        nextBot: bot.nextBot ?? '',
        description: bot.description ?? '',
        inputField: bot.inputname ?? '',
        captureMode: bot.save_data ?? '1',
        sendToMode: bot.send_to ?? '1',
        delaySeconds: Number(bot.presenceTime ?? 0),
        delayType: bot.presenceType ?? '0',
        shouldCallWebhook: bot.get_api_data === '2' || Boolean(bot.api_url),
        webhookUrl: bot.api_url ?? '',
        webhookConfig: apiConfig,
        active: bot.use_ai === '1',
        isFallback,
        rawLegacy: {
          ...bot,
          api_config: apiConfig,
        },
      };

      if (type === FlowNodeType.CALL_WEBHOOK) {
        config.responseMessage = bot.caption ?? '';
      }

      const node: ImportedNode = {
        id,
        label: bot.name?.trim() || `Imported Bot ${index + 1}`,
        type,
        config,
        positionX: 380,
        positionY: 110 + index * 140,
      };

      nodes.push(node);
      botLookup.set(node.label, node);

      edges.push({
        id: randomUUID(),
        sourceNodeId: routerNodeId,
        targetNodeId: id,
        condition: {
          kind: isFallback ? 'fallback' : 'keyword_match',
          keywords,
          matchType: config.matchType,
          importedKeywordSource: bot.keywords ?? '',
        },
      });
    });

    const routes = nodes
      .filter((node) => node.id !== routerNodeId)
      .map((node) => ({
        targetNodeId: node.id,
        label: node.label,
        keywords: this.asStringArray(node.config.keywords),
        matchType: node.config.matchType,
        isFallback: Boolean(node.config.isFallback),
      }));

    nodes[0].config.routes = routes;

    payload.chatbots?.forEach((bot) => {
      const source = bot.name ? botLookup.get(bot.name.trim()) : undefined;
      const target = bot.nextBot ? botLookup.get(bot.nextBot.trim()) : undefined;

      if (source && target) {
        edges.push({
          id: randomUUID(),
          sourceNodeId: source.id,
          targetNodeId: target.id,
          condition: {
            kind: 'next_bot',
            targetBotName: bot.nextBot,
          },
        });
      }
    });

    const aiNodeCount = nodes.filter((node) => node.type === FlowNodeType.AI_REPLY).length;
    const webhookNodeCount = nodes.filter((node) => node.type === FlowNodeType.CALL_WEBHOOK).length;
    const mediaNodeCount = nodes.filter((node) => node.type === FlowNodeType.SEND_MEDIA).length;

    return {
      settings: {
        source: 'legacy_whatsapp_keyword_builder',
        importVersion: payload.version ?? 'unknown',
        aiAssistantActive: aiNodeCount > 0,
        importSummary: {
          chatbotCount: payload.chatbots?.length ?? 0,
          templateCount: payload.templates?.length ?? 0,
          triggerCount: payload.chatbots?.length ?? 0,
          aiNodeCount,
          webhookNodeCount,
          mediaNodeCount,
        },
        legacyTemplates: payload.templates ?? [],
      },
      nodes,
      edges,
    };
  }

  private buildLegacyExport(flow: any): LegacyWorkflowPayload {
    const settings = this.asRecord(flow.settings);
    const aiAssistantActive = Boolean(settings.aiAssistantActive);
    const nodeMap = new Map(flow.nodes.map((node: any) => [node.id, node]));
    const edgesBySource = new Map<string, any[]>();

    flow.edges.forEach((edge: any) => {
      const existing = edgesBySource.get(edge.sourceNodeId) ?? [];
      existing.push(edge);
      edgesBySource.set(edge.sourceNodeId, existing);
    });

    const chatbots = flow.nodes
      .filter((node: any) => node.type !== FlowNodeType.KEYWORD_ROUTER)
      .sort((left: any, right: any) => {
        const leftIndex = Number(this.asRecord(left.config).importIndex ?? 0);
        const rightIndex = Number(this.asRecord(right.config).importIndex ?? 0);
        return leftIndex - rightIndex;
      })
      .map((node: any) => {
        const config = this.asRecord(node.config);
        const rawLegacy = this.asRecord(config.rawLegacy);
        const nextBotEdge = (edgesBySource.get(node.id) ?? []).find((edge) => {
          const condition = this.asRecord(edge.condition);
          return condition.kind === 'next_bot';
        });
        const nextBotNode = nextBotEdge
          ? (nodeMap.get(nextBotEdge.targetNodeId) as { label?: string } | undefined)
          : undefined;
        const apiConfig = config.webhookConfig ?? rawLegacy.api_config ?? { method: 'get' };

        return {
          ...rawLegacy,
          name: node.label,
          keywords: String(rawLegacy.keywords ?? config.keywordsRaw ?? this.asStringArray(config.keywords).join(',')),
          type_search: String(rawLegacy.type_search ?? config.matchTypeCode ?? '1'),
          caption: String(rawLegacy.caption ?? config.message ?? config.prompt ?? ''),
          media: rawLegacy.media ?? config.mediaUrl ?? null,
          nextBot: nextBotNode?.label ?? rawLegacy.nextBot ?? '',
          description: String(rawLegacy.description ?? config.description ?? ''),
          inputname: String(rawLegacy.inputname ?? config.inputField ?? ''),
          save_data: String(rawLegacy.save_data ?? config.captureMode ?? '1'),
          get_api_data: String(rawLegacy.get_api_data ?? (config.shouldCallWebhook ? '2' : '1')),
          api_url: String(rawLegacy.api_url ?? config.webhookUrl ?? ''),
          api_config: JSON.stringify(apiConfig),
          use_ai: node.type === FlowNodeType.AI_REPLY ? (aiAssistantActive ? '1' : '0') : String(rawLegacy.use_ai ?? '0'),
          is_default: config.isFallback ? '1' : String(rawLegacy.is_default ?? '0'),
        };
      });

    return {
      version: String(settings.importVersion ?? '8.0.0'),
      chatbots,
      templates: Array.isArray(settings.legacyTemplates) ? settings.legacyTemplates : [],
    };
  }

  private inferNodeType(bot: LegacyChatbot) {
    const searchableText = [bot.name, bot.description, bot.caption].join(' ').toLowerCase();

    if (bot.use_ai === '1') {
      return FlowNodeType.AI_REPLY;
    }

    if (bot.api_url || bot.get_api_data === '2') {
      return FlowNodeType.CALL_WEBHOOK;
    }

    if (bot.media) {
      return FlowNodeType.SEND_MEDIA;
    }

    if (
      searchableText.includes('human handoff') ||
      searchableText.includes('human agent will assist') ||
      searchableText.includes('connect you')
    ) {
      return FlowNodeType.HUMAN_HANDOFF;
    }

    return FlowNodeType.SEND_TEXT;
  }

  private parseKeywords(value?: string) {
    if (!value) {
      return [];
    }

    return value
      .split(',')
      .map((keyword) => keyword.trim())
      .filter(Boolean);
  }

  private parseApiConfig(value: LegacyChatbot['api_config']) {
    if (!value) {
      return { method: 'get' };
    }

    if (typeof value === 'object') {
      return value;
    }

    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return { raw: value };
    }
  }

  private deriveFlowName(payload: LegacyWorkflowPayload) {
    const primary = payload.chatbots?.find((bot) => bot.is_default === '1')?.name;
    if (primary?.trim()) {
      return primary.trim().replace(/_imported/gi, '').trim();
    }

    return 'Imported WhatsApp Workflow';
  }

  private slugify(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'workflow-export';
  }

  private asRecord(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};
  }

  private asStringArray(value: unknown) {
    return Array.isArray(value) ? value.map((item) => String(item)) : [];
  }

  private withAiAssistantSetting(settings: unknown, enabled: boolean) {
    return toPrismaJson({
      ...this.asRecord(settings),
      aiAssistantActive: enabled,
    });
  }
}
