// Checks the deterministic math is accurate (the browser's own Math is the reference)
import {dsin, dcos, datan2, dhypot, makeRandomState, nextRandom} from "../DetMath.js";

let worst = {sin: 0, cos: 0, atan2: 0};
const state = makeRandomState(12345);
for (let i = 0; i < 200000; i++) {
    const x = (nextRandom(state) - 0.5) * (i % 10 === 0 ? 20000 : 40);
    worst.sin = Math.max(worst.sin, Math.abs(dsin(x) - Math.sin(x)));
    worst.cos = Math.max(worst.cos, Math.abs(dcos(x) - Math.cos(x)));
    const y = (nextRandom(state) - 0.5) * 300;
    const z = (nextRandom(state) - 0.5) * 300;
    worst.atan2 = Math.max(worst.atan2, Math.abs(datan2(y, z) - Math.atan2(y, z)));
}
for (const [y, x] of [[0, 0], [0, -0], [-0, -1], [0, -1], [1, 0], [-1, 0], [0, 5], [-0, 5], [Infinity, 1], [1, -Infinity], [Infinity, -Infinity]]) {
    if (!Object.is(datan2(y, x), Math.atan2(y, x))) {
        console.log("atan2 edge differs", y, x, datan2(y, x), Math.atan2(y, x));
    }
}
console.log("worst error", worst, "hypot", dhypot(3, 4));
const ok = worst.sin < 1e-12 && worst.cos < 1e-12 && worst.atan2 < 1e-14;
console.log(ok ? "PASS" : "FAIL");
process.exit(ok ? 0 : 1);
