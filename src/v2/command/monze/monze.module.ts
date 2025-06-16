import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MezonModule } from 'src/v2/mezon/mezon.module';
import { MonzeService } from './monze.service';
import { MonzeEvent } from './monze.event';
import { CoingeckoService } from 'src/v2/coingecko/coingecko.service';

@Module({
  imports: [PrismaModule, MezonModule],
  providers: [MonzeService, MonzeEvent, CoingeckoService],
  exports: [MonzeService, MonzeEvent],
})
export class MonzeModule {}
