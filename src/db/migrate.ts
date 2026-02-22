import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { pool } from "./pool.js";

async function runSqlFile(filePath: string) {
  const sql = fs.readFileSync(filePath, "utf8");
  await pool.query(sql);
}

async function main() {
  const base = path.resolve(process.cwd(), "../db/migrations");
  const files = ["001_init.sql"];

  for (const f of files) {
    const fp = path.join(base, f);
    await runSqlFile(fp);
    console.log(`[migrate] applied ${f}`);
  }

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
