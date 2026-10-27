import { getIndex, getTracks } from "@/lib/content/load";

export const dynamic = "force-static";

export function GET() {
  return Response.json({
    tracks: getTracks().map(({ id, title, short }) => ({ id, title, short })),
    questions: getIndex(),
  });
}
