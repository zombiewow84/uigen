"use client";

import dynamic from "next/dynamic";

// Dynamically import MainContent to prevent server-side localStorage access
const MainContent = dynamic(
  () => import("./main-content").then((mod) => mod.MainContent),
  {
    ssr: false,
    loading: () => <div className="h-screen w-screen bg-neutral-50" />,
  }
);

interface ClientWrapperProps {
  user?: {
    id: string;
    email: string;
  } | null;
  project?: {
    id: string;
    name: string;
    messages: any[];
    data: any;
    createdAt: Date;
    updatedAt: Date;
  };
}

export function ClientWrapper({ user, project }: ClientWrapperProps) {
  return <MainContent user={user} project={project} />;
}
