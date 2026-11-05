"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { fetchWebsiteQueries, updateWebsiteQueryStatus } from "@/lib/websiteSync";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Search, CheckCircle, TriangleAlert, RefreshCw } from "lucide-react";

export default function WebsiteInquiriesPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Loads every query captured by the public website, newest first. Waits
  // for the signed-in user and re-runs once auth resolves, so an early
  // mount can't leave the list empty.
  const loadRows = useCallback(async () => {
    if (!user) {
      setRows([]);
      setLoadError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchWebsiteQueries();
      setRows(Array.isArray(data) ? data : []);
      setLoadError(null);
    } catch (error: any) {
      setLoadError(String(error?.message || "Could not load the inquiries from the public website."));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadRows();
  }, [user, loadRows]);

  const refresh = async () => {
    setIsRefreshing(true);
    try {
      await loadRows();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    if (updatingId) return;
    setUpdatingId(id);
    try {
      // The server answers with the fresh full list, so the view re-sorts.
      const fresh = await updateWebsiteQueryStatus(id, newStatus);
      setRows(Array.isArray(fresh) ? fresh : []);
      setLoadError(null);
    } catch (error: any) {
      console.error("Failed to update status:", error);
      alert(String(error?.message || "Failed to update inquiry status"));
    } finally {
      setUpdatingId(null);
    }
  };

  const displayStatus = (raw: string) =>
    String(raw || "new")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ") || "New";

  const statusBadgeClass = (raw: string) => {
    const v = String(raw || "new").toLowerCase();
    if (v === "resolved") return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (v === "in progress" || v === "contacted") return "bg-blue-50 text-blue-700 border-blue-200";
    if (v === "new") return "bg-amber-50 text-amber-700 border-amber-200";
    return "bg-slate-50 text-slate-600 border-slate-200";
  };

  const formatDate = (v: any) => {
    if (!v) return "—";
    if (typeof v === "string") {
      const d = new Date(v);
      return isNaN(d.getTime()) ? v : d.toLocaleDateString();
    }
    if (typeof v === "number") return new Date(v).toLocaleDateString();
    if (typeof v?.toDate === "function") return v.toDate().toLocaleDateString();
    return "—";
  };

  const lookingFor = (r: any) => {
    const parts = [r.brand, r.condition, r.carType, r.fuel].filter(Boolean);
    return parts.length ? parts.join(" • ") : "";
  };

  const filteredRows = rows.filter(i => {
    const lower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm ||
      [i.name, i.phone, i.email, i.message, i.brand, i.carType, i.condition, i.fuel, i.budget, i.source]
        .some(f => typeof f === "string" && f.toLowerCase().includes(lower));
    const status = String(i.status || "new").toLowerCase();
    const matchesStatus = statusFilter === "ALL" || status === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Website Inquiries"
        description="View and respond to inquiries submitted by visitors on the public website."
      />

      {loadError && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-amber-800">
          <TriangleAlert size={16} className="shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold">Could not load the inquiries from the public website.</p>
            <p className="font-semibold break-words">{loadError}</p>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <Card className="p-4 border-slate-100 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <Input
              className="pl-9 bg-white"
              placeholder="Search by customer name, phone, email, message, brand, budget..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] bg-white">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="in progress">In Progress</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="outline" className="flex items-center px-3 py-2 text-xs font-bold text-slate-600 border-slate-200 bg-white">
            {filteredRows.length} Inquiries
          </Badge>
          <Button
            variant="outline"
            className="h-9 text-xs font-bold gap-1.5"
            onClick={refresh}
            disabled={isRefreshing}
            title="Reload the latest inquiries from the public website"
          >
            <RefreshCw size={13} className={isRefreshing ? "animate-spin" : ""} />
            Refresh
          </Button>
        </div>
      </Card>

      {/* Table / List */}
      <Card className="border-slate-100 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-3">
              <RefreshCw size={28} className="animate-spin" />
              <p className="text-sm font-semibold text-slate-500">Loading inquiries...</p>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-3">
              <MessageSquare size={44} className="opacity-30" />
              <p className="text-sm font-semibold text-slate-500">No website inquiries found</p>
              <p className="text-xs text-slate-400 max-w-sm text-center">
                When visitors submit queries on the website, they will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100/70 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">Customer Name</th>
                    <th className="p-3.5">Contact Details</th>
                    <th className="p-3.5">Query</th>
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRows.map((inq) => {
                    const status = String(inq.status || "new").toLowerCase();
                    return (
                      <tr key={inq.id} className="hover:bg-slate-50 transition">
                        <td className="p-3.5 font-bold text-slate-900 text-sm">
                          {inq.name || "Visitor"}
                        </td>
                        <td className="p-3.5">
                          <div className="font-medium text-slate-700">{inq.email || "No Email"}</div>
                          <div className="text-slate-500 font-mono mt-0.5">{inq.phone || "No Phone"}</div>
                        </td>
                        <td className="p-3.5 max-w-xs">
                          {lookingFor(inq) && (
                            <div className="font-semibold text-slate-800 mb-0.5 text-[11px] uppercase tracking-wide text-blue-700">
                              {lookingFor(inq)}{inq.budget ? ` — ${inq.budget}` : ""}
                            </div>
                          )}
                          <div className="text-slate-600">{inq.message || "No message provided"}</div>
                        </td>
                        <td className="p-3.5 text-slate-500 text-[11px] whitespace-nowrap">
                          {formatDate(inq.createdAt)}
                        </td>
                        <td className="p-3.5 text-center">
                          <Badge
                            variant="outline"
                            className={`font-semibold ${statusBadgeClass(inq.status)}`}
                          >
                            {displayStatus(inq.status)}
                          </Badge>
                        </td>
                        <td className="p-3.5 text-right space-x-1 whitespace-nowrap">
                          {updatingId === inq.id && (
                            <RefreshCw size={12} className="inline animate-spin text-slate-400 mr-1" />
                          )}
                          {status === "new" && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!!updatingId}
                              className="h-7 text-[11px] bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                              onClick={() => handleUpdateStatus(inq.id, "contacted")}
                            >
                              <CheckCircle size={12} className="mr-1" /> Mark Contacted
                            </Button>
                          )}
                          {status !== "resolved" && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!!updatingId}
                              className="h-7 text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                              onClick={() => handleUpdateStatus(inq.id, "resolved")}
                            >
                              <CheckCircle size={12} className="mr-1" /> Mark Resolved
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
