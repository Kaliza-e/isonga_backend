import { Module } from '@nestjs/common';
import { SmsService } from './sms.service';
import { MockSmsProvider } from './providers/mock-sms.provider';

@Module({
  providers: [MockSmsProvider, SmsService],
  exports: [SmsService],
})
export class SmsModule {}

