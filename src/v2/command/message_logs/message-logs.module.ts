import { Module } from '@nestjs/common';
import { SenaLogService } from './message-logs.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  imports: [],
  providers: [SenaLogService, PrismaService],
})
export class SenaLogsModule {}
