import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-void-bg-primary">
      <Sidebar />
      <Topbar />
      <main className="ml-60 pt-14">
        <div className="mx-auto max-w-[1440px] p-6">{children}</div>
      </main>
    </div>
  );
}
