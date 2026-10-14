// Copying and fingerprinting the whole game, for online play.
//
// Online, the game sometimes has to go back a few ticks (when the other player's key presses turn out different from
// what it guessed) and play them again. So it keeps copies of the game: everything that changes as it's played, which
// the game gathers into one object (see captureState in knight-knight-online.js).
//
// cloneState copies all of it, keeping each thing's class (so a copied Knight is still a Knight) and keeping things
// that point at each other pointing at the copies (a boulder's owner is the copied knight, not the old one). Frozen
// things never change, like the arenas' layouts and the players' colors, so copies share them instead.
//
// hashState boils it all down to a short fingerprint. Both players' games fingerprint the same ticks and compare, so
// if they ever drift apart it's noticed straight away.

export function deepFreeze(thing) {
    if (thing === null || typeof thing !== "object" || Object.isFrozen(thing)) {
        return thing;
    }
    Object.freeze(thing);
    for (const key of Object.keys(thing)) {
        deepFreeze(thing[key]);
    }
    return thing;
}

export function cloneState(root) {
    const copies = new Map();

    function copy(value) {
        if (value === null || typeof value !== "object") {
            return value; // numbers, strings, and functions (which never hold game state here)
        }
        if (Object.isFrozen(value)) {
            return value;
        }
        const done = copies.get(value);
        if (done !== undefined) {
            return done;
        }
        if (Array.isArray(value)) {
            const array = new Array(value.length);
            copies.set(value, array);
            for (let i = 0; i < value.length; i++) {
                array[i] = copy(value[i]);
            }
            return array;
        }
        if (value instanceof Map) {
            const map = new Map();
            copies.set(value, map);
            for (const [key, item] of value) {
                map.set(copy(key), copy(item));
            }
            return map;
        }
        if (value instanceof Set) {
            const set = new Set();
            copies.set(value, set);
            for (const item of value) {
                set.add(copy(item));
            }
            return set;
        }
        if (ArrayBuffer.isView(value)) {
            const typed = value.slice();
            copies.set(value, typed);
            return typed;
        }
        const object = Object.create(Object.getPrototypeOf(value));
        copies.set(value, object);
        for (const key of Object.keys(value)) {
            object[key] = copy(value[key]);
        }
        return object;
    }

    return copy(root);
}

// skip(object, key) leaves out parts that are allowed to differ between the two players' games (like where the
// raindrops are, which is only for looks)
export function hashState(root, skip) {
    const numberView = new DataView(new ArrayBuffer(8));
    let a = 0x811c9dc5;
    let b = 0x2545f491;
    const mix = word => {
        a = Math.imul(a ^ word, 0x01000193);
        b = Math.imul(b ^ word, 0x5bd1e995);
        b ^= b >>> 13;
    };
    const mixString = text => {
        mix(text.length | 0x40000000);
        for (let i = 0; i < text.length; i++) {
            mix(text.charCodeAt(i));
        }
    };
    const seen = new Map(); // things already fingerprinted, by the order they were first seen

    function visit(value) {
        switch (typeof value) {
            case "number":
                numberView.setFloat64(0, value);
                mix(1);
                mix(numberView.getUint32(0));
                mix(numberView.getUint32(4));
                return;
            case "string":
                mix(2);
                mixString(value);
                return;
            case "boolean":
                mix(value ? 3 : 4);
                return;
            case "undefined":
                mix(5);
                return;
            case "function":
                mix(6);
                return;
        }
        if (value === null) {
            mix(7);
            return;
        }
        const id = seen.get(value);
        if (id !== undefined) {
            mix(8);
            mix(id);
            return;
        }
        seen.set(value, seen.size);
        if (Array.isArray(value) || ArrayBuffer.isView(value)) {
            mix(9);
            mix(value.length);
            for (let i = 0; i < value.length; i++) {
                visit(value[i]);
            }
        } else if (value instanceof Map) {
            mix(10);
            mix(value.size);
            for (const [key, item] of value) {
                visit(key);
                visit(item);
            }
        } else if (value instanceof Set) {
            mix(11);
            mix(value.size);
            for (const item of value) {
                visit(item);
            }
        } else {
            mix(12);
            for (const key of Object.keys(value)) {
                if (skip !== undefined && skip(value, key)) {
                    continue;
                }
                mixString(key);
                visit(value[key]);
            }
        }
    }

    visit(root);
    return ((a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0"));
}

// ---------- Sending a copy over the network ----------
//
// If the two games ever do drift apart, the host sends the guest its copy of the game, to carry on from. That means
// turning it into plain JSON and back. classes is {name: class} for every kind of thing in the game, so things come
// back as the right class. Frozen things aren't sent, just named (frozenNames maps each one to its name).

function encodeNumber(value) {
    if (Number.isFinite(value) && !Object.is(value, -0)) {
        return value;
    }
    return {n: Object.is(value, -0) ? "-0" : String(value)};
}

export function serializeState(root, classes, frozenNames) {
    const classNames = new Map(Object.entries(classes).map(([name, type]) => [type.prototype, name]));
    const ids = new Map();
    const nodes = [];

    function encode(value) {
        switch (typeof value) {
            case "number":
                return encodeNumber(value);
            case "string":
            case "boolean":
                return value;
            case "undefined":
                return {u: 1};
            case "function":
                throw new Error("Can't send a function");
        }
        if (value === null) {
            return null;
        }
        if (Object.isFrozen(value)) {
            const name = frozenNames.get(value);
            if (name === undefined) {
                throw new Error("A frozen thing with no name");
            }
            return {z: name};
        }
        let id = ids.get(value);
        if (id !== undefined) {
            return {r: id};
        }
        id = nodes.length;
        ids.set(value, id);
        const node = [];
        nodes.push(node);
        if (Array.isArray(value)) {
            node.push("A", value.map(encode));
        } else if (value instanceof Map) {
            node.push("M", [...value].map(([key, item]) => [encode(key), encode(item)]));
        } else if (value instanceof Set) {
            node.push("S", [...value].map(encode));
        } else {
            const prototype = Object.getPrototypeOf(value);
            const name = prototype === Object.prototype ? "O" : classNames.get(prototype);
            if (name === undefined) {
                throw new Error("Don't know how to send a " + prototype?.constructor?.name);
            }
            const fields = {};
            for (const key of Object.keys(value)) {
                fields[key] = encode(value[key]);
            }
            node.push(name, fields);
        }
        return {r: id};
    }

    const top = encode(root);
    return {top, nodes};
}

export function deserializeState(data, classes, frozenByName) {
    // Every object first (empty), so things can point at each other however they like, then what's in them
    const objects = data.nodes.map(([type]) => {
        if (type === "A") return [];
        if (type === "M") return new Map();
        if (type === "S") return new Set();
        if (type === "O") return {};
        const kind = classes[type];
        if (kind === undefined) {
            throw new Error("Unknown kind of thing: " + type);
        }
        return Object.create(kind.prototype);
    });

    function decode(value) {
        if (value === null || typeof value !== "object") {
            return value;
        }
        if (value.r !== undefined) return objects[value.r];
        if (value.z !== undefined) {
            const thing = frozenByName.get(value.z);
            if (thing === undefined) {
                throw new Error("Unknown frozen thing: " + value.z);
            }
            return thing;
        }
        if (value.n !== undefined) return value.n === "-0" ? -0 : Number(value.n);
        if (value.u !== undefined) return undefined;
        throw new Error("Can't read " + JSON.stringify(value));
    }

    data.nodes.forEach(([type, contents], i) => {
        const object = objects[i];
        if (type === "A") {
            contents.forEach(item => object.push(decode(item)));
        } else if (type === "M") {
            contents.forEach(([key, item]) => object.set(decode(key), decode(item)));
        } else if (type === "S") {
            contents.forEach(item => object.add(decode(item)));
        } else {
            for (const key of Object.keys(contents)) {
                object[key] = decode(contents[key]);
            }
        }
    });
    return decode(data.top);
}

// Names every frozen thing reachable from the tables given (by where it is, like "ARENAS.MEADOW.rocks.0"), both ways
export function nameFrozenThings(tables) {
    const names = new Map();
    const byName = new Map();
    const visit = (thing, name) => {
        if (thing === null || typeof thing !== "object" || names.has(thing)) {
            return;
        }
        names.set(thing, name);
        byName.set(name, thing);
        for (const key of Object.keys(thing)) {
            visit(thing[key], name + "." + key);
        }
    };
    for (const [name, table] of Object.entries(tables)) {
        visit(table, name);
    }
    return {names, byName};
}
