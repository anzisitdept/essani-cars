// components/layout/DashboardLayout.tsx
"use client";

import { ReactNode, useState } from "react";
import { Sidebar } from "./Sidebar";
import { useAuth } from "@/context/AuthContext";
import { LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const { userData, logout } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const getInitials = (name?: string) => {
    return name
      ? name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
      : "ST";
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        isMobileOpen={isMobileSidebarOpen}
        setIsMobileOpen={setIsMobileSidebarOpen}
      />

      <main className={cn(
        "flex flex-col min-h-screen transition-all duration-300 ease-in-out",
        isSidebarCollapsed ? "md:pl-20" : "md:pl-64"
      )}>
        <header className="h-16 border-b border-slate-200 bg-white sticky top-0 z-40 px-4 md:px-8 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger */}
            <Button variant="ghost" size="icon" className="md:hidden -ml-2" onClick={() => setIsMobileSidebarOpen(true)}>
              <Menu size={24} />
            </Button>
            <h2 className="text-lg font-semibold text-slate-800">Caruzen Tracking</h2>
          </div>

          {/* User Profile Section - Hover for Logout */}
          <div className="relative group">
            <div className="flex items-center gap-3 cursor-pointer py-1.5 px-2 rounded-lg hover:bg-slate-50 transition-colors">
              <div className="text-right hidden md:block">
                <div className="text-sm font-semibold text-slate-800 leading-tight">
                  {userData?.name || "Staff Member"}
                </div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide bg-slate-100 inline-block px-1.5 rounded-sm mt-0.5">
                  {userData?.role || "GUEST"}
                </div>
              </div>

              <div className="h-9 w-9 rounded-full bg-slate-900 border-2 border-slate-200 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                {getInitials(userData?.name)}
              </div>
            </div>

            {/* Hover Dropdown */}
            <div className="absolute right-0 top-full pt-1 w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top-right z-50">
              <div className="bg-white border border-slate-200 shadow-xl rounded-lg overflow-hidden ring-1 ring-black/5">
                <div className="p-3 border-b border-slate-50 md:hidden bg-slate-50">
                  <p className="font-semibold text-sm text-slate-900">{userData?.name}</p>
                  <p className="text-xs text-slate-500 uppercase">{userData?.role}</p>
                </div>
                <button
                  onClick={logout}
                  className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors font-medium"
                >
                  <LogOut size={16} />
                  <span>Sign Out Account</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 p-4 md:p-8 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
