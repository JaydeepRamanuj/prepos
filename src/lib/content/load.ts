import fs from "node:fs";
import path from "node:path";
import { officeTrackDescriptions, useInterviewPrepCopy } from "@/lib/copy";
import { parseQuestionFile } from "./parse";
import type { QuestionIndexEntry, QuestionSource, TrackMeta } from "./types";

export const CONTENT_DIR = path.join(process.cwd(), "content");

export interface ContentProblem {
  file: string;
  level: "error" | "warning";
  message: string;
}

export interface LoadedContent {
  tracks: TrackMeta[];
  questions: QuestionSource[];
  problems: ContentProblem[];
}

function readTracks(problems: ContentProblem[]): TrackMeta[] {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  const tracks: TrackMeta[] = [];
  for (const dir of fs.readdirSync(CONTENT_DIR)) {
    const metaPath = path.join(CONTENT_DIR, dir, "meta.json");
    if (!fs.existsSync(metaPath)) continue;
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as TrackMeta;
      if (meta.id !== dir) problems.push({ file: metaPath, level: "error", message: `id "${meta.id}" must match folder "${dir}"` });
      if (!useInterviewPrepCopy) meta.description = officeTrackDescriptions[meta.id] ?? meta.description;
      tracks.push(meta);
    } catch (e) {
      problems.push({ file: metaPath, level: "error", message: `invalid JSON: ${(e as Error).message}` });
    }
  }
  return tracks.sort((a, b) => a.order - b.order);
}

export function loadAllContent(): LoadedContent {
  const problems: ContentProblem[] = [];
  const tracks = readTracks(problems);
  const questions: QuestionSource[] = [];

  for (const track of tracks) {
    const chapterIds = new Set(track.chapters.map((c) => c.id));
    const trackDir = path.join(CONTENT_DIR, track.id);
    const seen = new Map<string, string>();

    for (const entry of fs.readdirSync(trackDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const chapter = entry.name;
      const chapterDir = path.join(trackDir, chapter);
      if (!chapterIds.has(chapter)) {
        problems.push({ file: chapterDir, level: "error", message: `folder "${chapter}" is not a chapter in meta.json` });
        continue;
      }
      for (const filename of fs.readdirSync(chapterDir).sort()) {
        if (!filename.endsWith(".md")) continue;
        const file = path.join(chapterDir, filename);
        const rel = path.relative(process.cwd(), file);
        const res = parseQuestionFile(fs.readFileSync(file, "utf8"), { track: track.id, chapter, filename, file: rel });
        for (const m of res.errors) problems.push({ file: rel, level: "error", message: m });
        for (const m of res.warnings) problems.push({ file: rel, level: "warning", message: m });
        if (!res.question) continue;
        const dup = seen.get(res.question.slug);
        if (dup) {
          problems.push({ file: rel, level: "error", message: `slug "${res.question.slug}" already used by ${dup}` });
          continue;
        }
        seen.set(res.question.slug, rel);
        questions.push(res.question);
      }
    }
  }

  const ids = new Set(questions.map((q) => q.id));
  for (const q of questions)
    for (const r of q.related)
      if (!ids.has(r)) problems.push({ file: q.file, level: "warning", message: `related "${r}" does not exist (yet)` });

  // Stable ordering: track order, chapter order, file order.
  const trackOrder = new Map(tracks.map((t, i) => [t.id, i]));
  const chapterOrder = new Map(tracks.flatMap((t) => t.chapters.map((c, i) => [`${t.id}/${c.id}`, i] as const)));
  questions.sort(
    (a, b) =>
      trackOrder.get(a.track)! - trackOrder.get(b.track)! ||
      chapterOrder.get(`${a.track}/${a.chapter}`)! - chapterOrder.get(`${b.track}/${b.chapter}`)! ||
      a.order - b.order,
  );

  return { tracks, questions, problems };
}

let cache: LoadedContent | null = null;
export function getContent(): LoadedContent {
  if (!cache || process.env.NODE_ENV === "development") cache = loadAllContent();
  return cache;
}

export function toIndexEntry(q: QuestionSource): QuestionIndexEntry {
  const { id, track, chapter, slug, order, title, level, type, tags } = q;
  return { id, track, chapter, slug, order, title, level, type, tags };
}

export function getTracks() {
  return getContent().tracks;
}
export function getTrack(id: string) {
  return getContent().tracks.find((t) => t.id === id);
}
export function getQuestions() {
  return getContent().questions;
}
export function getTrackQuestions(trackId: string) {
  return getContent().questions.filter((q) => q.track === trackId);
}
export function getQuestion(trackId: string, slug: string) {
  return getContent().questions.find((q) => q.track === trackId && q.slug === slug);
}
export function getIndex(): QuestionIndexEntry[] {
  return getContent().questions.map(toIndexEntry);
}
