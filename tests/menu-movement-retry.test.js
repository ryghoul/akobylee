const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../public/menu.js'), 'utf8');
const classes = (...initial) => {
  const values = new Set(initial);
  return {
    contains: value => values.has(value), add: value => values.add(value),
    remove: (...args) => args.forEach(value => values.delete(value)),
    toggle: (value, enabled) => enabled ? values.add(value) : values.delete(value),
  };
};

function harness() {
  let moves = 0;
  let focused = false;
  let scrolled = false;
  const timers = new Map();
  let timerId = 0;
  const popup = { dataset: {}, classList: classes(), inert: true };
  const message = { textContent: '' };
  const section = { classList: classes('menu-section'), querySelectorAll: () => [row] };
  const row = {
    dataset: { id: 'drink' }, classList: classes(), closest: () => section,
    getBoundingClientRect: () => ({ top: 0, height: 100 }),
    scrollIntoView: () => { scrolled = true; }, focus: () => { focused = true; },
  };
  const context = {
    canEditMenu: () => true,
    activeMenuDrag: null, menuMovementRetryTimer: null,
    document: {
      body: { classList: classes('editor-enabled') },
      getElementById: id => id === 'menuMovementRetry' ? popup : message,
      querySelectorAll: selector => selector === '.mrow' ? [row] : [section],
    },
    setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    clearTimeout: id => timers.delete(id),
    console: { error() {} },
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function hideMenuMovementRetry('), source.indexOf('\nfunction editSelectedDrink(')), context);
  context.moveMenuRow = () => { moves++; context.bindMenuRowInteractions(); };
  context.bindMenuRowInteractions();
  const dataTransfer = { setData() {}, getData: () => 'drink' };
  return { context, popup, message, row, section, timers, start: () => row.ondragstart({ dataTransfer }),
    drop: () => section.ondrop({ dataTransfer, clientY: 0, preventDefault() {}, stopPropagation() {} }),
    getMoves: () => moves, getFocused: () => focused, getScrolled: () => scrolled };
}

test('failed or cancelled drops show a retry popup that fades after five seconds', () => {
  const { start, row, popup, timers, message } = harness();
  start();
  row.ondragend();
  assert.ok(popup.classList.contains('visible'));
  assert.match(message.textContent, /retry/);
  assert.equal(popup.inert, false);
  assert.equal(timers.size, 1);
  const timer = [...timers.values()][0];
  assert.equal(timer.delay, 5000);
  timer.callback();
  assert.equal(popup.classList.contains('visible'), false);
  assert.equal(popup.inert, true);
});

test('successful drops stay quiet even when movement rebinds drag handlers', () => {
  const { start, drop, row, popup, getMoves } = harness();
  start(); drop(); row.ondragend();
  assert.equal(getMoves(), 1);
  assert.equal(popup.classList.contains('visible'), false);
});

test('movement errors show one popup and retry selects and focuses the drink', () => {
  const { context, start, drop, row, popup, timers, getFocused, getScrolled } = harness();
  context.moveMenuRow = () => { throw new Error('Drop failed'); };
  start(); drop(); row.ondragend();
  assert.ok(popup.classList.contains('visible'));
  assert.equal(timers.size, 1);
  context.retryMenuMovement();
  assert.ok(row.classList.contains('is-selected'));
  assert.ok(getFocused()); assert.ok(getScrolled());
  assert.equal(popup.classList.contains('visible'), false);
});
