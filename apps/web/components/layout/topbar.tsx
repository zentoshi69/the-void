import { Badge } from "../ui/badge";

export function Topbar() {
  return (
    <header className="fixed left-60 right-0 top-0 z-20 flex h-14 items-center justify-between border-b border-void-border bg-void-bg-primary px-6">
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-void-text-secondary">Command Center</span>
      </div>

      <div className="flex items-center gap-4">
        <Badge variant="positive">System Online</Badge>
        <div className="h-8 w-8 rounded-full bg-void-bg-tertiary" />
      </div>
    </header>
  );
}
