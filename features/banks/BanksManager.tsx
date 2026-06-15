"use client";
import { useState, useEffect, FormEvent } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, where } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Search, Plus, Pencil, Trash2, Landmark, X, CheckCircle2, AlertTriangle, Building, CreditCard, Hash, Store, UserSquare, Phone, FileImage, UploadCloud } from "lucide-react";

interface Account {
  id: string;
  name: string;
  typeId: string;
  typeName: string;
  balance: number;
  description?: string;
  accountNumber?: string;
  iban?: string;
  bankName?: string;
  shopName?: string;
  fatherName?: string;
  phoneNumber?: string;
  cnic?: string;
  cnicPicture?: string;
  createdAt: any;
}

const hardcodedAccountTypes = [
  { id: "bank", name: "Bank" },
  { id: "investor", name: "Investor" },
  { id: "client", name: "Clients" }
];

export const BanksManager = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    typeId: "bank",
    balance: "0",
    description: "",
    accountNumber: "",
    iban: "",
    bankName: "",
    shopName: "",
    fatherName: "",
    phoneNumber: "",
    cnic: "",
    cnicPicture: "",
  });

  const [cnicFile, setCnicFile] = useState<File | null>(null);

  // Fetch Accounts (only those that match our hardcoded types)
  useEffect(() => {
    const validTypes = hardcodedAccountTypes.map(t => t.id);
    const qAccounts = query(
      collection(db, "accounts"),
      where("typeId", "in", validTypes)
    );
    
    const unsubAccounts = onSnapshot(qAccounts, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
      // Sort client-side since we use 'in' query
      data.sort((a, b) => a.name.localeCompare(b.name));
      setAccounts(data);
    });

    return () => {
      unsubAccounts();
    };
  }, []);

  const resetForm = () => {
    setFormData({ 
      name: "", 
      typeId: "bank", 
      balance: "0", 
      description: "",
      accountNumber: "",
      iban: "",
      bankName: "",
      shopName: "",
      fatherName: "",
      phoneNumber: "",
      cnic: "",
      cnicPicture: "",
    });
    setCnicFile(null);
    setIsEditing(null);
    setMessage("");
  };

  const handleEdit = (account: Account) => {
    setFormData({
      name: account.name,
      typeId: account.typeId,
      balance: account.balance.toString(),
      description: account.description || "",
      accountNumber: account.accountNumber || "",
      iban: account.iban || "",
      bankName: account.bankName || "",
      shopName: account.shopName || "",
      fatherName: account.fatherName || "",
      phoneNumber: account.phoneNumber || "",
      cnic: account.cnic || "",
      cnicPicture: account.cnicPicture || "",
    });
    setCnicFile(null);
    setIsEditing(account.id);
    setMessage("");
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete the account "${name}"?`)) {
      try {
        await deleteDoc(doc(db, "accounts", id));
        
        if (user) {
          await addDoc(collection(db, "logs"), {
            action: `Deleted bank/special account: ${name}`,
            performedBy: user.uid,
            timestamp: serverTimestamp(),
            type: "ADMIN_ACTION"
          });
        }
        
        setMessage("Success: Account deleted successfully.");
      } catch (error: any) {
        console.error("Error deleting account:", error);
        setMessage(`Error: ${error.message}`);
      }
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.name.trim()) {
      setMessage("Error: Account name is required");
      return;
    }

    if (!formData.typeId) {
      setMessage("Error: Please select an account type");
      return;
    }

    if (formData.typeId !== "bank" && !formData.phoneNumber.trim()) {
      setMessage("Error: Phone number is required for this account type");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      let cnicPicUrl = formData.cnicPicture;
      if (cnicFile) {
        const fileRef = ref(storage, `cnic/${Date.now()}_${cnicFile.name}`);
        const snapshot = await uploadBytes(fileRef, cnicFile);
        cnicPicUrl = await getDownloadURL(snapshot.ref);
      }

      const selectedType = hardcodedAccountTypes.find(t => t.id === formData.typeId);
      const typeName = selectedType ? selectedType.name : "Unknown";

      const payload = {
        name: formData.name.trim(),
        typeId: formData.typeId,
        typeName: typeName,
        balance: parseFloat(formData.balance) || 0,
        description: formData.description.trim(),
        accountNumber: formData.accountNumber.trim(),
        iban: formData.iban.trim(),
        bankName: formData.bankName.trim(),
        shopName: formData.shopName.trim(),
        fatherName: formData.fatherName.trim(),
        phoneNumber: formData.phoneNumber.trim(),
        cnic: formData.cnic.trim(),
        cnicPicture: cnicPicUrl,
        updatedBy: user.uid,
        updatedAt: serverTimestamp()
      };

      if (isEditing) {
        await updateDoc(doc(db, "accounts", isEditing), payload);
        
        await addDoc(collection(db, "logs"), {
          action: `Updated bank/special account: ${formData.name}`,
          performedBy: user.uid,
          timestamp: serverTimestamp(),
          type: "ADMIN_ACTION"
        });

        setMessage("Success: Account updated successfully.");
      } else {
        // Check for duplicates
        const duplicate = accounts.find(a => a.name.toLowerCase() === formData.name.trim().toLowerCase());
        if (duplicate) {
          setMessage("Error: An account with this name already exists.");
          setLoading(false);
          return;
        }

        const accountRef = await addDoc(collection(db, "accounts"), {
          ...payload,
          createdBy: user.uid,
          createdAt: serverTimestamp()
        });

        // Opening Balance voucher
        const initialBal = parseFloat(formData.balance) || 0;
        if (initialBal !== 0) {
          const today = new Date().toISOString().split("T")[0];
          await addDoc(collection(db, "vouchers"), {
            voucherNo: `OB-${accountRef.id.slice(-6).toUpperCase()}`,
            date: today,
            description: `Opening Balance — ${formData.name.trim()}`,
            amount: Math.abs(initialBal),
            debit: initialBal > 0 ? Math.abs(initialBal) : 0,
            credit: initialBal < 0 ? Math.abs(initialBal) : 0,
            cashAccountId: accountRef.id,
            cashAccountName: formData.name.trim(),
            cashType: initialBal > 0 ? "debit" : "credit",
            cashPreviousBalance: 0,
            cashNewBalance: initialBal,
            counterAccountId: null,
            counterAccountName: "Opening Balance (Equity)",
            counterType: initialBal > 0 ? "credit" : "debit",
            counterPreviousBalance: null,
            counterNewBalance: null,
            accountId: accountRef.id,
            accountName: formData.name.trim(),
            type: initialBal > 0 ? "debit" : "credit",
            previousBalance: 0,
            newBalance: initialBal,
            isOpeningBalance: true,
            invoiceType: "OPENING_BALANCE",
            createdBy: user.uid,
            createdAt: serverTimestamp()
          });
        }

        await addDoc(collection(db, "logs"), {
          action: `Created bank/special account: ${formData.name} (${typeName})`,
          performedBy: user.uid,
          timestamp: serverTimestamp(),
          type: "ADMIN_ACTION"
        });

        setMessage("Success: Account created successfully.");
      }
      resetForm();
    } catch (error: any) {
      console.error("Error saving account:", error);
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredAccounts = accounts.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.description && a.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (a.accountNumber && a.accountNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (a.iban && a.iban.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (a.shopName && a.shopName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (a.phoneNumber && a.phoneNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = typeFilter === "ALL" || a.typeId === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-auto">
      {/* Left: Form */}
      <Card className="p-6 h-fit">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">{isEditing ? "Edit Account" : "Add New Account"}</h3>
          {isEditing && (
            <Button variant="ghost" size="sm" onClick={resetForm} className="h-8 w-8 p-0">
              <X size={16} />
            </Button>
          )}
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded text-xs font-medium flex items-center gap-2 ${message.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {!message.includes('Error') && <CheckCircle2 size={14} />}
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-500 flex items-center gap-2">
              <Landmark size={12} /> Account Name *
            </label>
            <Input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Main Branch HBL..." />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-500 block">
              Account Type *
            </label>
            <Select disabled value={formData.typeId} onValueChange={(val) => setFormData(prev => ({ ...prev, typeId: val }))}>
              <SelectTrigger className="w-full bg-slate-50 cursor-not-allowed text-slate-500">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {hardcodedAccountTypes.map(type => (
                  <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formData.typeId !== "bank" && (
            <div className="space-y-4 p-4 border rounded-xl bg-slate-50/50">
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 flex items-center gap-2">
                  <Store size={12} /> Shop Name
                </label>
                <Input value={formData.shopName} onChange={e => setFormData({ ...formData, shopName: e.target.value })} placeholder="Shop / Business Name" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 flex items-center gap-2">
                  <UserSquare size={12} /> Father Name
                </label>
                <Input value={formData.fatherName} onChange={e => setFormData({ ...formData, fatherName: e.target.value })} placeholder="Father's Name" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 flex items-center gap-2">
                  <Phone size={12} /> Phone Number *
                </label>
                <Input required={formData.typeId !== "bank"} value={formData.phoneNumber} onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })} placeholder="e.g. 03001234567" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 flex items-center gap-2">
                  <CreditCard size={12} /> CNIC / ID
                </label>
                <Input value={formData.cnic} onChange={e => setFormData({ ...formData, cnic: e.target.value })} placeholder="XXXXX-XXXXXXX-X" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 flex items-center gap-2">
                  <FileImage size={12} /> CNIC Picture / Scan
                </label>
                <div className="flex items-center gap-2">
                  <Input 
                    type="file" 
                    accept="image/*"
                    onChange={e => {
                      if (e.target.files && e.target.files.length > 0) {
                        setCnicFile(e.target.files[0]);
                      }
                    }} 
                    className="file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>
                {(formData.cnicPicture || cnicFile) && (
                  <div className="text-[10px] text-green-600 font-medium flex items-center gap-1 mt-1">
                    <CheckCircle2 size={12} /> {cnicFile ? "New image selected" : "Image previously uploaded"}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-500 flex items-center gap-2">
              <Building size={12} /> Bank Name
            </label>
            <Input value={formData.bankName} onChange={e => setFormData({ ...formData, bankName: e.target.value })} placeholder="e.g. HBL, Meezan Bank" />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-500 flex items-center gap-2">
              <Hash size={12} /> Account Number
            </label>
            <Input value={formData.accountNumber} onChange={e => setFormData({ ...formData, accountNumber: e.target.value })} placeholder="Account Number" />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-500 flex items-center gap-2">
              <CreditCard size={12} /> IBAN Number
            </label>
            <Input value={formData.iban} onChange={e => setFormData({ ...formData, iban: e.target.value })} placeholder="PK00XXXX000000000000" />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-500 block">
              Initial Balance / Current Balance
            </label>
            <Input type="number" step="0.01" value={formData.balance} onChange={e => setFormData({ ...formData, balance: e.target.value })} placeholder="0.00" />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-500">
              Description / Notes
            </label>
            <Input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Brief info (optional)" />
          </div>

          <Button type="submit" className="w-full bg-slate-900 mt-2" disabled={loading}>
            {isEditing ? "Update Account" : "Add Account"}
          </Button>
        </form>
      </Card>

      {/* Right: List */}
      <Card className="lg:col-span-2 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row gap-4 justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 text-slate-400" size={16} />
            <Input
              className="pl-9 bg-white"
              placeholder="Search by name, IBAN, notes..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px] bg-white">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                {hardcodedAccountTypes.map(type => (
                  <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs text-slate-500 font-medium px-2 shrink-0">
              {filteredAccounts.length} Accounts
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px]">
          {filteredAccounts.map(account => (
            <div key={account.id} className="group flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl hover:border-blue-200 hover:shadow-sm transition-all">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold">
                  {account.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-slate-900">
                      {account.name}
                    </h4>
                    <span className="text-[10px] bg-slate-100 text-slate-600 font-bold uppercase px-1.5 py-0.5 rounded">
                      {account.typeName}
                    </span>
                  </div>
                  {account.bankName && (
                    <div className="text-xs text-slate-700 mt-1 flex gap-2 font-medium">
                      Bank: {account.bankName}
                    </div>
                  )}
                  {account.shopName && (
                    <div className="text-xs text-blue-700 mt-1 flex gap-2 font-semibold">
                      Shop: {account.shopName}
                    </div>
                  )}
                  {(account.phoneNumber || account.fatherName || account.cnic) && (
                    <div className="text-[11px] text-slate-600 mt-1 space-x-2">
                      {account.phoneNumber && <span>📞 {account.phoneNumber}</span>}
                      {account.fatherName && <span>👤 S/O {account.fatherName}</span>}
                      {account.cnic && <span>🪪 {account.cnic}</span>}
                    </div>
                  )}
                  {(account.accountNumber || account.iban) && (
                    <div className="text-xs text-slate-500 mt-1 flex gap-3">
                      {account.accountNumber && <span>A/C: {account.accountNumber}</span>}
                      {account.iban && <span>IBAN: {account.iban}</span>}
                    </div>
                  )}
                  {account.description && (
                    <p className="text-xs text-slate-400 mt-0.5 italic">
                      {account.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-slate-900">
                    Rs. {account.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-slate-400">Balance</div>
                </div>

                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(account)} title="Edit">
                    <Pencil size={16} className="text-blue-600" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(account.id, account.name)} title="Delete">
                    <Trash2 size={16} className="text-red-500" />
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {filteredAccounts.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <p>No accounts found.</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
