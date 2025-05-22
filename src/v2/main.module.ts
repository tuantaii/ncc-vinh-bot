import { Module } from '@nestjs/common';
import { MezonModule } from './mezon/mezon.module';

@Module({
  imports: [MezonModule],
  exports: [MezonModule],
})
export class MainV2Module {}
