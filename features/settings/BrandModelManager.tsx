"use client";
import { useState, useEffect } from "react";
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, where, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useImageUpload } from "@/hooks/useImageUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, ChevronRight, Plus, X, Pencil, Check } from "lucide-react";

// Types
interface Brand {
  id: string;
  name: string;
  logoUrl: string;
  active: boolean;
}

interface Model {
  id: string;
  brandId: string;
  name: string;
  bodyType: string;
  active: boolean;
  variants?: string[]; // Added variants array
}

export const BrandModelManager = () => {
  const { uploadImage, uploading } = useImageUpload();

  // State
  const [brands, setBrands] = useState<Brand[]>([]);
  const [models, setModels] = useState<Model[]>([]);

  // Selection State
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);

  // Form Inputs
  const [newBrandName, setNewBrandName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [removeExistingLogo, setRemoveExistingLogo] = useState(false);
  const [editingModel, setEditingModel] = useState<Model | null>(null);
  const [editingVariant, setEditingVariant] = useState<string | null>(null);
  const [newModelName, setNewModelName] = useState("");
  const [newModelBody, setNewModelBody] = useState("");
  const [newVariantName, setNewVariantName] = useState("");

  // Fetch Brands
  useEffect(() => {
    const q = query(collection(db, "brands"), orderBy("name"));
    return onSnapshot(q, (snap) => setBrands(snap.docs.map(d => ({ id: d.id, ...d.data() } as Brand))));
  }, []);

  // Fetch Models when Brand selected
  useEffect(() => {
    if (!selectedBrand) {
      setModels([]);
      setSelectedModel(null);
      return;
    }
    const q = query(collection(db, "models"), where("brandId", "==", selectedBrand.id));
    return onSnapshot(q, (snap) => setModels(snap.docs.map(d => ({ id: d.id, ...d.data() } as Model))));
  }, [selectedBrand]);

  // Sync selectedModel with models when models update (e.g. after adding variant)
  useEffect(() => {
    if (selectedModel) {
      const updatedModel = models.find(m => m.id === selectedModel.id);
      if (updatedModel) {
        setSelectedModel(updatedModel);
      }
    }
  }, [models]);

  // --- Actions ---

  const handleAddBrand = async () => {
    if (!newBrandName.trim()) return alert("Brand name is required");

    let logoUrl = "/carlogo.png"; // Default logo

    // If user selected a custom image, upload it
    if (selectedFile) {
      const uploadedUrl = await uploadImage(selectedFile);
      if (uploadedUrl) {
        logoUrl = uploadedUrl;
      }
    }

    await addDoc(collection(db, "brands"), {
      name: newBrandName,
      logoUrl: logoUrl,
      active: true
    });

    setNewBrandName("");
    setSelectedFile(null);
  };

  const handleUpdateBrand = async () => {
    if (!editingBrand || !newBrandName.trim()) return alert("Brand name is required");

    let logoUrl = editingBrand.logoUrl; // Keep existing logo by default

    // If user wants to remove existing logo, use default
    if (removeExistingLogo) {
      logoUrl = "/carlogo.png";
    }
    // If user selected a new image, upload it
    else if (selectedFile) {
      const uploadedUrl = await uploadImage(selectedFile);
      if (uploadedUrl) {
        logoUrl = uploadedUrl;
      }
    }

    await updateDoc(doc(db, "brands", editingBrand.id), {
      name: newBrandName,
      logoUrl: logoUrl
    });

    // Reset edit mode
    setEditingBrand(null);
    setNewBrandName("");
    setSelectedFile(null);
    setRemoveExistingLogo(false);
  };

  const handleEditBrand = (brand: Brand, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent brand selection
    setEditingBrand(brand);
    setNewBrandName(brand.name);
    setSelectedFile(null);
    setRemoveExistingLogo(false);
  };

  const handleCancelEdit = () => {
    setEditingBrand(null);
    setNewBrandName("");
    setSelectedFile(null);
    setRemoveExistingLogo(false);
  };

  const handleAddModel = async () => {
    if (!selectedBrand || !newModelName) return;
    await addDoc(collection(db, "models"), {
      brandId: selectedBrand.id,
      name: newModelName,
      bodyType: newModelBody,
      variants: [], // Initialize empty variants
      active: true
    });
    setNewModelName("");
    setNewModelBody("");
  };

  const handleUpdateModel = async () => {
    if (!editingModel || !newModelName.trim()) return alert("Model name is required");

    await updateDoc(doc(db, "models", editingModel.id), {
      name: newModelName,
      bodyType: newModelBody
    });

    setEditingModel(null);
    setNewModelName("");
    setNewModelBody("");
  };

  const handleEditModel = (model: Model, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingModel(model);
    setNewModelName(model.name);
    setNewModelBody(model.bodyType);
  };

  const handleCancelModelEdit = () => {
    setEditingModel(null);
    setNewModelName("");
    setNewModelBody("");
  };

  const handleAddVariant = async () => {
    if (!selectedModel || !newVariantName.trim()) return;

    try {
      await updateDoc(doc(db, "models", selectedModel.id), {
        variants: arrayUnion(newVariantName.trim())
      });
      setNewVariantName("");
    } catch (error) {
      console.error("Error adding variant:", error);
    }
  };

  const handleUpdateVariant = async () => {
    if (!selectedModel || !editingVariant || !newVariantName.trim()) return;

    // Remove old variant
    await updateDoc(doc(db, "models", selectedModel.id), {
      variants: arrayRemove(editingVariant)
    });

    // Add updated variant
    await updateDoc(doc(db, "models", selectedModel.id), {
      variants: arrayUnion(newVariantName.trim())
    });

    setEditingVariant(null);
    setNewVariantName("");
  };

  const handleEditVariant = (variant: string) => {
    setEditingVariant(variant);
    setNewVariantName(variant);
  };

  const handleCancelVariantEdit = () => {
    setEditingVariant(null);
    setNewVariantName("");
  };

  const handleRemoveVariant = async (variant: string) => {
    if (!selectedModel) return;
    if (confirm(`Remove variant ${variant}?`)) {
      await updateDoc(doc(db, "models", selectedModel.id), {
        variants: arrayRemove(variant)
      });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">

      {/* COLUMN 1: BRANDS */}
      <Card className="flex flex-col overflow-hidden h-[400px] lg:h-[600px]">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-bold text-slate-800">{editingBrand ? "✏️ Edit Brand" : "1. Brands"}</h3>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {brands.map(brand => (
            <div
              key={brand.id}
              onClick={() => { setSelectedBrand(brand); setSelectedModel(null); }}
              className={`flex items-center p-3 rounded-lg cursor-pointer border transition-all ${selectedBrand?.id === brand.id ? "bg-blue-50 border-blue-200 ring-1 ring-blue-200" : "bg-white border-slate-100 hover:border-blue-100"
                }`}
            >
              <img src={brand.logoUrl} className="w-8 h-8 object-contain mr-3" alt="logo" />
              <span className="flex-1 font-medium text-sm">{brand.name}</span>
              <div className="flex items-center gap-2">
                {selectedBrand?.id === brand.id && <ChevronRight size={16} className="text-blue-500" />}
                <button
                  onClick={(e) => handleEditBrand(brand, e)}
                  className="text-slate-300 hover:text-blue-500 p-1 transition-colors"
                >
                  <Pencil size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="New Brand Name"
              value={newBrandName}
              onChange={e => setNewBrandName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (editingBrand ? handleUpdateBrand() : handleAddBrand())}
              className="bg-white flex-1"
            />
            <Button
              size="icon"
              onClick={editingBrand ? handleUpdateBrand : handleAddBrand}
              disabled={uploading || !newBrandName.trim()}
              className="shrink-0 bg-slate-900"
            >
              <ChevronRight size={16} />
            </Button>
            {editingBrand && (
              <Button
                size="icon"
                onClick={handleCancelEdit}
                variant="ghost"
                className="shrink-0"
              >
                <X size={16} />
              </Button>
            )}
          </div>
          {editingBrand && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200">
                <img src={editingBrand.logoUrl} className="w-8 h-8 object-contain" alt="current" />
                <span className="text-xs text-slate-500">Current Logo</span>
              </div>
              <label className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200 cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={removeExistingLogo}
                  onChange={(e) => setRemoveExistingLogo(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-xs text-slate-600">Remove logo & use default</span>
              </label>
            </div>
          )}
          <Input
            type="file"
            accept="image/*"
            className="text-xs bg-white"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            disabled={uploading}
          />
          {selectedFile && (
            <div className="text-xs text-slate-600 flex items-center gap-2">
              <span className="truncate">{selectedFile.name}</span>
              <button onClick={() => setSelectedFile(null)} className="text-slate-400 hover:text-red-500">
                <X size={12} />
              </button>
            </div>
          )}
          {uploading && <div className="text-xs text-center text-blue-500 animate-pulse">Uploading logo...</div>}
        </div>
      </Card>

      {/* COLUMN 2: MODELS */}
      <Card className="flex flex-col overflow-hidden h-[400px] lg:h-[600px]">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-slate-800">{editingModel ? "✏️ Edit Model" : "2. Models"}</h3>
          {selectedBrand && <Badge variant="secondary" className="text-[10px]">{selectedBrand.name}</Badge>}
        </div>

        {!selectedBrand ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm p-4 text-center">
            Select a brand to manage models
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {models.map(model => (
                <div
                  key={model.id}
                  onClick={() => setSelectedModel(model)}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer border transition-all ${selectedModel?.id === model.id ? "bg-blue-50 border-blue-200 ring-1 ring-blue-200" : "bg-white border-slate-100 hover:border-blue-100"
                    }`}
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm">{model.name}</p>
                    <p className="text-xs text-slate-400">{model.bodyType}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedModel?.id === model.id && <ChevronRight size={16} className="text-blue-500" />}
                    <button
                      onClick={(e) => handleEditModel(model, e)}
                      className="text-slate-300 hover:text-blue-500 p-1 transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteDoc(doc(db, "models", model.id)); }}
                      className="text-slate-300 hover:text-red-500 p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {models.length === 0 && <p className="text-center text-xs text-slate-400 py-4">No models found.</p>}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-3">
              <div className="space-y-2">
                <Input
                  placeholder="Model Name (e.g. Corolla)"
                  value={newModelName}
                  onChange={e => setNewModelName(e.target.value)}
                  className="bg-white"
                />
                <Input
                  placeholder="Body (e.g. Sedan)"
                  value={newModelBody}
                  onChange={e => setNewModelBody(e.target.value)}
                  className="bg-white"
                />
              </div>
              <Button onClick={editingModel ? handleUpdateModel : handleAddModel} className="w-full bg-slate-900 text-white size-sm">
                {editingModel ? "Update Model" : "Add Model"}
              </Button>
              {editingModel && (
                <Button onClick={handleCancelModelEdit} variant="ghost" className="w-full">
                  Cancel
                </Button>
              )}
            </div>
          </>
        )}
      </Card>

      {/* COLUMN 3: VARIANTS */}
      <Card className="flex flex-col overflow-hidden h-[400px] lg:h-[600px]">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-slate-800">3. Variants</h3>
          {selectedModel && <Badge variant="secondary" className="text-[10px]">{selectedModel.name}</Badge>}
        </div>

        {!selectedModel ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm p-4 text-center">
            Select a model to manage variants
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {selectedModel.variants && selectedModel.variants.length > 0 ? (
                selectedModel.variants.map((variant, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg group hover:border-blue-100">
                    <span className="text-sm font-medium text-slate-700">{variant}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEditVariant(variant)}
                        className="text-slate-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleRemoveVariant(variant)}
                        className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 space-y-2">
                  <div className="bg-slate-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto text-slate-300">
                    <Plus size={24} />
                  </div>
                  <p className="text-xs text-slate-400">No variants defined.</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex gap-2">
              <Input
                placeholder="Variant (e.g. 1.8 CVT)"
                value={newVariantName}
                onChange={e => setNewVariantName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (editingVariant ? handleUpdateVariant() : handleAddVariant())}
                className="bg-white"
              />
              <Button size="icon" onClick={editingVariant ? handleUpdateVariant : handleAddVariant} className="shrink-0 bg-slate-900">
                {editingVariant ? <Check size={16} /> : <Plus size={16} />}
              </Button>
              {editingVariant && (
                <Button size="icon" onClick={handleCancelVariantEdit} variant="ghost" className="shrink-0">
                  <X size={16} />
                </Button>
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  );
};