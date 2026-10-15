// Match settings, changed from the title screen's settings menu and remembered in the browser.

const STORAGE_KEY = "knight-knight-online-settings";

export const ROUNDS_CHOICES = [3, 5, 7, 10];
export const BOULDER_CHOICES = ["OFF", "FEW", "NORMAL", "LOTS"];
// Every arena that can be picked, in the order the arena picker shows them. (DESERT and GRAVEYARD are left out for
// now: add one back here, and take "disabled" off it in Arenas.js, to bring it back.)
export const ARENA_NAMES = ["MEADOW", "RIVER", "SNOW", "VOLCANO", "FOREST", "MINE", "LIGHTHOUSE", "BRIDGE", "LAVALAKE", "RING", "STORM", "SUMO", "SHIP", "SHOWDOWN", "JOUST"];
// Things that come at you on their own, each of which can be turned off (boulders have their own setting, for how
// many). These match the names in the arenas' hazards lists.
export const HAZARD_KINDS = ["holes", "horse", "catapult", "lightning", "tornado", "dragon", "fireball", "bear", "chicken"];
export const WEATHER_KINDS = ["wind", "rain", "snow", "ash"];
// COOL KILLS replays knockdowns where something cool happened. FINAL BLOW only replays the one that wins the match,
// and only if it was cool.
export const KILL_CAM_CHOICES = ["COOL KILLS", "FINAL BLOW", "OFF"];

// Quick matches are played with these, so nobody gets surprised by a stranger's settings
export const DEFAULTS = {
    roundsToWin: 5,
    arenas: {}, // arena name: on or off. Missing ones are on. With more than one on, it's a different one each round.
    boulders: "NORMAL",
    hazards: {}, // hazard kind (see HAZARD_KINDS): on or off. Missing ones are on.
    weathers: {}, // weather kind (see WEATHER_KINDS): on or off. Missing ones are on.
    normalRounds: true, // off: every round is one of the game modes that are on (the next four, and showdowns and jousts)
    juggernaut: true, // every few rounds, one of the knights is huge and slow with 3 hearts
    chickenRounds: true, // every few rounds, one starts as a chicken, and every 10 seconds they swap
    killCam: "COOL KILLS",
    music: true,
    powerups: {}, // power-up type: on or off. Missing ones are on.
};

const allOff = names => Object.fromEntries(names.map(name => [name, false]));

// Settings as they were before (one arena or MIXED, and hazards, holes and weather each just on or off) turned into
// how they are now. Returns a fresh copy, filled in with the defaults for anything missing.
export function normalizeSettings(saved) {
    const values = JSON.parse(JSON.stringify({...DEFAULTS, ...saved}));
    if (typeof values.arena === "string" && ARENA_NAMES.includes(values.arena)) {
        values.arenas = Object.fromEntries(ARENA_NAMES.map(name => [name, name === values.arena]));
    }
    delete values.arena;
    if (typeof values.hazards !== "object" || values.hazards === null) {
        // (holes had their own setting then)
        values.hazards = values.hazards === false ? allOff(HAZARD_KINDS.filter(kind => kind !== "holes")) : {};
    }
    if (values.shiftingGround === false) {
        values.hazards.holes = false;
    }
    delete values.shiftingGround;
    if (values.weather === false) {
        values.weathers = allOff(WEATHER_KINDS);
    }
    delete values.weather;
    return values;
}

// Whether something in one of the on-or-off lists (arenas, hazards, weathers, powerups) is on
export function isOnIn(values, group, name) {
    return values[group]?.[name] !== false;
}

class Settings {
    constructor() {
        let saved = {};
        try {
            saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
        } catch (e) {
            // Blocked or broken storage just means the defaults
        }
        this.values = normalizeSettings(saved);
    }

    get(key) {
        return this.values[key];
    }

    set(key, value) {
        this.values[key] = value;
        this.save();
    }

    toggle(key) {
        this.set(key, !this.values[key]);
    }

    // Steps to the next (or previous) of a list of choices, wrapping around
    cycle(key, choices, direction) {
        const index = choices.indexOf(this.values[key]);
        this.set(key, choices[(index + direction + choices.length) % choices.length]);
    }

    // Everything back how it started (including every power-up on)
    reset() {
        this.values = JSON.parse(JSON.stringify(DEFAULTS));
        this.save();
    }

    isOn(group, name) {
        return isOnIn(this.values, group, name);
    }

    setOn(group, name, on) {
        this.values[group] = {...this.values[group], [name]: on};
        this.save();
    }

    isPowerupOn(type) {
        return this.isOn("powerups", type);
    }

    togglePowerup(type) {
        this.setOn("powerups", type, !this.isPowerupOn(type));
    }

    save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.values));
        } catch (e) {
            // Still works this time, just isn't remembered
        }
    }
}

export default Settings;
