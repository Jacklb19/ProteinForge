import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Supabase migration RLS coverage', () => {
  const migrationsDir = path.resolve(process.cwd(), 'supabase', 'migrations');

  it('includes at least one SQL migration', () => {
    expect(fs.existsSync(migrationsDir)).toBe(true);
    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'));
    expect(files.length).toBeGreaterThan(0);
  });

  it('enables row level security for every created table', () => {
    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'));

    const createdTables: string[] = [];
    const rlsEnabledTables: string[] = [];

    // Include optional schema and conditional creation clauses.
    const createTableRegex =
      /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-zA-Z0-9_]+)\s*\(/gi;

    // Match explicit RLS activation independently of statement formatting.
    const enableRlsRegex =
      /alter\s+table\s+(?:public\.)?([a-zA-Z0-9_]+)\s+enable\s+row\s+level\s+security\s*;/gi;

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      let match: RegExpExecArray | null;

      while ((match = createTableRegex.exec(content)) !== null) {
        const tableName = match[1]?.toLowerCase();
        if (tableName) {
          createdTables.push(tableName);
        }
      }

      while ((match = enableRlsRegex.exec(content)) !== null) {
        const tableName = match[1]?.toLowerCase();
        if (tableName) {
          rlsEnabledTables.push(tableName);
        }
      }
    }

    expect(createdTables.length).toBeGreaterThan(0);

    for (const table of createdTables) {
      expect(
        rlsEnabledTables,
        `Table '${table}' was created without row level security`,
      ).toContain(table);
    }
  });
});
