import { Module } from '@nestjs/common';
import { PushService } from './push.service';
import { MockPushProvider } from './providers/mock-push.provider';

@Module({
  providers: [MockPushProvider, PushService],
  exports: [PushService],
})
export class PushModule {}

