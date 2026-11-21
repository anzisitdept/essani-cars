"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  collection, doc, onSnapshot, orderBy, query, runTransaction, serverTimestamp,
} from "firebase/firestore";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Landmark, Loader2, Plus, Wallet } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Account = { id: string; name: string; balance: number };
type InvestmentTransaction = {
  id: string;
  date: string;
  type: "deposit" | "withdrawal" | "transfer-in" | "transfer-out";
  amount: number;
  previousBalance: number;
  newBalance: number;
  description: string;
  accountName?: string;
  createdAt?: { seconds?: number };
};

const investmentRef = doc(db, "backup-investment", "main");
const formatMoney = (amount: number) => `Rs. ${(amount || 0).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function BackupInvestmentManager() {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<InvestmentTransaction[]>([]);
  const [operation, setOperation] = useState<"deposit" | "withdrawal" | "transfer">("deposit");
  const [transferDirection, setTransferDirection] = useState<"to-investment" | "from-investment">("to-investment");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const unsubInvestment = onSnapshot(investmentRef, snapshot => {
      setBalance(snapshot.exists() ? Number(snapshot.data().balance) || 0 : 0);
    });
    const unsubAccounts = onSnapshot(query(collection(db, "accounts"), orderBy("name")), snapshot => {
      setAccounts(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as Account)));
    });
    const unsubTransactions = onSnapshot(collection(db, "backup-investment-transactions"), snapshot => {
      const rows = snapshot.docs
        .filter(item => item.data().investmentId === "main")
        .map(item => ({ id: item.id, ...item.data() } as InvestmentTransaction));
      rows.sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setTransactions(rows);
    });
    return () => { unsubInvestment(); unsubAccounts(); unsubTransactions(); };
  }, []);

  const selectedAccount = useMemo(() => accounts.find(account => account.id === accountId), [accounts, accountId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    const amountValue = Number(amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setMessage("Enter an amount greater than zero.");
      return;
    }
    if (operation === "transfer" && !selectedAccount) {
      setMessage("Select an account for the transfer.");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      await runTransaction(db, async transaction => {
        const investmentSnapshot = await transaction.get(investmentRef);
        const previousBalance = investmentSnapshot.exists() ? Number(investmentSnapshot.data().balance) || 0 : 0;
        const isTransfer = operation === "transfer";
        const accountRef = isTransfer && selectedAccount ? doc(db, "accounts", selectedAccount.id) : null;
        const accountSnapshot = accountRef ? await transaction.get(accountRef) : null;
        if (accountSnapshot && !accountSnapshot.exists()) throw new Error("The selected account no longer exists.");

        const moneyIn = operation === "deposit" || (isTransfer && transferDirection === "to-investment");
        const nextBalance = previousBalance + (moneyIn ? amountValue : -amountValue);
        const transactionType: InvestmentTransaction["type"] = operation === "deposit"
          ? "deposit"
          : operation === "withdrawal"
            ? "withdrawal"
            : moneyIn ? "transfer-in" : "transfer-out";
        const resolvedDescription = description.trim() || (operation === "transfer"
          ? `${moneyIn ? "Transfer from" : "Transfer to"} ${selectedAccount?.name}`
          : operation === "deposit" ? "Investment deposit" : "Investment withdrawal");
        const historyRef = doc(collection(db, "backup-investment-transactions"));
        const accountName = isTransfer ? selectedAccount?.name : undefined;
        const historyData = {
          investmentId: "main", date, type: transactionType, amount: amountValue,
          previousBalance, newBalance: nextBalance, description: resolvedDescription,
          accountId: isTransfer ? selectedAccount?.id : null,
          accountName: accountName || null,
          createdBy: user.uid, createdAt: serverTimestamp(),
        };

        transaction.set(investmentRef, {
          balance: nextBalance,
          ...(investmentSnapshot.exists() ? {} : { createdAt: serverTimestamp(), createdBy: user.uid }),
          updatedAt: serverTimestamp(), updatedBy: user.uid,
        }, { merge: true });
        transaction.set(historyRef, historyData);

        if (accountRef && accountSnapshot) {
          const accountData = accountSnapshot.data();
          const currentAccountBalance = Number(accountData.balance) || 0;
          const accountReceives = !moneyIn;
          const accountNextBalance = currentAccountBalance + (accountReceives ? amountValue : -amountValue);
          const voucherRef = doc(collection(db, "vouchers"));
          const voucherNo = `BI-${voucherRef.id.slice(-6).toUpperCase()}`;
          const accountTransactionType = accountReceives ? "debit" : "credit";
          transaction.update(accountRef, {
            balance: accountNextBalance, updatedAt: serverTimestamp(), updatedBy: user.uid,
          });
          transaction.set(voucherRef, {
            voucherNo, date,
            description: `${resolvedDescription} (Backup Investment transfer)`,
            amount: amountValue,
            debit: accountReceives ? amountValue : 0,
            credit: accountReceives ? 0 : amountValue,
            accountId: selectedAccount!.id,
            accountName: accountData.name,
            type: accountTransactionType,
            previousBalance: currentAccountBalance,
            newBalance: accountNextBalance,
            isBackupInvestmentTransfer: true,
            backupInvestmentTransactionId: historyRef.id,
            createdBy: user.uid, createdAt: serverTimestamp(),
          });
        }
      });
      setAmount("");
      setDescription("");
      setMessage("Transaction saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save this transaction.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Backup Investment" description="Track investment deposits, withdrawals, and transfers separately from regular accounts." />

      <div className="grid gap-6 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.5fr)]">
        <div className="space-y-6">
          <Card className="overflow-hidden border-emerald-100 bg-gradient-to-br from-emerald-700 to-teal-800 text-white shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-emerald-100"><Landmark size={18} /><span className="text-xs font-semibold uppercase tracking-widest">Backup Investment Balance</span></div>
              <p className="mt-4 text-3xl font-bold">{formatMoney(balance)}</p>
              <p className="mt-2 text-sm text-emerald-100">Independent balance · {transactions.length} recorded transactions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Plus size={17} /> Record transaction</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  {(["deposit", "withdrawal", "transfer"] as const).map(value => (
                    <Button key={value} type="button" size="sm" variant={operation === value ? "default" : "outline"}
                      className={operation === value ? "bg-slate-900" : ""} onClick={() => { setOperation(value); setMessage(""); }}>
                      {value === "deposit" ? "Deposit" : value === "withdrawal" ? "Withdraw" : "Transfer"}
                    </Button>
                  ))}
                </div>

                {operation === "transfer" && <div className="space-y-2">
                  <label className="text-sm font-medium">Transfer direction</label>
                  <Select value={transferDirection} onValueChange={(value: "to-investment" | "from-investment") => setTransferDirection(value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="to-investment">Account to Backup Investment</SelectItem>
                      <SelectItem value="from-investment">Backup Investment to Account</SelectItem>
                    </SelectContent>
                  </Select>
                  <label className="text-sm font-medium">Account</label>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger><SelectValue placeholder="Choose an account" /></SelectTrigger>
                    <SelectContent>{accounts.map(account => <SelectItem key={account.id} value={account.id}>{account.name} · {formatMoney(account.balance)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><label className="text-sm font-medium">Amount (Rs.)</label><Input type="number" min="0.01" step="0.01" required value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00" /></div>
                  <div className="space-y-2"><label className="text-sm font-medium">Date</label><Input type="date" required value={date} onChange={event => setDate(event.target.value)} /></div>
                </div>
                <div className="space-y-2"><label className="text-sm font-medium">Description</label><Input value={description} onChange={event => setDescription(event.target.value)} placeholder="Optional details" /></div>
                {message && <p className={`text-sm ${message.startsWith("Transaction") ? "text-emerald-700" : "text-red-600"}`}>{message}</p>}
                <Button type="submit" disabled={loading} className="w-full bg-slate-900">
                  {loading ? <><Loader2 size={16} className="mr-2 animate-spin" /> Saving...</> : <><ArrowLeftRight size={16} className="mr-2" /> Save {operation === "transfer" ? "transfer" : operation}</>}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Wallet size={17} /> Transaction history</CardTitle></CardHeader>
          <CardContent>
            {transactions.length === 0 ? <div className="py-16 text-center text-sm text-slate-400">No Backup Investment transactions yet.</div> : (
              <div className="space-y-3">
                {transactions.map(item => {
                  const isInflow = item.type === "deposit" || item.type === "transfer-in";
                  const title = item.type === "transfer-in" ? `Transfer from ${item.accountName || "account"}`
                    : item.type === "transfer-out" ? `Transfer to ${item.accountName || "account"}`
                      : item.type === "deposit" ? "Deposit" : "Withdrawal";
                  return <div key={item.id} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${isInflow ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                      {isInflow ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{title}</p>
                      <p className="truncate text-xs text-slate-500">{item.description} · {item.date}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${isInflow ? "text-emerald-700" : "text-rose-700"}`}>{isInflow ? "+" : "−"}{formatMoney(item.amount)}</p>
                      <p className="text-[11px] text-slate-400">Balance {formatMoney(item.newBalance)}</p>
                    </div>
                  </div>;
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
