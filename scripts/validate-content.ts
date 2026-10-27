/* Validate every question file. Usage:
 *   npm run validate              -> all tracks
 *   npm run validate -- react     -> one track (plus global checks)
 *   npm run validate -- react -q  -> errors only
 */
import { loadAllContent } from "../src/lib/content/load";

const args = process.argv.slice(2);
const quiet = args.includes("-q");
const only = args.find((a) => !a.startsWith("-"));

const { tracks, questions, problems } = loadAllContent();
const shown = problems.filter(
  (p) => (!only || p.file.includes(`content/${only}/`)) && (!quiet || p.level === "error"),
);

for (const p of shown) console.log(`${p.level === "error" ? "✖" : "⚠"} ${p.file}: ${p.message}`);

console.log("\nCounts");
for (const t of tracks) {
  if (only && t.id !== only) continue;
  const qs = questions.filter((q) => q.track === t.id);
  const lv = (l: string) => qs.filter((q) => q.level === l).length;
  console.log(
    `  ${t.id.padEnd(18)} ${String(qs.length).padStart(3)}  (E ${lv("easy")} / M ${lv("medium")} / H ${lv("hard")} / A ${lv("advanced")})`,
  );
  for (const c of t.chapters) {
    const n = qs.filter((q) => q.chapter === c.id).length;
    console.log(`      ${c.id.padEnd(26)} ${n}`);
  }
}
if (!only) console.log(`  ${"TOTAL".padEnd(18)} ${questions.length}`);

const errors = problems.filter((p) => p.level === "error" && (!only || p.file.includes(`content/${only}/`)));
if (errors.length) {
  console.log(`\n${errors.length} error(s)`);
  process.exit(1);
}
console.log("\nNo errors");
