import { Migrator } from 'kysely/migration';
import { pathToFileURL } from 'node:url';
import { createDatabase, type Database } from './database.js';
import type { Kysely } from 'kysely';
import * as initial from './migrations/001-project-revisions.js';
export async function migrateDatabase(db: Kysely<Database>) {
  const migrator = new Migrator({ db, provider: {
    async getMigrations() { return { '001-project-revisions': initial }; },
  } });
  const result = await migrator.migrateToLatest();
  if (result.error) throw result.error;
  return result.results ?? [];
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const db = createDatabase(process.env.DATABASE_URL ?? '');
  try { console.log(await migrateDatabase(db)); }
  catch { console.error('Database migration failed. Check local database configuration/schema.'); process.exitCode = 1; }
  finally { await db.destroy(); }
}
