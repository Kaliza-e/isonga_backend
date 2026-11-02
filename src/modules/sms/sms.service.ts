import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsDispatchResult, SmsProvider } from './sms.interface';
import { MockSmsProvider } from './providers/mock-sms.provider';

@Injectable()
export class SmsService {
  private readonly provider: SmsProvider;
  private readonly logger = new Logger(SmsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly mockProvider: MockSmsProvider,
  ) {
    const providerName = this.configService.get<string>('SMS_PROVIDER', 'mock');
    // Extensible provider registry (e.g. PinnaTech, Africa's Talking, MTN/Airtel SMS API)
    this.provider = this.mockProvider;
    this.logger.log(`Initialized SMS gateway using provider: "${this.provider.providerName}"`);
  }

  async send(to: string, message: string): Promise<SmsDispatchResult> {
    try {
      return await this.provider.sendSms(to, message);
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${to}: ${(error as Error).message}`);
      return {
        success: false,
        messageId: '',
        provider: this.provider.providerName,
        error: (error as Error).message,
      };
    }
  }
}

