// Just enough of a browser for the game to load in Node, so the simulation can be tested headless.
// Nothing is drawn and nothing makes sound; requestAnimationFrame never fires, so the tests drive the ticks.

const noop = () => {};
const ctx = new Proxy({}, {
    get: (target, key) => key in target ? target[key] : noop,
    set: (target, key, value) => { target[key] = value; return true; },
});

function makeElement() {
    return {
        style: {}, width: 300, height: 150, children: [],
        getContext: () => ctx,
        addEventListener: noop, removeEventListener: noop,
        appendChild: noop, setAttribute: noop, focus: noop, remove: noop,
        getBoundingClientRect: () => ({left: 0, top: 0, width: 960, height: 720}),
    };
}

const listeners = {};
globalThis.window = globalThis;
globalThis.addEventListener = (type, fn) => { (listeners[type] ??= []).push(fn); };
globalThis.removeEventListener = noop;
globalThis.dispatchFakeEvent = (type, event) => { for (const fn of listeners[type] ?? []) fn(event); };
globalThis.document = {
    createElement: makeElement,
    body: {...makeElement(), offsetWidth: 960, offsetHeight: 720, innerHTML: ""},
    documentElement: makeElement(),
    addEventListener: noop,
    title: "",
    hidden: false,
};
globalThis.location = {search: "", hostname: "test", href: "http://test/", protocol: "http:"};
globalThis.devicePixelRatio = 1;
globalThis.requestAnimationFrame = noop;
globalThis.matchMedia = () => ({addEventListener: noop, matches: false});
globalThis.Image = class { constructor() { this.complete = false; } addEventListener() {} set src(v) {} };
const store = {};
globalThis.localStorage = {getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = "" + v; }, removeItem: k => { delete store[k]; }};
