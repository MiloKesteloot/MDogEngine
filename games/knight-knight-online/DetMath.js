// Math that comes out exactly the same in every browser, for online play.
//
// Online, both players' computers run the whole game themselves and only send each other their key presses, so
// every number in the game has to come out the same on both, down to the last bit, or the two games drift apart.
// Adding, multiplying, dividing and square roots always do, but Math.sin, Math.cos, Math.atan2 and Math.hypot are
// allowed to differ a tiny bit between browsers (Chrome and Safari don't always agree). These are built only from
// the operations that always agree. They're the classic fdlibm ones, accurate to about the last digit.
//
// The random numbers are here too: a seeded generator whose state is part of the game, so both players' games roll
// the same numbers.

// pi/2 split in two, so angles can be brought into range without losing precision
const PIO2_HI = 1.57079632673412561417e+00;
const PIO2_LO = 6.07710050650619224932e-11;
const INV_PIO2 = 6.36619772367581382433e-01;

const S1 = -1.66666666666666324348e-01;
const S2 = 8.33333333332248946124e-03;
const S3 = -1.98412698298579493134e-04;
const S4 = 2.75573137070700676789e-06;
const S5 = -2.50507602534068634195e-08;
const S6 = 1.58969099521155010221e-10;

const C1 = 4.16666666666666019037e-02;
const C2 = -1.38888888888741095749e-03;
const C3 = 2.48015872894767294178e-05;
const C4 = -2.75573143513906633035e-07;
const C5 = 2.08757232129817482790e-09;
const C6 = -1.13596475577881948265e-11;

// sin and cos for x between -pi/4 and pi/4
function kernelSin(x) {
    const z = x * x;
    return x + x * z * (S1 + z * (S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)))));
}

function kernelCos(x) {
    const z = x * x;
    return 1 - 0.5 * z + z * z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
}

// Which quarter turn x is in (0 to 3), and how far into it
function reduce(x) {
    const n = Math.round(x * INV_PIO2);
    const r = (x - n * PIO2_HI) - n * PIO2_LO;
    return [((n % 4) + 4) % 4, r];
}

export function dsin(x) {
    if (!Number.isFinite(x)) {
        return NaN;
    }
    const [quarter, r] = reduce(x);
    switch (quarter) {
        case 0: return kernelSin(r);
        case 1: return kernelCos(r);
        case 2: return -kernelSin(r);
        default: return -kernelCos(r);
    }
}

export function dcos(x) {
    if (!Number.isFinite(x)) {
        return NaN;
    }
    const [quarter, r] = reduce(x);
    switch (quarter) {
        case 0: return kernelCos(r);
        case 1: return -kernelSin(r);
        case 2: return -kernelCos(r);
        default: return kernelSin(r);
    }
}

const ATAN_HI = [4.63647609000806093515e-01, 7.85398163397448278999e-01, 9.82793723247329054082e-01, 1.57079632679489655800e+00];
const ATAN_LO = [2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399573676603587e-17];
const AT = [
    3.33333333333329318027e-01, -1.99999999998764832476e-01, 1.42857142725034663711e-01, -1.11111104054623557880e-01,
    9.09088713343650656196e-02, -7.69187620504482999495e-02, 6.66107313738753120669e-02, -5.83357013379057348645e-02,
    4.97687799461593236017e-02, -3.65315727442169155270e-02, 1.62858201153657823623e-02,
];

export function datan(x) {
    if (Number.isNaN(x)) {
        return NaN;
    }
    const sign = x < 0 ? -1 : 1;
    let a = Math.abs(x);
    let id;
    if (a > 1e17) {
        return sign * (ATAN_HI[3] + ATAN_LO[3]);
    }
    if (a < 0.4375) {
        if (a < 1e-29) {
            return x;
        }
        id = -1;
    } else if (a < 1.1875) {
        if (a < 0.6875) {
            id = 0;
            a = (2 * a - 1) / (2 + a);
        } else {
            id = 1;
            a = (a - 1) / (a + 1);
        }
    } else if (a < 2.4375) {
        id = 2;
        a = (a - 1.5) / (1 + 1.5 * a);
    } else {
        id = 3;
        a = -1 / a;
    }
    const z = a * a;
    const w = z * z;
    const s1 = z * (AT[0] + w * (AT[2] + w * (AT[4] + w * (AT[6] + w * (AT[8] + w * AT[10])))));
    const s2 = w * (AT[1] + w * (AT[3] + w * (AT[5] + w * (AT[7] + w * AT[9]))));
    if (id < 0) {
        return sign * (a - a * (s1 + s2));
    }
    return sign * (ATAN_HI[id] - ((a * (s1 + s2) - ATAN_LO[id]) - a));
}

export function datan2(y, x) {
    if (Number.isNaN(x) || Number.isNaN(y)) {
        return NaN;
    }
    const negativeX = x < 0 || Object.is(x, -0);
    if (y === 0) {
        // Straight along the x axis: 0 or pi, keeping the sign of y
        return negativeX ? (Object.is(y, -0) ? -Math.PI : Math.PI) : y;
    }
    if (x === 0) {
        return y > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
        if (!Number.isFinite(x) && !Number.isFinite(y)) {
            const angle = negativeX ? 3 * Math.PI / 4 : Math.PI / 4;
            return y > 0 ? angle : -angle;
        }
        if (!Number.isFinite(y)) {
            return y > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
        return negativeX ? (y > 0 ? Math.PI : -Math.PI) : (y > 0 ? 0 : -0);
    }
    const t = datan(Math.abs(y / x));
    if (!negativeX) {
        return y > 0 ? t : -t;
    }
    return y > 0 ? Math.PI - t : -(Math.PI - t);
}

export function dhypot(x, y) {
    return Math.sqrt(x * x + y * y);
}

// ---------- Random numbers ----------

// mulberry32: small, fast, and good enough for a game. Its whole state is one number, kept in an object so it can be
// saved and restored with the rest of the game.
export function makeRandomState(seed) {
    return {s: seed >>> 0};
}

export function nextRandom(state) {
    state.s = (state.s + 0x6D2B79F5) >>> 0;
    let t = state.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
