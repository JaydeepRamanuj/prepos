"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Map of key → epoch ms when it was set. */
export type Stamp = Record<string, number>;

export type ListName = "solved" | "revise" | "bookmarks" | "chapters";

export interface ProgressData {
  solved: Stamp; // question keys
  revise: Stamp; // question keys
  bookmarks: Stamp; // question keys
  chapters: Stamp; // "track__chapter" marked done manually
  notes: Record<string, string>; // question key → note
}

export interface Prefs {
  autoReveal: boolean;
}

interface ProgressState extends ProgressData {
  prefs: Prefs;
  lastVisited: { id: string; title: string; at: number } | null;
  hydrated: boolean;
  toggle: (list: ListName, key: string) => boolean; // returns new on/off
  setNote: (key: string, note: string) => void;
  setPref: <K extends keyof Prefs>(k: K, v: Prefs[K]) => void;
  visit: (id: string, title: string) => void;
  replaceData: (data: ProgressData) => void;
  resetLocal: () => void;
}

export const emptyData = (): ProgressData => ({ solved: {}, revise: {}, bookmarks: {}, chapters: {}, notes: {} });

/** Writer installed by the sync layer when the user is signed in. */
type RemoteWriter = {
  toggle: (list: ListName, key: string, on: boolean, at: number) => void;
  note: (key: string, note: string) => void;
};
let remote: RemoteWriter | null = null;
export function setRemoteWriter(w: RemoteWriter | null) {
  remote = w;
}

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      ...emptyData(),
      prefs: { autoReveal: false },
      lastVisited: null,
      hydrated: false,
      toggle: (list, key) => {
        const cur = { ...get()[list] };
        const on = !cur[key];
        const at = Date.now();
        if (on) cur[key] = at;
        else delete cur[key];
        set({ [list]: cur } as Partial<ProgressState>);
        remote?.toggle(list, key, on, at);
        return on;
      },
      setNote: (key, note) => {
        const notes = { ...get().notes };
        if (note.trim()) notes[key] = note;
        else delete notes[key];
        set({ notes });
        remote?.note(key, note.trim() ? note : "");
      },
      setPref: (k, v) => set({ prefs: { ...get().prefs, [k]: v } }),
      visit: (id, title) => set({ lastVisited: { id, title, at: Date.now() } }),
      replaceData: (data) => set({ ...data }),
      resetLocal: () => set({ ...emptyData() }),
    }),
    {
      name: "prepos-progress",
      version: 1,
      partialize: ({ solved, revise, bookmarks, chapters, notes, prefs, lastVisited }) => ({
        solved, revise, bookmarks, chapters, notes, prefs, lastVisited,
      }),
      onRehydrateStorage: () => () => {
        useProgress.setState({ hydrated: true });
      },
    },
  ),
);

export function getData(s: ProgressData): ProgressData {
  return { solved: s.solved, revise: s.revise, bookmarks: s.bookmarks, chapters: s.chapters, notes: s.notes };
}

/** Union of two progress sets; for notes the longer text wins when both exist. */
export function mergeData(a: ProgressData, b: ProgressData): ProgressData {
  const stamp = (x: Stamp, y: Stamp) => {
    const out: Stamp = { ...x };
    for (const [k, v] of Object.entries(y)) out[k] = Math.max(out[k] ?? 0, v);
    return out;
  };
  const notes = { ...a.notes };
  for (const [k, v] of Object.entries(b.notes)) if (!notes[k] || v.length > notes[k].length) notes[k] = v;
  return {
    solved: stamp(a.solved, b.solved),
    revise: stamp(a.revise, b.revise),
    bookmarks: stamp(a.bookmarks, b.bookmarks),
    chapters: stamp(a.chapters, b.chapters),
    notes,
  };
}
