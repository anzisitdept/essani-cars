"use client";

import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Search, CheckCircle, Mail } from "lucide-react";

export default function WebsiteInquiriesPage() {
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    const q = query(collection(db, "website-inquiries"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setInquiries(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => {
      const fallbackUnsub = onSnapshot(collection(db, "website-inquiries"), (snap) => {
        setInquiries(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      });
      return () => fallbackUnsub();
    });

    return () => unsub();
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "website-inquiries", id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Failed to update status:", err);
      alert("Failed to update inquiry status");
    }
  };

  const filteredInquiries = inquiries.filter(i => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm ||
      (i.name || i.customerName || "").toLowerCase().includes(searchLower) ||
      (i.phone || i.email || "").toLowerCase().includes(searchLower) ||
      (i.message || i.subject || "").toLowerCase().includes(searchLower);

    const matchesStatus = statusFilter === "ALL" || (i.status || "New") === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Website Inquiries"
        description="View and respond to inquiries submitted by visitors on the public website."
      />

      {/* Filter Bar */}
      <Card className="p-4 border-slate-100 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <Input
              className="pl-9 bg-white"
              placeholder="Search by customer name, email, phone, message..."
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
              <SelectItem value="New">New</SelectItem>
              <SelectItem value="In Progress">In Progress</SelectItem>
              <SelectItem value="Resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="outline" className="flex items-center px-3 py-2 text-xs font-bold text-slate-600 border-slate-200 bg-white">
            {filteredInquiries.length} Inquiries
          </Badge>
        </div>
      </Card>

      {/* Table / List */}
      <Card className="border-slate-100 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {filteredInquiries.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-3">
              <MessageSquare size={44} className="opacity-30" />
              <p className="text-sm font-semibold text-slate-500">No website inquiries found</p>
              <p className="text-xs text-slate-400 max-w-sm text-center">
                When visitors submit contact forms or questions on the website, they will appear here live.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100/70 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">Customer Name</th>
                    <th className="p-3.5">Contact Details</th>
                    <th className="p-3.5">Subject / Message</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInquiries.map((inq) => {
                    const status = inq.status || "New";
                    return (
                      <tr key={inq.id} className="hover:bg-slate-50 transition">
                        <td className="p-3.5 font-bold text-slate-900 text-sm">
                          {inq.name || inq.customerName || "Visitor"}
                        </td>
                        <td className="p-3.5">
                          <div className="font-medium text-slate-700">{inq.email || "No Email"}</div>
                          <div className="text-slate-500 font-mono mt-0.5">{inq.phone || "No Phone"}</div>
                        </td>
                        <td className="p-3.5 max-w-xs">
                          {inq.subject && <div className="font-semibold text-slate-800 mb-0.5">{inq.subject}</div>}
                          <div className="text-slate-600 truncate">{inq.message || inq.inquiryText || "No message provided"}</div>
                        </td>
                        <td className="p-3.5 text-center">
                          <Badge
                            variant="outline"
                            className={`font-semibold ${
                              status === "Resolved"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : status === "In Progress"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}
                          >
                            {status}
                          </Badge>
                        </td>
                        <td className="p-3.5 text-right space-x-1">
                          {status !== "Resolved" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                              onClick={() => handleUpdateStatus(inq.id, "Resolved")}
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
