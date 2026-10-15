# Knight Knight Online server

A tiny Cloudflare Worker that handles join codes and quick matches (a matchmaker pairs up whoever's looking). Each
code gets a room (a Durable Object), and the two players use the room to find each other and set up a direct
connection between their browsers. After that the match goes
straight between the players, so the server barely does anything. The match only goes through the server if a
direct connection can't be made (some school or work networks block them), and it still works then, just a little
slower.

It runs on Cloudflare's free plan, with no credit card. The free plan allows 100,000 requests a day, and every 20
WebSocket messages the server receives count as one request. Setting up a match only takes a few dozen messages, so
that's thousands of matches a day. A match that has to go through the server is about 115 messages a second between
the two players, so about 5 hours of those a day. If the limit's ever reached, new matches can't start until it
resets at midnight UTC.

## Putting it online (once)

1. Make a free account at https://dash.cloudflare.com/sign-up.
2. In a terminal:

   ```
   cd games/knight-knight-online/server
   npm install
   npx wrangler login      # opens the browser to log in to Cloudflare
   npx wrangler deploy
   ```

   The first deploy asks you to pick a `workers.dev` subdomain if you haven't got one yet. Type just a name, like
   `yourname` (lowercase letters, numbers and hyphens), not a whole address. When it's done it prints the server's
   address, which is the worker's name and then your subdomain: `https://knight-knight-online.yourname.workers.dev`.
3. Put that address in `games/knight-knight-online/config.js`, with `wss://` instead of `https://`:

   ```js
   export const SERVER_URL = "wss://knight-knight-online.yourname.workers.dev";
   ```

4. Commit and push, so GitHub Pages has it. Online play then works on milo.games.

To update the server later (like after the server code changes), just run `npx wrangler deploy` again in this
folder.

## Trying it on your own computer

In one terminal, run the server:

```
cd games/knight-knight-online/server
npm run dev
```

In another, serve the game:

```
node games/knight-knight-online/tests/static-server.mjs
```

Then open http://127.0.0.1:8000/?game=knight-knight-online&server=ws://127.0.0.1:8787 in two browser windows. The
`server=` part makes the game use the server on your computer; without it, the game always uses the real one (even
when the game itself is running on your computer).
