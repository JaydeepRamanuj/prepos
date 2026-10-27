import "server-only";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeStringify from "rehype-stringify";

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypePrettyCode, {
    theme: { light: "github-light", dark: "github-dark-dimmed" },
    keepBackground: false,
    defaultLang: { block: "txt", inline: "plaintext" },
    bypassInlineCode: true,
  })
  .use(rehypeStringify);

const cache = new Map<string, Promise<string>>();

/** Markdown → HTML at build time. Content is authored in-repo, so it is trusted. */
export function renderMarkdown(md: string): Promise<string> {
  if (!md.trim()) return Promise.resolve("");
  let hit = cache.get(md);
  if (!hit) {
    hit = processor.process(md).then(String);
    cache.set(md, hit);
  }
  return hit;
}
