import { Injectable, Logger } from '@nestjs/common';
import { PushDispatchResult, PushProvider } from './push.interface';
import { MockPushProvider } from './providers/mock-push.provider';

@Injectable()
export class PushService {
  private readonly provider: PushProvider;
  private readonly logger = new Logger(PushService.name);

  constructor(private readonly mockProvider: MockPushProvider) {
    this.provider = this.mockProvider;
    this.logger.log(`Initialized Push Notification service with provider: "${this.provider.providerName}"`);
  }

  async send(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<PushDispatchResult> {
    if (!tokens || tokens.length === 0) {
      return { success: true, messageId: '', multicastCount: 0 };
    }
    return this.provider.sendPush(tokens, title, body, data);
  }
}

