import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md pt-24 text-center">
      <h1 className="font-serif text-[28px] font-semibold">This page doesn&apos;t exist</h1>
      <p className="mt-2 text-[15px] text-ink-2">The question may have been renamed or moved to another track.</p>
      <Link href="/tracks" className="mt-6 inline-block rounded-lg bg-blue px-5 py-2.5 text-[15px] font-medium text-surface">
        Browse tracks
      </Link>
    </div>
  );
}
