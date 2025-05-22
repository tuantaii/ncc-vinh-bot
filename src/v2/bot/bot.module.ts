import { Module } from '@nestjs/common';
import { BotGateway } from './bot.gateway';
import { RedisModule } from 'src/core/redis/redis.module';
@Module({
  imports: [RedisModule],
  providers: [BotGateway],
  exports: [BotGateway],
})
export class BotModule {}
