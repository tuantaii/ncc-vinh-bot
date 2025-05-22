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
        const client = new MezonClient(
          configService.get<string>('MEZON_TOKEN'),
        );
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
