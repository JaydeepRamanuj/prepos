import {
  Atom,
  Blocks,
  Braces,
  Bug,
  Code,
  Database,
  FileType,
  FlaskConical,
  Gauge,
  Layout,
  MessagesSquare,
  Server,
  Shield,
  Sparkles,
  Triangle,
  Users,
  BookOpen,
  type LucideIcon,
} from "lucide-react";

const map: Record<string, LucideIcon> = {
  atom: Atom,
  blocks: Blocks,
  braces: Braces,
  bug: Bug,
  code: Code,
  database: Database,
  "file-type": FileType,
  "flask-conical": FlaskConical,
  gauge: Gauge,
  layout: Layout,
  "messages-square": MessagesSquare,
  server: Server,
  shield: Shield,
  sparkles: Sparkles,
  triangle: Triangle,
  users: Users,
};

export function TrackIcon({ name, className }: { name: string; className?: string }) {
  const Icon = map[name] ?? BookOpen;
  return <Icon className={className} strokeWidth={1.75} aria-hidden />;
}
