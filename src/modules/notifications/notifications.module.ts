import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { TargetingModule } from '../targeting/targeting.module';
import { SmsModule } from '../sms/sms.module';
import { PushModule } from '../push/push.module';

@Module({
  imports: [TargetingModule, SmsModule, PushModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}

