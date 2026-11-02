import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { SmsDispatchResult, SmsProvider } from '../sms.interface';

@Injectable()
export class MockSmsProvider implements SmsProvider {
  readonly providerName = 'MockRwandaSmsGateway';
  private readonly logger = new Logger(MockSmsProvider.name);

  async sendSms(to: string, message: string): Promise<SmsDispatchResult> {
    const messageId = `rw_sms_${crypto.randomBytes(8).toString('hex')}`;
    this.logger.log(`[SMS-MOCK] Sent SMS to ${to} (ref: ${messageId}): "${message.slice(0, 60)}..."`);

    return {
      success: true,
      messageId,
      provider: this.providerName,
      rawResponse: {
        status: 'SUBMITTED',
        carrier: to.startsWith('+25078') || to.startsWith('+25079') ? 'MTN_RW' : 'AIRTEL_RW',
        destination: to,
        timestamp: new Date().toISOString(),
      },
    };
  }
}

