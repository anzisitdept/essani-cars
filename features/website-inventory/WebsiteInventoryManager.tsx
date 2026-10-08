"use client";
import { useState, useEffect, useMemo } from "react";
import {
  collection, onSnapshot, query, orderBy, addDoc, updateDoc,
  doc, serverTimestamp, getDocs, where, arrayUnion
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
  Search, CarFront, X, Sparkles, SlidersHorizontal, Globe, LayoutGrid,
  PlusCircle, Send, CheckCircle2, Loader2, Inbox, Car, Image as ImageIcon, Upload, Trash2, RefreshCw, Eye, EyeOff
} from "lucide-react";
import { WebsiteVehicleCard } from "./WebsiteVehicleCard";
import { WebsiteVehicleDetailModal } from "./WebsiteVehicleDetailModal";
import { syncVehicleToWebsite, toggleWebsiteVehicleVisibility } from "@/lib/websiteSync";

type Tab = "published" | "drafts" | "add";

export const WebsiteInventoryManager = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("published");

  // Published (website-inventory collection)
  const [publishedVehicles, setPublishedVehicles] = useState<any[]>([]);

  // Draft suggestions (cars collection, For Purchase, not yet published)
  const [draftVehicles, setDraftVehicles] = useState<any[]>([]);

  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [uploadingDraftId, setUploadingDraftId] = useState<string | null>(null);
  const [viewingDraftVehicle, setViewingDraftVehicle] = useState<any | null>(null);

  const handleDeleteDraftImage = async (vehicleId: string, imageUrl: string) => {
    if (!confirm("Are you sure you want to delete this image?")) return;
    try {
      const vehicle = draftVehicles.find(v => v.id === vehicleId);
      if (!vehicle) return;
      const newAssets = vehicle.assets.filter((url: string) => url !== imageUrl);
      await updateDoc(doc(db, "cars", vehicleId), {
        assets: newAssets
      });
      setViewingDraftVehicle({ ...vehicle, assets: newAssets });
    } catch (error) {
      console.error("Failed to delete image:", error);
      alert("Failed to delete image.");
    }
  };

  const handleDraftImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, vehicleId: string) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingDraftId(vehicleId);

    try {
      const newAssets: string[] = [];
      const IMGBB_API_KEY = process.env.NEXT_PUBLIC_IMGBB_API_KEY || "";
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append("image", file);

        const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            newAssets.push(data.data.url);
          }
        }
      }

      if (newAssets.length > 0) {
        await updateDoc(doc(db, "cars", vehicleId), {
          assets: arrayUnion(...newAssets)
        });
      }
    } catch (error) {
      console.error("Failed to upload draft images:", error);
      alert("An error occurred while uploading images.");
    } finally {
      setUploadingDraftId(null);
      e.target.value = "";
    }
  };

  // Publish dialog state
  const [publishingVehicle, setPublishingVehicle] = useState<any | null>(null);
  const [publishAskingPrice, setPublishAskingPrice] = useState("");
  const [publishDescription, setPublishDescription] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState("");

  // Add direct listing state
  const [newListing, setNewListing] = useState({
    make: "", model: "", variant: "", year: "", color: "",
    fuelType: "", transmission: "", city: "Sukkur",
    engineNo: "", chassisNo: "", registrationNo: "",
    askingPrice: "", description: ""
  });
  const [isAddingListing, setIsAddingListing] = useState(false);
  const [addMessage, setAddMessage] = useState("");

  // System Configuration attributes for dynamic selectors
  const [brands, setBrands] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);
  const [fuelTypes, setFuelTypes] = useState<any[]>([]);
  const [transmissions, setTransmissions] = useState<any[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [models, setModels] = useState<any[]>([]);

  // Filters (for published tab)
  const [searchTerm, setSearchTerm] = useState("");
  const [brandFilter, setBrandFilter] = useState("ALL");
  const [visibilityFilter, setVisibilityFilter] = useState<"ALL" | "LIVE" | "HIDDEN">("ALL");
  const [togglingVehicleId, setTogglingVehicleId] = useState<string | null>(null);

  const handleToggleVisibility = async (vehicle: any) => {
    const isCurrentlyHidden = vehicle.isHidden === true || vehicle.status === "Hidden";
    setTogglingVehicleId(vehicle.id);
    try {
      await toggleWebsiteVehicleVisibility(vehicle.id, isCurrentlyHidden);
    } catch (err) {
      console.error("Failed to toggle visibility:", err);
      alert("Failed to update vehicle visibility.");
    } finally {
      setTogglingVehicleId(null);
    }
  };

  // ------- Real-time listeners -------

  // 1. Published website inventory collection
  useEffect(() => {
    const q = query(collection(db, "website-inventory"), orderBy("publishedAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setPublishedVehicles(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // 2. Purchase Invoice vehicles awaiting publication: cars with purchasePrice > 0 and publishedToWeb != true and not sold
  useEffect(() => {
    const q = query(collection(db, "cars"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const allCars: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDraftVehicles(
        allCars.filter(v =>
          v.purchasePrice && Number(v.purchasePrice) > 0 && !v.publishedToWeb && !v.isSold
        )
      );
    });
    return () => unsub();
  }, []);

  // 3. Fetch Settings Brands, Colors, Fuel Types, and Transmissions
  useEffect(() => {
    const unsubBrands = onSnapshot(query(collection(db, "brands"), orderBy("name")), (snap) => {
      setBrands(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubColors = onSnapshot(query(collection(db, "settings_colors"), orderBy("name")), (snap) => {
      setColors(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubFuel = onSnapshot(query(collection(db, "settings_fuel"), orderBy("name")), (snap) => {
      setFuelTypes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubTrans = onSnapshot(query(collection(db, "settings_transmission"), orderBy("name")), (snap) => {
      setTransmissions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubBrands();
      unsubColors();
      unsubFuel();
      unsubTrans();
    };
  }, []);

  // 4. Fetch Models matching selected brand id
  useEffect(() => {
    if (!selectedBrandId) {
      setModels([]);
      setNewListing(prev => ({ ...prev, model: "", variant: "" }));
      return;
    }
    const q = query(collection(db, "models"), where("brandId", "==", selectedBrandId));
    const unsub = onSnapshot(q, (snap) => {
      setModels(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [selectedBrandId]);

  // ------- Filtered & Derived -------

  const viewingVehicle = useMemo(() => {
    if (!selectedVehicleId) return null;
    return publishedVehicles.find(v => v.id === selectedVehicleId) || null;
  }, [selectedVehicleId, publishedVehicles]);

  const uniqueBrands = useMemo(() => {
    const brands = new Set(publishedVehicles.map(v => v.make || v.brandName).filter(Boolean));
    return Array.from(brands).sort() as string[];
  }, [publishedVehicles]);

  const filteredPublished = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    return publishedVehicles.filter(v => {
      if (v.status === "Sold") return false;
      const isHidden = v.isHidden === true || v.status === "Hidden";
      if (visibilityFilter === "LIVE" && isHidden) return false;
      if (visibilityFilter === "HIDDEN" && !isHidden) return false;

      const matchesSearch = !searchTerm ||
        v.make?.toLowerCase().includes(lower) ||
        v.model?.toLowerCase().includes(lower) ||
        v.registrationNo?.toLowerCase().includes(lower) ||
        v.chassisNo?.toLowerCase().includes(lower) ||
        v.color?.toLowerCase().includes(lower);
      const matchesBrand = brandFilter === "ALL" || (v.make || v.brandName) === brandFilter;
      return matchesSearch && matchesBrand;
    });
  }, [publishedVehicles, searchTerm, brandFilter, visibilityFilter]);

  const filteredDrafts = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    if (!searchTerm) return draftVehicles;
    return draftVehicles.filter(v =>
      v.brandName?.toLowerCase().includes(lower) ||
      v.model?.toLowerCase().includes(lower) ||
      v.chassisNumber?.toLowerCase().includes(lower) ||
      v.registrationNumber?.toLowerCase().includes(lower)
    );
  }, [draftVehicles, searchTerm]);

  // ------- Publish Action -------

  const openPublishDialog = (vehicle: any) => {
    setPublishingVehicle(vehicle);
    setPublishAskingPrice(vehicle.purchasePrice ? String(vehicle.purchasePrice) : "");
    setPublishDescription(`${vehicle.brandName} ${vehicle.model} ${vehicle.modelYear || vehicle.year} - ${vehicle.color}`);
    setPublishMessage("");
  };

  const handlePublish = async () => {
    if (!publishingVehicle || !user) return;
    if (!publishAskingPrice || parseFloat(publishAskingPrice) <= 0) {
      setPublishMessage("Error: Please enter a valid asking price.");
      return;
    }

    setIsPublishing(true);
    setPublishMessage("");

    try {
      const listingPayload = {
        sourceVehicleId: publishingVehicle.id,
        type: "Physical Showroom",
        make: publishingVehicle.brandName,
        brandName: publishingVehicle.brandName,
        model: publishingVehicle.model,
        variant: publishingVehicle.variant || "",
        year: parseInt(publishingVehicle.modelYear || publishingVehicle.year) || publishingVehicle.year,
        color: publishingVehicle.color,
        fuelType: publishingVehicle.fuelType,
        transmission: publishingVehicle.transmission,
        engineNo: publishingVehicle.engineNumber,
        chassisNo: publishingVehicle.chassisNumber,
        registrationNo: publishingVehicle.registrationNumber || "",
        askingPrice: parseFloat(publishAskingPrice),
        price: parseFloat(publishAskingPrice),
        images: publishingVehicle.assets || [],
        description: publishDescription,
        status: "Available",
        barcode: publishingVehicle.barcode,
        publishedAt: serverTimestamp(),
        publishedBy: user.uid
      };

      // 1. Create website-inventory document in accounts database
      const docRef = await addDoc(collection(db, "website-inventory"), listingPayload);

      // 2. Sync to caruzen-motors-website public database
      await syncVehicleToWebsite(docRef.id, listingPayload);

      // 3. Mark source vehicle as published
      await updateDoc(doc(db, "cars", publishingVehicle.id), {
        publishedToWeb: true,
        publishedAt: serverTimestamp()
      });

      setPublishMessage("Success: Vehicle published to website & synchronized with online database!");
      setTimeout(() => {
        setPublishingVehicle(null);
        setPublishMessage("");
      }, 1500);

    } catch (err) {
      console.error("Publish error:", err);
      setPublishMessage("Error: Could not publish vehicle. Please try again.");
    } finally {
      setIsPublishing(false);
    }
  };

  // ------- Add Direct Website-Only Listing -------

  const handleAddListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!newListing.make || !newListing.model || !newListing.year || !newListing.askingPrice) {
      setAddMessage("Error: Make, Model, Year, and Asking Price are required.");
      return;
    }

    setIsAddingListing(true);
    setAddMessage("");

    try {
      const listingPayload = {
        sourceVehicleId: null,
        type: "Website Only",
        make: newListing.make,
        brandName: newListing.make,
        model: newListing.model,
        variant: newListing.variant,
        year: parseInt(newListing.year),
        color: newListing.color,
        fuelType: newListing.fuelType,
        transmission: newListing.transmission,
        city: newListing.city || "Sukkur",
        engineNo: newListing.engineNo,
        chassisNo: newListing.chassisNo,
        registrationNo: newListing.registrationNo,
        askingPrice: parseFloat(newListing.askingPrice),
        price: parseFloat(newListing.askingPrice),
        images: [],
        description: newListing.description,
        status: "Available",
        publishedAt: serverTimestamp(),
        publishedBy: user.uid
      };

      // 1. Save to accounts DB
      const docRef = await addDoc(collection(db, "website-inventory"), listingPayload);

      // 2. Sync to website DB
      await syncVehicleToWebsite(docRef.id, listingPayload);

      setAddMessage("Success: Listing added and synced with website database!");
      setNewListing({
        make: "", model: "", variant: "", year: "", color: "",
        fuelType: "", transmission: "", city: "Sukkur",
        engineNo: "", chassisNo: "", registrationNo: "",
        askingPrice: "", description: ""
      });
      setSelectedBrandId("");
    } catch (err) {
      console.error("Add listing error:", err);
      setAddMessage("Error: Could not add listing.");
    } finally {
      setIsAddingListing(false);
    }
  };

  // ------- Batch Sync All Published to Website DB -------
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState("");

  const handleSyncAllToWebsite = async () => {
    if (publishedVehicles.length === 0) {
      alert("No published vehicles to sync.");
      return;
    }
    if (!confirm(`Sync all ${publishedVehicles.length} published vehicles to the public website database?`)) return;

    setIsSyncingAll(true);
    setSyncStatusMsg("");

    try {
      let syncedCount = 0;
      for (const vehicle of publishedVehicles) {
        await syncVehicleToWebsite(vehicle.id, vehicle);
        syncedCount++;
      }
      setSyncStatusMsg(`Successfully synced ${syncedCount} vehicles to the website database!`);
      setTimeout(() => setSyncStatusMsg(""), 4000);
    } catch (error) {
      console.error("Failed to sync all vehicles:", error);
      alert("An error occurred while syncing vehicles.");
    } finally {
      setIsSyncingAll(false);
    }
  };

  // ------- Tabs -------

  const tabs: { key: Tab; label: string; count?: number; icon: any }[] = [
    { key: "published", label: "Published Inventory", count: publishedVehicles.length, icon: Globe },
    { key: "drafts", label: "Awaiting Publication", count: draftVehicles.length, icon: Inbox },
    { key: "add", label: "Add Web Listing", icon: PlusCircle },
  ];

  return (
    <>
      <div className="space-y-6">

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-5 border-slate-100 flex items-center justify-between shadow-sm bg-gradient-to-tr from-blue-50 to-white">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Published</p>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-1">
                {publishedVehicles.filter(v => v.status !== "Sold").length}
              </h3>
            </div>
            <div className="p-3 bg-blue-100/60 rounded-xl text-blue-600">
              <Globe size={22} />
            </div>
          </Card>
          <Card className="p-5 border-slate-100 flex items-center justify-between shadow-sm bg-gradient-to-tr from-emerald-50 to-white">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Live Online</p>
              <h3 className="text-2xl font-extrabold text-emerald-900 mt-1">
                {publishedVehicles.filter(v => (v.status === "Available" || !v.status) && !v.isHidden).length}
              </h3>
            </div>
            <div className="p-3 bg-emerald-100/60 rounded-xl text-emerald-600">
              <CheckCircle2 size={22} />
            </div>
          </Card>
          <Card className="p-5 border-slate-100 flex items-center justify-between shadow-sm bg-gradient-to-tr from-orange-50 to-white">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Hidden from Web</p>
              <h3 className="text-2xl font-extrabold text-amber-700 mt-1">
                {publishedVehicles.filter(v => v.status === "Hidden" || v.isHidden === true).length}
              </h3>
            </div>
            <div className="p-3 bg-amber-100/60 rounded-xl text-amber-600">
              <EyeOff size={22} />
            </div>
          </Card>
          <Card className="p-5 border-slate-100 flex items-center justify-between shadow-sm bg-gradient-to-tr from-amber-50 to-white">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Awaiting Publication</p>
              <h3 className="text-2xl font-extrabold text-amber-800 mt-1">{draftVehicles.length}</h3>
            </div>
            <div className="p-3 bg-amber-100/60 rounded-xl text-amber-600">
              <Inbox size={22} />
            </div>
          </Card>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-full md:w-fit max-sm:overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSearchTerm(""); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap
                ${activeTab === tab.key
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
                }`}
            >
              <tab.icon size={15} />
              {tab.label}
              {tab.count !== undefined && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold
                  ${activeTab === tab.key ? "bg-slate-100 text-slate-700" : "bg-slate-200 text-slate-500"}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ---------- PUBLISHED TAB ---------- */}
        {activeTab === "published" && (
          <div className="space-y-4">
            {/* Filters */}
            <Card className="p-4 border-slate-100 shadow-sm">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                  <Input
                    className="pl-9 bg-white"
                    placeholder="Search by make, model, chassis, color..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={brandFilter} onValueChange={setBrandFilter}>
                  <SelectTrigger className="w-[140px] bg-white">
                    <SelectValue placeholder="All Brands" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Brands</SelectItem>
                    {uniqueBrands.map(b => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={visibilityFilter} onValueChange={(val: any) => setVisibilityFilter(val)}>
                  <SelectTrigger className="w-[150px] bg-white font-semibold text-xs">
                    <SelectValue placeholder="Visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Visibility</SelectItem>
                    <SelectItem value="LIVE">Live Online</SelectItem>
                    <SelectItem value="HIDDEN">Hidden Only</SelectItem>
                  </SelectContent>
                </Select>
                <Badge variant="outline" className="flex items-center px-3 py-2 text-xs font-bold text-slate-600 border-slate-200 bg-white">
                  {filteredPublished.length} of {publishedVehicles.length}
                </Badge>
                <Button
                  onClick={handleSyncAllToWebsite}
                  disabled={isSyncingAll || publishedVehicles.length === 0}
                  variant="outline"
                  className="gap-2 text-xs font-bold text-blue-600 border-blue-200 hover:bg-blue-50 bg-white"
                  title="Push all published listings to public website database"
                >
                  <RefreshCw size={13} className={isSyncingAll ? "animate-spin" : ""} />
                  {isSyncingAll ? "Syncing to Website..." : "Sync to Website DB"}
                </Button>
              </div>
            </Card>

            {syncStatusMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                {syncStatusMsg}
              </div>
            )}

            {/* Grid */}
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 min-h-[300px]">
              {filteredPublished.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredPublished.map(vehicle => (
                    <WebsiteVehicleCard
                      key={vehicle.id}
                      vehicle={vehicle}
                      onOpenDetails={(v) => setSelectedVehicleId(v.id)}
                      onToggleVisibility={handleToggleVisibility}
                      isTogglingVisibility={togglingVehicleId === vehicle.id}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <div className="h-16 w-16 bg-slate-200/60 rounded-full flex items-center justify-center mb-4">
                    <Globe size={28} />
                  </div>
                  <p className="text-sm font-bold text-slate-500">No published vehicles found</p>
                  <p className="text-xs text-slate-400 mt-1">Publish vehicles from the Awaiting Publication tab.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---------- DRAFTS TAB ---------- */}
        {activeTab === "drafts" && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <Input
                className="pl-9 bg-white"
                placeholder="Search drafts by brand, model, chassis..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              {filteredDrafts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 bg-slate-50 rounded-2xl border border-slate-100 text-slate-400">
                  <Inbox size={36} className="mb-3 opacity-30" />
                  <p className="text-sm font-bold text-slate-500">No vehicles awaiting publication</p>
                  <p className="text-xs text-slate-400 mt-1">All purchase invoice vehicles have been published.</p>
                </div>
              ) : (
                filteredDrafts.map(vehicle => (
                  <div key={vehicle.id}
                    className="flex items-center justify-between max-sm:flex-wrap max-sm:gap-3 p-4 bg-white border border-slate-100 rounded-xl hover:border-amber-200 hover:shadow-sm transition-all">
                    <div className="flex items-center gap-4">
                      {vehicle.assets && vehicle.assets.length > 0 ? (
                        <div 
                          className="h-10 w-10 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setViewingDraftVehicle(vehicle)}
                        >
                          <img src={vehicle.assets[0]} alt="Vehicle" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm shrink-0">
                          <Car size={18} />
                        </div>
                      )}
                      <div>
                        <h4 className="font-semibold text-slate-900">
                          {vehicle.brandName} {vehicle.model}
                          {vehicle.variant && <span className="text-xs font-normal text-slate-500 ml-1">{vehicle.variant}</span>}
                        </h4>
                        <div className="flex max-sm:flex-wrap items-center gap-3 text-xs text-slate-500 mt-0.5">
                          <span>Year: {vehicle.modelYear || vehicle.year}</span>
                          <span className="border-l pl-3 border-slate-200">{vehicle.color}</span>
                          <span className="border-l pl-3 border-slate-200 font-mono">{vehicle.chassisNumber}</span>
                          {vehicle.purchasePrice && (
                            <span className="border-l pl-3 border-slate-200 font-semibold text-slate-700">
                              Rs. {Number(vehicle.purchasePrice).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0 items-center max-sm:max-w-full max-sm:flex-wrap">
                      <div className="relative">
                        <Input
                          type="file"
                          accept="image/*"
                          multiple
                          className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full"
                          onChange={(e) => handleDraftImageUpload(e, vehicle.id)}
                          disabled={uploadingDraftId === vehicle.id}
                          title="Upload images"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs gap-1.5 bg-white border-slate-200 text-slate-700 hover:bg-slate-50 relative z-0 h-8"
                          disabled={uploadingDraftId === vehicle.id}
                        >
                          {uploadingDraftId === vehicle.id ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                          Upload Image
                        </Button>
                      </div>
                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-200 bg-amber-50 h-8 flex items-center">
                        Draft
                      </Badge>
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5 h-8"
                        onClick={() => openPublishDialog(vehicle)}
                      >
                        <Send size={13} />
                        Publish to Web
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ---------- ADD LISTING TAB ---------- */}
        {activeTab === "add" && (
          <Card className="p-6 max-w-3xl">
            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-100">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <PlusCircle size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Add Website-Only Listing</h3>
                <p className="text-xs text-slate-500">This vehicle will be listed online only and is not physically in the showroom.</p>
              </div>
            </div>

            {addMessage && (
              <div className={`mb-4 p-3 rounded-lg text-xs font-medium flex items-center gap-2
                ${addMessage.includes("Error") ? "bg-red-50 text-red-700 border border-red-100" : "bg-green-50 text-green-700 border border-green-100"}`}>
                {!addMessage.includes("Error") && <CheckCircle2 size={14} />}
                {addMessage}
              </div>
            )}

            <form onSubmit={handleAddListing} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">Make / Brand *</label>
                  <Select
                    value={selectedBrandId}
                    onValueChange={(val) => {
                      setSelectedBrandId(val);
                      const brandName = brands.find(b => b.id === val)?.name || "";
                      setNewListing(p => ({ ...p, make: brandName, model: "", variant: "" }));
                    }}
                    required
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Select Brand..." />
                    </SelectTrigger>
                    <SelectContent>
                      {brands.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">Model *</label>
                  <Select
                    value={newListing.model}
                    onValueChange={(val) => {
                      setNewListing(p => ({ ...p, model: val, variant: "" }));
                    }}
                    disabled={!selectedBrandId}
                    required
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder={selectedBrandId ? "Select Model..." : "Choose Brand First"} />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map(m => (
                        <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">Variant / Trim</label>
                  {models.find(m => m.name === newListing.model)?.variants?.length > 0 ? (
                    <Select
                      value={newListing.variant}
                      onValueChange={(val) => setNewListing(p => ({ ...p, variant: val }))}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Select Variant..." />
                      </SelectTrigger>
                      <SelectContent>
                        {models.find(m => m.name === newListing.model)?.variants.map((v: string) => (
                          <SelectItem key={v} value={v}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={newListing.variant}
                      onChange={e => setNewListing(p => ({ ...p, variant: e.target.value }))}
                      placeholder="e.g. GLi"
                      disabled={!newListing.model}
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">Year *</label>
                  <Input required type="number" value={newListing.year} onChange={e => setNewListing(p => ({ ...p, year: e.target.value }))} placeholder="e.g. 2022" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">Color</label>
                  <Select
                    value={newListing.color}
                    onValueChange={(val) => setNewListing(p => ({ ...p, color: val }))}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Select Color..." />
                    </SelectTrigger>
                    <SelectContent>
                      {colors.map(c => (
                        <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">Fuel Type</label>
                  <Select
                    value={newListing.fuelType}
                    onValueChange={(val) => setNewListing(p => ({ ...p, fuelType: val }))}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Select Fuel..." />
                    </SelectTrigger>
                    <SelectContent>
                      {fuelTypes.map(f => (
                        <SelectItem key={f.id} value={f.name}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">Transmission</label>
                  <Select
                    value={newListing.transmission}
                    onValueChange={(val) => setNewListing(p => ({ ...p, transmission: val }))}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Select Trans..." />
                    </SelectTrigger>
                    <SelectContent>
                      {transmissions.map(t => (
                        <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">Reg. Number</label>
                  <Input value={newListing.registrationNo} onChange={e => setNewListing(p => ({ ...p, registrationNo: e.target.value }))} placeholder="e.g. ABC-123" className="uppercase" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">Asking Price (PKR) *</label>
                  <Input required type="number" value={newListing.askingPrice} onChange={e => setNewListing(p => ({ ...p, askingPrice: e.target.value }))} placeholder="e.g. 3500000" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">Chassis Number</label>
                  <Input value={newListing.chassisNo} onChange={e => setNewListing(p => ({ ...p, chassisNo: e.target.value }))} placeholder="Optional" className="font-mono" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">City / Location</label>
                  <Input value={newListing.city} onChange={e => setNewListing(p => ({ ...p, city: e.target.value }))} placeholder="e.g. Sukkur" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">Engine Number</label>
                  <Input value={newListing.engineNo} onChange={e => setNewListing(p => ({ ...p, engineNo: e.target.value }))} placeholder="Optional" className="font-mono" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">Description</label>
                  <Input value={newListing.description} onChange={e => setNewListing(p => ({ ...p, description: e.target.value }))} placeholder="Brief description for website..." />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 gap-2" disabled={isAddingListing}>
                  {isAddingListing ? <><Loader2 size={14} className="animate-spin" />Adding...</> : <><Globe size={14} />Publish Listing</>}
                </Button>
              </div>
            </form>
          </Card>
        )}

      </div>

      {/* Publish Dialog */}
      <Dialog open={!!publishingVehicle} onOpenChange={() => setPublishingVehicle(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Publish to Website Inventory</DialogTitle>
            <DialogDescription>
              Set the public asking price and description for{" "}
              <strong>{publishingVehicle?.brandName} {publishingVehicle?.model}</strong>.
              The internal purchase price will remain private.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {publishMessage && (
              <div className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2
                ${publishMessage.includes("Error") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                {!publishMessage.includes("Error") && <CheckCircle2 size={14} />}
                {publishMessage}
              </div>
            )}

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-sm space-y-1">
              <div className="flex gap-2 text-slate-600">
                <span className="text-slate-400 w-28">Brand / Model:</span>
                <span className="font-semibold">{publishingVehicle?.brandName} {publishingVehicle?.model} ({publishingVehicle?.modelYear || publishingVehicle?.year})</span>
              </div>
              <div className="flex gap-2 text-slate-600">
                <span className="text-slate-400 w-28">Color:</span>
                <span className="font-semibold">{publishingVehicle?.color}</span>
              </div>
              <div className="flex gap-2 text-slate-600">
                <span className="text-slate-400 w-28">Chassis No:</span>
                <span className="font-mono font-semibold">{publishingVehicle?.chassisNumber}</span>
              </div>
              {publishingVehicle?.purchasePrice && (
                <div className="flex gap-2 text-slate-600">
                  <span className="text-slate-400 w-28">Purchase Price:</span>
                  <span className="font-semibold text-slate-900">Rs. {Number(publishingVehicle.purchasePrice).toLocaleString()} (private)</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500">Public Asking Price (PKR) *</label>
              <Input
                type="number"
                value={publishAskingPrice}
                onChange={e => setPublishAskingPrice(e.target.value)}
                placeholder="Enter public listing price..."
                className="font-semibold"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500">Public Description</label>
              <Input
                value={publishDescription}
                onChange={e => setPublishDescription(e.target.value)}
                placeholder="Short description shown on website..."
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setPublishingVehicle(null)} disabled={isPublishing}>Cancel</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 gap-2"
              onClick={handlePublish}
              disabled={isPublishing}
            >
              {isPublishing ? <><Loader2 size={14} className="animate-spin" /> Publishing...</> : <><Send size={14} /> Publish Now</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Draft Images Viewer Modal */}
      <Dialog open={!!viewingDraftVehicle} onOpenChange={() => setViewingDraftVehicle(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Draft Images - {viewingDraftVehicle?.brandName} {viewingDraftVehicle?.model}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 py-4 max-h-[60vh] overflow-y-auto">
            {viewingDraftVehicle?.assets?.map((url: string, index: number) => (
              <div key={index} className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-square">
                <img src={url} alt={`Draft Image ${index + 1}`} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-8 w-8 p-0 rounded-full"
                    onClick={() => handleDeleteDraftImage(viewingDraftVehicle.id, url)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
            {(!viewingDraftVehicle?.assets || viewingDraftVehicle.assets.length === 0) && (
              <div className="col-span-full py-8 text-center text-slate-400">
                <ImageIcon size={32} className="mx-auto mb-2 opacity-50" />
                <p>No images uploaded yet.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingDraftVehicle(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Website Vehicle Detail Modal */}
      <WebsiteVehicleDetailModal
        isOpen={!!selectedVehicleId}
        onClose={() => setSelectedVehicleId(null)}
        vehicle={viewingVehicle}
        onToggleVisibility={handleToggleVisibility}
        isTogglingVisibility={viewingVehicle ? togglingVehicleId === viewingVehicle.id : false}
      />
    </>
  );
};
