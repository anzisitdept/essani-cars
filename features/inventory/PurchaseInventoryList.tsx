"use client";

import { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Car, Search, Filter, X, CheckCircle2, AlertTriangle, Coins, FileText, LayoutList
} from "lucide-react";

export function PurchaseInventoryList() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [stockFilter, setStockFilter] = useState("ALL"); // ALL, INSTOCK, SOLD
  const [docFilter, setDocFilter] = useState("ALL");
  const [plateFilter, setPlateFilter] = useState("ALL");
  const [yearFilter, setYearFilter] = useState("ALL");

  useEffect(() => {
    const q = query(collection(db, "cars"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const all: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Purchase inventory = vehicles with a purchase price greater than zero
      setVehicles(all.filter(v => v.purchasePrice && v.purchasePrice > 0));
      setLoading(false);
    }, (err) => {
      console.error("Error fetching purchase inventory:", err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Extract unique mfg years for filters
  const uniqueYears = useMemo(() => {
    const years = new Set(vehicles.map(v => v.modelYear || v.year).filter(Boolean));
    return Array.from(years).sort((a: any, b: any) => b - a);
  }, [vehicles]);

  // Filtered Inventory
  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      // 1. Search Query
      const s = searchTerm.toLowerCase().trim();
      const matchesSearch = !s ||
        `${v.brandName} ${v.model}`.toLowerCase().includes(s) ||
        (v.chassisNumber || "").toLowerCase().includes(s) ||
        (v.registrationNumber || "").toLowerCase().includes(s) ||
        (v.variant || "").toLowerCase().includes(s) ||
        (v.color || "").toLowerCase().includes(s);

      // 2. Stock Status
      const matchesStock = stockFilter === "ALL" ||
        (stockFilter === "SOLD" && v.isSold) ||
        (stockFilter === "INSTOCK" && !v.isSold);

      // 3. Document Status
      const matchesDoc = docFilter === "ALL" ||
        (docFilter === "NOT_APPLIED" && (v.fileStatus === "Not Applied" || (!v.fileStatus && v.docsApplied === false))) ||
        (docFilter === "SHOWROOM" && (v.fileStatus === "Showroom" || (!v.fileStatus && v.docsApplied === true))) ||
        (docFilter === "EXCISE" && v.fileStatus === "At Excise") ||
        (docFilter === "RETURNED" && v.fileStatus === "Returned Back to Showroom") ||
        (docFilter === "DELIVERED" && v.fileStatus?.toLowerCase().includes("delivered"));

      // 4. Plate Status
      const matchesPlate = plateFilter === "ALL" ||
        (plateFilter === "NOT_AVAILABLE" && (v.plateStatus === "Never Applied" || v.plateStatus === "Not Issued from Excise" || v.plateStatus === "At Party's Hand")) ||
        (plateFilter === "SHOWROOM" && v.plateStatus === "Showroom") ||
        (plateFilter === "DELIVERED" && v.plateStatus?.toLowerCase().includes("delivered"));

      // 5. Mfg Year Filter
      const vehicleYear = (v.modelYear || v.year)?.toString();
      const matchesYear = yearFilter === "ALL" || vehicleYear === yearFilter;

      return matchesSearch && matchesStock && matchesDoc && matchesPlate && matchesYear;
    });
  }, [vehicles, searchTerm, stockFilter, docFilter, plateFilter, yearFilter]);

  // Valuation Stats
  const stats = useMemo(() => {
    let totalPurchasedCount = vehicles.length;
    let inStockCount = 0;
    let soldCount = 0;
    
    let activeValuation = 0; // Cost of currently in-stock purchased vehicles
    let totalValuationAllTime = 0; // Cost of all purchased vehicles
    let soldRevenue = 0; // Total sales revenue

    vehicles.forEach(v => {
      const purchaseVal = Number(v.purchasePrice) || 0;
      const expensesVal = Number(v.totalExpenses) || 0;
      const capitalized = Number(v.capitalizedCost) || (purchaseVal + expensesVal);

      totalValuationAllTime += capitalized;

      if (v.isSold) {
        soldCount++;
        soldRevenue += Number(v.salePrice) || 0;
      } else {
        inStockCount++;
        activeValuation += capitalized;
      }
    });

    return {
      totalPurchasedCount,
      inStockCount,
      soldCount,
      activeValuation,
      totalValuationAllTime,
      soldRevenue
    };
  }, [vehicles]);

  // Filtered Summation Totals
  const filteredTotals = useMemo(() => {
    let purchaseTotal = 0;
    let expensesTotal = 0;
    let capitalizedTotal = 0;

    filteredVehicles.forEach(v => {
      const p = Number(v.purchasePrice) || 0;
      const e = Number(v.totalExpenses) || 0;
      const c = Number(v.capitalizedCost) || (p + e);

      purchaseTotal += p;
      expensesTotal += e;
      capitalizedTotal += c;
    });

    return {
      purchaseTotal,
      expensesTotal,
      capitalizedTotal
    };
  }, [filteredVehicles]);

  const clearFilters = () => {
    setSearchTerm("");
    setStockFilter("ALL");
    setDocFilter("ALL");
    setPlateFilter("ALL");
    setYearFilter("ALL");
  };

  const hasActiveFilters = searchTerm || stockFilter !== "ALL" || docFilter !== "ALL" || plateFilter !== "ALL" || yearFilter !== "ALL";

  return (
    <div className="space-y-6">
      {/* --- Valuation Stats Cards --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Active Inventory Value */}
        <Card className="border-slate-200/80 shadow-sm bg-white hover:shadow-md transition-shadow duration-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Active Stock Value</span>
              <p className="text-2xl font-extrabold text-blue-700">Rs. {stats.activeValuation.toLocaleString()}</p>
              <p className="text-xs text-slate-400 font-medium">In-stock assets valuation</p>
            </div>
            <div className="p-3.5 bg-blue-50 text-blue-700 rounded-2xl shadow-inner">
              <Coins size={24} />
            </div>
          </CardContent>
        </Card>

        {/* In-Stock Count */}
        <Card className="border-slate-200/80 shadow-sm bg-white hover:shadow-md transition-shadow duration-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Vehicles In-Stock</span>
              <p className="text-3xl font-extrabold text-slate-900">{stats.inStockCount}</p>
              <p className="text-xs text-slate-400 font-medium">Currently in showroom</p>
            </div>
            <div className="p-3.5 bg-blue-50 text-blue-600 rounded-2xl shadow-inner">
              <Car size={24} />
            </div>
          </CardContent>
        </Card>

        {/* Total Cost Outlay */}
        <Card className="border-slate-200/80 shadow-sm bg-white hover:shadow-md transition-shadow duration-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">All-Time Outlay</span>
              <p className="text-2xl font-bold text-slate-800">Rs. {stats.totalValuationAllTime.toLocaleString()}</p>
              <p className="text-xs text-slate-400 font-medium">Total cost (stock + sold)</p>
            </div>
            <div className="p-3.5 bg-slate-50 text-slate-600 rounded-2xl shadow-inner">
              <FileText size={24} />
            </div>
          </CardContent>
        </Card>

        {/* Sold Count & Revenue */}
        <Card className="border-slate-200/80 shadow-sm bg-white hover:shadow-md transition-shadow duration-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Sold Vehicles</span>
              <p className="text-2xl font-extrabold text-emerald-700">{stats.soldCount}</p>
              <p className="text-xs text-slate-400 font-medium">Rs. {stats.soldRevenue.toLocaleString()} revenue</p>
            </div>
            <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl shadow-inner">
              <LayoutList size={24} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* --- Filter Options --- */}
      <Card className="border-slate-200 shadow-sm print-hide bg-slate-50/50">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <Input
                className="pl-10 bg-white border-slate-200 shadow-sm"
                placeholder="Search by brand, model, variant, chassis or registration..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2 items-center">
              {/* Stock Status Filter */}
              <Select value={stockFilter} onValueChange={setStockFilter}>
                <SelectTrigger className="w-[130px] h-10 bg-white text-xs border-slate-200 shadow-sm">
                  <SelectValue placeholder="Stock status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Stock</SelectItem>
                  <SelectItem value="INSTOCK">In Stock</SelectItem>
                  <SelectItem value="SOLD">Sold</SelectItem>
                </SelectContent>
              </Select>

              {/* Doc Status Filter */}
              <Select value={docFilter} onValueChange={setDocFilter}>
                <SelectTrigger className="w-[140px] h-10 bg-white text-xs border-slate-200 shadow-sm">
                  <SelectValue placeholder="Document Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Documents</SelectItem>
                  <SelectItem value="NOT_APPLIED">Not Applied</SelectItem>
                  <SelectItem value="SHOWROOM">Showroom</SelectItem>
                  <SelectItem value="EXCISE">At Excise</SelectItem>
                  <SelectItem value="RETURNED">Returned</SelectItem>
                  <SelectItem value="DELIVERED">Delivered</SelectItem>
                </SelectContent>
              </Select>

              {/* Plate Status Filter */}
              <Select value={plateFilter} onValueChange={setPlateFilter}>
                <SelectTrigger className="w-[140px] h-10 bg-white text-xs border-slate-200 shadow-sm">
                  <SelectValue placeholder="Plate Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Plates</SelectItem>
                  <SelectItem value="NOT_AVAILABLE">Not Available</SelectItem>
                  <SelectItem value="SHOWROOM">Showroom</SelectItem>
                  <SelectItem value="DELIVERED">Delivered</SelectItem>
                </SelectContent>
              </Select>

              {/* Mfg Year Filter */}
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger className="w-[120px] h-10 bg-white text-xs border-slate-200 shadow-sm">
                  <SelectValue placeholder="Model Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Years</SelectItem>
                  {uniqueYears.map((yr: any) => (
                    <SelectItem key={yr.toString()} value={yr.toString()}>{yr.toString()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Reset */}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-10 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2.5"
                >
                  <X size={14} className="mr-1" /> Reset
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* --- Inventory Table with Dynamic Summary Row --- */}
      {loading ? (
        <div className="flex justify-center items-center py-20 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <p className="text-slate-400 text-sm font-medium">Loading purchase inventory...</p>
        </div>
      ) : filteredVehicles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-dashed border-slate-200 rounded-2xl text-slate-400">
          <Car size={48} className="mb-3 opacity-30 text-blue-500" />
          <p className="font-semibold text-slate-600 text-base">No Purchased Vehicles Found</p>
          <p className="text-xs mt-1">Try adjusting your filters or search query.</p>
          {hasActiveFilters && (
            <Button variant="link" onClick={clearFilters} className="mt-3 text-blue-600 font-medium">Clear Filters</Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-blue-700 to-blue-800 text-white border-b">
                  <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">#</th>
                  <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Vehicle</th>
                  <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Chassis No.</th>
                  <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Registration</th>
                  <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Year / Color</th>
                  <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide">Purchase Price</th>
                  <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide">Total Expenses</th>
                  <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide">Capitalized Cost</th>
                  <th className="px-4 py-3 text-center font-semibold text-xs uppercase tracking-wide">Stock Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVehicles.map((v, idx) => {
                  const purchase = Number(v.purchasePrice) || 0;
                  const expenses = Number(v.totalExpenses) || 0;
                  const capitalized = Number(v.capitalizedCost) || (purchase + expenses);
                  return (
                    <tr
                      key={v.id}
                      className="hover:bg-slate-50/50 transition-colors duration-150"
                    >
                      <td className="px-4 py-3.5 text-slate-400 font-mono text-xs">{idx + 1}</td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-900">{v.brandName} {v.model}</div>
                        {v.variant && <div className="text-xs text-slate-400 mt-0.5">{v.variant}</div>}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-xs bg-slate-100 px-2.5 py-1 rounded text-slate-700 border border-slate-200/50">
                          {v.chassisNumber || v.chassisNo || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {v.registrationNumber || v.registrationNo ? (
                          <span className="font-mono text-xs text-slate-700 font-semibold">{v.registrationNumber || v.registrationNo}</span>
                        ) : (
                          <span className="text-slate-300 text-xs">Unregistered</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 text-xs">
                        <div className="font-medium">{v.modelYear || v.year || "—"}</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span
                            className="inline-block w-3.5 h-3.5 rounded-full border border-slate-200 shadow-sm animate-pulse"
                            style={{ backgroundColor: v.color?.toLowerCase() || "#ccc" }}
                          />
                          <span>{v.color || "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-medium text-slate-600">
                        Rs. {purchase.toLocaleString()}
                      </td>
                      <td className="px-4 py-3.5 text-right text-xs">
                        {expenses > 0 ? (
                          <span className="text-orange-600 font-semibold">
                            Rs. {expenses.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="font-bold text-blue-700 text-sm">
                          Rs. {capitalized.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {v.isSold ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">
                            SOLD
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                            In Stock
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {/* --- Dynamic Summation Row --- */}
                <tr className="bg-slate-50/80 font-bold border-t-2 border-slate-200">
                  <td className="px-4 py-3 text-slate-500 text-xs font-mono">TOTAL</td>
                  <td className="px-4 py-3 text-slate-700" colSpan={4}>
                    Showing {filteredVehicles.length} matching vehicles
                  </td>
                  <td className="px-4 py-3 text-right text-slate-900 text-sm">
                    Rs. {filteredTotals.purchaseTotal.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-orange-700 text-sm">
                    Rs. {filteredTotals.expensesTotal.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-blue-800 text-sm font-extrabold bg-blue-50/50">
                    Rs. {filteredTotals.capitalizedTotal.toLocaleString()}
                  </td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
