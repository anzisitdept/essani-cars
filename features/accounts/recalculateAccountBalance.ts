import {
  collection, doc, getDocs, serverTimestamp, writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

type BalanceAccount = { id: string; balance: number; initialBalance?: number };

export async function getAccountInitialBalance(account: BalanceAccount) {
  if (typeof account.initialBalance === "number") return account.initialBalance;
  const [cashSnap, generalSnap] = await Promise.all([
    getDocs(collection(db, "vouchers")),
    getDocs(collection(db, "general-vouchers")),
  ]);
  const openingVoucher = cashSnap.docs.find((snapshot) => {
    const voucher = snapshot.data();
    return voucher.isOpeningBalance && (voucher.accountId === account.id || voucher.cashAccountId === account.id);
  });
  if (openingVoucher) {
    const voucher = openingVoucher.data();
    const openingBalance = voucher.newBalance ?? voucher.cashNewBalance;
    if (typeof openingBalance === "number") return openingBalance;
  }
  let debit = 0;
  let credit = 0;
  cashSnap.docs.forEach((snapshot) => {
    const v = snapshot.data();
    if (v.isOpeningBalance) return;
    if (v.cashAccountId === account.id) {
      const delta = Math.abs((v.cashNewBalance ?? account.balance) - (v.cashPreviousBalance ?? account.balance)) || v.amount || 0;
      if (v.cashType === "debit") debit += delta;
      else if (v.cashType === "credit") credit += delta;
    } else if (v.accountId === account.id && !v.cashAccountId) {
      if (v.type === "debit") debit += Number(v.amount) || 0;
      else if (v.type === "credit") credit += Number(v.amount) || 0;
    }
  });
  generalSnap.docs.forEach((snapshot) => {
    const g = snapshot.data();
    if (g.fromAccountId === account.id) credit += Number(g.amount) || 0;
    else if (g.toAccountId === account.id) debit += Number(g.amount) || 0;
  });
  return account.balance - debit + credit;
}

/** Update transaction balance snapshots after changing an account's opening balance. */
export async function recalculateAccountBalance(
  account: BalanceAccount,
  initialBalance: number,
  userId: string,
) {
  const [cashSnap, generalSnap] = await Promise.all([
    getDocs(collection(db, "vouchers")),
    getDocs(collection(db, "general-vouchers")),
  ]);

  const entries: Array<{
    date: string;
    code: string;
    debit: number;
    credit: number;
    ref: ReturnType<typeof doc>;
    target: "cash" | "legacy" | "generalFrom" | "generalTo";
    patch: Record<string, number>;
  }> = [];

  cashSnap.docs.forEach((snapshot) => {
    const v = snapshot.data();
    if (v.isOpeningBalance) return;
    const rawCode = String(v.voucherNo ?? "");
    const code = /^(OB-|PI-|SI-|JV-|BI-)/.test(rawCode) ? rawCode : `CV-${rawCode.padStart(4, "0")}`;
    if (v.cashAccountId === account.id) {
      const delta = Math.abs((v.cashNewBalance ?? account.balance) - (v.cashPreviousBalance ?? account.balance)) || v.amount || 0;
      entries.push({
        date: v.date ?? "", code, debit: v.cashType === "debit" ? delta : 0,
        credit: v.cashType === "credit" ? delta : 0, ref: doc(db, "vouchers", snapshot.id), target: "cash", patch: {},
      });
    } else if (v.accountId === account.id && !v.cashAccountId) {
      const amount = Number(v.amount) || 0;
      entries.push({
        date: v.date ?? "", code, debit: v.type === "debit" ? amount : 0,
        credit: v.type === "credit" ? amount : 0, ref: doc(db, "vouchers", snapshot.id), target: "legacy", patch: {},
      });
    }
  });

  generalSnap.docs.forEach((snapshot) => {
    const g = snapshot.data();
    const rawCode = String(g.voucherNo ?? "");
    const code = rawCode.startsWith("JV-") ? rawCode : `JV-${rawCode.padStart(4, "0")}`;
    if (g.fromAccountId === account.id) {
      entries.push({ date: g.date ?? "", code, debit: 0, credit: Number(g.amount) || 0,
        ref: doc(db, "general-vouchers", snapshot.id), target: "generalFrom", patch: {} });
    } else if (g.toAccountId === account.id) {
      entries.push({ date: g.date ?? "", code, debit: Number(g.amount) || 0, credit: 0,
        ref: doc(db, "general-vouchers", snapshot.id), target: "generalTo", patch: {} });
    }
  });

  entries.sort((a, b) => a.date.localeCompare(b.date) || a.code.localeCompare(b.code));

  let runningBalance = initialBalance;
  entries.forEach((entry) => {
    const previousBalance = runningBalance;
    runningBalance += entry.debit - entry.credit;
    if (entry.target === "generalFrom") {
      entry.patch = { fromPreviousBalance: previousBalance, fromNewBalance: runningBalance };
    } else if (entry.target === "generalTo") {
      entry.patch = { toPreviousBalance: previousBalance, toNewBalance: runningBalance };
    } else if (entry.target === "cash") {
      entry.patch = { cashPreviousBalance: previousBalance, cashNewBalance: runningBalance };
    } else {
      entry.patch = { previousBalance, newBalance: runningBalance };
    }
  });

  // Keep each commit below Firestore's 500-write batch limit; update the account last.
  for (let start = 0; start < entries.length; start += 499) {
    const batch = writeBatch(db);
    entries.slice(start, start + 499).forEach((entry) => batch.update(entry.ref, entry.patch));
    if (start + 499 >= entries.length) {
      batch.update(doc(db, "accounts", account.id), {
        initialBalance,
        balance: runningBalance,
        updatedBy: userId,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }

  if (entries.length === 0) {
    const batch = writeBatch(db);
    batch.update(doc(db, "accounts", account.id), {
      initialBalance,
      balance: initialBalance,
      updatedBy: userId,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  }
}
