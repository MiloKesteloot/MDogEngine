/*
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║   Snack Man Remastered - online scoreboard                           ║
 * ║   This file was written by Claude (Anthropic's AI).                  ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

// The online top 10, stored in Supabase. Talks to Supabase's built-in web API with plain fetch calls.
// Each name has one entry, holding that name's best score. Scores can only be added through the
// submit_snack_man_score database function, which only ever raises a name's score, never lowers it.
//
// Fill these in from your Supabase project (Project Settings -> API). The anon / publishable key is meant
// to be public, so it's fine here. Never put the service_role / secret key here.
// While they're empty, the scoreboard just shows as offline and the game works without it.
const SUPABASE_URL = "https://vymdamtkgujoqprmzuma.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_iHinE0cf-DQxoC4-HZ4Wmw_O2lc7Eil";

const TABLE = "snack_man_scores";
const SUBMIT_FUNCTION = "submit_snack_man_score";
const BOARD_SIZE = 10;
const MAX_NAME_LENGTH = 10;
const NAME_KEY = "snack-man-name"; // the last name entered on this device

// Names can't contain these (the database checks the same list, so this just gives a quicker message)
const BLOCKED_WORDS = ["FUCK", "SHIT", "CUNT", "NIGG", "FAG", "BITCH", "WHORE", "SLUT", "RAPE", "DICK", "COCK", "PUSSY"];

// Capital letters, numbers and single spaces only, since that's what the pixel font draws well
function cleanName(text) {
    return text.toUpperCase().replace(/[^A-Z0-9 ]/g, "").replace(/ +/g, " ").slice(0, MAX_NAME_LENGTH);
}

class Scoreboard {
    constructor() {
        this.entries = []; // [{name, score}], best first
        this.status = "loading"; // "loading", "ready" or "offline"
        this.highlight = null; // a name to flash on the board (just saved)

        try {
            this.myName = localStorage.getItem(NAME_KEY);
        } catch (e) {
            this.myName = null;
        }

        this.refresh();
    }

    isConfigured() {
        return SUPABASE_URL !== "" && SUPABASE_ANON_KEY !== "";
    }

    headers() {
        const headers = {apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json"};
        // Older "anon" keys are JWTs and also go in Authorization; newer "publishable" keys must not
        if (!SUPABASE_ANON_KEY.startsWith("sb_publishable_")) {
            headers.Authorization = "Bearer " + SUPABASE_ANON_KEY;
        }
        return headers;
    }

    // Loads the top 10. Never throws: if something goes wrong, the board just shows as offline.
    async refresh() {
        if (!this.isConfigured()) {
            this.status = "offline";
            return;
        }
        try {
            const url = SUPABASE_URL + "/rest/v1/" + TABLE + "?select=name,score&order=score.desc,updated_at.asc&limit=" + BOARD_SIZE;
            const response = await fetch(url, {headers: this.headers()});
            if (!response.ok) {
                throw new Error("Scoreboard load failed: " + response.status);
            }
            this.entries = await response.json();
            this.status = "ready";
        } catch (e) {
            console.error(e);
            this.status = "offline";
        }
    }

    // Whether a score would get onto the top 10
    qualifies(score) {
        if (this.status !== "ready" || score <= 0) {
            return false;
        }
        return this.entries.length < BOARD_SIZE || score > this.entries[this.entries.length - 1].score;
    }

    // {rank, score} for a name on the board, or null. Rank starts at 1.
    find(name) {
        const key = cleanName(name).trim();
        const index = this.entries.findIndex(entry => entry.name === key);
        return index === -1 ? null : {rank: index + 1, score: this.entries[index].score};
    }

    // Why a name can't be used, or null if it's fine
    nameProblem(name) {
        const clean = cleanName(name).trim();
        if (clean === "") {
            return "TYPE A NAME FIRST";
        }
        if (BLOCKED_WORDS.some(word => clean.replace(/ /g, "").includes(word))) {
            return "PLEASE PICK ANOTHER NAME";
        }
        return null;
    }

    rememberName(name) {
        this.myName = name;
        try {
            localStorage.setItem(NAME_KEY, name);
        } catch (e) {
            // No storage: they'll just have to type it again next time
        }
    }

    // Saves a score. Resolves to {name, score, improved} (improved is false if the name already had a
    // score at least this high), or throws if it couldn't be saved.
    async submit(name, score) {
        const response = await fetch(SUPABASE_URL + "/rest/v1/rpc/" + SUBMIT_FUNCTION, {
            method: "POST",
            headers: this.headers(),
            body: JSON.stringify({player_name: cleanName(name).trim(), player_score: score})
        });
        if (!response.ok) {
            throw new Error("Scoreboard save failed: " + response.status + " " + await response.text());
        }
        const rows = await response.json();
        this.rememberName(rows[0].name);
        this.highlight = rows[0].name;
        await this.refresh();
        return rows[0];
    }
}

export {cleanName, MAX_NAME_LENGTH};
export default Scoreboard;
