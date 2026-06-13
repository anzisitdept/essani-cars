"use client";
import { useState, useEffect, FormEvent } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
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
import { Search, Plus, Pencil, Trash2, Wallet, X, CheckCircle2, AlertTriangle } from "lucide-react";
import Link from "next/link";

interface Account {
  id: string;
  name: string;
  typeId: string;
  typeName: string;
  balance: number;
  description?: string;
  createdAt: any;
}

interface AccountType {
  id: string;
  name: string;
}

export const AccountsManager = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    typeId: "",
    balance: "0",
    description: ""
  });

  // Fetch Accounts and Account Types
  useEffect(() => {
    const qAccounts = query(collection(db, "accounts"), orderBy("name"));
    const unsubAccounts = onSnapshot(qAccounts, (snapshot) => {
      setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
    });

    const qTypes = query(collection(db, "account-types"), orderBy("name"));
    const unsubTypes = onSnapshot(qTypes, (snapshot) => {
      setAccountTypes(snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name } as AccountType)));
    });

    return () => {
      unsubAccounts();
      unsubTypes();
    };
  }, []);

  const resetForm = () => {
    setFormData({ name: "", typeId: "", balance: "0", description: "" });
    setIsEditing(null);
    setMessage("");
  };

  const handleEdit = (account: Account) => {
    setFormData({
      name: account.name,
      typeId: account.typeId,
      balance: account.balance.toString(),
      description: account.description || ""
    });
    setIsEditing(account.id);
    setMessage("");
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete the account "${name}"?`)) {
      try {
        await deleteDoc(doc(db, "accounts", id));
        
        if (user) {
          await addDoc(collection(db, "logs"), {
            action: `Deleted account: ${name}`,
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

    setLoading(true);
    setMessage("");

    try {
      const selectedType = accountTypes.find(t => t.id === formData.typeId);
      const typeName = selectedType ? selectedType.name : "Unknown";

      const payload = {
        name: formData.name.trim(),
        typeId: formData.typeId,
        typeName: typeName,
        balance: parseFloat(formData.balance) || 0,
        description: formData.description.trim(),
        updatedBy: user.uid,
        updatedAt: serverTimestamp()
      };

      if (isEditing) {
        await updateDoc(doc(db, "accounts", isEditing), payload);
        
        await addDoc(collection(db, "logs"), {
          action: `Updated account: ${formData.name}`,
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

        // If an initial balance is set, write an Opening Balance voucher
        // so it shows up as the first entry in the General Ledger
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
            // New double-entry format
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
            // Backward compat
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
          action: `Created account: ${formData.name} (${typeName})${initialBal ? ` with opening balance Rs. ${initialBal.toLocaleString()}` : ""}`,
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
      (a.description && a.description.toLowerCase().includes(searchTerm.toLowerCase()));
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

        {accountTypes.length === 0 ? (
          <div className="p-4 bg-amber-50 rounded-lg text-amber-800 text-xs flex flex-col gap-2">
            <div className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle size={16} /> No Account Types Found
            </div>
            <p>You must define at least one account type before creating accounts.</p>
            <Link href="/dashboard/account-types" className="mt-2">
              <Button size="sm" variant="outline" className="w-full text-xs border-amber-300 hover:bg-amber-100/50">
                Manage Account Types
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500 flex items-center gap-2">
                <Wallet size={12} /> Account Name *
              </label>
              <Input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Office Petty Cash, HBL Bank..." />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500 block">
                Account Type *
              </label>
              <Select value={formData.typeId} onValueChange={(val) => setFormData(prev => ({ ...prev, typeId: val }))}>
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {accountTypes.map(type => (
                    <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
        )}
      </Card>

      {/* Right: List */}
      <Card className="lg:col-span-2 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row gap-4 justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 text-slate-400" size={16} />
            <Input
              className="pl-9 bg-white"
              placeholder="Search by name or notes..."
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
                {accountTypes.map(type => (
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
                  {account.description && (
                    <p className="text-xs text-slate-500 mt-0.5">
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
