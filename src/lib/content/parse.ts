import matter from "gray-matter";
import {
  LEVELS,
  QUESTION_TYPES,
  type Level,
  type QuestionSource,
  type QuestionType,
} from "./types";

export const SECTION_NAMES = [
  "Question",
  "Clues",
  "Interview Answer",
  "Explanation",
  "Follow-ups",
  "Common Mistakes",
  "Tips",
] as const;
type SectionName = (typeof SECTION_NAMES)[number];

const REQUIRED: SectionName[] = ["Question", "Interview Answer", "Explanation"];

export interface ParseResult {
  question?: QuestionSource;
  errors: string[];
  warnings: string[];
}

/** Split the body into `## Section` blocks, ignoring `##` inside code fences. */
function splitSections(body: string) {
  const sections = new Map<string, string>();
  const unknown: string[] = [];
  let current: string | null = null;
  let buf: string[] = [];
  let inFence = false;
  let fenceMarker = "";

  const flush = () => {
    if (current !== null) sections.set(current, buf.join("\n").trim());
    buf = [];
  };

  for (const line of body.split(/\r?\n/)) {
    const fence = line.match(/^\s*(```+|~~~+)/);
    if (fence) {
      if (!inFence) {
        inFence = true;
        fenceMarker = fence[1];
      } else if (line.trim().startsWith(fenceMarker)) {
        inFence = false;
      }
    }
    const h2 = !inFence && line.match(/^##\s+(.+?)\s*$/);
    if (h2) {
      flush();
      current = h2[1];
      if (!(SECTION_NAMES as readonly string[]).includes(current)) unknown.push(current);
      continue;
    }
    if (current !== null) buf.push(line);
  }
  flush();
  return { sections, unknown };
}

/** Top-level "- " list items, keeping indented continuation lines. */
export function splitListItems(md: string): string[] {
  const items: string[] = [];
  let cur: string[] | null = null;
  for (const line of md.split(/\r?\n/)) {
    const m = line.match(/^[-*]\s+(.*)$/) || line.match(/^\d+[.)]\s+(.*)$/);
    if (m) {
      if (cur) items.push(cur.join("\n").trim());
      cur = [m[1]];
    } else if (cur) {
      cur.push(line.replace(/^ {2,4}/, ""));
    }
  }
  if (cur) items.push(cur.join("\n").trim());
  return items.filter(Boolean);
}

export function parseQuestionFile(
  raw: string,
  info: { track: string; chapter: string; filename: string; file: string },
): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const nameMatch = info.filename.match(/^(\d{2,3})-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/);
  if (!nameMatch) {
    errors.push(`filename must look like "03-some-slug.md" (got "${info.filename}")`);
    return { errors, warnings };
  }
  const order = Number(nameMatch[1]);
  const slug = nameMatch[2];

  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(raw);
  } catch (e) {
    errors.push(`frontmatter is not valid YAML: ${(e as Error).message}`);
    return { errors, warnings };
  }
  const fm = parsed.data as Record<string, unknown>;

  const title = typeof fm.title === "string" ? fm.title.trim() : "";
  if (!title) errors.push("frontmatter.title is required");

  const level = fm.level as Level;
  if (!LEVELS.includes(level)) errors.push(`frontmatter.level must be one of ${LEVELS.join(", ")}`);

  const type = fm.type as QuestionType;
  if (!QUESTION_TYPES.includes(type))
    errors.push(`frontmatter.type must be one of ${QUESTION_TYPES.join(", ")}`);

  const tags = Array.isArray(fm.tags) ? fm.tags.map(String) : [];
  const related = Array.isArray(fm.related) ? fm.related.map(String) : [];
  for (const r of related)
    if (!/^[a-z0-9-]+\/[a-z0-9-]+$/.test(r)) errors.push(`related entry "${r}" must be "track/slug"`);

  const { sections, unknown } = splitSections(parsed.content);
  for (const u of unknown) errors.push(`unknown section "## ${u}"`);
  for (const r of REQUIRED) if (!sections.get(r)) errors.push(`missing required section "## ${r}"`);

  const clues = splitListItems(sections.get("Clues") ?? "");
  if ((level === "hard" || level === "advanced") && clues.length < 2)
    errors.push("hard/advanced questions need 2-3 clues under ## Clues");
  if (clues.length > 4) warnings.push("more than 4 clues; keep it to 2-3");

  const answer = sections.get("Interview Answer") ?? "";
  const answerWords = answer.split(/\s+/).filter(Boolean).length;
  if (answerWords > 0 && answerWords < 25) warnings.push(`interview answer is very short (${answerWords} words)`);

  const explanation = sections.get("Explanation") ?? "";
  const explWords = explanation.split(/\s+/).filter(Boolean).length;
  if (explWords > 0 && explWords < 80) warnings.push(`explanation is thin (${explWords} words)`);

  if (!sections.get("Follow-ups") && type !== "behavioural") warnings.push("no ## Follow-ups");

  if (errors.length) return { errors, warnings };

  return {
    errors,
    warnings,
    question: {
      id: `${info.track}/${slug}`,
      track: info.track,
      chapter: info.chapter,
      slug,
      order,
      title,
      level,
      type,
      tags,
      related,
      question: sections.get("Question") ?? "",
      clues,
      answer,
      explanation,
      followUps: sections.get("Follow-ups") ?? "",
      mistakes: sections.get("Common Mistakes") ?? "",
      tips: sections.get("Tips") ?? "",
      file: info.file,
    },
  };
}
