"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, query, orderBy, limit, onSnapshot, Timestamp } from "firebase/firestore";
import {
  Car, Clock, CheckCircle2, AlertTriangle,
  TrendingUp, Activity, Gauge, ArrowUpRight,
  CalendarDays, FileWarning, BarChart3, FileText,
  Printer, Truck, UserPlus, Package, ArrowRight
} from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { StatsCard } from "@/components/shared/StatsCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend
} from 'recharts';

// --- Interfaces ---
interface HistoryEntry {
  status: string;
  timestamp: string;
  type?: 'MAIN' | 'FILE' | 'PLATE';
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
  registrationNumber?: string;
}

interface LogData {
  id: string;
  action: string;
  timestamp: Timestamp;
  type?: string;
  details?: string;
  performedBy?: string;
}

// --- Colors ---
const COLORS = {
  primary: '#0f172a',
  secondary: '#64748b',
  accent: '#3b82f6',
  danger: '#ef4444',
  warning: '#f59e0b',
  success: '#10b981',
};

const CHART_COLORS = ['#0f172a', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

export default function DashboardPage() {
  const { user } = useAuth();
  const [cars, setCars] = useState<CarData[]>([]);
  const [recentLogs, setRecentLogs] = useState<LogData[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Fetch Data
  useEffect(() => {
    if (!user) return;

    // Real-time Cars
    const unsubCars = onSnapshot(query(collection(db, 'cars')), (snapshot) => {
      setCars(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CarData)));
      setLoading(false);
    });

    // Real-time Logs (Last 10)
    const unsubLogs = onSnapshot(query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(10)), (snapshot) => {
      setRecentLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LogData)));
    });

    return () => { unsubCars(); unsubLogs(); };
  }, [user]);

  // 2. Computed Analytics & Alerts
  const analytics = useMemo(() => {
    const total = cars.length;
    const now = new Date();

    // --- Workflow Counters ---
    const docsShowroom = cars.filter(c => c.fileStatus === 'Showroom').length;
    const docsExcise = cars.filter(c => c.fileStatus === 'At Excise').length;
    const docsDelivered = cars.filter(c => c.fileStatus?.toLowerCase().includes('delivered')).length;

    const platesShowroom = cars.filter(c => c.plateStatus === 'Showroom').length;
    const platesNotAvailable = cars.filter(c =>
      c.plateStatus === 'Not Issued from Excise' ||
      c.plateStatus === 'At Party\'s Hand' ||
      c.plateStatus === 'Never Applied'
    ).length;
    const platesDelivered = cars.filter(c => c.plateStatus?.toLowerCase().includes('delivered')).length;

    // --- Critical Alerts Logic ---

    // 1. Excise Overdue (> 15 Days)
    // const exciseOverdue = cars.filter(c => {
    //   if (c.fileStatus !== 'At Excise') return false;
    //   const entry = c.history?.slice().reverse().find(h =>
    //     (h.type === 'FILE' && h.status === 'At Excise') ||
    //     (h.action === 'Document Status Update' && h.details?.includes('to At Excise'))
    //   );
    //   if (!entry) return false;
    //   const days = Math.ceil(Math.abs(now.getTime() - new Date(entry.timestamp).getTime()) / (86400000));
    //   return days > 15;
    // }).map(c => {
    //   const entry = c.history?.slice().reverse().find(h => (h.type === 'FILE' && h.status === 'At Excise') || (h.action === 'Document Status Update' && h.details?.includes('to At Excise')));
    //   return { ...c, days: Math.ceil(Math.abs(now.getTime() - new Date(entry!.timestamp).getTime()) / (86400000)) };
    // });

    const exciseOverdue = cars.filter(c => {
      if (c.fileStatus !== 'At Excise') return false;
      const entry = c.history?.slice().reverse().find(h =>
        (h.type === 'FILE' && h.status === 'At Excise') ||
        (h.action === 'Document Status Update' && h.details?.includes('to At Excise'))
      );
      if (!entry) return false;
      const minutes = Math.ceil(Math.abs(now.getTime() - new Date(entry.timestamp).getTime()) / (60000));
      return minutes > 2;
    }).map(c => {
      const entry = c.history?.slice().reverse().find(h =>
        (h.type === 'FILE' && h.status === 'At Excise') ||
        (h.action === 'Document Status Update' && h.details?.includes('to At Excise'))
      );
      return {
        ...c,
        minutes: Math.ceil(Math.abs(now.getTime() - new Date(entry!.timestamp).getTime()) / (60000))
      };
    });


    // 2. Plate Printing Delayed (> 10 Days)
    const plateDelayed = cars.filter(c => {
      if (c.plateStatus !== 'Plates Printing in Process') return false;
      const entry = c.history?.slice().reverse().find(h =>
        (h.type === 'PLATE' && h.status === 'Plates Printing in Process') ||
        (h.action === 'Plate Status Update' && h.details?.includes('Printing'))
      );
      if (!entry) return false;
      const days = Math.ceil(Math.abs(now.getTime() - new Date(entry.timestamp).getTime()) / (86400000));
      return days > 10;
    }).map(c => {
      const entry = c.history?.slice().reverse().find(h => (h.type === 'PLATE' && h.status === 'Plates Printing in Process') || (h.action === 'Plate Status Update' && h.details?.includes('Printing')));
      return { ...c, days: Math.ceil(Math.abs(now.getTime() - new Date(entry!.timestamp).getTime()) / (86400000)) };
    });

    return {
      total, docsShowroom, docsExcise, docsDelivered,
      platesShowroom, platesNotAvailable, platesDelivered,
      exciseOverdue, plateDelayed
    };
  }, [cars]);


  // Chart Data: Monthly Trends
  const trendData = useMemo(() => {
    const data: Record<string, number> = {};
    const sorted = [...cars].sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
    sorted.forEach(c => {
      if (c.createdAt) {
        const key = c.createdAt.toDate().toLocaleString('default', { month: 'short' });
        data[key] = (data[key] || 0) + 1;
      }
    });
    return Object.keys(data).map(name => ({ name, vehicles: data[name] }));
  }, [cars]);


  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center flex-col gap-4">
        <Activity className="h-12 w-12 animate-pulse text-slate-300" />
        <p className="text-slate-500 font-medium">Loading Command Center...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-6 border-b border-slate-100 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1 font-medium">Operational Command Center & Activity Feed</p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/registry">
            <Button className="bg-slate-900 shadow-xl shadow-slate-200 hover:bg-slate-800 gap-2 h-11 px-6 text-sm font-semibold">
              <UserPlus size={18} /> New Registration
            </Button>
          </Link>
        </div>
      </div>

      {/* --- ROW 1: Critical Alerts & High Level KPIs --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Critical Alerts Panel */}
        <Card className={`md:col-span-2 shadow-sm border-2 ${analytics.exciseOverdue.length > 0 || analytics.plateDelayed.length > 0 ? 'border-red-100 bg-red-50/10' : 'border-slate-100'}`}>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <AlertTriangle className={analytics.exciseOverdue.length > 0 ? "text-red-500 animate-pulse" : "text-green-500"} size={20} />
                Critical Alerts System
              </CardTitle>
              <div className="flex gap-2">
                {analytics.exciseOverdue.length > 0 && <Badge variant="destructive">{analytics.exciseOverdue.length} Excise Overdue</Badge>}
                {analytics.plateDelayed.length > 0 && <Badge variant="destructive" className="bg-orange-500">{analytics.plateDelayed.length} Plate Delayed</Badge>}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {analytics.exciseOverdue.length === 0 && analytics.plateDelayed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-slate-400">
                <CheckCircle2 size={32} className="text-green-500 mb-2 opacity-80" />
                <p className="text-sm font-medium">All Operations Running Smoothly</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2">
                {/* Excise Alerts */}
                {analytics.exciseOverdue.map(car => (
                  <div key={car.id} className="flex items-center justify-between p-3 bg-white border border-red-100 rounded-lg shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-xs">{car.minutes}D</div>
                      <div>
                        <div className="font-bold text-sm text-slate-800 flex items-center gap-2">
                          {car.brandName} {car.model}
                          <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-red-200 text-red-600">Excise</Badge>
                        </div>
                        <div className="text-xs text-slate-500 font-mono">{car.chassisNumber}</div>
                      </div>
                    </div>
                    <Link href="/dashboard/inventory"><Button size="sm" variant="outline" className="h-7 text-xs">View</Button></Link>
                  </div>
                ))}
                {/* Plate Alerts */}
                {analytics.plateDelayed.map(car => (
                  <div key={car.id} className="flex items-center justify-between p-3 bg-white border border-orange-100 rounded-lg shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-xs">{car.days}D</div>
                      <div>
                        <div className="font-bold text-sm text-slate-800 flex items-center gap-2">
                          {car.brandName} {car.model}
                          <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-orange-200 text-orange-600">Plate Printing</Badge>
                        </div>
                        <div className="text-xs text-slate-500 font-mono">{car.chassisNumber}</div>
                      </div>
                    </div>
                    <Link href="/dashboard/inventory"><Button size="sm" variant="outline" className="h-7 text-xs">View</Button></Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Global Stats */}
        <div className="space-y-4">
          <StatsCard title="Total Fleet Volume" value={analytics.total} icon={Car} colorClass="bg-slate-900 text-white border-slate-700" />
          <StatsCard title="Completed Registrations" value={analytics.docsDelivered} icon={CheckCircle2} colorClass="bg-green-50 text-green-600 border-green-100" />
        </div>
      </div>

      {/* --- ROW 2: Operational Pipelines --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Document Pipeline */}
        <Card className="shadow-sm border-blue-100 border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-wider flex items-center gap-2">
              <FileText size={16} className="text-blue-500" /> Document Workflow
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            <div className="flex items-center justify-between relative">
              {/* Connector Line */}
              <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 -z-10 -translate-y-1/2 rounded-full"></div>

              <div className="flex flex-col items-center gap-2 bg-white px-2">
                <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-sm">
                  <span className="font-bold text-lg">{analytics.docsShowroom}</span>
                </div>
                <span className="text-xs font-bold text-slate-600">Showroom</span>
              </div>
              <ArrowRight size={20} className="text-slate-300" />
              <div className="flex flex-col items-center gap-2 bg-white px-2">
                <div className="w-12 h-12 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shadow-sm">
                  <span className="font-bold text-lg">{analytics.docsExcise}</span>
                </div>
                <span className="text-xs font-bold text-slate-600">At Excise</span>
              </div>
              <ArrowRight size={20} className="text-slate-300" />
              <div className="flex flex-col items-center gap-2 bg-white px-2">
                <div className="w-12 h-12 rounded-xl bg-green-100 text-green-600 flex items-center justify-center shadow-sm">
                  <span className="font-bold text-lg">{analytics.docsDelivered}</span>
                </div>
                <span className="text-xs font-bold text-slate-600">Delivered</span>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg flex justify-between items-center text-xs">
              <span className="text-slate-500">Pending Actions: <b className="text-slate-900">{analytics.docsShowroom}</b> files ready for Excise.</span>
              <Link href="/dashboard/inventory"><Button size="sm" variant="ghost" className="h-6 text-blue-600 hover:text-blue-700 p-0">Manage Files</Button></Link>
            </div>
          </CardContent>
        </Card>

        {/* Plate Pipeline */}
        <Card className="shadow-sm border-purple-100 border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-wider flex items-center gap-2">
              <Printer size={16} className="text-purple-500" /> Number Plate Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            <div className="flex items-center justify-between relative">
              {/* Connector Line */}
              <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 -z-10 -translate-y-1/2 rounded-full"></div>

              <div className="flex flex-col items-center gap-2 bg-white px-2">
                <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-sm">
                  <span className="font-bold text-lg">{analytics.platesShowroom}</span>
                </div>
                <span className="text-xs font-bold text-slate-600">Showroom</span>
              </div>
              <ArrowRight size={20} className="text-slate-300" />
              <div className="flex flex-col items-center gap-2 bg-white px-2">
                <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shadow-sm">
                  <span className="font-bold text-lg">{analytics.platesNotAvailable}</span>
                </div>
                <span className="text-xs font-bold text-slate-600">Not Available</span>
              </div>
              <ArrowRight size={20} className="text-slate-300" />
              <div className="flex flex-col items-center gap-2 bg-white px-2">
                <div className="w-12 h-12 rounded-xl bg-green-100 text-green-600 flex items-center justify-center shadow-sm">
                  <span className="font-bold text-lg">{analytics.platesDelivered}</span>
                </div>
                <span className="text-xs font-bold text-slate-600">Delivered</span>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg flex justify-between items-center text-xs">
              <span className="text-slate-500">Action: <b className="text-slate-900">{analytics.platesShowroom}</b> plates in showroom ready to deliver.</span>
              <Link href="/dashboard/delivery"><Button size="sm" variant="ghost" className="h-6 text-purple-600 hover:text-purple-700 p-0">Go to Delivery</Button></Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* --- ROW 3: Monthly Chart & Activity Feed --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Monthly Registration Area Chart */}
        <Card className="lg:col-span-2 shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-base font-bold">Volume Trends</CardTitle>
            <CardDescription>Monthly registration intake</CardDescription>
          </CardHeader>
          <CardContent className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none' }} />
                <Area type="monotone" dataKey="vehicles" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Unified Activity Stream */}
        <Card className="shadow-sm border-slate-200 flex flex-col">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Activity size={18} className="text-slate-400" /> Live Feed
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto max-h-[300px] pr-2">
            <div className="space-y-4 relative">
              <div className="absolute left-2.5 top-2 bottom-4 w-px bg-slate-100"></div>
              {recentLogs.map((log) => (
                <div key={log.id} className="relative pl-8">
                  <div className={`absolute left-0 top-1.5 w-5 h-5 rounded-full border-4 border-white flex items-center justify-center z-10 ${log.action.includes('Registered') ? 'bg-blue-500' :
                    log.action.includes('Status') ? 'bg-orange-500' :
                      log.action.includes('Delivery') ? 'bg-green-500' : 'bg-slate-400'
                    }`}></div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 line-clamp-1">{log.action}</p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{log.details}</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {log.timestamp?.seconds ? new Date(log.timestamp.seconds * 1000).toLocaleString() : 'Just now'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}