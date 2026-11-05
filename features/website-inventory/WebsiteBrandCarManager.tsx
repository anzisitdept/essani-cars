"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
  Search, CarFront, PlusCircle, Loader2, Globe, Eye, EyeOff, Trash2,
  Pencil, Building2, Sparkles, CheckCircle2, TriangleAlert, RefreshCw, Database,
  ChevronUp, ChevronDown, GripVertical, Image as ImageIcon
} from "lucide-react";
import { websiteBrandApi, websiteNewCarApi } from "@/lib/websiteSync";
import { WebsiteDataInspector } from "./WebsiteDataInspector";

const slugifyClient = (v: string) =>
  String(v || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/* ----------------------------------------------------------- Brand dialog */

const emptyBrand = { name: "", slug: "", logoUrl: "", description: "", status: "published" };

const BrandDialog = ({ open, editing, onClose, onSaved }: {
  open: boolean;
  editing: any | null;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [form, setForm] = useState(emptyBrand);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (open) {
      setForm(editing
        ? {
          name: editing.name || "",
          slug: editing.slug || editing.id || "",
          logoUrl: editing.logo_url || editing.logoUrl || "",
          description: editing.description || "",
          status: editing.status || "published",
        }
        : emptyBrand);
      setMessage("");
    }
  }, [open, editing]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      setMessage("Error: Brand name is required.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      let data;
      if (editing) {
        data = await websiteBrandApi.patch(editing.slug || editing.id, form);
      } else {
        data = await websiteBrandApi.save(form);
      }
      if (data?.error) throw new Error(data.error);
      onSaved();
      onClose();
    } catch (error: any) {
      setMessage(`Error: ${String(error?.message || error)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Website Brand" : "Add Website Brand"}</DialogTitle>
          <DialogDescription>
            Creates the brand that groups its cars on the public website.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          {message.includes("Error") ? (
            <div className="p-3 rounded-lg text-xs font-medium bg-red-50 text-red-700 border border-red-100 flex items-center gap-2">
              <TriangleAlert size={14} /> {message.replace("Error: ", "")}
            </div>
          ) : message ? (
            <div className="p-3 rounded-lg text-xs font-medium bg-green-50 text-green-700">{message}</div>
          ) : null}
          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-500">Brand Name *</Label>
            <Input
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value, slug: editing ? p.slug : slugifyClient(e.target.value) }))}
              placeholder="e.g. Toyota"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-500">Slug (document id / URL path)</Label>
            <Input
              disabled={!!editing}
              value={form.slug || slugifyClient(form.name)}
              onChange={e => setForm(p => ({ ...p, slug: slugifyClient(e.target.value) }))}
              placeholder="e.g. toyota"
              className="font-mono text-xs"
            />
            <p className="text-[10px] text-slate-400">Document path: <span className="font-mono">new_cars/{form.slug || slugifyClient(form.name) || "brand-slug"}</span>{editing && <span className="text-amber-600"> — slug is fixed so website links stay stable</span>}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-500">Logo URL</Label>
            <Input
              value={form.logoUrl}
              onChange={e => setForm(p => ({ ...p, logoUrl: e.target.value }))}
              placeholder="https://... (brand logo image)"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-500">Brand Status</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="published">Published (visible)</SelectItem>
                  <SelectItem value="draft">Draft (hidden)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-500">Description</Label>
              <Input
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Optional brand blurb"
              />
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button className="bg-blue-600 hover:bg-blue-700 gap-2" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {editing ? "Save Brand" : "Create Brand"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ------------------------------------------------------------- Car dialog */

interface SpecRow { key: string; value: string }
interface VariantRow { name: string; price: string; status: string }

const emptyCar = {
  name: "", model: "", price: "", priceMin: "", priceMax: "",
  description: "", bodyType: "", transmission: "", fuelType: "", city: "",
  status: "published", featured: false,
};

const CarDialog = ({ open, brand, editing, onClose, onSaved }: {
  open: boolean;
  brand: any;
  editing: any | null;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [form, setForm] = useState({ ...emptyCar });
  const [imagesText, setImagesText] = useState("");
  const [specs, setSpecs] = useState<SpecRow[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open || !brand) return;
    if (editing) {
      setForm({
        name: editing.name || editing.model || "",
        model: editing.model || "",
        price: editing.price != null ? String(editing.price) : "",
        priceMin: editing.price_min != null ? String(editing.price_min) : "",
        priceMax: editing.price_max != null ? String(editing.price_max) : "",
        description: editing.description || "",
        bodyType: editing.body_type || "",
        transmission: editing.transmission || "",
        fuelType: editing.fuelType || editing.fuel_type || "",
        city: editing.city || "",
        status: editing.status || "published",
        featured: editing.featured === true,
      });
      const imgs: any[] = editing.images || (editing.image ? [editing.image] : (editing.cover_image ? [editing.cover_image] : []));
      setImagesText(imgs.map((i: any) => (typeof i === "string" ? i : i?.url || "")).filter(Boolean).join("\n"));
      const specObj = editing.specifications || {};
      setSpecs(Object.entries(specObj).map(([key, value]) => ({ key, value: String(value ?? "") })));
      // Live cars carry their variants in the `variants` subcollection — the
      // listing embeds them so editing preserves rows instead of wiping them.
      setVariants((editing.variants || []).map((v: any) => ({
        name: v.name || "",
        price: v.price != null ? String(v.price) : "",
        status: v.status === "draft" ? "draft" : "published",
      })));
    } else {
      setForm({ ...emptyCar });
      setImagesText("");
      setSpecs([]);
      setVariants([]);
    }
    setMessage("");
  }, [open, editing, brand]);

  const handleSave = async () => {
    const modelName = form.model.trim();
    const displayName = form.name.trim();
    if (!modelName && !displayName) {
      setMessage("Error: Model or Display Name is required.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const payload = {
        ...form,
        name: displayName || modelName,
        model: modelName || displayName,
        images: imagesText.split("\n").map(u => u.trim()).filter(Boolean),
        specifications: Object.fromEntries(specs.filter(s => s.key.trim()).map(s => [s.key.trim(), s.value.trim()])),
        variantsInput: variants
          .filter(v => v.name.trim())
          .map(v => ({ name: v.name.trim(), price: v.price || null, status: v.status === "draft" ? "draft" : "published" })),
      };
      let data;
      if (editing) {
        data = await websiteNewCarApi.patch(brand.id, brand.name, editing.id, payload);
      } else {
        data = await websiteNewCarApi.create(brand.id, brand.name, payload);
      }
      if (data?.error) throw new Error(data.error);
      onSaved();
      onClose();
    } catch (error: any) {
      setMessage(`Error: ${String(error?.message || error)}`);
    } finally {
      setSaving(false);
    }
  };

  const moneyLabel = (v: unknown) => {
    if (v == null || String(v).trim() === "") return "—";
    const n = Number(v);
    // Scraped docs keep prices as free text (e.g. "PKR 3.5 crore") — print
    // them verbatim instead of a broken "PKR NaN".
    return Number.isFinite(n) ? `PKR ${n.toLocaleString()}` : String(v);
  };
  const priceLabel = (() => {
    const min = Number(form.priceMin), max = Number(form.priceMax);
    if (form.priceMin && form.priceMax && Number.isFinite(min) && Number.isFinite(max)) {
      return `PKR ${min.toLocaleString()} – ${max.toLocaleString()}`;
    }
    return form.price ? moneyLabel(form.price) : (form.priceMin || form.priceMax) ? `${moneyLabel(form.priceMin || form.priceMax)}` : "—";
  })();

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Website Car" : "Add New Car"} — {brand?.name}</DialogTitle>
          <DialogDescription>
            This car will be listed under {brand?.name} on the public website.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {message.includes("Error") ? (
            <div className="p-3 rounded-lg text-xs font-medium bg-red-50 text-red-700 border border-red-100 flex items-center gap-2">
              <TriangleAlert size={14} /> {message.replace("Error: ", "")}
            </div>
          ) : message ? (
            <div className="p-3 rounded-lg text-xs font-medium bg-green-50 text-green-700">{message}</div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-500">Display Name</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Corolla Altis (defaults to model)" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-500">Model *</Label>
              <Input value={form.model} onChange={e => setForm(p => ({ ...p, model: e.target.value }))} placeholder="e.g. Corolla" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-500">Price (single)</Label>
              <Input type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder="e.g. 3500000" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-500">Price Min</Label>
              <Input type="number" value={form.priceMin} onChange={e => setForm(p => ({ ...p, priceMin: e.target.value }))} placeholder="range from" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-500">Price Max</Label>
              <Input type="number" value={form.priceMax} onChange={e => setForm(p => ({ ...p, priceMax: e.target.value }))} placeholder="range to" />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 -mt-2">Public price shown: <span className="font-semibold text-slate-600">{priceLabel}</span> (range wins when both set)</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-500">Body Type</Label>
              <Input value={form.bodyType} onChange={e => setForm(p => ({ ...p, bodyType: e.target.value }))} placeholder="e.g. Sedan" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-500">Transmission</Label>
              <Input value={form.transmission} onChange={e => setForm(p => ({ ...p, transmission: e.target.value }))} placeholder="e.g. Automatic" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-500">Fuel Type</Label>
              <Input value={form.fuelType} onChange={e => setForm(p => ({ ...p, fuelType: e.target.value }))} placeholder="e.g. Petrol" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-500">City</Label>
              <Input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} placeholder="e.g. Sukkur" />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-500">Image URLs (one per line)</Label>
            <Textarea
              value={imagesText}
              onChange={e => setImagesText(e.target.value)}
              placeholder={"https://i.ibb.co/.../front.jpg\nhttps://i.ibb.co/.../side.jpg"}
              className="font-mono text-xs min-h-20"
            />
            <p className="text-[10px] text-slate-400">First image is used as the cover. Upload images elsewhere (e.g. via the used-car screens) and paste the URLs here.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-500">Listing Status</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="published">Published (visible on website)</SelectItem>
                  <SelectItem value="draft">Draft (hidden from website)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 mt-6 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={e => setForm(p => ({ ...p, featured: e.target.checked }))}
                className="h-4 w-4 accent-blue-600"
              />
              <span className="text-xs font-medium text-slate-600 flex items-center gap-1"><Sparkles size={13} className="text-amber-500" /> Featured on website</span>
            </label>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-slate-500">Specifications</Label>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setSpecs(p => [...p, { key: "", value: "" }])}>
                <PlusCircle size={12} /> Add Spec
              </Button>
            </div>
            {specs.length === 0 && <p className="text-[11px] text-slate-400">No specifications added.</p>}
            {specs.map((row, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input className="w-1/3 bg-white" placeholder="Label (e.g. Engine)" value={row.key}
                  onChange={e => setSpecs(p => p.map((r, j) => j === i ? { ...r, key: e.target.value } : r))} />
                <Input className="flex-1 bg-white" placeholder="Value (e.g. 1.8L Dual VVT-i)" value={row.value}
                  onChange={e => setSpecs(p => p.map((r, j) => j === i ? { ...r, value: e.target.value } : r))} />
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => setSpecs(p => p.filter((_, j) => j !== i))}>
                  <Trash2 size={13} />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-slate-500">Variants (stored in the car&apos;s <span className="font-mono">variants</span> subcollection)</Label>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setVariants(p => [...p, { name: "", price: "", status: "published" }])}>
                <PlusCircle size={12} /> Add Variant
              </Button>
            </div>
            {variants.length === 0 && <p className="text-[11px] text-slate-400">No variants added.</p>}
            {variants.map((row, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input className="flex-1 bg-white" placeholder="Variant name (e.g. GLi 1.3 VVT)" value={row.name}
                  onChange={e => setVariants(p => p.map((r, j) => j === i ? { ...r, name: e.target.value } : r))} />
                <Input className="w-40 bg-white" type="number" placeholder="Price (PKR)" value={row.price}
                  onChange={e => setVariants(p => p.map((r, j) => j === i ? { ...r, price: e.target.value } : r))} />
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => setVariants(p => p.filter((_, j) => j !== i))}>
                  <Trash2 size={13} />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button className="bg-blue-600 hover:bg-blue-700 gap-2" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
            {editing ? "Save Car" : "Publish Car"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* --------------------------------------------------------------- Manager */

export const WebsiteBrandCarManager = ({
  onDataChanged,
}: {
  /** Called after any brands/new-cars change so parents can refresh (e.g. live stats). */
  onDataChanged?: () => void;
} = {}) => {
  const { userData } = useAuth();
  const canManage =
    userData?.role === "admin" ||
    userData?.role === "Super Admin" ||
    userData?.permissions?.includes("ALL") ||
    userData?.permissions?.includes("inventory");

  const [brands, setBrands] = useState<any[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(true);
  const [brandsError, setBrandsError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [cars, setCars] = useState<any[]>([]);
  const [loadingCars, setLoadingCars] = useState(false);
  const [carsError, setCarsError] = useState("");
  const [inspectOpen, setInspectOpen] = useState(false);

  const [brandDialogOpen, setBrandDialogOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<any | null>(null);
  const [deletingBrandId, setDeletingBrandId] = useState<string | null>(null);

  const [carDialogOpen, setCarDialogOpen] = useState(false);
  const [editingCar, setEditingCar] = useState<any | null>(null);
  const [deletingCarId, setDeletingCarId] = useState<string | null>(null);
  const [togglingCarId, setTogglingCarId] = useState<string | null>(null);
  const [togglingFeaturedCarId, setTogglingFeaturedCarId] = useState<string | null>(null);

  // Brand arrangement (drag & drop as well as arrow buttons) — the order is
  // persisted in the website project as each brand's `sort_order` field.
  const [arranging, setArranging] = useState(false);
  const [draggingBrandId, setDraggingBrandId] = useState<string | null>(null);
  const [dragOverBrandId, setDragOverBrandId] = useState<string | null>(null);

  const selectedBrand = brands.find(b => b.id === selectedBrandId) || null;

  const loadBrands = useCallback(async () => {
    setLoadingBrands(true);
    setBrandsError("");
    try {
      const data = await websiteBrandApi.list();
      setBrands((data.brands || []).map((b: any) => ({ ...b, id: b.id })));
    } catch (error: any) {
      setBrandsError(String(error?.message || error));
    } finally {
      setLoadingBrands(false);
    }
  }, []);

  const loadCars = useCallback(async (brandSlug: string) => {
    setLoadingCars(true);
    setCarsError("");
    try {
      const data = await websiteNewCarApi.listForBrand(brandSlug);
      setCars(data.cars || []);
    } catch (error: any) {
      setCarsError(String(error?.message || error));
    } finally {
      setLoadingCars(false);
    }
  }, []);

  useEffect(() => {
    if (canManage) loadBrands();
    else setLoadingBrands(false);
  }, [canManage, loadBrands]);

  useEffect(() => {
    if (selectedBrandId) loadCars(selectedBrandId);
    else setCars([]);
  }, [selectedBrandId, loadCars]);

  const refreshAfterWrite = async () => {
    await loadBrands();
    if (selectedBrandId) await loadCars(selectedBrandId);
    onDataChanged?.();
  };

  /**
   * Applies a new arrangement of brands: optimistic update + one PATCH that
   * batch-writes sort_order into Firestore. Reverts on failure.
   */
  const applyBrandOrder = async (orderedIds: string[]) => {
    if (arranging) return;
    const previous = brands;
    const byId = new Map(previous.map(b => [b.id, b]));
    const reordered = orderedIds.map(id => byId.get(id)).filter(Boolean) as any[];
    if (reordered.length !== previous.length) return;
    setBrands(reordered);
    setArranging(true);
    try {
      await websiteBrandApi.reorder(orderedIds);
    } catch (error: any) {
      setBrands(previous);
      setBrandsError(`Could not save the brand order: ${String(error?.message || error)}`);
    } finally {
      setArranging(false);
    }
  };

  const moveBrand = (brandId: string, direction: -1 | 1) => {
    const ids = brands.map(b => b.id);
    const from = ids.indexOf(brandId);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    applyBrandOrder(ids);
  };

  // Rearranging is disabled while search filters the list (partials can't
  // represent a full arrangement) to avoid dragging within a subset.
  const canArrange = !loadingBrands && !arranging && !searchTerm.trim();

  const dragBrandTo = (targetBrandId: string) => {
    const sourceId = draggingBrandId;
    setDraggingBrandId(null);
    setDragOverBrandId(null);
    if (!sourceId || sourceId === targetBrandId) return;
    const ids = brands.map(b => b.id);
    const from = ids.indexOf(sourceId);
    if (from < 0) return;
    ids.splice(from, 1);
    const target = ids.indexOf(targetBrandId);
    ids.splice(target, 0, sourceId);
    applyBrandOrder(ids);
  };

  const filteredBrands = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    if (!lower) return brands;
    return brands.filter(b =>
      (b.name || "").toLowerCase().includes(lower) ||
      (b.id || "").includes(lower)
    );
  }, [brands, searchTerm]);

  const filteredCars = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    if (!lower) return cars;
    return cars.filter(c =>
      (c.model || "").toLowerCase().includes(lower) ||
      (c.name || "").toLowerCase().includes(lower) ||
      (c.slug || "").includes(lower)
    );
  }, [cars, searchTerm]);

  const handleToggleCarStatus = async (car: any) => {
    if (!selectedBrand) return;
    const newStatus = car.status === "draft" ? "published" : "draft";
    setTogglingCarId(car.id);
    try {
      const data = await websiteNewCarApi.patch(selectedBrand.id, selectedBrand.name, car.id, {
        ...(car.model ? { model: car.model, name: car.name || car.model } : {}),
        status: newStatus,
      });
      if (data?.error) throw new Error(data.error);
      await refreshAfterWrite();
    } catch (error: any) {
      setCarsError(String(error?.message || error));
    } finally {
      setTogglingCarId(null);
    }
  };

  const handleToggleCarFeatured = async (car: any) => {
    if (!selectedBrand) return;
    setTogglingFeaturedCarId(car.id);
    try {
      // Minimal patch — the server merges, so scraped fields stay intact.
      const data = await websiteNewCarApi.patch(selectedBrand.id, selectedBrand.name, car.id, {
        ...(car.model || car.name ? { model: car.model || car.name, name: car.name || car.model } : {}),
        ...(car.status === "draft" || car.status === "published" ? { status: car.status } : {}),
        featured: !(car.featured === true),
      });
      if (data?.error) throw new Error(data.error);
      await refreshAfterWrite();
    } catch (error: any) {
      setCarsError(String(error?.message || error));
    } finally {
      setTogglingFeaturedCarId(null);
    }
  };

  const handleDeleteBrand = async (brand: any) => {
    if (!confirm(`Delete brand "${brand.name}" and ALL of its cars from the public website? This cannot be undone.`)) return;
    setDeletingBrandId(brand.id);
    setBrandsError("");
    try {
      const data = await websiteBrandApi.remove(brand.id);
      if (data?.error) throw new Error(data.error);
      if (selectedBrandId === brand.id) setSelectedBrandId(null);
      await loadBrands();
    } catch (error: any) {
      setBrandsError(String(error?.message || error));
    } finally {
      setDeletingBrandId(null);
    }
  };

  const handleDeleteCar = async (car: any) => {
    if (!selectedBrand) return;
    if (!confirm(`Remove car "${car.name || car.model}" from the public website? This cannot be undone.`)) return;
    setDeletingCarId(car.id);
    setCarsError("");
    try {
      const data = await websiteNewCarApi.remove(selectedBrand.id, car.id);
      if (data?.error) throw new Error(data.error);
      await refreshAfterWrite();
    } catch (error: any) {
      setCarsError(String(error?.message || error));
    } finally {
      setDeletingCarId(null);
    }
  };

  const carImage = (car: any) => {
    const imgs: any[] = car.images || (car.image ? [car.image] : (car.cover_image ? [car.cover_image] : []));
    const first = imgs[0];
    return typeof first === "string" ? first : first?.url || "";
  };

  if (!canManage) {
    return (
      <div className="p-6 bg-slate-50 border border-slate-100 rounded-2xl text-center">
        <p className="text-sm font-bold text-slate-500">You do not have permission to manage the website inventory.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {brandsError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-semibold flex items-start gap-2">
          <TriangleAlert size={16} className="shrink-0 mt-0.5" />
          <span>{brandsError}</span>
        </div>
      )}

      {/* Brand list */}
      <Card className="p-4 border-slate-100 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <Input
              className="pl-9 bg-white"
              placeholder="Search brands & cars..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <Button
            onClick={() => { setEditingBrand(null); setBrandDialogOpen(true); }}
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-xs font-bold"
          >
            <PlusCircle size={14} /> Add Brand
          </Button>
          <Button onClick={refreshAfterWrite} variant="outline" className="gap-2 text-xs font-bold text-slate-600 bg-white" title="Reload brands and cars from the website project">
            <RefreshCw size={13} /> Reload
          </Button>
          <Button
            onClick={() => setInspectOpen(true)}
            variant="outline"
            className="gap-2 text-xs font-bold text-indigo-600 border-indigo-200 hover:bg-indigo-50 bg-white"
            title="See how the existing website data is actually stored"
          >
            <Database size={13} /> Inspect data
          </Button>
        </div>
      </Card>

      {loadingBrands ? (
        <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
          <Loader2 size={18} className="animate-spin" /> Loading brands...
        </div>
      ) : filteredBrands.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 bg-slate-50 rounded-2xl border border-slate-100 text-slate-400">
          <Building2 size={36} className="mb-3 opacity-30" />
          <p className="text-sm font-bold text-slate-500">No website brands yet</p>
          <p className="text-xs text-slate-400 mt-1">Create your first brand to group its cars on the public website.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Brand column */}
          <div className="space-y-2">
            {filteredBrands.map(brand => {
              const isDraft = brand.status === "draft";
              const count = brand.car_count ?? brand.carCount ?? 0;
              const brandIdx = brands.findIndex(b => b.id === brand.id);
              const isDragging = draggingBrandId === brand.id;
              const isDragTarget =
                canArrange && draggingBrandId !== null &&
                dragOverBrandId === brand.id && draggingBrandId !== brand.id;
              return (
                <button
                  key={brand.id}
                  onClick={() => setSelectedBrandId(brand.id)}
                  disabled={deletingBrandId === brand.id}
                  draggable={canArrange}
                  onDragStart={(e) => {
                    if (!canArrange) { e.preventDefault(); return; }
                    setDraggingBrandId(brand.id);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", brand.id);
                  }}
                  onDragOver={(e) => {
                    if (canArrange && draggingBrandId) {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }
                    setDragOverBrandId(brand.id);
                  }}
                  onDragLeave={() => setDragOverBrandId(prev => (prev === brand.id ? null : prev))}
                  onDrop={(e) => { e.preventDefault(); dragBrandTo(brand.id); }}
                  onDragEnd={() => { setDraggingBrandId(null); setDragOverBrandId(null); }}
                  title={canArrange ? "Select the brand — drag this card up/down to change the website order" : undefined}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between gap-2
                    ${selectedBrandId === brand.id
                      ? "border-blue-300 bg-blue-50/60 ring-1 ring-blue-200"
                      : "border-slate-100 bg-white hover:border-slate-300"}
                    ${isDragging ? "opacity-40" : ""}
                    ${isDragTarget ? "ring-2 ring-indigo-300 border-indigo-200" : ""}
                    ${canArrange ? "cursor-grab" : ""}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`hidden sm:flex items-center justify-center h-9 w-9 shrink-0 rounded-lg text-xs font-mono font-bold border transition-colors ${
                        isDragging ? "border-slate-200 bg-slate-100 text-slate-400" : "border-indigo-100 bg-indigo-50 text-indigo-500"
                      }`}
                      title="Display order (1 = shown first on the website)"
                    >
                      {brandIdx >= 0 ? brandIdx + 1 : "?"}
                    </span>
                    {brand.logo_url || brand.logoUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={brand.logo_url || brand.logoUrl} alt={brand.name} draggable={false} className="h-9 w-9 rounded-lg bg-white object-contain border border-slate-200 shrink-0" />
                    ) : (
                      <div className="h-9 w-9 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                        <Building2 size={16} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{brand.name}</p>
                      <p className="text-[10px] font-mono text-slate-400 truncate">{brand.id} • {count} car{count === 1 ? "" : "s"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {canArrange && (
                      <span
                        role="button"
                        onClick={(e) => { e.stopPropagation(); moveBrand(brand.id, -1); }}
                        className={`p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer ${
                          brandIdx <= 0 ? "opacity-30 pointer-events-none" : ""
                        }`}
                        title="Move brand up (saved to Firestore)"
                      >
                        <ChevronUp size={13} />
                      </span>
                    )}
                    {canArrange && (
                      <span
                        role="button"
                        onClick={(e) => { e.stopPropagation(); moveBrand(brand.id, 1); }}
                        className={`p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer ${
                          brandIdx < 0 || brandIdx >= brands.length - 1 ? "opacity-30 pointer-events-none" : ""
                        }`}
                        title="Move brand down (saved to Firestore)"
                      >
                        <ChevronDown size={13} />
                      </span>
                    )}
                    <Badge className={isDraft ? "bg-amber-100 text-amber-800 border-0" : "bg-emerald-100 text-emerald-800 border-0"}>
                      {isDraft ? <EyeOff size={10} /> : <Globe size={10} />}
                      {isDraft ? "Draft" : "Live"}
                    </Badge>
                    <span
                      role="button"
                      onClick={(e) => { e.stopPropagation(); setEditingBrand(brand); setBrandDialogOpen(true); }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
                      title="Edit brand"
                    >
                      <Pencil size={13} />
                    </span>
                    <span
                      role="button"
                      onClick={(e) => { e.stopPropagation(); handleDeleteBrand(brand); }}
                      className={`p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer ${deletingBrandId === brand.id ? "opacity-40 pointer-events-none" : ""}`}
                      title="Delete brand and all its cars"
                    >
                      {deletingBrandId === brand.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Cars column */}
          <div className="lg:col-span-2">
            {!selectedBrand ? (
              <div className="h-full min-h-[220px] flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 text-slate-400">
                <CarFront size={30} className="mb-2 opacity-40" />
                <p className="text-xs font-semibold">Select a brand to manage its cars</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <CarFront size={15} className="text-blue-600" />
                    {selectedBrand.name} Cars
                  </h4>
                  <Button
                    size="sm"
                    onClick={() => { setEditingCar(null); setCarDialogOpen(true); }}
                    className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-xs"
                  >
                    <PlusCircle size={13} /> Add Car
                  </Button>
                </div>

                {loadingCars ? (
                  <div className="flex items-center justify-center py-10 text-slate-400 gap-2">
                    <Loader2 size={16} className="animate-spin" /> Loading cars...
                  </div>
                ) : carsError ? (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-semibold">{carsError}</div>
                ) : filteredCars.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 bg-slate-50 rounded-2xl border border-slate-100 text-slate-400">
                    <CarFront size={28} className="mb-2 opacity-30" />
                    <p className="text-xs font-semibold">No cars under this brand yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredCars.map(car => {
                      const isDraft = car.status === "draft";
                      const isFeaturedCar = car.featured === true;
                      const img = carImage(car);
                      const photoCount = Array.isArray(car.images) ? car.images.filter(Boolean).length : (img ? 1 : 0);
                      const fmtPrice = (v: any) => {
                        if (v == null || String(v).trim() === "") return "";
                        const n = Number(v);
                        return Number.isFinite(n) ? `Rs. ${n.toLocaleString()}` : String(v).trim();
                      };
                      const priceText = (car.price_min != null && car.price_max != null
                        && Number.isFinite(Number(car.price_min)) && Number.isFinite(Number(car.price_max)))
                        ? `Rs. ${Number(car.price_min).toLocaleString()} – ${Number(car.price_max).toLocaleString()}`
                        : (fmtPrice(car.price) || fmtPrice(car.price_range) || "—");
                      const specLine = [car.body_type, car.fuel_type || car.fuelType, car.transmission]
                        .filter(Boolean).join(" • ");
                      return (
                        <div key={car.id} className="relative group/carCard h-full">
                          <div className={`absolute -inset-0.5 rounded-2xl opacity-0 group-hover/carCard:opacity-100 transition duration-500 blur-sm z-0 ${isDraft
                            ? "bg-gradient-to-r from-amber-500 to-orange-500"
                            : "bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-500"
                          }`}></div>
                          <div className={`relative h-full flex flex-col border rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 z-10 bg-white ${isDraft
                            ? "border-amber-200/90 ring-1 ring-amber-100"
                            : "border-slate-100"
                          }`}>
                            {/* Cover image header */}
                            <div className="relative aspect-[16/10] bg-slate-950 overflow-hidden shrink-0">
                              {img ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={img}
                                  alt={car.name || car.model}
                                  className={`w-full h-full object-cover group-hover/carCard:scale-105 transition-transform duration-500 ${isDraft ? "grayscale-[30%] opacity-90" : ""}`}
                                />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-indigo-950 text-slate-600 space-y-2">
                                  <CarFront size={32} className="opacity-80" />
                                  <p className="text-[10px] font-mono uppercase tracking-widest truncate max-w-[80%]">{car.slug}</p>
                                </div>
                              )}

                              {/* Live/Draft + Featured badges */}
                              <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 flex-wrap max-w-[70%]">
                                <Badge className={`${isDraft ? "bg-amber-500/90" : "bg-emerald-500/90"} text-white border-0 px-2 py-0.5 text-[10px] font-bold flex items-center gap-1`}>
                                  {isDraft ? <EyeOff size={10} /> : <Globe size={10} />}
                                  {isDraft ? "Draft" : "Live"}
                                </Badge>
                                {isFeaturedCar && (
                                  <Badge className="bg-amber-400/95 text-amber-950 border-0 px-2 py-0.5 text-[10px] font-bold flex items-center gap-1">
                                    <Sparkles size={10} /> Featured
                                  </Badge>
                                )}
                              </div>

                              {/* Photo count */}
                              {photoCount > 0 && (
                                <Badge className="absolute top-3 right-3 z-10 bg-blue-600/90 text-white border-0 px-2 py-0.5 text-[10px] font-bold flex items-center gap-1">
                                  <ImageIcon size={10} /> {photoCount}
                                </Badge>
                              )}

                              {/* Hover overlay: Manage Car */}
                              <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/60 via-black/15 to-black/30 opacity-0 group-hover/carCard:opacity-100 max-sm:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                <Button
                                  onClick={() => { setEditingCar(car); setCarDialogOpen(true); }}
                                  className="gap-2 bg-white text-slate-900 hover:bg-slate-100 font-bold text-xs px-3.5 py-2.5 rounded-xl shadow-lg border-0 translate-y-2 group-hover/carCard:translate-y-0 transition-all duration-300 active:scale-95"
                                >
                                  <Pencil size={14} className="text-blue-600" /> Manage Car
                                </Button>
                              </div>
                            </div>

                            {/* Info segment */}
                            <div className="p-4 flex-1 flex flex-col gap-2 min-h-[86px]">
                              <div className="min-w-0">
                                <h3 className="text-sm font-bold text-slate-900 truncate leading-tight">{car.name || car.model}</h3>
                                <p className="text-[11px] text-slate-400 truncate mt-0.5">{specLine || car.slug}</p>
                              </div>
                              <p className="text-base font-extrabold text-blue-600 mt-auto">{priceText}</p>
                            </div>

                            {/* Manage actions */}
                            <div className="p-3 border-t border-slate-100 bg-slate-50/70 flex items-center gap-1.5 flex-wrap">
                              <Button
                                size="sm"
                                variant="outline"
                                className={`h-7 text-[10px] font-bold gap-1 px-2 rounded-lg ${isDraft
                                  ? "text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
                                  : "text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100"}`}
                                onClick={() => handleToggleCarStatus(car)}
                                disabled={togglingCarId === car.id}
                                title={isDraft ? "Publish this car on the website" : "Unpublish this car (make it a draft)"}
                              >
                                {togglingCarId === car.id ? <Loader2 size={11} className="animate-spin" /> : isDraft ? <Eye size={11} /> : <EyeOff size={11} />}
                                {isDraft ? "Publish" : "Unpublish"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className={`h-7 text-[10px] font-bold gap-1 px-2 rounded-lg text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100 ${isFeaturedCar ? "ring-1 ring-amber-300" : ""}`}
                                onClick={() => handleToggleCarFeatured(car)}
                                disabled={togglingFeaturedCarId === car.id}
                                title={isFeaturedCar ? "Remove from featured cars" : "Mark this car as featured"}
                              >
                                {togglingFeaturedCarId === car.id ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                                {isFeaturedCar ? "Featured" : "Feature"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[10px] font-bold text-blue-600 border-blue-200 hover:bg-blue-50 rounded-lg gap-1 px-2"
                                onClick={() => { setEditingCar(car); setCarDialogOpen(true); }}
                              >
                                <Pencil size={11} /> Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[10px] font-bold text-red-600 border-red-200 hover:bg-red-50 rounded-lg gap-1 px-2 ml-auto"
                                onClick={() => handleDeleteCar(car)}
                                disabled={deletingCarId === car.id}
                              >
                                {deletingCarId === car.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <BrandDialog
        open={brandDialogOpen}
        editing={editingBrand}
        onClose={() => { setBrandDialogOpen(false); setEditingBrand(null); }}
        onSaved={refreshAfterWrite}
      />
      <CarDialog
        open={carDialogOpen}
        brand={selectedBrand}
        editing={editingCar}
        onClose={() => { setCarDialogOpen(false); setEditingCar(null); }}
        onSaved={refreshAfterWrite}
      />
      <WebsiteDataInspector open={inspectOpen} onClose={() => setInspectOpen(false)} />
    </div>
  );
};
