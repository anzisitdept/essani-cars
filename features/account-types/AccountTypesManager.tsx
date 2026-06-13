"use client";
import { useState, useEffect, FormEvent } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, getDocs, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, Plus, Pencil, Trash2, Layers, X, CheckCircle2, RefreshCw } from "lucide-react";

interface AccountType {
  id: string;
  name: string;
  description?: string;
  createdAt: any;
}

const DEFAULT_TYPES = [
  { name: "Cash in hand", description: "Physical cash reserves, petty cash, and drawer cash" },
  { name: "Bank", description: "Checking, savings, or current bank accounts" },
  { name: "Investor", description: "Accounts for business investors and shareholders" },
  { name: "Expense", description: "Direct and indirect business operational expenses" },
  { name: "Other", description: "Other general accounts and miscellaneous categories" }
];

export const AccountTypesManager = () => {
  const { user } = useAuth();
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    description: ""
  });

  // Fetch Account Types
  useEffect(() => {
    const q = query(collection(db, "account-types"), orderBy("name"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAccountTypes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AccountType)));
    });
    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setFormData({ name: "", description: "" });
    setIsEditing(null);
    setMessage("");
  };

  const handleEdit = (type: AccountType) => {
    setFormData({
      name: type.name,
      description: type.description || ""
    });
    setIsEditing(type.id);
    setMessage("");
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete the account type "${name}"? Accounts using this type may experience issues.`)) {
      try {
        await deleteDoc(doc(db, "account-types", id));
        
        // Log activity
        if (user) {
          await addDoc(collection(db, "logs"), {
            action: `Deleted account type: ${name}`,
            performedBy: user.uid,
            timestamp: serverTimestamp(),
            type: "ADMIN_ACTION"
          });
        }
        
        setMessage("Success: Account type deleted successfully.");
      } catch (error: any) {
        console.error("Error deleting account type:", error);
        setMessage(`Error: ${error.message}`);
      }
    }
  };

  const handleSeedDefaults = async () => {
    if (!user) return;
    setLoading(true);
    setMessage("");
    try {
      const batch = writeBatch(db);
      const collectionRef = collection(db, "account-types");

      // Verify what currently exists to prevent duplicate names
      const existingNames = new Set(accountTypes.map(t => t.name.toLowerCase()));
      let addedCount = 0;

      DEFAULT_TYPES.forEach(item => {
        if (!existingNames.has(item.name.toLowerCase())) {
          const docRef = doc(collectionRef); // Generate auto id
          batch.set(docRef, {
            ...item,
            createdBy: user.uid,
            createdAt: serverTimestamp()
          });
          addedCount++;
        }
      });

      if (addedCount > 0) {
        await batch.commit();
        
        await addDoc(collection(db, "logs"), {
          action: `Seeded ${addedCount} default account types`,
          performedBy: user.uid,
          timestamp: serverTimestamp(),
          type: "ADMIN_ACTION"
        });

        setMessage(`Success: Seeded ${addedCount} default account types.`);
      } else {
        setMessage("Note: Default account types already exist.");
      }
    } catch (error: any) {
      console.error("Error seeding account types:", error);
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.name.trim()) {
      setMessage("Error: Name is required");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        updatedBy: user.uid,
        updatedAt: serverTimestamp()
      };

      if (isEditing) {
        await updateDoc(doc(db, "account-types", isEditing), payload);
        
        await addDoc(collection(db, "logs"), {
          action: `Updated account type: ${formData.name}`,
          performedBy: user.uid,
          timestamp: serverTimestamp(),
          type: "ADMIN_ACTION"
        });

        setMessage("Success: Account type updated successfully.");
      } else {
        // Check for duplicate names
        const duplicate = accountTypes.find(t => t.name.toLowerCase() === formData.name.trim().toLowerCase());
        if (duplicate) {
          setMessage("Error: An account type with this name already exists.");
          setLoading(false);
          return;
        }

        await addDoc(collection(db, "account-types"), {
          ...payload,
          createdBy: user.uid,
          createdAt: serverTimestamp()
        });

        await addDoc(collection(db, "logs"), {
          action: `Created account type: ${formData.name}`,
          performedBy: user.uid,
          timestamp: serverTimestamp(),
          type: "ADMIN_ACTION"
        });

        setMessage("Success: Account type created successfully.");
      }
      resetForm();
    } catch (error: any) {
      console.error("Error saving account type:", error);
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredTypes = accountTypes.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-auto">
      {/* Left: Form */}
      <Card className="p-6 h-fit">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">{isEditing ? "Edit Account Type" : "Add New Account Type"}</h3>
          {isEditing && (
            <Button variant="ghost" size="sm" onClick={resetForm} className="h-8 w-8 p-0">
              <X size={16} />
            </Button>
          )}
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded text-xs font-medium flex items-center gap-2 ${message.includes('Error') ? 'bg-red-50 text-red-700' : message.includes('Note') ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
            {(!message.includes('Error') && !message.includes('Note')) && <CheckCircle2 size={14} />}
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-500 flex items-center gap-2">
              <Layers size={12} /> Account Type Name *
            </label>
            <Input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Cash in hand, Bank, Investor" />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-500">
              Description
            </label>
            <Input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Brief description (optional)" />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1 bg-slate-900" disabled={loading}>
              {isEditing ? "Update Type" : "Add Type"}
            </Button>
            {!isEditing && (
              <Button type="button" variant="outline" onClick={handleSeedDefaults} disabled={loading} title="Seed Default Account Types" className="flex items-center gap-1.5">
                <RefreshCw size={14} /> Seed Default
              </Button>
            )}
          </div>
        </form>
      </Card>

      {/* Right: List */}
      <Card className="lg:col-span-2 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 text-slate-400" size={16} />
            <Input
              className="pl-9 bg-white"
              placeholder="Search by name or description..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="text-xs text-slate-500 font-medium px-2 shrink-0">
            {filteredTypes.length} Types
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px]">
          {filteredTypes.map(type => (
            <div key={type.id} className="group flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl hover:border-blue-200 hover:shadow-sm transition-all">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold">
                  {type.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">
                    {type.name}
                  </h4>
                  {type.description && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {type.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="sm" onClick={() => handleEdit(type)} title="Edit">
                  <Pencil size={16} className="text-blue-600" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(type.id, type.name)} title="Delete">
                  <Trash2 size={16} className="text-red-500" />
                </Button>
              </div>
            </div>
          ))}

          {filteredTypes.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <p>No account types found. Add a custom one or click &quot;Seed Default&quot; to populate standard types.</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
