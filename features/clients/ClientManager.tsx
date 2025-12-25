"use client";
import { useState, useEffect, FormEvent } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, Plus, Pencil, Trash2, User, Phone, Mail, MapPin, CreditCard, X, Image as ImageIcon } from "lucide-react";
import { ClientAssetsModal } from "./ClientAssetsModal";


interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  cnic?: string; // National ID
  address?: string;
  assets?: string[];
}

export const ClientManager = () => {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [assetsClient, setAssetsClient] = useState<Client | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    cnic: "",
    address: ""
  });

  // Fetch Clients
  useEffect(() => {
    const q = query(collection(db, "clients"), orderBy("name"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
    });
    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setFormData({ name: "", phone: "", email: "", cnic: "", address: "" });
    setIsEditing(null);
  };

  const handleEdit = (client: Client) => {
    setFormData({
      name: client.name,
      phone: client.phone,
      email: client.email || "",
      cnic: client.cnic || "",
      address: client.address || ""
    });
    setIsEditing(client.id);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure? This will remove the client from the database.")) {
      await deleteDoc(doc(db, "clients", id));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const payload = {
      ...formData,
      updatedBy: user.uid,
      updatedAt: serverTimestamp()
    };

    try {
      if (isEditing) {
        await updateDoc(doc(db, "clients", isEditing), payload);
      } else {
        await addDoc(collection(db, "clients"), {
          ...payload,
          createdBy: user.uid,
          createdAt: serverTimestamp()
        });
      }
      resetForm();
    } catch (error) {
      console.error("Error saving client:", error);
      alert("Failed to save client.");
    }
  };

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-auto lg:h-[calc(100vh-200px)]">
      {/* Left: Form */}
      <Card className="p-6 h-fit">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">{isEditing ? "Edit Client" : "Add New Client"}</h3>
          {isEditing && (
            <Button variant="ghost" size="sm" onClick={resetForm} className="h-8 w-8 p-0">
              <X size={16} />
            </Button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-500 flex items-center gap-2">
              <User size={12} /> Full Name *
            </label>
            <Input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Ali Khan" />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-500 flex items-center gap-2">
              <Phone size={12} /> Phone Number *
            </label>
            <Input required value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="+92 300..." />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500 flex items-center gap-2">
                <Mail size={12} /> Email
              </label>
              <Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="Optional" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500 flex items-center gap-2">
                <CreditCard size={12} /> CNIC / ID
              </label>
              <Input value={formData.cnic} onChange={e => setFormData({ ...formData, cnic: e.target.value })} placeholder="Optional" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-500 flex items-center gap-2">
              <MapPin size={12} /> Address
            </label>
            <Input value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="City, Area..." />
          </div>

          <Button type="submit" className="w-full bg-slate-900">
            {isEditing ? "Update Client" : "Add Client"}
          </Button>
        </form>
      </Card>

      {/* Right: List */}
      <Card className="lg:col-span-2 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 text-slate-400" size={16} />
            <Input
              className="pl-9 bg-white"
              placeholder="Search by name or phone..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="text-xs text-slate-500 font-medium px-2">
            {filteredClients.length} Clients
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredClients.map(client => (
            <div key={client.id} className="group flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl hover:border-blue-200 hover:shadow-sm transition-all">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold">
                  {client.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">{client.name}</h4>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                    <span className="flex items-center gap-1"><Phone size={10} /> {client.phone}</span>
                    {client.address && <span className="flex items-center gap-1 border-l pl-3 border-slate-200"><MapPin size={10} /> {client.address}</span>}
                  </div>
                </div>
              </div>


              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="sm" onClick={() => setAssetsClient(client)} title="Assets">
                  <ImageIcon size={16} className="text-purple-600" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleEdit(client)} title="Edit">
                  <Pencil size={16} className="text-blue-600" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(client.id)} title="Delete">
                  <Trash2 size={16} className="text-red-500" />
                </Button>
              </div>
            </div>
          ))}

          {filteredClients.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <p>No clients found matching &quot;{searchTerm}&quot;</p>
            </div>
          )}
        </div>
      </Card>

      {/* Assets Modal */}
      <ClientAssetsModal
        isOpen={!!assetsClient}
        onClose={() => setAssetsClient(null)}
        client={assetsClient}
      />
    </div>
  );
};