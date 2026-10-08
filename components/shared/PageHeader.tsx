import React, { ReactNode } from "react";

interface PageHeaderProps {
    title: string;
    description: string;
    action?: ReactNode;
}

export const PageHeader = ({ title, description, action }: PageHeaderProps) => (
  <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
    <div className="min-w-0 space-y-1">
      <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      <p className="text-sm text-slate-500">{description}</p>
    </div>
    {action && <div>{action}</div>}
  </div>
);