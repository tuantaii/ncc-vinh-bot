import { Inject, Injectable, Logger } from '@nestjs/common';
import { ChromaClient } from 'chromadb';
import { PrismaService } from 'src/prisma/prisma.service';
import { OpenAIEmbeddings } from '@langchain/openai';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ChromaService {
  private readonly logger = new Logger(ChromaService.name);
  private readonly embeddings: OpenAIEmbeddings;

  constructor(
    @Inject('CHROMA_CLIENT')
    private readonly client: ChromaClient,
    private readonly configService: ConfigService,
  ) {
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: this.configService.get('OPENAI_API_KEY'),
      modelName: 'text-embedding-3-small',
    });
  }

  async getOrCreateCollection(name: string) {
    try {
      // Try to get the collection first
      const collection = await this.client.getCollection({
        name,
        embeddingFunction: {
          generate: async (texts: string[]) => {
            const embeddings = await this.embeddings.embedDocuments(texts);
            return embeddings.map((embedding) => Array.from(embedding));
          },
        },
      });
      this.logger.log(`Using existing collection: ${name}`);
      return collection;
    } catch (error) {
      // If collection doesn't exist, create it
      this.logger.log(`Creating new collection: ${name}`);
      const collection = await this.client.createCollection({
        name,
        embeddingFunction: {
          generate: async (texts: string[]) => {
            const embeddings = await this.embeddings.embedDocuments(texts);
            return embeddings.map((embedding) => Array.from(embedding));
          },
        },
      });
      return collection;
    }
  }
}
