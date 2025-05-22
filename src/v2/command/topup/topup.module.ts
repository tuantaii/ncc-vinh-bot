import { Module } from '@nestjs/common';
import { TopupService } from './topup.service';
import { TopupEvent } from './topup.event';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MezonModule } from 'src/v2/mezon/mezon.module';

@Module({
  imports: [PrismaModule, MezonModule],
  providers: [TopupService, TopupEvent],
  exports: [TopupService, TopupEvent],
})
export class TopupModule {}
