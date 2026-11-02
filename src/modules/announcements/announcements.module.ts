import { Module } from '@nestjs/common';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';
import { AreasModule } from '../areas/areas.module';
import { TargetingModule } from '../targeting/targeting.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AreasModule, TargetingModule, NotificationsModule],
  controllers: [AnnouncementsController],
  providers: [AnnouncementsService],
  exports: [AnnouncementsService],
})
export class AnnouncementsModule {}
