import { Module } from '@nestjs/common';
import { ChromaClient } from 'chromadb';
import { ConfigService } from '@nestjs/config';
import { ChromaService } from './chroma.service';

@Module({
  imports: [],
  providers: [
    ChromaService,
    {
      provide: 'CHROMA_CLIENT',
      useFactory: () => {
        return new ChromaClient({
          path: 'http://localhost:1902',
        });
      },
    },
  ],
  exports: [ChromaService, 'CHROMA_CLIENT'],
})
export class ChromeModule {}
