// components/layout/Sidebar.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Database, Settings, PlusCircle, Car, FileText, LogOut, Users, LucideIcon, BarChart3, Shield, Truck, ChevronLeft, ChevronRight, X, UserCircle, History, Wallet, Layers, Receipt, ArrowLeftRight, BookOpen, ShoppingCart, PackagePlus, Landmark } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MenuItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permissionId?: string;
}

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}

export const Sidebar = ({ isCollapsed, setIsCollapsed, isMobileOpen, setIsMobileOpen }: SidebarProps) => {
  const pathname = usePathname();
  const { logout, userData } = useAuth();

  const menuItems: MenuItem[] = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permissionId: 'dashboard' },
    { href: '/dashboard/registry', label: 'New Registration', icon: PlusCircle, permissionId: 'registry' },
    { href: '/dashboard/clients', label: 'Manage Clients', icon: UserCircle, permissionId: 'clients' },
    { href: '/dashboard/investors', label: 'Manage Investors', icon: Users, permissionId: 'investors' },
    { href: '/dashboard/banks', label: 'Manage Banks', icon: Landmark },
    { href: '/dashboard/account-types', label: 'Account Types', icon: Layers, permissionId: 'account_types' },
    { href: '/dashboard/accounts', label: 'Accounts', icon: Wallet, permissionId: 'accounts' },
    { href: '/dashboard/cash-voucher', label: 'Cash Voucher', icon: Receipt, permissionId: 'cash_voucher' },
    { href: '/dashboard/general-voucher', label: 'General Voucher', icon: ArrowLeftRight, permissionId: 'general_voucher' },
    { href: '/dashboard/general-ledger', label: 'General Ledger', icon: BookOpen, permissionId: 'general_ledger' },
    { href: '/dashboard/settings', label: 'Configurations', icon: Settings, permissionId: 'settings' },
    { href: '/dashboard/inventory', label: 'Inventory', icon: Database, permissionId: 'inventory' },
    { href: '/dashboard/purchase-invoice', label: 'Purchase Invoice', icon: PackagePlus, permissionId: 'purchase_invoice' },
    { href: '/dashboard/sale-invoice', label: 'Sale Invoice', icon: ShoppingCart, permissionId: 'sale_invoice' },
    { href: '/dashboard/website-inventory', label: 'Website Inventory', icon: Car, permissionId: 'inventory' },
    { href: '/dashboard/history', label: 'Vehicle History', icon: History, permissionId: 'inventory' },

    { href: '/dashboard/delivery', label: 'Delivery', icon: Truck, permissionId: 'delivery' },
    { href: '/dashboard/reports', label: 'Reports & Analytics', icon: BarChart3, permissionId: 'reports' },
    { href: '/dashboard/logs', label: 'Activity Logs', icon: FileText, permissionId: 'logs' },
    { href: '/dashboard/roles', label: 'Roles', icon: Shield, permissionId: 'roles' },
    { href: '/dashboard/users', label: 'Users', icon: Users, permissionId: 'users' },
  ];

  const hasPermission = (permissionId?: string) => {
    if (!permissionId) return true;
    if (!userData) return false;
    if (userData.role === 'admin' || userData.role === 'Super Admin') return true;
    if (userData.permissions?.includes('ALL')) return true;
    return userData.permissions?.includes(permissionId);
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside className={cn(
        "fixed left-0 top-0 bottom-0 bg-white border-r border-slate-200 flex flex-col z-50 transition-all duration-300 ease-in-out",
        isCollapsed ? "w-20" : "w-64",
        // Mobile behavior: hidden by default, visible when open
        "transform md:transform-none",
        isMobileOpen ? "translate-x-0 w-64" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="h-16 flex items-center justify-between px-4 border-slate-100 relative">
          {/* Logo Section */}
          {!isCollapsed ? (
            <img src="/Vendora side.png" alt="Caruzen" className="h-40 w-50 object-contain" />
          ) : (
            <div className="w-full flex justify-center">
              <div className="h-8 w-8 bg-slate-900 rounded flex items-center justify-center text-white font-bold text-sm">V</div>
            </div>
          )}

          {/* Mobile Close Button */}
          <Button variant="ghost" size="icon" className="md:hidden absolute right-2 top-4" onClick={() => setIsMobileOpen(false)}>
            <X size={20} />
          </Button>
        </div>

        {/* Toggle Button (Desktop Only) */}
        {!isMobileOpen && (
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "absolute -right-3 top-20 h-6 w-6 rounded-full border border-slate-200 bg-white p-0 shadow-sm hidden md:flex items-center justify-center hover:bg-slate-50",
              "text-slate-400 hover:text-slate-600"
            )}
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </Button>
        )}

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            if (!hasPermission(item.permissionId)) return null;

            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center space-x-3 px-3 py-2 rounded-md transition-colors group relative",
                  isActive ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                  isCollapsed && "justify-center px-2"
                )}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon size={20} className={cn("shrink-0", isActive && "text-slate-900")} />
                {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}

                {/* Tooltip for collapsed state */}
                {isCollapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                    {item.label}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          {!isCollapsed && (
            <div className="mb-4 px-2 text-xs text-slate-400 truncate">
              Logged in as: {userData?.role || 'Staff'}
            </div>
          )}
          <Button
            variant="ghost"
            className={cn(
              "w-full text-red-600 hover:text-red-700 hover:bg-red-50",
              isCollapsed ? "justify-center px-0" : "justify-start"
            )}
            onClick={logout}
            title={isCollapsed ? "Sign Out" : undefined}
          >
            <LogOut size={20} className={cn("shrink-0", !isCollapsed && "mr-2")} />
            {!isCollapsed && <span>Sign Out</span>}
          </Button>
        </div>
      </aside>
    </>
  );
};