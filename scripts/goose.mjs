import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const command = process.argv[2] ?? 'up';
if (!['up', 'down', 'status', 'version', 'down-to', 'up-to', 'validate'].includes(command)) {
  console.error('Supported commands: up, down, status, version, validate, up-to VERSION, down-to VERSION.'); process.exit(1);
}
const dbstring = process.env.DATABASE_URL ?? process.env.GOOSE_DBSTRING;
if (!dbstring && command !== 'validate') { console.error('Set DATABASE_URL or GOOSE_DBSTRING for a local database.'); process.exit(1); }
const target = process.argv[3];
if (command.endsWith('-to') && !/^\d+$/.test(target ?? '')) { console.error('A numeric migration version is required.'); process.exit(1); }
const child = spawn(process.env.GOOSE_BIN ?? 'goose', ['-dir', fileURLToPath(new URL('../db/migrations/', import.meta.url)), command, ...(target ? [target] : [])], {
  stdio: 'inherit', env: { ...process.env, GOOSE_DRIVER: 'postgres', GOOSE_DBSTRING: dbstring },
});
child.on('error', error => { console.error(error.code === 'ENOENT' ? 'Install Goose and add it to PATH, or set GOOSE_BIN to its executable path.' : 'Could not start Goose.'); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
