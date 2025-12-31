#!/usr/bin/env bun
/**
 * Full setup orchestration for Hasura playground.
 *
 * Steps:
 * 1. Generate SQL migrations
 * 2. Generate Hasura metadata
 * 3. Start Docker containers
 * 4. Wait for Hasura health
 * 5. Apply migrations via Hasura API
 * 6. Reload metadata
 * 7. Export GraphQL schema
 */

import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const HASURA_ENDPOINT = 'http://localhost:8080';
const HASURA_ADMIN_SECRET = 'myadminsecret';
const POSTGRES_URL = 'postgres://postgres:postgrespassword@localhost:5432/hasura_perf';

async function run(command: string, args: string[], cwd?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`\n$ ${command} ${args.join(' ')}`);
    const proc = spawn(command, args, {
      cwd: cwd || join(import.meta.dirname, '..'),
      stdio: 'inherit',
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });

    proc.on('error', reject);
  });
}

async function waitForHasura(maxAttempts = 30): Promise<void> {
  console.log('\nWaiting for Hasura to be ready...');

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${HASURA_ENDPOINT}/healthz`);
      if (response.ok) {
        console.log('Hasura is ready!');
        return;
      }
    } catch {
      // Ignore connection errors
    }

    process.stdout.write('.');
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error('Hasura did not become ready in time');
}

async function applyMigrations(): Promise<void> {
  console.log('\nApplying migrations...');

  const migrationPath = join(
    import.meta.dirname,
    '..',
    'hasura',
    'migrations',
    'default',
    '20240101000000_init',
    'up.sql'
  );

  const sql = await readFile(migrationPath, 'utf-8');

  const response = await fetch(`${HASURA_ENDPOINT}/v2/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hasura-Admin-Secret': HASURA_ADMIN_SECRET,
    },
    body: JSON.stringify({
      type: 'run_sql',
      args: {
        source: 'default',
        sql,
        cascade: false,
        read_only: false,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to apply migrations: ${text}`);
  }

  console.log('Migrations applied successfully');
}

async function trackTables(): Promise<void> {
  console.log('\nTracking tables...');

  // Get list of tables from the database
  const tablesResponse = await fetch(`${HASURA_ENDPOINT}/v2/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hasura-Admin-Secret': HASURA_ADMIN_SECRET,
    },
    body: JSON.stringify({
      type: 'run_sql',
      args: {
        source: 'default',
        sql: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
        cascade: false,
        read_only: true,
      },
    }),
  });

  if (!tablesResponse.ok) {
    throw new Error('Failed to get table list');
  }

  const tablesResult = (await tablesResponse.json()) as { result: string[][] };
  const tables = tablesResult.result.slice(1).map((row) => row[0]); // Skip header row

  console.log(`Found ${tables.length} tables to track`);

  // Track each table
  for (const tableName of tables) {
    const response = await fetch(`${HASURA_ENDPOINT}/v1/metadata`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hasura-Admin-Secret': HASURA_ADMIN_SECRET,
      },
      body: JSON.stringify({
        type: 'pg_track_table',
        args: {
          source: 'default',
          table: {
            schema: 'public',
            name: tableName,
          },
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      // Ignore "already tracked" errors
      if (!text.includes('already tracked')) {
        console.warn(`Warning: Failed to track ${tableName}: ${text}`);
      }
    }
  }

  console.log('Tables tracked successfully');
}

async function trackRelationships(): Promise<void> {
  console.log('\nTracking foreign key relationships...');

  const response = await fetch(`${HASURA_ENDPOINT}/v1/metadata`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hasura-Admin-Secret': HASURA_ADMIN_SECRET,
    },
    body: JSON.stringify({
      type: 'pg_suggest_relationships',
      args: {
        omit_tracked: true,
        source: 'default',
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to suggest relationships: ${text}`);
  }

  const result = (await response.json()) as { relationships: Array<{ type: string; args: unknown }> };
  const relationships = result.relationships || [];

  console.log(`Found ${relationships.length} relationships to create`);

  // Create each relationship
  for (const rel of relationships) {
    const createResponse = await fetch(`${HASURA_ENDPOINT}/v1/metadata`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hasura-Admin-Secret': HASURA_ADMIN_SECRET,
      },
      body: JSON.stringify(rel),
    });

    if (!createResponse.ok) {
      const text = await createResponse.text();
      // Ignore "already exists" errors
      if (!text.includes('already exists')) {
        console.warn(`Warning: Failed to create relationship: ${text}`);
      }
    }
  }

  console.log('Relationships tracked successfully');
}

async function main(): Promise<void> {
  console.log('=== Hasura Playground Setup ===\n');

  // Step 1: Generate migrations
  console.log('Step 1: Generating SQL migrations...');
  await run('bun', ['scripts/generate-schema.ts']);

  // Step 2: Generate metadata
  console.log('\nStep 2: Generating Hasura metadata...');
  await run('bun', ['scripts/generate-metadata.ts']);

  // Step 3: Start Docker
  console.log('\nStep 3: Starting Docker containers...');
  await run('docker', ['compose', 'up', '-d']);

  // Step 4: Wait for Hasura
  await waitForHasura();

  // Step 5: Apply migrations
  await applyMigrations();

  // Step 6: Track tables and relationships
  await trackTables();
  await trackRelationships();

  // Step 7: Export schema
  console.log('\nStep 7: Exporting GraphQL schema...');
  await run('bun', ['scripts/export-schema.ts']);

  console.log('\n=== Setup Complete ===');
  console.log('\nHasura Console: http://localhost:8080/console');
  console.log('Admin Secret: myadminsecret');
}

main().catch((error) => {
  console.error('\nSetup failed:', error);
  process.exit(1);
});
