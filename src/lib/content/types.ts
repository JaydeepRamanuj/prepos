export const LEVELS = ["easy", "medium", "hard", "advanced"] as const;
export type Level = (typeof LEVELS)[number];

export const QUESTION_TYPES = [
  "concept",
  "output",
  "implement",
  "debugging",
  "scenario",
  "design",
  "behavioural",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const LEVEL_LABEL: Record<Level, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  advanced: "Advanced",
};

export const TYPE_LABEL: Record<QuestionType, string> = {
  concept: "Concept",
  output: "Predict output",
  implement: "Implement it",
  debugging: "Debugging",
  scenario: "Scenario",
  design: "Design",
  behavioural: "Behavioural",
};

export interface ChapterMeta {
  id: string;
  title: string;
  description: string;
}

export interface TrackMeta {
  id: string;
  title: string;
  short: string;
  description: string;
  icon: string;
  order: number;
  group: "core" | "frontend" | "engineering" | "career";
  chapters: ChapterMeta[];
}

/** Raw markdown sections of one question file. */
export interface QuestionSource {
  id: string; // `${track}/${slug}`
  track: string;
  chapter: string;
  slug: string;
  order: number;
  title: string;
  level: Level;
  type: QuestionType;
  tags: string[];
  related: string[];
  question: string;
  clues: string[];
  answer: string;
  explanation: string;
  followUps: string;
  mistakes: string;
  tips: string;
  file: string;
}

/** Lightweight entry used for lists, search and progress math. */
export interface QuestionIndexEntry {
  id: string;
  track: string;
  chapter: string;
  slug: string;
  order: number;
  title: string;
  level: Level;
  type: QuestionType;
  tags: string[];
}

export function toKey(id: string) {
  // Firestore map keys cannot contain "/" safely in field paths.
  return id.replace("/", "__");
}
