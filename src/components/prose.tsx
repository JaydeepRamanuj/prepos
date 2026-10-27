import { cn } from "@/lib/utils";

/** Renders build-time HTML from our own markdown files. */
export function Prose({ html, className }: { html: string; className?: string }) {
  return <div className={cn("prose-q", className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
