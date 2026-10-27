import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const migrations = readdirSync(migrationsDir).filter((file) => file.endsWith(".sql")).sort();
if (migrations.length === 0) throw new Error("No Supabase migrations found.");
for (const migration of migrations) {
  const sql = readFileSync(join(migrationsDir, migration), "utf8");
  if (!sql.trim()) throw new Error(`Migration is empty: ${migration}`);
}
console.log(`Supabase migration inventory OK: ${migrations.length} file(s).`);
