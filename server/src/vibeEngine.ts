/**
 * vibeEngine.ts — Server-side semantic similarity engine
 *
 * Uses @xenova/transformers to run Xenova/all-MiniLM-L6-v2 in Node.js.
 * The pipeline is a singleton — loaded once at server startup and reused.
 * Embeddings are stored in the DB as JSON strings (vibe_vector column).
 *
 * Why server-side?
 * - No 30MB WASM download per browser session
 * - Scores are pre-computed → instant API response
 * - Browser stays lightweight; privacy-first local mode still possible
 */

// @xenova/transformers ships its own type definitions
import { pipeline, env } from '@xenova/transformers';

// Run in Node.js (server) — do not attempt browser WebAssembly paths
env.allowLocalModels = false; // Pull from HuggingFace hub only
env.useBrowserCache  = false; // Use Node.js fs cache instead
env.cacheDir         = './.cache/transformers'; // Local cache inside server/

/**
 * Singleton pipeline holder — ensures the model is only downloaded once
 * and reused across all requests.
 */
class VibeEngineSingleton {
  private static instance: any = null;
  private static loading: Promise<any> | null = null;

  static async getInstance(): Promise<any> {
    if (this.instance) return this.instance;

    // Prevent race conditions: if already loading, wait for it
    if (this.loading) return this.loading;

    this.loading = (async () => {
      console.log('  🧠 Loading Vibe Engine (Xenova/all-MiniLM-L6-v2)...');
      const extractor = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
        { revision: 'main' }
      );
      console.log('  ✓ Vibe Engine ready.');
      this.instance = extractor;
      this.loading  = null;
      return extractor;
    })();

    return this.loading;
  }
}

/**
 * Compute a semantic embedding for a given text string.
 * Returns a normalized float32 vector of length 384.
 */
export async function computeEmbedding(text: string): Promise<number[]> {
  const extractor = await VibeEngineSingleton.getInstance();
  const output    = await extractor(text, { pooling: 'mean', normalize: true });
  // output.data is a Float32Array — convert to plain array for JSON storage
  return Array.from(output.data as Float32Array);
}

/**
 * Cosine similarity between two vectors.
 * Assumes both are already L2-normalized (which MiniLM outputs are).
 * In that case, cosine similarity = dot product.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Warm-up: trigger model load at server boot so the first API
 * request isn't slow. Call this from index.ts after DB init.
 * Errors are swallowed — server stays up even if model fails to load.
 */
export async function warmUpVibeEngine(): Promise<void> {
  try {
    await VibeEngineSingleton.getInstance();
  } catch (err) {
    console.error('  ⚠ Vibe Engine failed to load:', err);
  }
}
