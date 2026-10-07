"use client";

import { useState, useEffect, useMemo } from "react";
import {
  collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, serverTimestamp
} from "firebase/firestore";
import { websiteDb } from "@/lib/firebase";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
  Search, Eye, CheckCircle, XCircle, PauseCircle, CheckCircle2,
  Trash2, MessageSquare, Phone, Mail, User, MapPin, Gauge,
  Calendar, Fuel, Settings2, Image as ImageIcon, Sparkles,
  ExternalLink, ChevronLeft, ChevronRight, X, Loader2, AlertTriangle,
  CarFront, ShieldAlert, ShoppingBag, Clock
} from "lucide-react";

export interface WebsiteSaleRequest {
  id: string;
  title: string;
  brand: string;
  brandSlug?: string;
  model: string;
  year: number;
  price: number;
  priceLabel?: string;
  mileage: number;
  fuelType: string;
  transmission: string;
  city: string;
  condition?: "Excellent" | "Good" | "Fair" | string;
  sellerName: string;
  sellerEmail: string;
  sellerPhone: string;
  sellerCnic?: string;
  sellerId?: string;
  images: string[];
  description: string;
  status: "pending" | "approved" | "suspended" | "sold" | "rejected";
  createdAt: any;
  updatedAt?: any;
}

type TabKey = "pending" | "approved" | "suspended" | "sold" | "rejected" | "ALL";

// Format price in PKR currency
const formatPrice = (price: number): string => {
  if (!price && price !== 0) return "Rs. 0";
  return `Rs. ${Number(price).toLocaleString()}`;
};

// Generate Price Label (e.g. "38.50 Lacs")
const formatPriceLabel = (price: number): string => {
  if (!price) return "N/A";
  if (price >= 10000000) {
    return `${(price / 10000000).toFixed(2)} Crore`;
  }
  if (price >= 100000) {
    return `${(price / 100000).toFixed(2)} Lacs`;
  }
  return Number(price).toLocaleString();
};

// Clean phone for WhatsApp (Pakistan international format)
const cleanWhatsAppPhone = (phone: string): string => {
  if (!phone) return "";
  let cleaned = phone.replace(/[^0-9]/g, "");
  if (cleaned.startsWith("03")) {
    cleaned = "92" + cleaned.substring(1);
  } else if (cleaned.startsWith("3")) {
    cleaned = "92" + cleaned;
  }
  return cleaned;
};

export const WebsiteSaleRequestsManager = () => {
  const [requests, setRequests] = useState<WebsiteSaleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("pending");

  // Detailed preview modal state
  const [selectedRequest, setSelectedRequest] = useState<WebsiteSaleRequest | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<WebsiteSaleRequest | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Notification message
  const [actionMessage, setActionMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showNotification = (text: string, type: "success" | "error" = "success") => {
    setActionMessage({ text, type });
    setTimeout(() => setActionMessage(null), 3500);
  };

  // Real-time listener on used_cars collection from caruzen-motors-website
  useEffect(() => {
    setLoading(true);
    const q = query(collection(websiteDb, "used_cars"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(q, (snap) => {
      const docs: WebsiteSaleRequest[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title || `${data.brand || data.make || ""} ${data.model || ""} ${data.year || ""}`.trim() || "Untitled Listing",
          brand: data.brand || data.make || "Unknown Brand",
          brandSlug: data.brandSlug || "",
          model: data.model || "Unknown Model",
          year: Number(data.year) || 0,
          price: Number(data.price || data.askingPrice || data.expectedPrice) || 0,
          priceLabel: data.priceLabel || formatPriceLabel(Number(data.price || data.askingPrice || data.expectedPrice) || 0),
          mileage: Number(data.mileage) || 0,
          fuelType: data.fuelType || "Petrol",
          transmission: data.transmission || "Automatic",
          city: data.city || "Sukkur",
          condition: data.condition || "Good",
          sellerName: data.sellerName || data.name || "Anonymous Seller",
          sellerEmail: data.sellerEmail || data.email || "",
          sellerPhone: data.sellerPhone || data.phone || "",
          sellerCnic: data.sellerCnic || data.cnic || "",
          sellerId: data.sellerId || "",
          images: Array.isArray(data.images) ? data.images : (data.assets || []),
          description: data.description || "",
          status: (data.status || "pending").toLowerCase() as any,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        };
      });

      setRequests(docs);
      setLoading(false);
    }, (error) => {
      console.error("Firestore onSnapshot error for used_cars:", error);
      // Fallback without orderBy if composite index is pending
      const fallbackUnsub = onSnapshot(collection(websiteDb, "used_cars"), (fallbackSnap) => {
        const docs: WebsiteSaleRequest[] = fallbackSnap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: data.title || `${data.brand || data.make || ""} ${data.model || ""} ${data.year || ""}`.trim() || "Untitled Listing",
            brand: data.brand || data.make || "Unknown Brand",
            brandSlug: data.brandSlug || "",
            model: data.model || "Unknown Model",
            year: Number(data.year) || 0,
            price: Number(data.price || data.askingPrice || data.expectedPrice) || 0,
            priceLabel: data.priceLabel || formatPriceLabel(Number(data.price || data.askingPrice || data.expectedPrice) || 0),
            mileage: Number(data.mileage) || 0,
            fuelType: data.fuelType || "Petrol",
            transmission: data.transmission || "Automatic",
            city: data.city || "Sukkur",
            condition: data.condition || "Good",
            sellerName: data.sellerName || data.name || "Anonymous Seller",
            sellerEmail: data.sellerEmail || data.email || "",
            sellerPhone: data.sellerPhone || data.phone || "",
            sellerCnic: data.sellerCnic || data.cnic || "",
            sellerId: data.sellerId || "",
            images: Array.isArray(data.images) ? data.images : (data.assets || []),
            description: data.description || "",
            status: (data.status || "pending").toLowerCase() as any,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt
          };
        });

        // Sort by createdAt descending locally
        docs.sort((a, b) => {
          const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (new Date(a.createdAt).getTime() || 0);
          const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (new Date(b.createdAt).getTime() || 0);
          return timeB - timeA;
        });

        setRequests(docs);
        setLoading(false);
      });
      return () => fallbackUnsub();
    });

    return () => unsub();
  }, []);

  // Update selectedRequest when live data changes
  useEffect(() => {
    if (selectedRequest) {
      const updated = requests.find(r => r.id === selectedRequest.id);
      if (updated) {
        setSelectedRequest(updated);
      }
    }
  }, [requests]);

  // Tab counts
  const counts = useMemo(() => {
    return {
      pending: requests.filter(r => r.status === "pending").length,
      approved: requests.filter(r => r.status === "approved").length,
      suspended: requests.filter(r => r.status === "suspended").length,
      sold: requests.filter(r => r.status === "sold").length,
      rejected: requests.filter(r => r.status === "rejected").length,
      ALL: requests.length,
    };
  }, [requests]);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();
    return requests.filter((req) => {
      const matchesTab = activeTab === "ALL" || req.status === activeTab;
      const matchesSearch = !search ||
        req.title.toLowerCase().includes(search) ||
        req.brand.toLowerCase().includes(search) ||
        req.model.toLowerCase().includes(search) ||
        req.sellerName.toLowerCase().includes(search) ||
        req.sellerPhone.toLowerCase().includes(search) ||
        req.sellerEmail.toLowerCase().includes(search) ||
        req.city.toLowerCase().includes(search);

      return matchesTab && matchesSearch;
    });
  }, [requests, activeTab, searchTerm]);

  // Action: Update status
  const handleUpdateStatus = async (
    reqId: string,
    newStatus: "approved" | "suspended" | "sold" | "rejected" | "pending"
  ) => {
    setActionLoadingId(reqId);
    try {
      const docRef = doc(websiteDb, "used_cars", reqId);
      await updateDoc(docRef, {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      const statusLabels: Record<string, string> = {
        approved: "Approved & Live on Website",
        suspended: "Suspended / Delisted",
        sold: "Marked as Sold",
        rejected: "Rejected",
        pending: "Moved to Under Review"
      };
      showNotification(`Listing status updated to: ${statusLabels[newStatus] || newStatus}`);
    } catch (error) {
      console.error("Error updating status:", error);
      showNotification("Failed to update status. Please try again.", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Action: Delete document
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(websiteDb, "used_cars", deleteTarget.id));
      showNotification(`Listing "${deleteTarget.title}" permanently deleted.`);
      setDeleteTarget(null);
      if (selectedRequest?.id === deleteTarget.id) {
        setSelectedRequest(null);
      }
    } catch (error) {
      console.error("Error deleting listing:", error);
      showNotification("Failed to delete listing. Please try again.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  // Action: Open WhatsApp
  const handleOpenWhatsApp = (req: WebsiteSaleRequest) => {
    const cleanPhone = cleanWhatsAppPhone(req.sellerPhone);
    if (!cleanPhone) {
      alert("No valid phone number available for this seller.");
      return;
    }
    const message = `Salam ${req.sellerName || ""}, this is Essani Cars regarding your car listing for ${req.title || `${req.brand} ${req.model}`} submitted on our website...`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  // Status Badge UI
  const renderStatusBadge = (status: WebsiteSaleRequest["status"]) => {
    switch (status) {
      case "pending":
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-bold text-[11px] px-2.5 py-0.5">
            Under Review
          </Badge>
        );
      case "approved":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold text-[11px] px-2.5 py-0.5">
            Live Approved
          </Badge>
        );
      case "suspended":
        return (
          <Badge className="bg-slate-100 text-slate-700 border-slate-300 font-bold text-[11px] px-2.5 py-0.5">
            Suspended
          </Badge>
        );
      case "sold":
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-300 font-bold text-[11px] px-2.5 py-0.5">
            Sold
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-100 text-red-800 border-red-300 font-bold text-[11px] px-2.5 py-0.5">
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs">
            {status}
          </Badge>
        );
    }
  };

  const tabs: { key: TabKey; label: string; count: number; color: string }[] = [
    { key: "pending", label: "Under Review", count: counts.pending, color: "text-amber-700 bg-amber-50 border-amber-200" },
    { key: "approved", label: "Live Approved", count: counts.approved, color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    { key: "suspended", label: "Suspended", count: counts.suspended, color: "text-slate-700 bg-slate-100 border-slate-200" },
    { key: "sold", label: "Sold", count: counts.sold, color: "text-blue-700 bg-blue-50 border-blue-200" },
    { key: "rejected", label: "Rejected", count: counts.rejected, color: "text-red-700 bg-red-50 border-red-200" },
    { key: "ALL", label: "All Requests", count: counts.ALL, color: "text-slate-800 bg-slate-100 border-slate-200" },
  ];

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl text-xs font-bold flex items-center justify-between shadow-lg border transition-all animate-in fade-in slide-in-from-top-2 ${
            actionMessage.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
              : "bg-red-50 text-red-900 border-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === "success" ? (
              <CheckCircle2 size={16} className="text-emerald-600" />
            ) : (
              <ShieldAlert size={16} className="text-red-600" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-slate-700">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card
          onClick={() => setActiveTab("pending")}
          className={`p-4 cursor-pointer transition-all border ${
            activeTab === "pending"
              ? "ring-2 ring-amber-500 bg-amber-50/50 shadow-sm"
              : "hover:border-amber-200 bg-white"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Under Review</p>
            <span className="p-1.5 bg-amber-100 text-amber-700 rounded-lg"><Clock size={14} /></span>
          </div>
          <p className="text-2xl font-black text-amber-800 mt-2">{counts.pending}</p>
          <p className="text-[10px] text-amber-600 mt-0.5">Awaiting Admin Approval</p>
        </Card>

        <Card
          onClick={() => setActiveTab("approved")}
          className={`p-4 cursor-pointer transition-all border ${
            activeTab === "approved"
              ? "ring-2 ring-emerald-500 bg-emerald-50/50 shadow-sm"
              : "hover:border-emerald-200 bg-white"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Live Approved</p>
            <span className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg"><CheckCircle size={14} /></span>
          </div>
          <p className="text-2xl font-black text-emerald-800 mt-2">{counts.approved}</p>
          <p className="text-[10px] text-emerald-600 mt-0.5">Visible to Public Online</p>
        </Card>

        <Card
          onClick={() => setActiveTab("suspended")}
          className={`p-4 cursor-pointer transition-all border ${
            activeTab === "suspended"
              ? "ring-2 ring-slate-500 bg-slate-50/50 shadow-sm"
              : "hover:border-slate-200 bg-white"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Suspended</p>
            <span className="p-1.5 bg-slate-200 text-slate-700 rounded-lg"><PauseCircle size={14} /></span>
          </div>
          <p className="text-2xl font-black text-slate-800 mt-2">{counts.suspended}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Temporarily Delisted</p>
        </Card>

        <Card
          onClick={() => setActiveTab("sold")}
          className={`p-4 cursor-pointer transition-all border ${
            activeTab === "sold"
              ? "ring-2 ring-blue-500 bg-blue-50/50 shadow-sm"
              : "hover:border-blue-200 bg-white"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Sold</p>
            <span className="p-1.5 bg-blue-100 text-blue-700 rounded-lg"><ShoppingBag size={14} /></span>
          </div>
          <p className="text-2xl font-black text-blue-800 mt-2">{counts.sold}</p>
          <p className="text-[10px] text-blue-600 mt-0.5">Completed Sales</p>
        </Card>

        <Card
          onClick={() => setActiveTab("ALL")}
          className={`p-4 cursor-pointer transition-all border ${
            activeTab === "ALL"
              ? "ring-2 ring-slate-900 bg-slate-50/50 shadow-sm"
              : "hover:border-slate-200 bg-white"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Total Submissions</p>
            <span className="p-1.5 bg-slate-100 text-slate-700 rounded-lg"><CarFront size={14} /></span>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{counts.ALL}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">All Website Submissions</p>
        </Card>
      </div>

      {/* Tabs & Search Bar */}
      <Card className="p-4 border-slate-100 shadow-sm">
        <div className="flex flex-col gap-4">
          {/* Tab buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border ${
                  activeTab === tab.key
                    ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                    activeTab === tab.key
                      ? "bg-slate-700 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search input */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <Input
                className="pl-9 bg-white"
                placeholder="Search by Car Title, Seller Name, Seller Phone, Email, City..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <Badge variant="outline" className="flex items-center justify-center px-4 py-2 text-xs font-bold text-slate-700 border-slate-200 bg-white shrink-0">
              Showing {filteredRequests.length} of {requests.length} Requests
            </Badge>
          </div>
        </div>
      </Card>

      {/* Main Table / Requests List */}
      <Card className="border-slate-100 shadow-sm overflow-hidden bg-white">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 size={36} className="animate-spin text-blue-600" />
              <p className="text-sm font-semibold text-slate-600">Loading website sale requests from used_cars...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <div className="p-4 bg-slate-100 rounded-full text-slate-400">
                <CarFront size={36} />
              </div>
              <p className="text-base font-bold text-slate-700">No sale requests found</p>
              <p className="text-xs text-slate-400 max-w-sm text-center">
                {searchTerm
                  ? "No listings match your search criteria. Try clearing the search."
                  : `No listings with status "${activeTab}" at the moment.`}
              </p>
              {searchTerm && (
                <Button size="sm" variant="outline" onClick={() => setSearchTerm("")} className="mt-2 text-xs">
                  Clear Search
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3.5 pl-5">Vehicle & Photos</th>
                    <th className="p-3.5">Seller Details</th>
                    <th className="p-3.5">Specs & City</th>
                    <th className="p-3.5 text-right">Asking Price</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-right pr-5">Actions & Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRequests.map((req) => {
                    const isActionLoading = actionLoadingId === req.id;
                    const primaryImage = req.images && req.images.length > 0 ? req.images[0] : null;

                    return (
                      <tr key={req.id} className="hover:bg-slate-50/80 transition-colors group">
                        {/* Vehicle Photo & Title */}
                        <td className="p-3.5 pl-5">
                          <div className="flex items-center gap-3">
                            <div
                              onClick={() => {
                                setSelectedRequest(req);
                                setActiveImageIndex(0);
                              }}
                              className="relative w-16 h-12 bg-slate-900 rounded-lg overflow-hidden shrink-0 border border-slate-200 cursor-pointer group-hover:border-blue-400 transition"
                            >
                              {primaryImage ? (
                                <img
                                  src={primaryImage}
                                  alt={req.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-500">
                                  <CarFront size={20} />
                                </div>
                              )}
                              {req.images && req.images.length > 1 && (
                                <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[9px] font-bold px-1 rounded">
                                  +{req.images.length}
                                </span>
                              )}
                            </div>
                            <div>
                              <div
                                onClick={() => {
                                  setSelectedRequest(req);
                                  setActiveImageIndex(0);
                                }}
                                className="font-extrabold text-slate-900 text-sm hover:text-blue-600 cursor-pointer flex items-center gap-1.5"
                              >
                                {req.title}
                              </div>
                              <div className="text-slate-500 text-xs flex items-center gap-2 mt-0.5">
                                <span>{req.brand}</span>
                                <span>•</span>
                                <span>{req.model}</span>
                                <span>•</span>
                                <span className="font-mono">{req.year}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Seller Details */}
                        <td className="p-3.5">
                          <div className="space-y-0.5">
                            <div className="font-bold text-slate-900 flex items-center gap-1">
                              <User size={12} className="text-slate-400" />
                              <span>{req.sellerName}</span>
                            </div>
                            <div className="text-slate-600 font-mono text-[11px] flex items-center gap-1">
                              <Phone size={11} className="text-slate-400" />
                              <span>{req.sellerPhone || "N/A"}</span>
                            </div>
                            {req.sellerEmail && (
                              <div className="text-slate-400 text-[11px] truncate max-w-[170px]" title={req.sellerEmail}>
                                {req.sellerEmail}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Specs & City */}
                        <td className="p-3.5 text-slate-700">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 font-semibold text-slate-800">
                              <MapPin size={12} className="text-rose-500" />
                              <span>{req.city}</span>
                            </div>
                            <div className="text-slate-500 text-[11px] flex items-center gap-1.5">
                              <Gauge size={11} className="text-slate-400" />
                              <span>{req.mileage ? `${Number(req.mileage).toLocaleString()} km` : "N/A"}</span>
                              <span>•</span>
                              <span>{req.transmission}</span>
                            </div>
                            <div className="text-slate-400 text-[10px]">
                              Fuel: {req.fuelType} {req.condition ? `• Cond: ${req.condition}` : ""}
                            </div>
                          </div>
                        </td>

                        {/* Price */}
                        <td className="p-3.5 text-right">
                          <div className="font-mono font-black text-emerald-700 text-sm">
                            {formatPrice(req.price)}
                          </div>
                          <div className="text-slate-400 text-[10px] font-semibold">
                            {req.priceLabel || formatPriceLabel(req.price)}
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="p-3.5 text-center">
                          {renderStatusBadge(req.status)}
                        </td>

                        {/* Actions Toolbar */}
                        <td className="p-3.5 text-right pr-5">
                          <div className="flex items-center justify-end gap-1">
                            {/* WhatsApp Button */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenWhatsApp(req)}
                              className="h-8 px-2.5 text-xs bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:text-emerald-800 font-bold gap-1"
                              title="Message Seller on WhatsApp"
                            >
                              <MessageSquare size={13} className="text-emerald-600" />
                              <span className="hidden sm:inline">WhatsApp</span>
                            </Button>

                            {/* View Details Button */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedRequest(req);
                                setActiveImageIndex(0);
                              }}
                              className="h-8 px-2.5 text-xs bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 font-bold gap-1"
                              title="View Full Details & Photos"
                            >
                              <Eye size={13} />
                              <span className="hidden sm:inline">Review</span>
                            </Button>

                            {/* Approve (if not approved) */}
                            {req.status !== "approved" && (
                              <Button
                                size="sm"
                                disabled={isActionLoading}
                                onClick={() => handleUpdateStatus(req.id, "approved")}
                                className="h-8 px-2.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold gap-1"
                                title="Approve & Publish to Website"
                              >
                                {isActionLoading ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={13} />}
                                <span className="hidden sm:inline">Approve</span>
                              </Button>
                            )}

                            {/* Suspend (if approved) */}
                            {req.status === "approved" && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isActionLoading}
                                onClick={() => handleUpdateStatus(req.id, "suspended")}
                                className="h-8 px-2.5 text-xs bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 font-bold gap-1"
                                title="Suspend from Public Website"
                              >
                                <PauseCircle size={13} />
                                <span className="hidden sm:inline">Suspend</span>
                              </Button>
                            )}

                            {/* Delete */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeleteTarget(req)}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                              title="Delete Listing"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
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

      {/* Detailed Review Modal / Drawer */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white">
          {selectedRequest && (
            <>
              {/* Header */}
              <div className="p-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md">
                    <CarFront size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-lg text-slate-900">{selectedRequest.title}</h3>
                      {renderStatusBadge(selectedRequest.status)}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Doc ID: <span className="font-mono font-semibold">{selectedRequest.id}</span> • City: {selectedRequest.city}
                    </p>
                  </div>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Image Gallery */}
                <div>
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <ImageIcon size={14} className="text-blue-500" /> Uploaded Photos ({selectedRequest.images?.length || 0})
                  </h4>

                  {selectedRequest.images && selectedRequest.images.length > 0 ? (
                    <div className="space-y-3">
                      {/* Main Featured Photo */}
                      <div className="relative aspect-[16/9] md:aspect-[21/9] bg-slate-950 rounded-2xl overflow-hidden border border-slate-200 group">
                        <img
                          src={selectedRequest.images[activeImageIndex] || selectedRequest.images[0]}
                          alt="Vehicle Large Preview"
                          className="w-full h-full object-contain cursor-pointer"
                          onClick={() => setLightboxImage(selectedRequest.images[activeImageIndex] || selectedRequest.images[0])}
                        />
                        <button
                          onClick={() => setLightboxImage(selectedRequest.images[activeImageIndex] || selectedRequest.images[0])}
                          className="absolute top-3 right-3 p-2 bg-black/60 hover:bg-black text-white rounded-xl backdrop-blur-sm transition text-xs font-bold flex items-center gap-1.5"
                        >
                          <Eye size={14} /> Fullscreen
                        </button>
                      </div>

                      {/* Thumbnails row */}
                      {selectedRequest.images.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto pb-2">
                          {selectedRequest.images.map((img, idx) => (
                            <div
                              key={idx}
                              onClick={() => setActiveImageIndex(idx)}
                              className={`w-20 h-16 rounded-xl overflow-hidden shrink-0 border-2 cursor-pointer transition ${
                                activeImageIndex === idx ? "border-blue-600 ring-2 ring-blue-100" : "border-slate-200 opacity-70 hover:opacity-100"
                              }`}
                            >
                              <img src={img} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-8 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center text-slate-400 space-y-1">
                      <ImageIcon size={32} className="mx-auto opacity-40 mb-2" />
                      <p className="text-xs font-bold text-slate-500">No photos uploaded</p>
                      <p className="text-[11px]">The seller did not attach any vehicle images.</p>
                    </div>
                  )}
                </div>

                {/* Grid: Specifications & Seller Card */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Technical Specifications */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Settings2 size={14} className="text-blue-500" /> Specifications
                    </h4>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2.5 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-200/60">
                        <span className="text-slate-400 font-semibold">Make / Brand:</span>
                        <span className="font-bold text-slate-800">{selectedRequest.brand}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200/60">
                        <span className="text-slate-400 font-semibold">Model:</span>
                        <span className="font-bold text-slate-800">{selectedRequest.model}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200/60">
                        <span className="text-slate-400 font-semibold">Model Year:</span>
                        <span className="font-bold text-slate-800 font-mono">{selectedRequest.year}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200/60">
                        <span className="text-slate-400 font-semibold">Mileage:</span>
                        <span className="font-bold text-slate-800">{Number(selectedRequest.mileage || 0).toLocaleString()} km</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200/60">
                        <span className="text-slate-400 font-semibold">Transmission:</span>
                        <span className="font-bold text-slate-800">{selectedRequest.transmission}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200/60">
                        <span className="text-slate-400 font-semibold">Fuel Type:</span>
                        <span className="font-bold text-slate-800">{selectedRequest.fuelType}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200/60">
                        <span className="text-slate-400 font-semibold">Condition:</span>
                        <span className="font-bold text-slate-800">{selectedRequest.condition || "Good"}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-400 font-semibold">City Location:</span>
                        <span className="font-bold text-slate-800">{selectedRequest.city}</span>
                      </div>
                    </div>
                  </div>

                  {/* Seller Contact Details */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <User size={14} className="text-blue-500" /> Seller Information
                    </h4>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3 text-xs">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                        <span className="text-slate-400 font-semibold">Seller Name:</span>
                        <span className="font-bold text-slate-900 text-sm">{selectedRequest.sellerName}</span>
                      </div>
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                        <span className="text-slate-400 font-semibold">Phone:</span>
                        <span className="font-mono font-bold text-slate-900">{selectedRequest.sellerPhone || "N/A"}</span>
                      </div>
                      {selectedRequest.sellerEmail && (
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                          <span className="text-slate-400 font-semibold">Email:</span>
                          <span className="font-semibold text-slate-800">{selectedRequest.sellerEmail}</span>
                        </div>
                      )}
                      {selectedRequest.sellerCnic && (
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                          <span className="text-slate-400 font-semibold">CNIC:</span>
                          <span className="font-mono font-semibold text-slate-800">{selectedRequest.sellerCnic}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-semibold">Asking Price:</span>
                        <div className="text-right">
                          <span className="font-mono font-black text-emerald-700 text-base">
                            {formatPrice(selectedRequest.price)}
                          </span>
                          <div className="text-[10px] text-slate-500 font-bold">
                            ({selectedRequest.priceLabel || formatPriceLabel(selectedRequest.price)})
                          </div>
                        </div>
                      </div>

                      {/* Direct WhatsApp Action in Card */}
                      <Button
                        onClick={() => handleOpenWhatsApp(selectedRequest)}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-2 py-2 mt-2"
                      >
                        <MessageSquare size={15} /> Chat with Seller on WhatsApp
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Seller Description */}
                {selectedRequest.description && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Seller Description</h4>
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-sans">
                      {selectedRequest.description}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer Controls */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteTarget(selectedRequest)}
                    className="text-xs text-red-600 border-red-200 hover:bg-red-50 gap-1.5"
                  >
                    <Trash2 size={13} /> Delete Listing
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  {/* Status change buttons */}
                  {selectedRequest.status !== "approved" && (
                    <Button
                      size="sm"
                      onClick={() => handleUpdateStatus(selectedRequest.id, "approved")}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5"
                    >
                      <CheckCircle size={14} /> Approve & Publish
                    </Button>
                  )}

                  {selectedRequest.status !== "suspended" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateStatus(selectedRequest.id, "suspended")}
                      className="bg-white border-slate-300 text-slate-700 text-xs font-bold gap-1.5"
                    >
                      <PauseCircle size={14} /> Suspend
                    </Button>
                  )}

                  {selectedRequest.status !== "sold" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateStatus(selectedRequest.id, "sold")}
                      className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 text-xs font-bold gap-1.5"
                    >
                      <ShoppingBag size={14} /> Mark Sold
                    </Button>
                  )}

                  {selectedRequest.status !== "rejected" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateStatus(selectedRequest.id, "rejected")}
                      className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100 text-xs font-bold gap-1.5"
                    >
                      <XCircle size={14} /> Reject
                    </Button>
                  )}

                  <Button variant="ghost" size="sm" onClick={() => setSelectedRequest(null)} className="text-xs">
                    Close
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 animate-in fade-in"
          onClick={() => setLightboxImage(null)}
        >
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 p-2.5 bg-white/20 hover:bg-white/30 text-white rounded-full transition"
          >
            <X size={24} />
          </button>
          <img
            src={lightboxImage}
            alt="Full Preview"
            className="max-w-full max-h-[90vh] object-contain rounded-xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 text-red-600 rounded-xl">
                <AlertTriangle size={22} />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900">Delete Sale Request?</DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  This will permanently remove the listing from the database.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1 my-2">
            <p className="font-bold text-slate-800">{deleteTarget?.title}</p>
            <p className="text-slate-500">Seller: {deleteTarget?.sellerName} • Price: {deleteTarget && formatPrice(deleteTarget.price)}</p>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={isDeleting} className="text-xs">
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold gap-1.5"
            >
              {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
