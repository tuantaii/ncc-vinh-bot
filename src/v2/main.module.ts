import { Module } from '@nestjs/common';
import { MezonModule } from './mezon/mezon.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [MezonModule, ScheduleModule.forRoot()],
  exports: [MezonModule],
})
export class MainV2Module {}
