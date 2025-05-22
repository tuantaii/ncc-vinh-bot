declare module '@xenova/transformers' {
  export interface Tokenizer {
    encode(text: string): number[];
    decode(tokens: number[]): string;
  }

  export function encoding_for_model(model: string): Promise<Tokenizer>;
}
