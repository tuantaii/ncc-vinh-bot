import { redisClientFactory } from './redis';
import { RedisRepository } from './redis.repo';
import { Module } from '@nestjs/common';
import { Global } from '@nestjs/common';

@Global()
@Module({
  imports: [],
  providers: [redisClientFactory, RedisRepository],
  exports: [redisClientFactory, RedisRepository],
})
export class RedisModule {}
