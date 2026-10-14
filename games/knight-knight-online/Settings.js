// Match settings, changed from the title screen's settings menu and remembered in the browser.

const STORAGE_KEY = "knight-knight-online-settings";

export const ROUNDS_CHOICES = [3, 5, 7, 10];
export const BOULDER_CHOICES = ["OFF", "FEW", "NORMAL", "LOTS"];
export const ARENA_CHOICES = ["MIXED", "MEADOW", "RIVER", "SNOW", "VOLCANO", "FOREST", "MINE", "LIGHTHOUSE", "BRIDGE", "LAVALAKE", "RING", "STORM", "SUMO", "SHIP", "SHOWDOWN", "JOUST"];
// COOL KILLS replays knockdowns where something cool happened. FINAL BLOW only replays the one that wins the match,
// and only if it was cool.
export const KILL_CAM_CHOICES = ["COOL KILLS", "FINAL BLOW", "OFF"];

const DEFAULTS = {
    roundsToWin: 5,
    arena: "MIXED", // MIXED picks a different arena every round
    boulders: "NORMAL",
    weather: true,
    hazards: true, // horses, catapults, fireballs, dragons, chickens, bears and the storm's lightning
    shiftingGround: true, // holes cracking open mid-round
    juggernaut: true, // every few rounds, whoever's behind is huge and slow with 3 hearts
    killCam: "COOL KILLS",
    music: true,
    powerups: {}, // power-up type: on or off. Missing ones are on.
};

class Settings {
    constructor() {
        this.values = JSON.parse(JSON.stringify(DEFAULTS));
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
            Object.assign(this.values, saved);
        } catch (e) {
            // Blocked or broken storage just means the defaults
        }
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

    isPowerupOn(type) {
        return this.values.powerups[type] !== false;
    }

    togglePowerup(type) {
        this.values.powerups[type] = !this.isPowerupOn(type);
        this.save();
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
