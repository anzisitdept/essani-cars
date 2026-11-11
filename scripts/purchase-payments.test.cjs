const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function compile(text, globals = {}) {
  const context = { exports: {}, ...globals };
  const { outputText } = ts.transpileModule(text, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  vm.runInNewContext(outputText, context);
  return context.exports;
}
const payments = compile(fs.readFileSync('lib/purchasePayments.ts', 'utf8'));
let generatedId = 0;
const firestore = {
  doc: (parent, name, id) => {
    const key = id || `generated-${++generatedId}`;
    return { id: key, path: `${parent.path || name}/${key}` };
  },
  collection: (_, path) => ({ path }),
};
const { preparePurchasePayment } = compile(fs.readFileSync('lib/purchasePaymentTransaction.ts', 'utf8'), {
  require: name => name === 'firebase/firestore' ? firestore : payments,
});

function transactionCallback(file, handler) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback;
  function find(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === handler) {
      function search(child) {
        if (ts.isCallExpression(child) && child.expression.getText(source) === 'runTransaction') callback = child.arguments[1].getText(source);
        ts.forEachChild(child, search);
      }
      search(node);
    }
    ts.forEachChild(node, find);
  }
  find(source);
  assert.ok(callback, `${handler} transaction found`);
  return callback;
}
const cashFile = 'features/cash-voucher/CashVoucherManager.tsx';
const generalFile = 'features/general-voucher/GeneralVoucherManager.tsx';
const callbacks = {
  create: transactionCallback(cashFile, 'handleCreateVoucher'),
  edit: transactionCallback(cashFile, 'handleUpdateVoucher'),
  delete: transactionCallback(cashFile, 'handleDeleteVoucher'),
  generalCreate: transactionCallback(generalFile, 'handleCreateVoucher'),
  generalDelete: transactionCallback(generalFile, 'handleDeleteVoucher'),
  reverse: transactionCallback('features/invoices/PurchaseInvoiceManager.tsx', 'handleDeleteInvoice'),
  reverseInventory: transactionCallback('features/inventory/PurchaseInventoryList.tsx', 'handleDeleteVehicle'),
};

function ledger() {
  const data = {
    'accounts/cash': { name: 'Cash', balance: 5000 },
    'accounts/seller': { name: 'Seller', balance: -2000, typeName: 'Client' },
    'cars/first': { purchasePrice: 1000, isPaid: false, sellerAccountId: 'seller', purchasePaidAmount: 0 },
    'cars/second': { purchasePrice: 1000, isPaid: false, sellerAccountId: 'seller', purchasePaidAmount: 0 },
  };
  async function run(kind, amount, invoiceId = 'first', extra = {}) {
    const form = { cashAccountId: 'cash', counterAccountId: 'seller', fromAccountId: 'cash', toAccountId: 'seller',
      purchaseInvoiceId: invoiceId, date: '2026-11-11', description: 'Seller payment' };
    const { run } = compile(`exports.run = ${callbacks[kind]}`, {
      ...firestore, preparePurchasePayment, db: {}, user: { uid: 'user' }, serverTimestamp: () => 'timestamp',
      canReversePurchase: payments.canReversePurchase,
      car: { id: 'first', ...data['cars/first'] }, voucherRefs: [],
      formData: form, editFormData: form, debitAmt: 0, creditAmt: amount, amount, enteredAmount: amount,
      cashType: 'credit', counterType: 'debit', newCashType: 'credit', newCounterType: 'debit', newAmount: amount,
      nextVoucherNo: 1, selectedEditVoucher: { id: 'payment' },
      voucher: { ...(data['vouchers/payment'] || data['general-vouchers/payment']), id: 'payment' }, ...extra,
    });
    const writes = [];
    const tx = {
      get: async ref => {
        assert.equal(writes.length, 0, 'Every read occurs before writes');
        const record = data[ref.path];
        return { exists: () => record !== undefined, data: () => record };
      },
      set: (ref, value) => writes.push({ path: ref.path, value }),
      update: (ref, value) => {
        assert.ok(data[ref.path], `Updated document exists: ${ref.path}`);
        writes.push({ path: ref.path, value: { ...data[ref.path], ...value } });
      },
      delete: ref => writes.push({ path: ref.path, remove: true }),
    };
    await run(tx);
    for (const write of writes) {
      if (write.remove) delete data[write.path];
      else data[write.path] = write.value;
    }
    return writes;
  }
  function saveAsPayment(writes, collection = 'vouchers') {
    const voucher = writes.find(w => w.path.startsWith(`${collection}/`));
    data[`${collection}/payment`] = voucher.value;
    delete data[voucher.path];
  }
  return { data, run, saveAsPayment };
}

test('selected invoice receives a partial payment; the other invoice is untouched', async () => {
  const { data, run } = ledger();
  await run('create', 250);
  assert.equal(data['accounts/cash'].balance, 4750);
  assert.equal(data['accounts/seller'].balance, -1750);
  assert.equal(payments.purchaseOutstanding(data['cars/first']), 750);
  assert.equal(data['cars/first'].isPaid, false);
  assert.equal(payments.purchaseOutstanding(data['cars/second']), 1000);
});

test('full payment marks the invoice paid; deletion restores its payable and both balances', async () => {
  const state = ledger();
  state.saveAsPayment(await state.run('create', 1000));
  assert.equal(state.data['cars/first'].isPaid, true);
  assert.equal(state.data['cars/first'].purchasePaidAtCreation, false);
  assert.equal(payments.canReversePurchase(state.data['cars/first']), false);
  await state.run('delete', 1000);
  assert.equal(state.data['cars/first'].isPaid, false);
  assert.equal(payments.purchaseOutstanding(state.data['cars/first']), 1000);
  assert.equal(state.data['accounts/cash'].balance, 5000);
  assert.equal(state.data['accounts/seller'].balance, -2000);
});

test('editing payment amount reverses its old effect before applying the new amount', async () => {
  const state = ledger();
  state.saveAsPayment(await state.run('create', 250));
  await state.run('edit', 400);
  assert.equal(state.data['cars/first'].purchasePaidAmount, 400);
  assert.equal(state.data['accounts/seller'].balance, -1600);
  assert.equal(state.data['accounts/cash'].balance, 4600);
});

test('moving a payment to another invoice restores the first invoice', async () => {
  const state = ledger();
  state.saveAsPayment(await state.run('create', 250));
  await state.run('edit', 250, 'second');
  assert.equal(state.data['cars/first'].purchasePaidAmount, 0);
  assert.equal(state.data['cars/second'].purchasePaidAmount, 250);
  assert.equal(state.data['accounts/seller'].balance, -1750);
});

test('overpayment and wrong seller invoice fail without changing any records', async () => {
  const state = ledger();
  const before = JSON.stringify(state.data);
  await assert.rejects(state.run('create', 1001), /exceeds/);
  assert.equal(JSON.stringify(state.data), before);
  state.data['cars/second'].sellerAccountId = 'another-seller';
  await assert.rejects(state.run('create', 250, 'second'), /does not belong/);
  assert.equal(state.data['accounts/seller'].balance, -2000);
});

test('unlinked general payments leave invoice payment status unchanged', async () => {
  const state = ledger();
  await state.run('create', 250, '');
  assert.equal(state.data['cars/first'].purchasePaidAmount, 0);
  assert.equal(state.data['accounts/seller'].balance, -1750);
});

test('an existing cash payment can be linked by editing without debiting cash a second time', async () => {
  const state = ledger();
  state.saveAsPayment(await state.run('create', 250, ''));
  await state.run('edit', 250, 'first');
  assert.equal(state.data['cars/first'].purchasePaidAmount, 250);
  assert.equal(state.data['accounts/cash'].balance, 4750);
  assert.equal(state.data['accounts/seller'].balance, -1750);
});

test('overpaid edits fail without changing the original payment or balances', async () => {
  const state = ledger();
  state.saveAsPayment(await state.run('create', 250));
  const before = JSON.stringify(state.data);
  await assert.rejects(state.run('edit', 1500), /exceeds/);
  assert.equal(JSON.stringify(state.data), before);
});

test('both purchase reversal screens require linked payments to be reversed first', async () => {
  for (const reverse of ['reverse', 'reverseInventory']) {
    const state = ledger();
    state.saveAsPayment(await state.run('create', 1000));
    const before = JSON.stringify(state.data);
    await assert.rejects(state.run(reverse, 0), /Reverse the invoice's linked payments/);
    assert.equal(JSON.stringify(state.data), before);
    await state.run('delete', 1000);
    await state.run(reverse, 0);
    assert.equal(state.data['cars/first'].purchasePrice, 0);
    assert.equal(state.data['accounts/seller'].balance, -1000);
  }
});

test('deleted invoices and cash inflows cannot be applied as invoice payments', async () => {
  const state = ledger();
  await assert.rejects(state.run('create', 100, 'deleted'), /no longer exists/);
  await assert.rejects(state.run('create', 100, 'first', { cashType: 'debit' }), /cash outflows/);
  assert.equal(state.data['accounts/cash'].balance, 5000);
});

test('bank/general voucher payments and their deletion update the selected invoice atomically', async () => {
  const state = ledger();
  state.saveAsPayment(await state.run('generalCreate', 1000), 'general-vouchers');
  assert.equal(state.data['cars/first'].isPaid, true);
  await state.run('generalDelete', 1000);
  assert.equal(state.data['cars/first'].isPaid, false);
  assert.equal(state.data['accounts/cash'].balance, 5000);
  assert.equal(state.data['accounts/seller'].balance, -2000);
});

test('legacy unpaid invoices use their linked client account and keep partial payments precise', async () => {
  const state = ledger();
  state.data['cars/first'] = { purchasePrice: 0.3, isPaid: false, sellerClientId: 'client' };
  state.data['clients/client'] = { accountId: 'seller' };
  await state.run('create', 0.1);
  await state.run('create', 0.2);
  assert.equal(payments.purchaseOutstanding(state.data['cars/first']), 0);
  assert.equal(state.data['cars/first'].isPaid, true);
});

test('Dashboard and report payable rule excludes debit/zero balances and cash accounts', () => {
  assert.equal(payments.isClientPayable({ typeName: 'Client', balance: -100 }), true);
  assert.equal(payments.isClientPayable({ typeName: 'CUSTOMER', balance: -100 }), true);
  for (const account of [{ typeName: 'Client', balance: 100 }, { typeName: 'Client', balance: 0 },
    { typeName: 'Cash', balance: -100 }, { typeName: 'Client', name: 'Cash account', balance: -100 }]) {
    assert.equal(payments.isClientPayable(account), false);
  }
});
