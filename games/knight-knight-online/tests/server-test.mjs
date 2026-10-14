// Checks the room server (server/worker.js), running locally with `npm run dev` in server/.
// node server-test.mjs [ws://127.0.0.1:8787]

const server = process.argv[2] ?? "ws://127.0.0.1:8787";

function open(code, role) {
    const socket = new WebSocket(`${server}/room/${code}?role=${role}`);
    const received = [];
    const waiters = [];
    socket.addEventListener("message", event => {
        const message = JSON.parse(event.data);
        const waiter = waiters.find(waiter => waiter.test(message));
        if (waiter !== undefined) {
            waiters.splice(waiters.indexOf(waiter), 1);
            waiter.resolve(message);
        } else {
            received.push(message);
        }
    });
    socket.closed = new Promise(resolve => socket.addEventListener("close", event => resolve(event.code)));
    socket.next = (test, what) => new Promise((resolve, reject) => {
        const found = received.find(test);
        if (found !== undefined) {
            received.splice(received.indexOf(found), 1);
            resolve(found);
            return;
        }
        waiters.push({test, resolve});
        setTimeout(() => reject(new Error("timed out waiting for " + what)), 4000);
    });
    socket.event = name => socket.next(m => m.t === "server" && m.e === name, name);
    return socket;
}

const code = "T" + Math.random().toString(36).slice(2, 5).toUpperCase().replace(/[^A-Z0-9]/g, "X");
let failures = 0;
async function check(name, test) {
    try {
        await test();
        console.log("ok   " + name);
    } catch (e) {
        failures++;
        console.log("FAIL " + name + ": " + e.message);
    }
}

const host = open(code, "host");
let guest;
await check("host gets a room", () => host.event("hosting"));
await check("joining an empty code is refused", async () => {
    const lost = open("ZZZZ", "guest");
    await lost.event("no-room");
    await lost.closed;
});
await check("a second host for the same code is refused", async () => {
    const other = open(code, "host");
    await other.event("taken");
});
await check("guest joins, and the host hears", async () => {
    guest = open(code, "guest");
    await guest.event("joined");
    await host.event("peer-joined");
});
await check("a third player is refused", async () => {
    const third = open(code, "guest");
    await third.event("full");
});
await check("messages go both ways", async () => {
    host.send(JSON.stringify({t: "ping", at: 1}));
    await guest.next(m => m.t === "ping" && m.at === 1, "ping");
    guest.send(JSON.stringify({t: "pong", at: 1}));
    await host.next(m => m.t === "pong" && m.at === 1, "pong");
});
await check("lots of messages arrive in order", async () => {
    for (let i = 0; i < 200; i++) {
        host.send(JSON.stringify({t: "in", f: i}));
    }
    for (let i = 0; i < 200; i++) {
        await guest.next(m => m.t === "in", "input " + i).then(m => {
            if (m.f !== i) throw new Error("out of order");
        });
    }
});
await check("guest leaving tells the host", async () => {
    guest.close();
    await host.event("peer-left");
});
await check("someone else can join after", async () => {
    guest = open(code, "guest");
    await guest.event("joined");
    await host.event("peer-joined");
});
await check("host leaving tells the guest and closes it", async () => {
    host.close();
    await guest.event("peer-left");
    await guest.closed;
});
console.log(failures === 0 ? "PASS" : failures + " FAILED");
process.exit(failures === 0 ? 0 : 1);
