import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md pt-24 text-center">
      <h1 className="font-serif text-[28px] font-semibold">This page doesn&apos;t exist</h1>
      <p className="mt-2 text-[15px] text-ink-2">The question may have been renamed or moved to another track.</p>
      <Button asChild size="lg" className="mt-6">
        <Link href="/tracks">Browse tracks</Link>
      </Button>
    </div>
  );
}
