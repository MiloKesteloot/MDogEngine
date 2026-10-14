// Serves the whole repo for testing in a browser: node static-server.mjs [port]
import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import {join, normalize, extname} from "node:path";
import {fileURLToPath} from "node:url";

const root = normalize(join(fileURLToPath(import.meta.url), "../../../.."));
const port = Number(process.argv[2] ?? 8000);
const TYPES = {".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".png": "image/png", ".json": "application/json",
    ".css": "text/css", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".csv": "text/csv", ".ttf": "font/ttf"};

createServer(async (request, response) => {
    const path = decodeURIComponent(new URL(request.url, "http://x").pathname);
    const file = normalize(join(root, path === "/" ? "index.html" : path));
    if (!file.startsWith(root)) {
        response.writeHead(403).end();
        return;
    }
    try {
        const data = await readFile(file);
        response.writeHead(200, {"Content-Type": TYPES[extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store"});
        response.end(data);
    } catch (e) {
        response.writeHead(404).end("Not found");
    }
}).listen(port, "127.0.0.1", () => console.log(`Serving ${root} at http://127.0.0.1:${port}`));
