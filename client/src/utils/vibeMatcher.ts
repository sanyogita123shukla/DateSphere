import { pipeline, env } from '@xenova/transformers';

// Skip local check, download from HF
env.allowLocalModels = false;
env.useBrowserCache = true;

class PipelineSingleton {
  static task = 'feature-extraction';
  static model = 'Xenova/all-MiniLM-L6-v2';
  static instance: any = null;

  static async getInstance(progress_callback: any = null) {
      if (this.instance === null) {
          this.instance = await pipeline(this.task as any, this.model, { progress_callback });
      }
      return this.instance;
  }
}

export async function getEmbedding(text: string, progressCallback?: (data: any) => void) {
  const extractor = await PipelineSingleton.getInstance(progressCallback);
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

export function cosineSimilarity(vecA: number[], vecB: number[]) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
