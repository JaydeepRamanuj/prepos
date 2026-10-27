"use client";

import { useEffect, useState } from "react";

export interface MockSession {
  ids: string[];
  titles: string[];
  startedAt: number;
  finished?: boolean;
}

const KEY = "prepos-mock";

export function readMock(): MockSession | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as MockSession) : null;
  } catch {
    return null;
  }
}

export function writeMock(s: MockSession | null) {
  try {
    if (s) sessionStorage.setItem(KEY, JSON.stringify(s));
    else sessionStorage.removeItem(KEY);
  } catch {
    /* storage unavailable — mock still works for this page */
  }
}

/** The active mock session, if this question is part of it. */
export function useMockFor(id: string) {
  const [state, setState] = useState<{ session: MockSession; index: number } | null>(null);
  useEffect(() => {
    const s = readMock();
    if (!s || s.finished) return;
    const index = s.ids.indexOf(id);
    if (index >= 0) setState({ session: s, index });
  }, [id]);
  return state;
}
