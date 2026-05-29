/**
 * backfill-vibe-vectors.ts
 * 
 * One-time script: run from the server/ directory to compute and store
 * vibe_vector embeddings for all existing users who don't have one yet.
 * 
 * Run: npx ts-node backfill-vibe-vectors.ts
 */

import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '.env') });

import { getDb } from './src/db';
import { computeEmbedding } from './src/vibeEngine';

async function backfill() {
  console.log('\n  🔄 Backfilling vibe_vectors for existing users...\n');

  const db = await getDb();

  const users = await db.all(
    'SELECT id, display_name, bio FROM users WHERE is_deleted = 0 AND (vibe_vector IS NULL OR vibe_vector = "")'
  );

  if (users.length === 0) {
    console.log('  ✓ All users already have vibe_vectors. Nothing to do.\n');
    process.exit(0);
  }

  console.log(`  Found ${users.length} user(s) without vibe_vectors.\n`);

  for (const user of users) {
    try {
      process.stdout.write(`  Computing for ${user.display_name}... `);
      const vec = await computeEmbedding(user.bio);
      await db.run(
        'UPDATE users SET vibe_vector = ? WHERE id = ?',
        [JSON.stringify(vec), user.id]
      );
      console.log('✓');
    } catch (err) {
      console.log(`✗ (${err})`);
    }
  }

  console.log('\n  ✓ Backfill complete.\n');
  process.exit(0);
}

backfill().catch((err) => {
  console.error('\n  ✗ Backfill failed:', err);
  process.exit(1);
});
