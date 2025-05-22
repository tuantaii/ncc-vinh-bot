import { Module } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [],
  providers: [
    {
      provide: 'QRANDT_CLIENT',
      useFactory: (configService: ConfigService) => {
        return new QdrantClient({
          url: configService.get('QRANDT_API_URL'),
          apiKey: configService.get('QRANDT_API_KEY'),
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: ['QRANDT_CLIENT'],
})
export class QdrantModule {}
