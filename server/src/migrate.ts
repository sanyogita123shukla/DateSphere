import { getDb } from './db';
import fs from 'fs';
import path from 'path';

const schemaPath = path.resolve(__dirname, './schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

async function migrate() {
  try {
    console.log('Running migration...');
    const db = await getDb();
    await db.exec(schema);
    console.log('Migration successful');
  } catch (err) {
    console.error('Migration failed', err);
    process.exit(1);
  }
}

migrate();
