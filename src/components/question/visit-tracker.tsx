"use client";

import { useEffect } from "react";
import { useProgress } from "@/lib/progress/store";

export function VisitTracker({ id, title }: { id: string; title: string }) {
  const visit = useProgress((s) => s.visit);
  useEffect(() => visit(id, title), [id, title, visit]);
  return null;
}
