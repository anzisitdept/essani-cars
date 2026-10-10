"use client";

import { useEffect, useState, useMemo } from "react";
import {
  collection, query, orderBy, limit, onSnapshot, Timestamp, getDocs, where
} from "firebase/firestore";
import {
  Car, CheckCircle2, AlertTriangle, TrendingUp, Activity, FileText,
  Printer, UserPlus, ArrowRight, Wallet, Banknote, Users, CreditCard,
  PieChart as PieChartIcon, BookOpen, ShoppingCart, Receipt, Package,
  Landmark, ClipboardList, BadgeCheck, BarChart3
} from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { StatsCard } from "@/components/shared/StatsCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend
} from "recharts";

// ─── Interfaces ────────────────────────────────────────────────────────────────
interface HistoryEntry {
  status: string;
  timestamp: string;
  type?: "MAIN" | "FILE" | "PLATE";
  action?: string;
  details?: string;
}

interface CarData {
  id: string;
  currentStatus: string;
  brandName: string;
  model: string;
  chassisNumber: string;
  fileStatus?: string;
  plateStatus?: string;
  createdAt?: Timestamp;
  history?: HistoryEntry[];
}

interface LogData {
  id: string;
  action: string;
  timestamp: Timestamp;
  details?: string;
}

interface AccountData {
  id: string;
  name: string;
  typeName: string;
  balance: number;
}

interface InventoryItem {
  id: string;
  brandName?: string;
  model?: string;
  isSold?: boolean;
  purchasePrice?: number;
  totalExpenses?: number;
  capitalizedCost?: number;
}

interface VoucherData {
  id: string;
  invoiceType?: string;
  amount?: number;
  date?: string;
  cashAccountId?: string;
  counterAccountId?: string;
  accountId?: string;
}

type MetricKey = "bank" | "cash" | "inventory" | "receivables" | "payables";

// ─── Colors ───────────────────────────────────────────────────────────────────
const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

const METRIC_CONFIG: Record<MetricKey, { label: string; color: string; ring: string; icon: any; gradient: string }> = {
  bank:        { label: "Bank Balance",    color: "from-blue-500 to-blue-700",    ring: "ring-blue-300",    icon: Wallet,     gradient: "#3b82f6" },
  cash:        { label: "Cash in Hand",    color: "from-emerald-500 to-emerald-700", ring: "ring-emerald-300", icon: Banknote,  gradient: "#10b981" },
  inventory:   { label: "Inventory Value", color: "from-indigo-500 to-indigo-700",  ring: "ring-indigo-300",  icon: Car,       gradient: "#8b5cf6" },
  receivables: { label: "Receivables",     color: "from-amber-500 to-amber-700",   ring: "ring-amber-300",   icon: CreditCard, gradient: "#f59e0b" },
  payables:    { label: "Payables",        color: "from-rose-500 to-rose-700",     ring: "ring-rose-300",    icon: Users,      gradient: "#ef4444" },
};

// ─── Quick Actions ─────────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { label: "New Registration",   href: "/dashboard/registry",          icon: UserPlus,      color: "bg-blue-50 text-blue-600 border-blue-100",    desc: "Register a new vehicle" },
  { label: "Sale Invoice",       href: "/dashboard/sale-invoice",      icon: Receipt,       color: "bg-green-50 text-green-600 border-green-100",  desc: "Create a sale invoice" },
  { label: "Purchase Invoice",   href: "/dashboard/purchase-invoice",  icon: ShoppingCart,  color: "bg-purple-50 text-purple-600 border-purple-100", desc: "Record a purchase" },
  { label: "Cash Voucher",       href: "/dashboard/cash-voucher",      icon: Banknote,      color: "bg-emerald-50 text-emerald-600 border-emerald-100", desc: "Issue a cash voucher" },
  { label: "General Voucher",    href: "/dashboard/general-voucher",   icon: BookOpen,      color: "bg-orange-50 text-orange-600 border-orange-100", desc: "General journal entry" },
  { label: "Clients",            href: "/dashboard/clients",           icon: Users,         color: "bg-rose-50 text-rose-600 border-rose-100",     desc: "Manage clients" },
  { label: "Purchase Inventory", href: "/dashboard/purchase-inventory",icon: Package,       color: "bg-amber-50 text-amber-600 border-amber-100",  desc: "View purchase stock" },
  { label: "General Ledger",     href: "/dashboard/general-ledger",    icon: BarChart3,     color: "bg-slate-50 text-slate-600 border-slate-100",  desc: "View ledger accounts" },
  { label: "Reports",            href: "/dashboard/reports",           icon: ClipboardList, color: "bg-sky-50 text-sky-600 border-sky-100",        desc: "Financial reports" },
];

// ─── Component ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth();

  const [cars, setCars]               = useState<CarData[]>([]);
  const [recentLogs, setRecentLogs]   = useState<LogData[]>([]);
  const [accounts, setAccounts]       = useState<AccountData[]>([]);
  const [inventory, setInventory]     = useState<InventoryItem[]>([]);
  const [inventoryValue, setInventoryValue] = useState(0);
  const [vouchers, setVouchers]       = useState<VoucherData[]>([]);
  const [activeMetric, setActiveMetric] = useState<MetricKey>("bank");
  const [loading, setLoading]         = useState(true);

  // ── Fetch ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const unsubs: (() => void)[] = [];

    unsubs.push(onSnapshot(query(collection(db, "cars")), snap => {
      setCars(snap.docs.map(d => ({ id: d.id, ...d.data() } as CarData)));
    }));

    unsubs.push(onSnapshot(query(collection(db, "logs"), orderBy("timestamp", "desc"), limit(10)), snap => {
      setRecentLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as LogData)));
    }));

    unsubs.push(onSnapshot(collection(db, "accounts"), snap => {
      setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() } as AccountData)));
    }));

    unsubs.push(onSnapshot(query(collection(db, "vouchers"), orderBy("date", "desc"), limit(500)), snap => {
      setVouchers(snap.docs.map(d => ({ id: d.id, ...d.data() } as VoucherData)));
    }));

    // Purchase inventory = cars collection where purchasePrice > 0 and !isSold
    // (matches exactly what PurchaseInventoryList does)
    getDocs(query(collection(db, "cars"), where("purchasePrice", ">", 0))).then(snap => {
      let total = 0;
      const list: InventoryItem[] = [];
      snap.docs.forEach(d => {
        const data = d.data();
        if (!data.isSold) {
          const p = Number(data.purchasePrice) || 0;
          const e = Number(data.totalExpenses) || 0;
          const capitalized = Number(data.capitalizedCost) || (p + e);
          total += capitalized;
          list.push({ id: d.id, ...data } as InventoryItem);
        }
      });
      setInventory(list);
      setInventoryValue(total);
      setLoading(false);
    }).catch(() => setLoading(false));

    return () => unsubs.forEach(u => u());
  }, [user]);

  // ── File-tracking Analytics ──────────────────────────────────────────────────
  const analytics = useMemo(() => {
    const now = new Date();

    const getHistoryDate = (car: CarData, matchFn: (h: HistoryEntry) => boolean) =>
      car.history?.slice().reverse().find(matchFn);

    const exciseOverdue = cars.filter(c => {
      if (c.fileStatus !== "At Excise") return false;
      const entry = getHistoryDate(c, h => (h.type === "FILE" && h.status === "At Excise") || (h.action === "Document Status Update" && !!h.details?.includes("to At Excise")));
      if (!entry) return false;
      return Math.ceil(Math.abs(now.getTime() - new Date(entry.timestamp).getTime()) / 86400000) > 15;
    }).map(c => {
      const entry = getHistoryDate(c, h => (h.type === "FILE" && h.status === "At Excise") || (h.action === "Document Status Update" && !!h.details?.includes("to At Excise")));
      return { ...c, days: Math.ceil(Math.abs(now.getTime() - new Date(entry!.timestamp).getTime()) / 86400000) };
    });

    const plateDelayed = cars.filter(c => {
      if (c.plateStatus !== "Plates Printing in Process") return false;
      const entry = getHistoryDate(c, h => (h.type === "PLATE" && h.status === "Plates Printing in Process") || (h.action === "Plate Status Update" && !!h.details?.includes("Printing")));
      if (!entry) return false;
      return Math.ceil(Math.abs(now.getTime() - new Date(entry.timestamp).getTime()) / 86400000) > 10;
    }).map(c => {
      const entry = getHistoryDate(c, h => (h.type === "PLATE" && h.status === "Plates Printing in Process") || (h.action === "Plate Status Update" && !!h.details?.includes("Printing")));
      return { ...c, days: Math.ceil(Math.abs(now.getTime() - new Date(entry!.timestamp).getTime()) / 86400000) };
    });

    return {
      total: cars.length,
      docsShowroom:   cars.filter(c => c.fileStatus === "Showroom").length,
      docsExcise:     cars.filter(c => c.fileStatus === "At Excise").length,
      docsDelivered:  cars.filter(c => c.fileStatus?.toLowerCase().includes("delivered")).length,
      platesShowroom: cars.filter(c => c.plateStatus === "Showroom").length,
      platesNotAvail: cars.filter(c => ["Not Issued from Excise", "At Party's Hand", "Never Applied"].includes(c.plateStatus || "")).length,
      platesDelivered:cars.filter(c => c.plateStatus?.toLowerCase().includes("delivered")).length,
      exciseOverdue, plateDelayed,
    };
  }, [cars]);

  // ── Financial Totals ──────────────────────────────────────────────────────────
  const finTotals = useMemo(() => {
    let bank = 0, cash = 0, receivables = 0, payables = 0;
    accounts.forEach(a => {
      const t = (a.typeName || "").toLowerCase();
      const n = (a.name || "").toLowerCase();
      const b = a.balance || 0;
      // Bank: typeName exactly 'bank'
      if (t === "bank") bank += b;
      // Cash: typeName OR name contains 'cash' (same logic as CashVoucherManager)
      else if (t.includes("cash") || n.includes("cash")) cash += b;
      // Receivables/Payables: Customer or Client accounts
      else if (t === "customer" || t === "client") {
        if (b > 0) receivables += b;
        else if (b < 0) payables += Math.abs(b);
      }
    });
    return { bank, cash, receivables, payables };
  }, [accounts]);

  // ── Dynamic Chart Data per Selected Card ──────────────────────────────────────
  const chartData = useMemo(() => {
    const trendMap: Record<string, { name: string; amount: number }> = {};

    const addToTrend = (date: string | undefined, amount: number) => {
      if (!date) return;
      const d = new Date(date);
      if (isNaN(d.getTime())) return;
      const key = d.toLocaleString("default", { month: "short", year: "2-digit" });
      if (!trendMap[key]) trendMap[key] = { name: key, amount: 0 };
      trendMap[key].amount += amount;
    };

    let pieData: { name: string; value: number }[] = [];

    if (activeMetric === "bank") {
      const bankAccs = accounts.filter(a => (a.typeName || "").toLowerCase() === "bank");
      pieData = bankAccs.filter(a => a.balance > 0).map(a => ({ name: a.name, value: a.balance }));
      const bankIds = new Set(bankAccs.map(a => a.id));
      vouchers.forEach(v => {
        const involved = (v.cashAccountId && bankIds.has(v.cashAccountId)) ||
                         (v.counterAccountId && bankIds.has(v.counterAccountId)) ||
                         (v.accountId && bankIds.has(v.accountId));
        if (involved) addToTrend(v.date, v.amount || 0);
      });
    } else if (activeMetric === "cash") {
      const cashAccs = accounts.filter(a => (a.typeName || "").toLowerCase() === "cash");
      pieData = cashAccs.filter(a => a.balance > 0).map(a => ({ name: a.name, value: a.balance }));
      const cashIds = new Set(cashAccs.map(a => a.id));
      vouchers.forEach(v => {
        const involved = (v.cashAccountId && cashIds.has(v.cashAccountId)) ||
                         (v.counterAccountId && cashIds.has(v.counterAccountId)) ||
                         (v.accountId && cashIds.has(v.accountId));
        if (involved) addToTrend(v.date, v.amount || 0);
      });
    } else if (activeMetric === "inventory") {
      const sorted = [...inventory].sort((a, b) => {
        const valA = Number(a.capitalizedCost) || ((Number(a.purchasePrice) || 0) + (Number(a.totalExpenses) || 0));
        const valB = Number(b.capitalizedCost) || ((Number(b.purchasePrice) || 0) + (Number(b.totalExpenses) || 0));
        return valB - valA;
      });
      pieData = sorted.slice(0, 7).map(i => ({
        name: (`${(i as any).brandName || ""} ${(i as any).model || ""}`).trim() || "Vehicle",
        value: Number(i.capitalizedCost) || ((Number(i.purchasePrice) || 0) + (Number(i.totalExpenses) || 0)),
      })).filter(p => p.value > 0);
      vouchers.forEach(v => { if (v.invoiceType === "PURCHASE") addToTrend(v.date, v.amount || 0); });
    } else if (activeMetric === "receivables") {
      const recAccs = accounts.filter(a => {
        const t = (a.typeName || "").toLowerCase();
        return (t === "customer" || t === "client") && a.balance > 0;
      });
      pieData = recAccs.sort((a, b) => b.balance - a.balance).slice(0, 7).map(a => ({ name: a.name, value: a.balance }));
      vouchers.forEach(v => { if (v.invoiceType === "SALE") addToTrend(v.date, v.amount || 0); });
    } else if (activeMetric === "payables") {
      const payAccs = accounts.filter(a => {
        const t = (a.typeName || "").toLowerCase();
        return (t === "client" || t === "customer") && a.balance < 0;
      });
      pieData = payAccs.sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance)).slice(0, 7).map(a => ({ name: a.name, value: Math.abs(a.balance) }));
      vouchers.forEach(v => { if (v.invoiceType === "PURCHASE") addToTrend(v.date, v.amount || 0); });
    }

    // Build ordered trend array (ascending by date approximation via insertion order reversed)
    const trendArray = Object.values(trendMap).reverse();

    return { pieData, trendArray };
  }, [activeMetric, accounts, inventory, vouchers]);

  // ── File Trend ────────────────────────────────────────────────────────────────
  const fileTrendData = useMemo(() => {
    const data: Record<string, number> = {};
    [...cars].sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)).forEach(c => {
      if (c.createdAt) {
        const key = c.createdAt.toDate().toLocaleString("default", { month: "short" });
        data[key] = (data[key] || 0) + 1;
      }
    });
    return Object.entries(data).map(([name, vehicles]) => ({ name, vehicles }));
  }, [cars]);

  // ─── Formatters ───────────────────────────────────────────────────────────────
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(n);

  const fmtShort = (val: number) =>
    val >= 1_000_000 ? `Rs ${(val / 1_000_000).toFixed(1)}M` : `Rs ${val.toLocaleString()}`;

  // ─── Metric values map ────────────────────────────────────────────────────────
  const metricValues: Record<MetricKey, number> = {
    bank: finTotals.bank,
    cash: finTotals.cash,
    inventory: inventoryValue,
    receivables: finTotals.receivables,
    payables: finTotals.payables,
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center flex-col gap-4">
        <Activity className="h-12 w-12 animate-pulse text-slate-300" />
        <p className="text-slate-500 font-medium">Loading Dashboard...</p>
      </div>
    );
  }

  // ─── Chart titles ──────────────────────────────────────────────────────────────
  const pieTitle: Record<MetricKey, string> = {
    bank:        "Bank Accounts",
    cash:        "Cash Accounts",
    inventory:   "Top Vehicles by Value",
    receivables: "Top Clients Owing Us",
    payables:    "Top Clients We Owe",
  };
  const lineTitle: Record<MetricKey, string> = {
    bank:        "Bank Activity Over Time",
    cash:        "Cash Activity Over Time",
    inventory:   "Purchase Invoices Over Time",
    receivables: "Sales Invoices Over Time",
    payables:    "Purchase Invoices Over Time",
  };

  return (
    <div className="space-y-10 pb-12 animate-in fade-in duration-500">

      {/* ═══════════════════════════════════════════════════════════════
          FINANCIAL OVERVIEW
      ═══════════════════════════════════════════════════════════════ */}
      <section className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Dashboard</h1>
            <p className="text-slate-500 mt-1 font-medium">Click any card to explore its breakdown &amp; trends</p>
          </div>
          <Link href="/dashboard/registry">
            <Button className="bg-slate-900 hover:bg-slate-800 gap-2 h-11 px-6 text-sm font-semibold shadow-md">
              <UserPlus size={18} /> New Registration
            </Button>
          </Link>
        </div>

        {/* ── 5 Metric Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {(Object.keys(METRIC_CONFIG) as MetricKey[]).map(key => {
            const cfg = METRIC_CONFIG[key];
            const Icon = cfg.icon;
            const isActive = activeMetric === key;
            return (
              <Card
                key={key}
                onClick={() => setActiveMetric(key)}
                className={`border-0 bg-gradient-to-br ${cfg.color} text-white overflow-hidden relative cursor-pointer
                  transition-all duration-300 hover:-translate-y-1 hover:shadow-xl
                  ${isActive ? `ring-4 ${cfg.ring} ring-offset-2 scale-[1.03] shadow-xl` : "opacity-85 hover:opacity-100"}`}
              >
                <div className="absolute -right-5 -top-5 opacity-[0.12]">
                  <Icon size={90} />
                </div>
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 text-white/70 mb-2">
                    <Icon size={15} />
                    <span className="text-xs font-semibold uppercase tracking-widest">{cfg.label}</span>
                  </div>
                  <p className="text-xl font-extrabold leading-tight">{fmt(metricValues[key])}</p>
                  {isActive && (
                    <div className="mt-2 text-[10px] font-medium text-white/60 flex items-center gap-1">
                      <PieChartIcon size={10} /> Showing breakdown below
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* ── Dynamic Charts ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Pie */}
          <Card className="shadow-sm border-slate-100">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-700">
                <PieChartIcon size={16} className="text-slate-400" />
                {pieTitle[activeMetric]}
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[260px]">
              {chartData.pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData.pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="45%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {chartData.pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                  <PieChartIcon size={32} className="opacity-30" />
                  <p className="text-sm">No breakdown data available</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Area/Line chart */}
          <Card className="shadow-sm border-slate-100 lg:col-span-2">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-700">
                <TrendingUp size={16} className="text-slate-400" />
                {lineTitle[activeMetric]}
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[260px]">
              {chartData.trendArray.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData.trendArray} margin={{ top: 10, right: 10, left: 30, bottom: 0 }}>
                    <defs>
                      <linearGradient id="metricGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={METRIC_CONFIG[activeMetric].gradient} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={METRIC_CONFIG[activeMetric].gradient} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={fmtShort} width={70} />
                    <RechartsTooltip
                      cursor={{ stroke: "#cbd5e1", strokeWidth: 1, strokeDasharray: "4 4" }}
                      contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                      formatter={(v: number) => [fmt(v), "Amount"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      name="Amount"
                      stroke={METRIC_CONFIG[activeMetric].gradient}
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#metricGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                  <TrendingUp size={32} className="opacity-30" />
                  <p className="text-sm">No activity data found for this metric</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Quick Actions ── */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-3">
            {QUICK_ACTIONS.map(action => {
              const Icon = action.icon;
              return (
                <Link key={action.href} href={action.href}>
                  <Card className={`border ${action.color} hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer`}>
                    <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${action.color}`}>
                        <Icon size={18} />
                      </div>
                      <span className="text-xs font-semibold leading-tight text-slate-700">{action.label}</span>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>

      </section>

      {/* ═══════════════════════════════════════════════════════════════
          DIVIDER
      ═══════════════════════════════════════════════════════════════ */}
      <div className="border-t border-slate-200" />

      {/* ═══════════════════════════════════════════════════════════════
          FILE TRACKING DASHBOARD
      ═══════════════════════════════════════════════════════════════ */}
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">File tracking Dashboard</h2>
          <p className="text-slate-500 mt-0.5 text-sm">Operational Command Center &amp; Activity Feed</p>
        </div>

        {/* Row 1: Alerts + Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className={`md:col-span-2 shadow-sm border-2 ${analytics.exciseOverdue.length > 0 || analytics.plateDelayed.length > 0 ? "border-red-100 bg-red-50/20" : "border-slate-100"}`}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <AlertTriangle className={analytics.exciseOverdue.length > 0 ? "text-red-500 animate-pulse" : "text-green-500"} size={20} />
                  Critical Alerts
                </CardTitle>
                <div className="flex gap-2 flex-wrap">
                  {analytics.exciseOverdue.length > 0 && <Badge variant="destructive">{analytics.exciseOverdue.length} Excise Overdue</Badge>}
                  {analytics.plateDelayed.length > 0 && <Badge variant="destructive" className="bg-orange-500">{analytics.plateDelayed.length} Plate Delayed</Badge>}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {analytics.exciseOverdue.length === 0 && analytics.plateDelayed.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-slate-400">
                  <CheckCircle2 size={32} className="text-green-500 mb-2" />
                  <p className="text-sm font-medium">All Operations Running Smoothly</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                  {analytics.exciseOverdue.map(car => (
                    <div key={car.id} className="flex items-center justify-between p-2.5 bg-white border border-red-100 rounded-lg">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-xs shrink-0">{car.days}D</div>
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-slate-800 max-sm:truncate">{car.brandName} {car.model}</div>
                          <div className="text-xs text-slate-500 font-mono max-sm:truncate">{car.chassisNumber}</div>
                        </div>
                      </div>
                      <Link href={`/dashboard/inventory?search=${car.chassisNumber}`} className="shrink-0">
                        <Button size="sm" variant="outline" className="h-7 text-xs">View</Button>
                      </Link>
                    </div>
                  ))}
                  {analytics.plateDelayed.map(car => (
                    <div key={car.id} className="flex items-center justify-between p-2.5 bg-white border border-orange-100 rounded-lg">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-xs shrink-0">{car.days}D</div>
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-slate-800 max-sm:truncate">{car.brandName} {car.model}</div>
                          <div className="text-xs text-slate-500 font-mono max-sm:truncate">{car.chassisNumber}</div>
                        </div>
                      </div>
                      <Link href={`/dashboard/inventory?search=${car.chassisNumber}`} className="shrink-0">
                        <Button size="sm" variant="outline" className="h-7 text-xs">View</Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <StatsCard title="Total Fleet Volume"       value={analytics.total}        icon={Car}           colorClass="bg-slate-900 text-white border-slate-700" />
            <StatsCard title="Completed Registrations" value={analytics.docsDelivered} icon={CheckCircle2}  colorClass="bg-green-50 text-green-600 border-green-100" />
          </div>
        </div>

        {/* Row 2: Pipelines */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Document Pipeline */}
          <Card className="shadow-sm border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-wider flex items-center gap-2">
                <FileText size={15} className="text-blue-500" /> Document Workflow
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 pt-3">
              <div className="flex items-center justify-between relative flex-wrap gap-x-2 gap-y-2">
                <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 -z-10 -translate-y-1/2 rounded-full" />
                {[
                  { label: "Showroom", value: analytics.docsShowroom, cls: "bg-blue-100 text-blue-700" },
                  { label: "At Excise", value: analytics.docsExcise, cls: "bg-orange-100 text-orange-700" },
                  { label: "Delivered", value: analytics.docsDelivered, cls: "bg-green-100 text-green-700" },
                ].map((s, i, arr) => (
                  <>
                    <div key={s.label} className="flex flex-col items-center gap-1.5 bg-white px-2">
                      <div className={`w-11 h-11 rounded-xl ${s.cls} flex items-center justify-center shadow-sm font-bold text-base`}>{s.value}</div>
                      <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">{s.label}</span>
                    </div>
                    {i < arr.length - 1 && <ArrowRight size={16} className="text-slate-300 shrink-0" key={`arr-${i}`} />}
                  </>
                ))}
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg flex flex-wrap justify-between items-center gap-2 text-xs">
                <span className="text-slate-500"><b className="text-slate-800">{analytics.docsShowroom}</b> files ready for Excise</span>
                <Link href="/dashboard/inventory" className="ml-auto"><Button size="sm" variant="ghost" className="h-6 text-blue-600 p-0 text-xs">Manage Files</Button></Link>
              </div>
            </CardContent>
          </Card>

          {/* Plate Pipeline */}
          <Card className="shadow-sm border-l-4 border-l-purple-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-wider flex items-center gap-2">
                <Printer size={15} className="text-purple-500" /> Number Plate Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 pt-3">
              <div className="flex items-center justify-between relative flex-wrap gap-x-2 gap-y-2">
                <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 -z-10 -translate-y-1/2 rounded-full" />
                {[
                  { label: "Showroom",      value: analytics.platesShowroom, cls: "bg-blue-100 text-blue-700" },
                  { label: "Not Available", value: analytics.platesNotAvail,  cls: "bg-slate-100 text-slate-600" },
                  { label: "Delivered",     value: analytics.platesDelivered, cls: "bg-green-100 text-green-700" },
                ].map((s, i, arr) => (
                  <>
                    <div key={s.label} className="flex flex-col items-center gap-1.5 bg-white px-2">
                      <div className={`w-11 h-11 rounded-xl ${s.cls} flex items-center justify-center shadow-sm font-bold text-base`}>{s.value}</div>
                      <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">{s.label}</span>
                    </div>
                    {i < arr.length - 1 && <ArrowRight size={16} className="text-slate-300 shrink-0" key={`arr-${i}`} />}
                  </>
                ))}
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg flex flex-wrap justify-between items-center gap-2 text-xs">
                <span className="text-slate-500"><b className="text-slate-800">{analytics.platesShowroom}</b> plates ready to deliver</span>
                <Link href="/dashboard/delivery" className="ml-auto"><Button size="sm" variant="ghost" className="h-6 text-purple-600 p-0 text-xs">Go to Delivery</Button></Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Row 3: Volume Chart + Live Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle className="text-base font-bold">Volume Trends</CardTitle>
              <CardDescription>Monthly registration intake</CardDescription>
            </CardHeader>
            <CardContent className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={fileTrendData}>
                  <defs>
                    <linearGradient id="fileGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#94a3b8" }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#94a3b8" }} />
                  <RechartsTooltip contentStyle={{ borderRadius: 8, border: "none" }} />
                  <Area type="monotone" dataKey="vehicles" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#fileGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200 flex flex-col">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Activity size={17} className="text-slate-400" /> Live Feed
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto max-h-[280px] pr-1">
              <div className="space-y-4 relative">
                <div className="absolute left-2.5 top-2 bottom-4 w-px bg-slate-100" />
                {recentLogs.map(log => (
                  <div key={log.id} className="relative pl-8">
                    <div className={`absolute left-0 top-1.5 w-5 h-5 rounded-full border-4 border-white z-10 ${log.action.includes("Registered") ? "bg-blue-500" : log.action.includes("Status") ? "bg-orange-500" : log.action.includes("Delivery") ? "bg-green-500" : "bg-slate-400"}`} />
                    <p className="text-sm font-semibold text-slate-800 line-clamp-1">{log.action}</p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{log.details}</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {log.timestamp?.seconds ? new Date(log.timestamp.seconds * 1000).toLocaleString() : "Just now"}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

      </section>
    </div>
  );
}