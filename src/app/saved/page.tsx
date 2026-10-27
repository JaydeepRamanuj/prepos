import type { Metadata } from "next";
import { SavedLists } from "@/components/saved-lists";

export const metadata: Metadata = { title: "Saved" };

export default function SavedPage() {
  return (
    <div className="mx-auto max-w-[720px] pt-8 md:pt-12">
      <h1 className="font-serif text-[28px] font-semibold tracking-tight md:text-[34px]">Saved</h1>
      <p className="mt-2 text-[15px] text-ink-2">Questions you marked to revise, bookmarked, or wrote notes on.</p>
      <SavedLists />
    </div>
  );
}
