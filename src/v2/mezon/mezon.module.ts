import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MezonClient } from 'mezon-sdk';
import { MezonService } from './mezon.service';
import { BotGateway } from '../bot/bot.gateway';
@Module({
  imports: [],
  providers: [
    Logger,
    BotGateway,
    {
      provide: 'MEZON',
      useFactory: async (
        configService: ConfigService,
        logger: Logger,
        botGateway: BotGateway,
      ) => {
        const botId = configService.get<string>('BOT_ID');
        const token = configService.get<string>('MEZON_TOKEN');

        if (!botId || !token) {
          throw new Error('Bot ID or token is not set');
        }

        const client = new MezonClient({
          botId,
          token,
        });
        await client.login();
        await botGateway.initEvent(client);
        logger.warn(`Mezon client initialized ${client.clientId}`);

        return client;
      },
      inject: [ConfigService, Logger, BotGateway],
    },
    MezonService,
  ],
  exports: ['MEZON', MezonService],
})
export class MezonModule {}
