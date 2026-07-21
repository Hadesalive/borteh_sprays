// check-migration-syntax.mjs
// Parses a migration with the real PostgreSQL grammar (libpg_query compiled to WASM) so syntax
// errors are caught here rather than by `supabase db push` against production. This validates
// GRAMMAR ONLY — it cannot know whether a column or function exists.
//
// Run: node scripts/check-migration-syntax.mjs supabase/migrations/<file>.sql

import { readFile } from "node:fs/promises";
import PgQueryModule from "pg-query-emscripten";

const target = process.argv[2];
if (!target) { console.error("usage: node check-migration-syntax.mjs <file.sql>"); process.exit(1); }

const sql = await readFile(target, "utf8");
const pg = await new PgQueryModule();
const res = pg.parse(sql);

if (res.error) {
  const { message, cursorpos } = res.error;
  const upto = sql.slice(0, cursorpos);
  const line = upto.split("\n").length;
  const col = cursorpos - upto.lastIndexOf("\n");
  console.error(`\n✖ SYNTAX ERROR at line ${line}, col ${col}: ${message}`);
  const lines = sql.split("\n");
  for (let i = Math.max(0, line - 4); i < Math.min(lines.length, line + 2); i++) {
    console.error(`${String(i + 1).padStart(5)}${i + 1 === line ? " >" : "  "} ${lines[i]}`);
  }
  process.exit(1);
}

const stmts = res.parse_tree?.stmts ?? [];
console.log(`\n✓ parses cleanly — ${stmts.length} top-level statements`);

// Surface what it will actually do, so the diff is reviewable at a glance.
const kinds = {};
for (const s of stmts) {
  const k = Object.keys(s.stmt || {})[0] || "?";
  kinds[k] = (kinds[k] || 0) + 1;
}
console.log("  " + Object.entries(kinds).map(([k, v]) => `${k}×${v}`).join(", "));
console.log("\n  NOTE: grammar only. Column/function existence is not checked.\n");
