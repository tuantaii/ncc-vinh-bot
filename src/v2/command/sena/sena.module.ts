import { Module } from '@nestjs/common';
import { SenaService } from './sena.service';
import { SenaEvent } from './sena.event';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MezonModule } from 'src/v2/mezon/mezon.module';

@Module({
  imports: [PrismaModule, MezonModule],
  providers: [SenaService, SenaEvent],
  exports: [SenaService, SenaEvent],
})
export class SenaModule {}
