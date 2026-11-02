import { Module } from '@nestjs/common';
import { TargetingService } from './targeting.service';

@Module({
  providers: [TargetingService],
  exports: [TargetingService],
})
export class TargetingModule {}

