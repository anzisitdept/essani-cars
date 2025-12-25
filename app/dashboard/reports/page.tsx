"use client";

import { useState, useEffect, useMemo } from "react";
import { collection, query, where, getDocs, Timestamp, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { StatsCard } from "@/components/shared/StatsCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area, LineChart, Line, RadialBarChart, RadialBar, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import {
  FileText, TrendingUp, Users, CarFront, Download,
  AlertTriangle, CheckCircle2, Fuel, LayoutDashboard, Database, Activity, ShieldAlert,
  Printer, Truck, Calendar, DollarSign
} from "lucide-react";

// --- Types ---
interface CarData {
  id: string;
  brandName: string;
  model: string;
  year: number;
  color: string;
  fuelType: string;
  transmission: string;
  currentStatus: string;
  chassisNumber: string;
  createdAt: Timestamp;
  ownerName?: string;
  fileStatus?: string;
  plateStatus?: string;
  registrationNumber?: string;
  cplcCounter?: string;
  engineNumber?: string;
  platesApplied?: boolean;
}

interface LogData {
  id: string;
  action: string;
  performedBy: string;
  timestamp: Timestamp;
  type: string;
  relatedCarId?: string;
  details?: string;
}

interface UserData {
  id: string;
  name: string;
  role: string;
}

// --- Colors & Themes ---
const COLORS = {
  primary: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6',
  slate: '#64748b',
  cyan: '#06b6d4',
  pink: '#ec4899'
};

const CHART_COLORS = [COLORS.primary, COLORS.success, COLORS.warning, COLORS.purple, COLORS.cyan, COLORS.pink, COLORS.danger];

export default function ReportsPage() {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'inventory' | 'operations' | 'team'>('overview');

  // Date Filters
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0], // Start of current year
    end: new Date().toISOString().split('T')[0] // Today
  });

  // Data State
  const [cars, setCars] = useState<CarData[]>([]);
  const [logs, setLogs] = useState<LogData[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);

  // 1. Fetch Data
  useEffect(() => {
    const hasPermission = userData?.role === 'admin' || userData?.permissions?.includes('reports') || userData?.permissions?.includes('ALL');
    if (!userData || !hasPermission) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const startTimestamp = Timestamp.fromDate(new Date(dateRange.start));
        const endTimestamp = Timestamp.fromDate(new Date(new Date(dateRange.end).setHours(23, 59, 59)));

        // Fetch Cars (Created in range)
        const carsQ = query(
          collection(db, "cars"),
          where("createdAt", ">=", startTimestamp),
          where("createdAt", "<=", endTimestamp),
          orderBy("createdAt", "desc")
        );

        // Fetch Logs (Activity in range)
        const logsQ = query(
          collection(db, "logs"),
          where("timestamp", ">=", startTimestamp),
          where("timestamp", "<=", endTimestamp)
        );

        // Fetch Users
        const usersQ = query(collection(db, "users"));

        const [carsSnap, logsSnap, usersSnap] = await Promise.all([
          getDocs(carsQ),
          getDocs(logsQ),
          getDocs(usersQ)
        ]);

        setCars(carsSnap.docs.map(d => ({ id: d.id, ...d.data() } as CarData)));
        setLogs(logsSnap.docs.map(d => ({ id: d.id, ...d.data() } as LogData)));
        setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as UserData)));

      } catch (error) {
        console.error("Error fetching report data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateRange, userData]);

  // --- Derived Metrics ---

  const kpiStats = useMemo(() => {
    const totalStock = cars.length;
    const delivered = cars.filter(c => c.currentStatus === 'DELIVERED').length;
    const processing = cars.filter(c => !['DELIVERED', 'SHOWROOM'].includes(c.currentStatus)).length; // Transit/Excise

    // Efficiency: Avg days to deliver (approx from logs if possible, else simplified)
    // Here simplifying to: Deliveries this month
    const currentMonth = new Date().getMonth();
    const deliveriesThisMonth = cars.filter(c =>
      c.currentStatus === 'DELIVERED' &&
      c.createdAt.toDate().getMonth() === currentMonth
    ).length;

    return { totalStock, delivered, processing, deliveriesThisMonth };
  }, [cars]);

  // Inventory Intelligence
  const brandDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    cars.forEach(c => { counts[c.brandName] = (counts[c.brandName] || 0) + 1; });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [cars]);

  const agingAnalysis = useMemo(() => {
    const today = new Date().getTime();
    return cars
      .filter(c => c.currentStatus === 'SHOWROOM')
      .map(c => ({
        ...c,
        age: Math.floor((today - c.createdAt.toDate().getTime()) / (1000 * 60 * 60 * 24))
      }))
      .sort((a, b) => b.age - a.age)
      .slice(0, 8);
  }, [cars]);

  // Operational Efficiency
  const operationFunnel = useMemo(() => {
    const platesPrinting = cars.filter(c => c.plateStatus === 'Plates Printing in Process').length;
    const platesReady = cars.filter(c => c.plateStatus === 'Ready for Collection').length;
    const platesCollected = cars.filter(c => c.plateStatus === 'Collected by Showroom').length;
    const platesDelivered = cars.filter(c => c.plateStatus?.toLowerCase().includes('delivered')).length;

    return [
      { name: 'Printing', value: platesPrinting, fill: COLORS.warning },
      { name: 'Ready', value: platesReady, fill: COLORS.primary },
      { name: 'Collected', value: platesCollected, fill: COLORS.purple },
      { name: 'Delivered', value: platesDelivered, fill: COLORS.success }, // Plate Delivery
    ];
  }, [cars]);

  const docStats = useMemo(() => {
    return [
      { name: 'Showroom', value: cars.filter(c => c.fileStatus === 'Showroom').length },
      { name: 'At Excise', value: cars.filter(c => c.fileStatus === 'At Excise').length },
      { name: 'Delivered', value: cars.filter(c => c.fileStatus?.toLowerCase().includes('delivered')).length },
    ];
  }, [cars]);

  // Team Performance
  const teamActivity = useMemo(() => {
    const counts: Record<string, number> = {};
    logs.forEach(log => {
      counts[log.performedBy] = (counts[log.performedBy] || 0) + 1;
    });

    return Object.entries(counts).map(([uid, count]) => {
      const user = users.find(u => u.id === uid);
      return {
        name: user?.name || 'Unknown',
        role: user?.role || 'Staff',
        actions: count,
        deliveries: logs.filter(l => l.performedBy === uid && l.type === 'DELIVERY').length
      };
    }).sort((a, b) => b.actions - a.actions);
  }, [logs, users]);


  const TabButton = ({ id, label, icon: Icon }: any) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all border ${activeTab === id
          ? "bg-slate-900 text-white border-slate-900 shadow-md"
          : "bg-white text-slate-600 hover:bg-slate-50 border-slate-200"
        }`}
    >
      <Icon size={16} /> {label}
    </button>
  );

  if (!userData) return null;

  return (
    <div className="space-y-8 pb-20">

      {/* Header & Controls */}
      <div className="flex flex-col xl:flex-row justify-between xl:items-end gap-6 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Analytics Suite</h1>
          <p className="text-sm text-slate-500 mt-1">Advanced fleet intelligence and operational insights.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4">
          <div className="flex bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm gap-2">
            <Input
              type="date"
              className="h-9 w-36 text-xs border-0 bg-slate-50 focus-visible:ring-0"
              value={dateRange.start}
              onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            />
            <span className="self-center text-slate-300">to</span>
            <Input
              type="date"
              className="h-9 w-36 text-xs border-0 bg-slate-50 focus-visible:ring-0"
              value={dateRange.end}
              onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            />
          </div>
          <Button variant="outline" className="h-12 w-12 rounded-xl" onClick={() => window.print()}>
            <Printer size={20} className="text-slate-600" />
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex flex-wrap gap-2">
        <TabButton id="overview" label="Executive Dashboard" icon={LayoutDashboard} />
        <TabButton id="inventory" label="Inventory Intelligence" icon={Database} />
        <TabButton id="operations" label="Operational Efficiency" icon={Activity} />
        <TabButton id="team" label="Team Performance" icon={Users} />
      </div>

      {/* ================= OVERVIEW TAB ================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in duration-500">

          {/* KPI Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatsCard title="Total Inventory" value={kpiStats.totalStock} icon={CarFront} colorClass="bg-blue-50 text-blue-600 border-blue-100" />
            <StatsCard title="Completed Deliveries" value={kpiStats.delivered} icon={CheckCircle2} colorClass="bg-emerald-50 text-emerald-600 border-emerald-100" />
            <StatsCard title="Pending Operations" value={kpiStats.processing} icon={Activity} colorClass="bg-orange-50 text-orange-600 border-orange-100" />
            <StatsCard title="New Leads (Month)" value={12} icon={TrendingUp} colorClass="bg-purple-50 text-purple-600 border-purple-100" /> {/* Placeholder/Calculated */}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Trend Chart */}
            <Card className="lg:col-span-2 shadow-sm border-slate-200">
              <CardHeader>
                <CardTitle>Registration Trends</CardTitle>
                <CardDescription>Daily vehicle intake volume over selected period</CardDescription>
              </CardHeader>
              <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={Object.entries(cars.reduce((acc: any, car) => {
                    const d = car.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    acc[d] = (acc[d] || 0) + 1;
                    return acc;
                  }, {})).map(([date, count]) => ({ date, count }))}>
                    <defs>
                      <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} />
                    <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorTrend)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Quick Actions / Alerts */}
            <div className="space-y-6">
              <Card className="shadow-sm border-slate-200 h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldAlert className="text-red-500" size={20} />
                    Critical Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {agingAnalysis.filter(c => c.age > 45).length > 0 ? (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                      <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={18} />
                      <div>
                        <h4 className="font-bold text-red-900 text-sm">{agingAnalysis.filter(c => c.age > 45).length} Vehicles Overdue</h4>
                        <p className="text-xs text-red-700 mt-1">Inventory aging exceeds 45 days. Review pricing or marketing.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-green-50 border border-green-100 rounded-xl flex items-center gap-3">
                      <CheckCircle2 className="text-green-600" size={18} />
                      <p className="text-sm text-green-800 font-medium">Inventory Health is Good</p>
                    </div>
                  )}

                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-slate-600">Document Processing</span>
                      <Badge variant="outline">{docStats.find(d => d.name === 'At Excise')?.value || 0} Pending</Badge>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div className="bg-orange-400 h-2 rounded-full" style={{ width: '45%' }}></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* ================= INVENTORY TAB ================= */}
      {activeTab === 'inventory' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Brand Mix */}
            <Card>
              <CardHeader><CardTitle>Brand Dominance</CardTitle></CardHeader>
              <CardContent className="h-[300px] flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={brandDistribution} innerRadius={80} outerRadius={100} paddingAngle={5} dataKey="value">
                      {brandDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend layout="vertical" verticalAlign="middle" align="right" />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Aging Stock Radar/Bar */}
            <Card>
              <CardHeader><CardTitle>Oldest Inventory Units</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="p-4 font-medium">Model</th>
                        <th className="p-4 font-medium">Age</th>
                        <th className="p-4 font-medium text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {agingAnalysis.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="p-4">
                            <div className="font-semibold text-slate-800">{item.brandName} {item.model}</div>
                            <div className="text-xs text-slate-400 font-mono">{item.chassisNumber}</div>
                          </td>
                          <td className="p-4">
                            <Badge variant={item.age > 60 ? "destructive" : "secondary"}>
                              {item.age} Days
                            </Badge>
                          </td>
                          <td className="p-4 text-right">
                            <span className="text-xs font-medium text-slate-500">{item.currentStatus}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ================= OPERATIONS TAB ================= */}
      {activeTab === 'operations' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <h3 className="text-lg font-bold text-slate-800">Pipeline Performance</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Plate Funnel */}
            <Card className="border-l-4 border-l-orange-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Printer size={20} className="text-orange-500" />
                  Number Plate Pipeline
                </CardTitle>
                <CardDescription>Status distribution of vehicle plates</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={operationFunnel} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'transparent' }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={32}>
                      {operationFunnel.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Document Workflow */}
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText size={20} className="text-blue-500" />
                  Document Workflow
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart innerRadius="20%" outerRadius="100%" data={docStats} startAngle={180} endAngle={0}>
                    <RadialBar label={{ position: 'insideStart', fill: '#fff' }} background dataKey="value" cornerRadius={10} />
                    <Legend iconSize={10} verticalAlign="bottom" align="center" />
                    <Tooltip />
                  </RadialBarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ================= TEAM PERFORMANCE TAB ================= */}
      {activeTab === 'team' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Leaderboard */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Staff Activity Leaderboard</CardTitle>
                <CardDescription>Top contributors by system actions (Registrations, Updates, Deliveries)</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="p-4 font-medium">Staff Member</th>
                      <th className="p-4 font-medium text-center">Total Actions</th>
                      <th className="p-4 font-medium text-center">Direct Deliveries</th>
                      <th className="p-4 font-medium text-right">Impact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {teamActivity.map((member, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${idx < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-600'}`}>
                              {idx + 1}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-800">{member.name}</div>
                              <div className="text-xs text-slate-400 capitalize">{member.role}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-center font-mono font-bold text-slate-600">{member.actions}</td>
                        <td className="p-4 text-center">
                          {member.deliveries > 0 ? (
                            <Badge className="bg-emerald-100 text-emerald-700 border-0">{member.deliveries}</Badge>
                          ) : <span className="text-slate-300">-</span>}
                        </td>
                        <td className="p-4 text-right">
                          <div className="w-24 ml-auto bg-slate-100 rounded-full h-1.5">
                            <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min((member.actions / (teamActivity[0]?.actions || 1)) * 100, 100)}%` }}></div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Recent Logs Feed */}
            <Card className="bg-slate-50/50 border-slate-200">
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-wide text-slate-500">Live Activity Feed</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                {logs.slice(0, 15).map(log => (
                  <div key={log.id} className="flex gap-3 text-sm">
                    <div className="mt-1">
                      <div className="h-2 w-2 rounded-full bg-blue-500 ring-4 ring-blue-50"></div>
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{log.action}</p>
                      <p className="text-xs text-slate-500">{log.details}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{log.timestamp?.toDate().toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}