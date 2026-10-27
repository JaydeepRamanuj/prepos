import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const qHref = (id: string) => {
  const [track, slug] = id.split("/");
  return `/tracks/${track}/${slug}`;
};

export const chapterKey = (track: string, chapter: string) => `${track}__${chapter}`;
