const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function loadRoute(fetch) {
  const source = fs.readFileSync('app/api/exchange-rate/route.ts', 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const context = {
    exports: {}, URL, Date, Number, Map, fetch,
    process: { env: { FXRATES_API_KEY: 'test-key' } },
    console: { error() {} },
    require: (name) => {
      assert.equal(name, 'next/server');
      return { NextResponse: { json: (body, options) => Response.json(body, options) } };
    },
  };
  vm.runInNewContext(outputText, context);
  return (date) => context.exports.GET(new Request(
    `http://localhost/api/exchange-rate${date === undefined ? '' : `?date=${date}`}`,
  ));
}

test('historical dates and latest rates use separate cache entries', async () => {
  const calls = [];
  const get = loadRoute(async (url) => {
    calls.push(url);
    assert.equal(url.searchParams.get('base'), 'USD');
    assert.equal(url.searchParams.get('api_key'), 'test-key');
    const date = url.searchParams.get('date');
    assert.equal(url.pathname, date ? '/historical' : '/latest');
    return Response.json({ success: true, base: 'USD', date: `${date || '2026-11-11'}T23:59:00.000Z`,
      rates: { USD: 1, PKR: date === '2025-01-15' ? 278 : 280, JPY: 150 } });
  });
  assert.equal((await (await get()).json()).rates.PKR, 280);
  assert.equal((await (await get('2025-01-15')).json()).rates.PKR, 278);
  assert.equal((await (await get('2025-01-16')).json()).date.slice(0, 10), '2025-01-16');
  assert.equal((await (await get('2025-01-15')).json()).rates.PKR, 278);
  assert.equal((await (await get()).json()).rates.PKR, 280);
  assert.equal(calls.length, 3);
});

test('invalid calendar dates and future dates never reach the provider', async () => {
  const get = loadRoute(() => { assert.fail('Unexpected provider call'); });
  for (const date of ['2025-02-30', '2025-13-01', 'not-a-date', '2025-1-2', '9999-01-01']) {
    assert.equal((await get(date)).status, 400);
  }
});

test('provider failures remain errors and can be retried for the same date', async () => {
  let calls = 0;
  const get = loadRoute(async () => {
    calls++;
    return Response.json({ error: { message: 'Historical rates unavailable' } }, { status: 403 });
  });
  for (let i = 0; i < 2; i++) {
    const response = await get('2025-01-15');
    assert.equal(response.status, 502);
    assert.equal((await response.json()).error, 'Historical rates unavailable');
  }
  assert.equal(calls, 2);
});

test('a provider response for another date cannot masquerade as the requested rate', async () => {
  const get = loadRoute(async () => Response.json({ success: true,
    date: '2025-01-16T23:59:00.000Z', rates: { USD: 1, PKR: 280 } }));
  const response = await get('2025-01-15');
  assert.equal(response.status, 502);
  assert.equal((await response.json()).success, false);
});
