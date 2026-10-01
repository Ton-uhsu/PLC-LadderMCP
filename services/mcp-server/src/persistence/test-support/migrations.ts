// Test adapter only. Production migrations are owned exclusively by Goose.
import { readdir, readFile } from 'node:fs/promises';
import { sql, type Kysely } from 'kysely';
export const migrationDirectory = new URL('../../../../../db/migrations/', import.meta.url);
export async function migrationFiles() { return (await readdir(migrationDirectory)).filter(f => /^\d+_.*\.sql$/.test(f)).sort(); }
export async function migrationStatements(file: string, direction: 'Up' | 'Down') {
  const source = await readFile(new URL(file, migrationDirectory), 'utf8');
  const statements: string[] = []; let active = false; let block = false; let buffer = '';
  for (const line of source.split('\n')) {
    const annotation = line.match(/^-- \+goose (Up|Down|StatementBegin|StatementEnd)\s*$/);
    if (annotation) {
      if (annotation[1] === 'Up' || annotation[1] === 'Down') { active = annotation[1] === direction; continue; }
      if (!active) continue;
      if (annotation[1] === 'StatementBegin') { block = true; continue; }
      block = false; if (buffer.trim()) statements.push(buffer); buffer = ''; continue;
    }
    if (!active || line.trim().startsWith('--') || !line.trim()) continue;
    buffer += line + '\n';
    if (!block && line.trimEnd().endsWith(';')) { statements.push(buffer); buffer = ''; }
  }
  if (buffer.trim() || block || !statements.length) throw new Error(`Incomplete Goose SQL: ${file}/${direction}`);
  return statements;
}
export async function runMigration(db: Kysely<any>, file: string, direction: 'Up' | 'Down') {
  const statements = await migrationStatements(file, direction);
  await db.transaction().execute(async trx => { for (const statement of statements) await sql.raw(statement).execute(trx); });
}
// All callers use isolated test databases. Repeated calls only verify the fixture is already migrated.
export async function migrateDatabase(db: Kysely<any>) {
  const existing = await sql<{ present: string | null }>`SELECT to_regclass('evidence.poc_runs')::text AS present`.execute(db);
  if (existing.rows[0].present) return;
  for (const file of await migrationFiles()) await runMigration(db, file, 'Up');
}
