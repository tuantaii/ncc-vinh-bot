import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
// import { MezonModule } from './mezon/mezon.module';
import { ConfigModule } from '@nestjs/config';
import * as Joi from '@hapi/joi';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { RedisModule } from './core/redis/redis.module';
import { MainV2Module } from './v2/main.module';
import { BotModule } from './v2/bot/bot.module';
import { SenaModule } from './v2/command/sena/sena.module';
import { SenaLogsModule } from './v2/command/message_logs/message-logs.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        MEZON_TOKEN: Joi.string().required(),
      }),
    }),
    RedisModule,
    EventEmitterModule.forRoot(),
    MainV2Module,
    BotModule,
    SenaModule,
    SenaLogsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
