import Link from "next/link";
import type { ReactNode } from "react";
import { Item } from "@/components/ui/item";
import { cn } from "@/lib/utils";

/** The bordered, divided list every row list in the app uses. */
export function ItemList({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <ul className={cn("divide-y divide-border overflow-hidden rounded-xl border border-border bg-card", className)}>
      {children}
    </ul>
  );
}

/** A row that is a single link. Hover and focus come from Item when it renders an <a>. */
export function ItemLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <li>
      <Item asChild className={cn("gap-3 rounded-none border-0 px-4 py-3 text-base focus-visible:ring-inset", className)}>
        <Link href={href}>{children}</Link>
      </Item>
    </li>
  );
}

/** Link inside a row that also has a sibling control (a toggle or a button). Same hover and focus as ItemLink. */
export const itemRowLinkClass =
  "flex min-w-0 flex-1 text-base outline-none transition-colors hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50";
