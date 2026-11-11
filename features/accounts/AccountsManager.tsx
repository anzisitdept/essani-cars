"use client";
import { useState, useEffect, useMemo, FormEvent } from "react";
import { useCurrencyExchangeRate } from "@/hooks/useCurrencyExchangeRate";
import {
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot,
  query, orderBy, serverTimestamp, getDocs, where
} from "firebase/firestore";
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
import {
  Search, Pencil, Trash2, Wallet, X, CheckCircle2, AlertTriangle,
  Store, UserSquare, Phone, CreditCard, FileImage, Loader2, MapPin,
  Coins, ArrowRightLeft
} from "lucide-react";
import Link from "next/link";

// Temporary currency helper — currencies offered in the Add/Edit Account form.
// These are only used for the on-screen PKR conversion and are never persisted.
const CURRENCY_OPTIONS = [
  { code: "PKR", name: "Pakistani Rupee" },
  { code: "USD", name: "US Dollar" },
  { code: "AED", name: "UAE Dirham" },
  { code: "SAR", name: "Saudi Riyal" },
  { code: "QAR", name: "Qatari Riyal" },
  { code: "OMR", name: "Omani Rial" },
  { code: "KWD", name: "Kuwaiti Dinar" },
  { code: "BHD", name: "Bahraini Dinar" },
  { code: "GBP", name: "British Pound" },
  { code: "EUR", name: "Euro" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "TRY", name: "Turkish Lira" },
  { code: "RUB", name: "Russian Ruble" },
  { code: "INR", name: "Indian Rupee" },
  { code: "LKR", name: "Sri Lankan Rupee" },
  { code: "NPR", name: "Nepalese Rupee" },
  { code: "BDT", name: "Bangladeshi Taka" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "NZD", name: "New Zealand Dollar" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "KRW", name: "South Korean Won" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "HKD", name: "Hong Kong Dollar" },
  { code: "TWD", name: "New Taiwan Dollar" },
  { code: "THB", name: "Thai Baht" },
  { code: "VND", name: "Vietnamese Dong" },
  { code: "IDR", name: "Indonesian Rupiah" },
  { code: "MYR", name: "Malaysian Ringgit" },
  { code: "PHP", name: "Philippine Peso" },
  { code: "MOP", name: "Macanese Pataca" },
  { code: "ILS", name: "Israeli Shekel" },
  { code: "EGP", name: "Egyptian Pound" },
  { code: "NGN", name: "Nigerian Naira" },
  { code: "KES", name: "Kenyan Shilling" },
  { code: "TZS", name: "Tanzanian Shilling" },
  { code: "ZAR", name: "South African Rand" },
  { code: "MAD", name: "Moroccan Dirham" },
  { code: "MXN", name: "Mexican Peso" },
  { code: "BRL", name: "Brazilian Real" },
  { code: "ARS", name: "Argentine Peso" },
  { code: "SEK", name: "Swedish Krona" },
  { code: "NOK", name: "Norwegian Krone" },
  { code: "DKK", name: "Danish Krone" },
  { code: "PLN", name: "Polish Zloty" },
  { code: "CZK", name: "Czech Koruna" },
  { code: "HUF", name: "Hungarian Forint" },
  { code: "RON", name: "Romanian Leu" },
];

interface Account {
  id: string;
  name: string;
  typeId: string;
  typeName: string;
  balance: number;
  description?: string;
  shopName?: string;
  fatherName?: string;
  phoneNumber?: string;
  cnic?: string;
  cnicPicture?: string;
  address?: string;
  createdAt: any;
}

interface AccountType {
  id: string;
  name: string;
  requireNumberInfo?: boolean;
}

export const AccountsManager = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [message, setMessage] = useState("");

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    typeId: "",
    balance: "0",
    balanceType: "debit",
    description: "",
    shopName: "",
    fatherName: "",
    phoneNumber: "",
    cnic: "",
    cnicPicture: "",
    address: ""
  });
  const [cnicFile, setCnicFile] = useState<File | null>(null);

  // ─── Temporary currency converter state (UI only — never persisted) ───────────
  // Kept outside `formData` on purpose so it can never end up in the
  // create/update payload written to Firestore.
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [currencyAmount, setCurrencyAmount] = useState("");
  const {
    selectedRate, rateInput, changeRate, ratesDate, changeRatesDate,
    ratesLoading, ratesError, fetchExchangeRates, today,
  } = useCurrencyExchangeRate(currencyCode);

  // Fetch Accounts and Account Types
  useEffect(() => {
    setDataLoading(true);
    let accountsReady = false;
    let typesReady = false;

    const checkReady = () => {
      if (accountsReady && typesReady) setDataLoading(false);
    };

    const qAccounts = query(collection(db, "accounts"), orderBy("name"));
    const unsubAccounts = onSnapshot(qAccounts, (snapshot) => {
      setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
      accountsReady = true;
      checkReady();
    });

    const qTypes = query(collection(db, "account-types"), orderBy("name"));
    const unsubTypes = onSnapshot(qTypes, (snapshot) => {
      setAccountTypes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AccountType)));
      typesReady = true;
      checkReady();
    });

    return () => {
      unsubAccounts();
      unsubTypes();
    };
  }, []);

  const pkrAmount = useMemo(() => {
    const amount = parseFloat(currencyAmount);
    if (!isFinite(amount) || amount <= 0 || selectedRate === null) return null;
    return amount * selectedRate;
  }, [currencyAmount, selectedRate]);

  const resetForm = () => {
    setFormData({
      name: "",
      typeId: "",
      balance: "0",
      balanceType: "debit",
      description: "",
      shopName: "",
      fatherName: "",
      phoneNumber: "",
      cnic: "",
      cnicPicture: "",
      address: ""
    });
    setCnicFile(null);
    setIsEditing(null);
    setMessage("");
  };

  const handleEdit = (account: Account) => {
    const isCredit = account.balance < 0;
    setFormData({
      name: account.name,
      typeId: account.typeId,
      balance: Math.abs(account.balance).toString(),
      balanceType: isCredit ? "credit" : "debit",
      description: account.description || "",
      shopName: account.shopName || "",
      fatherName: account.fatherName || "",
      phoneNumber: account.phoneNumber || "",
      cnic: account.cnic || "",
      cnicPicture: account.cnicPicture || "",
      address: account.address || ""
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
      const requireNumberInfo = selectedType?.requireNumberInfo ?? false;

      if (requireNumberInfo && !formData.phoneNumber.trim()) {
        setMessage("Error: Phone number is required when number information is enabled");
        setLoading(false);
        return;
      }

      let cnicPicUrl = formData.cnicPicture;
      if (cnicFile) {
        const apiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY;
        if (!apiKey) throw new Error("ImgBB API key is not configured.");

        const form = new FormData();
        form.append("image", cnicFile);

        const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
          method: "POST",
          body: form
        });
        const data = await res.json();
        if (data.success) {
          cnicPicUrl = data.data.url;
        } else {
          throw new Error(data.error?.message || "Failed to upload image to ImgBB");
        }
      }

      const enteredBalance = parseFloat(formData.balance) || 0;
      const finalBalance = formData.balanceType === "credit" ? -Math.abs(enteredBalance) : Math.abs(enteredBalance);

      const payload = {
        name: formData.name.trim(),
        typeId: formData.typeId,
        typeName: typeName,
        balance: finalBalance,
        description: formData.description.trim(),
        shopName: requireNumberInfo ? formData.shopName.trim() : "",
        fatherName: requireNumberInfo ? formData.fatherName.trim() : "",
        phoneNumber: requireNumberInfo ? formData.phoneNumber.trim() : "",
        cnic: requireNumberInfo ? formData.cnic.trim() : "",
        cnicPicture: requireNumberInfo ? cnicPicUrl : "",
        address: requireNumberInfo ? formData.address.trim() : "",
        updatedBy: user.uid,
        updatedAt: serverTimestamp()
      };

      if (isEditing) {
        const { balance, ...updatePayload } = payload;
        await updateDoc(doc(db, "accounts", isEditing), updatePayload);

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
        const initialBal = finalBalance;
        const today = new Date().toISOString().split("T")[0];
        if (initialBal !== 0) {
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
          action: `Created account: ${formData.name} (${typeName})${initialBal ? ` with opening balance Rs. ${Math.abs(initialBal).toLocaleString()} (${initialBal > 0 ? 'Dr' : 'Cr'})` : ""}`,
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
      (a.shopName && a.shopName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (a.phoneNumber && a.phoneNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = typeFilter === "ALL" || a.typeId === typeFilter;
    return matchesSearch && matchesType;
  });

  const selectedAccountType = accountTypes.find(t => t.id === formData.typeId);
  const showExtraFields = selectedAccountType?.requireNumberInfo ?? false;

  // --- Loading skeleton ---
  if (dataLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="animate-pulse space-y-4 p-6 bg-white rounded-xl border border-slate-100">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-9 bg-slate-100 rounded-lg" />
          ))}
        </div>
        <div className="lg:col-span-2 animate-pulse space-y-3 p-6 bg-white rounded-xl border border-slate-100">
          <div className="h-9 bg-slate-100 rounded-lg mb-4" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

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
            {!message.includes('Error') && <CheckCircle2 size={14} className="shrink-0" />}
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
              {formData.typeId && (
                <p className="text-[11px] mt-1.5 flex items-center gap-1">
                  {showExtraFields ? (
                    <span className="text-blue-600 font-medium">ℹ️ This account type requires number information (Phone, CNIC, etc.)</span>
                  ) : (
                    <span className="text-slate-400">No extra number info required for this type.</span>
                  )}
                </p>
              )}
            </div>

            {showExtraFields && (
              <div className="space-y-4 p-4 border rounded-xl bg-slate-50/50 mt-4">
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
                  <Input required value={formData.phoneNumber} onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })} placeholder="e.g. 03352256506" />
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

                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-500 flex items-center gap-2">
                    <MapPin size={12} /> Address
                  </label>
                  <Input value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="Full Address" />
                </div>
              </div>
            )}

            {/* ── Temporary currency converter (UI only, never persisted) ── */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500 flex items-center gap-2">
                <Coins size={12} /> PKR Amount
              </label>
              <Input
                readOnly
                value={pkrAmount === null ? "" : pkrAmount.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                placeholder="0.00"
                className="bg-slate-50 text-slate-600"
              />
              {ratesLoading ? (
                <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                  <Loader2 size={12} className="animate-spin" /> Loading exchange rate...
                </p>
              ) : ratesError ? (
                <p className="text-[10px] text-red-600 mt-1 flex items-center gap-1">
                  <AlertTriangle size={12} /> {ratesError}
                  <button type="button" onClick={fetchExchangeRates} className="underline font-medium ml-1">Retry</button>
                </p>
              ) : null}
              <div className="text-[10px] text-slate-400 mt-1 flex flex-wrap items-center gap-1">
                1 {currencyCode} ={" "}
                <Input
                  type="number"
                  step="any"
                  min="0"
                  aria-label={`${currencyCode} to PKR exchange rate`}
                  value={rateInput}
                  disabled={ratesLoading}
                  onChange={(e) => changeRate(e.target.value)}
                  className="h-6 w-24 px-1 text-xs md:text-xs"
                />
                <span>PKR •</span>
                <Input
                  type="date"
                  max={today}
                  aria-label="Exchange rate date"
                  value={ratesDate.slice(0, 10)}
                  onChange={(e) => changeRatesDate(e.target.value)}
                  className="h-6 w-auto px-1 text-xs md:text-xs"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500 flex items-center gap-2">
                <ArrowRightLeft size={12} /> Select Currency &amp; Amount
              </label>
              <div className="flex gap-2">
                <Select value={currencyCode} onValueChange={(val) => setCurrencyCode(val)}>
                  <SelectTrigger className="w-[150px] bg-white">
                    <SelectValue placeholder="Currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map(currency => (
                      <SelectItem key={currency.code} value={currency.code}>
                        {currency.code} — {currency.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={currencyAmount}
                  onChange={e => setCurrencyAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500 block">
                Initial Balance / Current Balance
              </label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.balance}
                  onChange={e => setFormData({ ...formData, balance: e.target.value })}
                  placeholder="0.00"
                  className="flex-1"
                  disabled={!!isEditing}
                />
                <Select
                  value={formData.balanceType}
                  onValueChange={(val) => setFormData(prev => ({ ...prev, balanceType: val }))}
                  disabled={!!isEditing}
                >
                  <SelectTrigger className="w-[120px] bg-white">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debit">Debit (Dr)</SelectItem>
                    <SelectItem value="credit">Credit (Cr)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {!!isEditing && (
                <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                  <AlertTriangle size={12} /> Balance cannot be edited. Please use Vouchers to adjust the balance.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500">
                Description / Notes
              </label>
              <Input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Brief info (optional)" />
            </div>

            <Button type="submit" className="w-full bg-slate-900 mt-2" disabled={loading}>
              {loading ? (
                <><Loader2 size={16} className="mr-2 animate-spin" /> {isEditing ? "Updating..." : "Creating..."}</>
              ) : (
                isEditing ? "Update Account" : "Add Account"
              )}
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
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
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
            <div key={account.id} className="group flex flex-wrap sm:flex-nowrap items-center justify-between gap-y-3 p-4 bg-white border border-slate-100 rounded-xl hover:border-blue-200 hover:shadow-sm transition-all">
              <div className="flex items-center gap-4 min-w-0">
                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold">
                  {account.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-slate-900">
                      {account.name}
                    </h4>
                    <span className="text-[10px] bg-slate-100 text-slate-600 font-bold uppercase px-1.5 py-0.5 rounded">
                      {account.typeName}
                    </span>
                  </div>
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
                  {account.description && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {account.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 ml-auto">
                <div className="text-right shrink-0">
                  <div className={`text-sm font-bold ${account.balance < 0 ? "text-red-600" : "text-slate-900"}`}>
                    Rs. {Math.abs(account.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {account.balance < 0 ? "Cr" : "Dr"}
                  </div>
                  <div className="text-[10px] text-slate-400">Balance</div>
                </div>

                <div className="flex gap-2 opacity-0 group-hover:opacity-100 max-sm:opacity-100 transition-opacity">
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
