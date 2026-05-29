import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

let dbInstance: Database<sqlite3.Database, sqlite3.Statement> | null = null;

export const getDb = async () => {
  if (!dbInstance) {
    const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST;
    const dbPath = isTest
      ? ':memory:'
      : path.resolve(__dirname, '../../datesphere.db');
    
    dbInstance = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    // Enable WAL mode for better concurrent access (file-based only)
    if (!isTest) {
      await dbInstance.run('PRAGMA journal_mode=WAL');
    }
    await dbInstance.run('PRAGMA foreign_keys=ON');
  }
  return dbInstance;
};

/** Reset DB singleton — used for test isolation */
export const resetDb = async () => {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
};
