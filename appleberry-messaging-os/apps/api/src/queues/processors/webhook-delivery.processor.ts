import * as crypto from 'crypto';
import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import axios, { AxiosError } from 'axios';

import { PrismaService } from '../../common/prisma/prisma.service';

export type WebhookDeliveryJobData = {
  url: string;
  payload: Record<string, unknown>;
  secret: string;
  webhookLogId: string;
  workspaceId?: string;
  eventType?: string;
};

const MAX_WEBHOOK_ATTEMPTS = 5;
const REQUEST_TIMEOUT_MS = 15_000;
const SIGNATURE_HEADER = 'X-Appleberry-Signature';

function signPayload(payload: string, secret: string): string {
  return `sha256=${crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex')}`;
}

@Processor('webhook-delivery')
export class WebhookDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookDeliveryProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<WebhookDeliveryJobData>): Promise<{ statusCode: number; delivered: boolean }> {
    const { url, payload, secret, webhookLogId, eventType } = job.data;
    const attemptNumber = (job.attemptsMade ?? 0) + 1;

    this.logger.log(
      `[webhook-delivery] Attempt ${attemptNumber}/${MAX_WEBHOOK_ATTEMPTS} delivering to url=${url} logId=${webhookLogId}`,
    );

    const payloadString = JSON.stringify(payload);
    const signature = signPayload(payloadString, secret);

    let statusCode: number | undefined;
    let deliveryError: string | undefined;

    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          [SIGNATURE_HEADER]: signature,
          'X-Appleberry-Event': eventType ?? 'webhook',
          'X-Appleberry-Attempt': String(attemptNumber),
          'User-Agent': 'Appleberry-Messaging-OS/1.0',
        },
        timeout: REQUEST_TIMEOUT_MS,
        // Accept any 2xx-3xx as success; treat 4xx/5xx as error via validateStatus
        validateStatus: (status) => status < 400,
      });

      statusCode = response.status;

      await this.updateWebhookLog(webhookLogId, statusCode, true, null);

      this.logger.log(`[webhook-delivery] Success: url=${url} statusCode=${statusCode} logId=${webhookLogId}`);
      return { statusCode, delivered: true };
    } catch (err) {
      const axiosErr = err as AxiosError;
      statusCode = axiosErr?.response?.status ?? 0;
      deliveryError = axiosErr?.message ?? String(err);

      this.logger.warn(
        `[webhook-delivery] Delivery failed attempt=${attemptNumber}: url=${url} statusCode=${statusCode} error=${deliveryError}`,
      );

      await this.updateWebhookLog(webhookLogId, statusCode, false, deliveryError);

      if (attemptNumber >= MAX_WEBHOOK_ATTEMPTS) {
        // Dead letter: mark as permanently failed
        this.logger.error(
          `[webhook-delivery] Max attempts (${MAX_WEBHOOK_ATTEMPTS}) reached for logId=${webhookLogId}. Dropping to dead letter.`,
        );
        await this.updateWebhookLog(webhookLogId, statusCode, false, `DEAD_LETTER after ${MAX_WEBHOOK_ATTEMPTS} attempts: ${deliveryError}`);
        // Return without throwing so BullMQ doesn't keep retrying (we handle retries manually via job opts)
        return { statusCode: statusCode ?? 0, delivered: false };
      }

      // Re-throw so BullMQ applies exponential backoff (configured in job opts)
      throw new Error(`[webhook-delivery] HTTP ${statusCode}: ${deliveryError}`);
    }
  }

  private async updateWebhookLog(
    webhookLogId: string,
    statusCode: number | undefined,
    success: boolean,
    errorMessage: string | null,
  ): Promise<void> {
    try {
      await this.prisma.webhookLog.update({
        where: { id: webhookLogId },
        data: {
          statusCode: statusCode ?? null,
          payload: {
            delivered: success,
            lastError: errorMessage,
            lastAttemptAt: new Date().toISOString(),
          },
        },
      });
    } catch (err) {
      this.logger.warn(`[webhook-delivery] Could not update WebhookLog ${webhookLogId}: ${String(err)}`);
    }
  }
}
