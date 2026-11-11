const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the actual invoice transaction without connecting to Firestore.
const source = ts.createSourceFile('PurchaseInvoiceManager.tsx',
  fs.readFileSync('features/invoices/PurchaseInvoiceManager.tsx', 'utf8'),
  ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let transaction;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'handleCreateInvoice') {
    function findTransaction(child) {
      if (ts.isCallExpression(child) && child.expression.getText(source) === 'runTransaction') {
        transaction = child.arguments[1].getText(source);
      }
      ts.forEachChild(child, findTransaction);
    }
    findTransaction(node);
  }
  ts.forEachChild(node, visit);
}
visit(source);
assert.ok(transaction, 'Purchase invoice transaction found');
const { outputText } = ts.transpileModule(`exports.run = ${transaction}`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});

function invoice(records, overrides = {}) {
  const writes = [];
  let nextId = 0;
  const context = {
    exports: {}, db: {}, isPaid: false, paymentAccountId: '', selectedSellerId: 'seller',
    selectedVehicle: { id: 'car', brandName: 'Toyota', model: 'Vitz', chassisNumber: '123456' },
    vehicleAssetTypeId: 'vehicle-assets', priceVal: 1000, invoiceDate: '2026-11-11',
    user: { uid: 'user' }, clients: [{ id: 'seller', name: 'Seller', phone: '123' }],
    hasInvestor: false, investorId: '', investors: [], commissionType: 'Fixed', commVal: 0,
    collection: (_, path) => ({ path }),
    doc: (parent, path, id) => {
      const generatedId = id || `new-${++nextId}`;
      return { id: generatedId, path: `${parent.path || path}/${generatedId}` };
    },
    serverTimestamp: () => 'timestamp',
    ...overrides,
  };
  vm.runInNewContext(outputText, context);
  const tx = {
    get: async (ref) => {
      assert.equal(writes.length, 0, 'All reads must precede writes');
      const data = records[ref.path] ?? (ref.path === 'cars/car' ? { purchasePrice: 0 } : undefined);
      return { exists: () => data !== undefined, data: () => data };
    },
    set: (ref, data) => writes.push({ kind: 'set', ref, data }),
    update: (ref, data) => writes.push({ kind: 'update', ref, data }),
  };
  return { run: () => context.exports.run(tx), writes };
}

test('missing seller ledger produces a useful error before any writes', async () => {
  const { run, writes } = invoice({ 'clients/seller': { name: 'Seller', accountId: 'deleted' } });
  await assert.rejects(run(), /Ledger account for seller "Seller" was not found/);
  assert.equal(writes.length, 0);
});

test('deleted sellers and sellers without an account cannot create incomplete invoices', async () => {
  for (const [records, error] of [
    [{}, /Selected seller no longer exists/],
    [{ 'clients/seller': { name: 'Seller' } }, /has no linked ledger account/],
  ]) {
    const { run, writes } = invoice(records);
    await assert.rejects(run(), error);
    assert.equal(writes.length, 0);
  }
});

test('valid unpaid purchases credit the seller and debit the vehicle', async () => {
  for (const previousBalance of [undefined, 500, -200]) {
    const { run, writes } = invoice({
      'clients/seller': { name: 'Seller', accountId: 'ledger' },
      'accounts/ledger': { name: 'Seller Ledger', balance: previousBalance },
    });
    await run();
    const balance = previousBalance || 0;
    assert.equal(writes.find(w => w.ref.path === 'accounts/ledger').data.balance, balance - 1000);
    const voucher = writes.find(w => w.ref.path.startsWith('vouchers/')).data;
    assert.equal(voucher.cashPreviousBalance, balance);
    assert.equal(voucher.cashNewBalance, balance - 1000);
    assert.equal(voucher.counterNewBalance, 1000);
    assert.equal(voucher.cashAccountName, 'Seller Ledger');
    assert.equal(writes.find(w => w.ref.path === 'cars/car').data.purchasePrice, 1000);
  }
});

test('paid purchases still debit the payment account', async () => {
  const { run, writes } = invoice({ 'accounts/cash': { name: 'Cash', balance: 5000 } },
    { isPaid: true, paymentAccountId: 'cash' });
  await run();
  assert.equal(writes.find(w => w.ref.path === 'accounts/cash').data.balance, 4000);
});
