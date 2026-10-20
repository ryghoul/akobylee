const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const publicDir = path.join(__dirname, '..', 'public');
const source = fs.readFileSync(path.join(publicDir, 'visit.js'), 'utf8');
function visit(storage) {
  const classes = new Set();
  const context = {
    localStorage: storage,
    window: {},
    document: { documentElement: { classList: { add: name => classes.add(name) } } }
  };
  vm.runInNewContext(source, context);
  return { returning: context.window.akoReturningVisitor, classes };
}

test('first visit shows entry; subsequent navigation and later visits skip it', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  const first = visit(storage);
  assert.equal(first.returning, false);
  assert.equal(first.classes.has('returning-visitor'), false);
  assert.equal(values.get('ako_visited'), '1');
  const next = visit(storage);
  assert.equal(next.returning, true);
  assert.equal(next.classes.has('returning-visitor'), true);
});

test('existing visitor markers are respected', () => {
  assert.equal(visit({ getItem: () => '1', setItem() {} }).returning, true);
});

test('blocked storage does not break entry', () => {
  assert.equal(visit({ getItem() { throw new Error('Storage denied'); } }).returning, false);
  assert.equal(visit({ getItem: () => '1', setItem() { throw new Error('Quota exceeded'); } }).returning, true);
});

test('every site page checks visits in the head before rendering content', () => {
  for (const name of fs.readdirSync(publicDir).filter(name => name.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(publicDir, name), 'utf8');
    assert.match(html, /<head>\s*<script src="visit.js"><\/script>/, name);
  }
});
