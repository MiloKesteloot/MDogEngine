# Knight Knight Online

Knight Knight, but you can also play it online with a friend, using a join code. Local two player still works
exactly like before. The original `games/knight-knight` is untouched.

On the title screen:

- **LOCAL MATCH**: two players, one keyboard, like always. Space or Enter starts it straight away.
- **QUICK MATCH**: play whoever else is looking. If someone's waiting you're paired with them straight away;
  otherwise you wait in line and play the next person who looks. While QUICK MATCH is picked, the bottom of the
  title screen says if anyone's waiting and how many matches are being played. Quick matches use the standard
  settings (the host can change them in the lobby after the first one).
- **HOST ONLINE MATCH**: you get a 4 letter code. Send it to a friend, or press C to copy a link that joins in one
  click (the address you're on, plus `&code=` and the code). You're
  red, and you pick the match's settings while you wait (Enter on the code screen); whatever they're set to when your
  friend joins is the match. When your friend joins, a doorbell plays, and if you're in another tab its title flashes
  "FRIEND JOINED!".
- **JOIN ONLINE MATCH**: type your friend's code (pasting the code or the whole invite link works too, and capitals
  don't matter). You're blue. You see the host's settings while the match gets ready.

Online, either set of keys moves your knight. Esc opens a menu, but it doesn't pause anything. After a match, both
press R for a rematch, or the host can press Esc and pick CHANGE SETTINGS: you both go to a lobby (still connected),
the host changes the settings while the guest watches them change, and START MATCH begins a new one. The ping is in
the bottom right corner, with "(SERVER)" next to it when the match is going through the server instead of straight
between you. F3 (or CONNECTION INFO in the menu) shows more: the ping, the input delay, how often the game is going
back to fix a wrong guess, how in step the two games are, and the sync checks.

Esc on the title screen opens the settings. Arenas, power-ups, hazards, weather and game modes each open their
own menu, where every one can be turned on or off separately, and a line under the menu says what the picked one
does. The arena picker shows a picture of each arena (made by `tests/arena-thumbs.mjs` and `tests/arena_thumbs.py`,
saved in `assets/knight-knight-online/`). With one arena on, every round is there; with more, it's a different one
each round. In GAME MODES, turning NORMAL ROUNDS off makes every round one of the modes that are on (juggernauts,
chickens, showdowns, jousts), on an arena that mode works on. Settings saved by an older version are converted (`normalizeSettings` in `Settings.js`).

Every few rounds (from round 3) there's a **chicken round**, on any arena but the bridge, sumo, the lighthouse, the
showdown and the joust: one knight starts as a chicken (blue's has a blue comb), which walks like a knight and picks
up power-ups but can't attack. Every 10 seconds everything holds still for a second and they swap. There are no sword
throws and no wild chickens in a chicken round, and never a juggernaut at the same time.

Before online play works on milo.games the server has to be put online. That takes a few minutes and it's free; see
[server/README.md](server/README.md).

## How it works

Both players' computers run the whole game, and all they send each other is their key presses: a few bits each tick.
To keep the two games exactly the same:

- **Everything that changes in a match is in one place.** `captureState()` gathers it, so it can be copied
  (`cloneState`), put back, fingerprinted (`hashState`), and sent (`serializeState`). See `Snapshot.js`.
- **Random numbers are seeded.** The host picks the seed, and the random number generator's state is part of the
  game. Things that are only for show (particles, raindrops, screen shake) use `Math.random` instead, so they can't
  throw the game's random numbers off.
- **Math is the same in every browser.** `Math.sin`, `cos`, `atan2` and `hypot` can differ slightly between Chrome
  and Safari, so the game uses its own versions from `DetMath.js`, built from operations every browser does
  identically.
- **Sounds and particles can be switched off** (`fx.on`), for when ticks are played again.

It uses **rollback netcode** (`Rollback.js`), like modern fighting games. Your own presses are used a couple of
ticks after you press them (the input delay, which follows the ping and is usually 2 to 4 ticks, 12 to 25 ms). If
the other player's presses haven't arrived yet when they're needed, the game guesses they're still holding the same
keys and carries on. When the real ones arrive and the guess was wrong, it goes back to a saved copy from before that
tick and plays forward again, invisibly, in the same frame. Most of the time the guess is right. Neither player has
an advantage: the host isn't "the server", and both games decide everything the same way.

Every second both games fingerprint the same tick and compare. If they ever don't match (which shouldn't happen),
the host sends its whole game over (about 30 KB) and the guest carries on from that, so a match never stays broken.
"FIXING SYNC..." shows in the corner while that happens.

The kill cam works online too. It's part of the game, so it starts and stops at the same moment for both players,
and either player can skip it by swinging.

### Files

| File | What it does |
|---|---|
| `knight-knight-online.js` | The game (a copy of Knight Knight's), plus the title menu, the online screens, and saving and restoring |
| `Rollback.js` | The rollback netcode. It knows nothing about the game itself, so it's tested on its own. |
| `Online.js` | Hosting and joining, measuring the ping, starting the match together, leaving |
| `Connection.js` | The WebSocket to the server, and the direct WebRTC connection between the browsers |
| `Snapshot.js` | Copying, fingerprinting and sending the game |
| `DetMath.js` | Math that's the same in every browser, and the seeded random numbers |
| `config.js` | Where the server is |
| `server/` | The Cloudflare Worker for join codes |
| `tests/` | Tests, run with Node (see below) |

## Tests

From `games/knight-knight-online/tests`, with Node 22 or newer:

| Test | Checks |
|---|---|
| `node sync-test.mjs` | Two copies of the game given the same presses stay identical in every arena, and going back and replaying comes out the same |
| `node long-mixed.mjs` | The same over a long mixed match (juggernauts, chicken rounds, showdowns, jousts...) |
| `node net-test.mjs` | Real matches with the rollback netcode over pretend networks: good, laggy, jittery, losing packets, changing delay, and one knocked out of sync on purpose that has to fix itself |
| `node serialize-test.mjs` | A copy of the game sent as JSON comes back exactly the same |
| `node hash-sanity.mjs`, `node detmath-test.mjs`, `node replay-check.mjs` | The fingerprint notices tiny differences, the math is accurate, and online kill cams play |
| `node server-test.mjs` | The server's rooms (needs `npm run dev` in `server/`) |
| `node browser-test.mjs` | Two real headless Chrome browsers play an online match through the local server. `NO_DIRECT=1` forces it through the server. (Needs the server and `node static-server.mjs`.) |
| `node local-test.mjs` | Local two player still works in a real browser |
| `node mouse-test.mjs` | Menus with the mouse: hovering selects, moving off selects nothing, arrows bring the selector back, clicking picks |
| `node quick-test.mjs`, `node invite-test.mjs` | Quick match pairing and cancelling, and invite links joining in one click, in two real browsers |
| `node lobby-test.mjs` | The settings shown before a match, the lobby between matches, and F3, in two real browsers |
| `node chicken-round-check.mjs` | Chicken rounds come up (never on the bridge, sumo or lighthouse), swap after a second's freeze, chickens never swing, and no sword throws drop |
| `node modes-check.mjs` | With normal rounds off, every round is one of the game modes that are on, in sync between two copies |
| `node settings-look.mjs` | The settings menus: the arena picker with the keys and the mouse, the hazards menu, and screenshots of them |
| `node showdown-check.mjs` | The showdown: all three layouts come up, and nothing extra (boulders, hazards, holes, chickens...) ever does |
| `node boxin-check.mjs`, `node fissure-edges.mjs` | The volcano's fissures boxing the knights in (always away from them, both on the same side, never too small), and reaching edge to edge |
| `node volcano-check.mjs` | The volcano's dragons every 7 to 13 seconds, and falling into a fissure |
| `node boogie-check.mjs` | The boogie bomb (dance, but can't attack, for 5 seconds), and the pause between rounds |
| `node facing-check.mjs`, `node code-check.mjs`, `node storm-check.mjs` | Spamming swing while turning, join codes, and the storm arena's lightning |

The browser tests use Chrome at its usual Windows location; set `CHROME` to use another one.
