import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PushDispatchResult, PushProvider } from '../push.interface';

@Injectable()
export class MockPushProvider implements PushProvider {
  readonly providerName = 'MockFirebaseCloudMessaging';
  private readonly logger = new Logger(MockPushProvider.name);

  async sendPush(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<PushDispatchResult> {
    const messageId = `fcm_msg_${crypto.randomBytes(8).toString('hex')}`;
    this.logger.log(
      `[FCM-MOCK] Dispatched Push Notification to ${tokens.length} devices (ref: ${messageId}): "${title}"`,
    );

    return {
      success: true,
      messageId,
      multicastCount: tokens.length,
    };
  }
}

