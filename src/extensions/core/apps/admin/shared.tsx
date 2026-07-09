import type { ReactNode } from "react";

export function AdminSurfaceLayout({
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return <div className="space-y-6">{children}</div>;
}
