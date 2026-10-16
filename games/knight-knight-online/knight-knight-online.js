import MDog from "../../MDogModules/MDogMain.js"
import Sound from "./Sound.js";
import Music from "./Music.js";
import Particles from "./Particles.js";
import Settings, {ROUNDS_CHOICES, BOULDER_CHOICES, ARENA_NAMES, HAZARD_KINDS, WEATHER_KINDS, KILL_CAM_CHOICES, DEFAULTS, normalizeSettings, isOnIn} from "./Settings.js";
import ARENAS from "./Arenas.js";
import Weather from "./Weather.js";
import Marks from "./Marks.js";
import KillCam, {BEFORE_TICKS as REPLAY_BEFORE_TICKS, AFTER_TICKS as REPLAY_AFTER_TICKS, PLAYBACK_SPEED as REPLAY_SPEED} from "./KillCam.js";
import {dsin, dcos, datan2, dhypot, makeRandomState, nextRandom} from "./DetMath.js";
import {cloneState, hashState, deepFreeze, serializeState, deserializeState, nameFrozenThings} from "./Snapshot.js";
import Online, {CODE_LENGTH, cleanCode, isCodeLetter, fetchStats} from "./Online.js";

// Knight Knight: a two player knight duel. One hit knocks a knight down, and the first to win 5 rounds wins.
// Swords that meet clang off each other (a parry). Boulders roll through that can be hit back at the other knight,
// giant boulders smash through everything, and there's always a power-up somewhere on the field:
//   Shield: a bubble that blocks one hit       Speed: faster walking
//   Thunder: lightning strikes the other knight  Big: twice as big, with twice the reach (and twice the target)
//   Avalanche: boulders roll in at the other knight, and can't hurt you
//   Fury: swing almost twice as fast
//   Throw sword: your next swing throws your sword, really fast. Then you have to go pick it up.
//   Reverse: the other knight's controls are backwards
// Every few rounds there's a showdown instead: no swords, just guns that never run out, with crates to hide behind.
// Sumo rounds are on a platform in the
// water, where hits only shove and the loser is whoever gets pushed in. Chickens show up when nobody's been hit for
// a minute. Each knight can taunt, which leaves him stuck in place for a second. Every few rounds is a juggernaut
// round, where one of the knights (picked at random) is huge and slow, with 3 hearts. Now and then there's a joust
// instead: both knights on horseback with momentum, and when they collide the faster one wins.
//
// A match builds up: round 1 is a plain sword fight (just boulders and power-ups), round 2 adds one twist (like
// wind or lightning), and from round 3 on anything goes, with the arena's hazards (and boulders) picked at random
// each round, like the weather.
// Rounds are fought in different arenas (see Arenas.js), with weather, hazards like horses and catapults, and
// ground that cracks open. Esc pauses, and the pause menu has the settings.

const Keyboard = MDog.Input.Keyboard;

// Small screen so the 20 pixel knights show up nice and big
MDog.Draw.setScreenSize(240, 180);
const SCREEN_WIDTH = MDog.Draw.getScreenWidthInArtPixels();
const SCREEN_HEIGHT = MDog.Draw.getScreenHeightInArtPixels();
const CENTER_X = MDog.Draw.getHalfScreenWidthInArtPixels();

const TICKS_PER_SECOND = 160; // MDog runs the active function at a fixed 160 ticks per second

// ---------- Tuning ----------

const WALK_SPEED = 60 / TICKS_PER_SECOND; // pixels per tick
const FRICTION = 0.86; // how much of a knight's push is left each tick, after a lunge or knockback
const ICE_FRICTION = 0.965; // on the snowfield everything slides much further
const ICE_ACCEL = 0.014; // and walking speeds up slowly instead of all at once
const SWING_SPEED = 14; // animation speed of the swing, so it's over in about 0.37 seconds
const LUNGE = 0.9; // the step forward at the start of a swing
const SWING_BUFFER_TICKS = 24; // pressing swing this soon before a swing ends swings again right after it
const CLASH_KNOCKBACK = 2.2;
const CLASH_STUN_TICKS = 26; // how long both knights can't do anything after their swords meet
const DEATH_KNOCKBACK = 2.8;
const ROCK_RECOIL = 1.2; // the bounce back when a sword hits a rock

const TRAIL_SPEED = 1.1; // moving faster than this leaves fading copies behind
const TRAIL_TICKS = 18; // how long each copy takes to fade

// Hitstop: everything freezes for a moment when something hits, so you can feel it
const HITSTOP_CLASH = 10;
const HITSTOP_DEFLECT = 6;
const HITSTOP_KILL = 28;
const HITSTOP_MATCH_POINT = 70;
const HITSTOP_BLOCK = 12;

// After a knockdown the game plays in slow motion for a moment
const SLOWMO_KILL = 150; // ticks
const SLOWMO_MATCH_POINT = 360;
const SLOWMO_RATE = 3; // during slow motion, the game moves on once every this many ticks
const FLASH_TICKS = 10; // the screen flashes white on a knockdown
// In the dark arenas, a lightning strike lights everything up: bright, a flicker, bright again, then it fades back
const LIGHTNING_GLOW_TICKS = 90; // about half a second

const POPUP_TICKS = 90;
const SLASH_TICKS = 22;
const SLASH_LENGTH = 30;
const CLOSE_CALL_GAP = 3; // missing by this many pixels or less is a close call
const CLOSE_CALL_COOLDOWN_TICKS = 90; // so they don't pile up
const QUICK_ROUND_TICKS = 3 * TICKS_PER_SECOND; // a round won faster than this is a "QUICK KILL!"
const EPIC_ROUND_TICKS = 40 * TICKS_PER_SECOND; // one that goes longer is "WHAT A FIGHT!"

const READY_TICKS = 150; // "READY" before each round
const FIGHT_TEXT_TICKS = 70; // how long "FIGHT!" stays up after the round starts
const ROUND_OVER_TICKS = 260 + 0.5 * TICKS_PER_SECOND; // from a knight going down to the next round (when there's no replay)
const RESTART_DELAY_TICKS = 120; // after the match, so a late swing press doesn't skip the win screen

const BOULDER_SPEED = 70 / TICKS_PER_SECOND; // pixels per tick
const BOULDER_MAX_SPEED = 160 / TICKS_PER_SECOND; // they get faster each time they're hit back
const BOULDER_DEFLECT_SPEEDUP = 1.5;
const BOULDER_WARNING_TICKS = TICKS_PER_SECOND; // the "!" shows this long before a boulder rolls in
const BOULDER_FIRST_WAIT = 2 * TICKS_PER_SECOND;
const BOULDER_MIN_WAIT = 5 * TICKS_PER_SECOND;
const BOULDER_MAX_WAIT = 9 * TICKS_PER_SECOND;
const BOULDER_ROUND_CHANCE = 0.45; // from round 3, how often a round has boulders at all
const HAZARD_ROUND_CHANCE = 0.4; // from round 3, how often each of the arena's hazards is on for a round...
const MAX_ROUND_HAZARDS = 2; // ...with no more than this many at once
const BOULDER_SETTING_WAIT = {OFF: Infinity, FEW: 1.8, NORMAL: 1, LOTS: 0.5}; // times the wait, from the settings
// The longer a round goes, the more boulders come, so nobody can just wait it out
const BOULDER_RUSH_TICKS = 40 * TICKS_PER_SECOND; // by this far into a round...
const BOULDER_RUSH_WAIT = 0.3; // ...they come this much as long apart
const ROCK_HITS = 3; // boulders a rock can take before it breaks
const GIANT_CHANCE = 0.2; // how often a boulder is a giant one
const GIANT_SCALE = 2;
const GIANT_SPEED = 0.7; // giants roll this much as fast

// There's always one power-up on the field. When it's picked up or it fades away, the next one comes this soon.
const POWERUP_RESPAWN_TICKS = 1.5 * TICKS_PER_SECOND;
const POWERUP_LIFE_TICKS = 12 * TICKS_PER_SECOND; // how long one sits there before it's gone
const FRENZY_COUNT = 12; // power-ups a frenzy block drops all over the arena...
const FRENZY_KNIGHT_DISTANCE = 24; // ...none of them this close to a knight
const FRENZY_RARITY = 3; // every other power-up is this many times as likely to show up
const FRENZY_DROP_GAP_TICKS = 5; // they come down one after another, this far apart
const POWERUP_DROP_HEIGHT = 40; // a dropped power-up falls from this high
const SPEED_BOOST_TICKS = 7 * TICKS_PER_SECOND;
const SPEED_BOOST = 1.5; // walking speed
const SHIELD_KNOCKBACK = 2.4;
const SHIELD_STUN_TICKS = 16;
const SHIELD_GRACE_TICKS = 40; // can't be hit for a moment after the shield breaks
const GROW_TICKS = 8 * TICKS_PER_SECOND;
// Big stacks: each one picked up makes him bigger (and fills the time back up), up to the last of these
const GROW_SCALES = [1, 2, 2.5, 3];
// Shields and sword throws stack too, up to this many. (Everything else that lasts a while just fills back up.)
const MAX_STACK = 3;
const THUNDER_TRACK_TICKS = 0.8 * TICKS_PER_SECOND; // the target follows the knight this long...
const THUNDER_LOCK_TICKS = 0.5 * TICKS_PER_SECOND; // ...then stays put this long before it strikes
const THUNDER_RADIUS = 13;
const AVALANCHE_COUNT = 8;
const AVALANCHE_GAP_TICKS = 0.25 * TICKS_PER_SECOND; // between each boulder
const AVALANCHE_SPREAD = 26; // how far off from the knight each one can be lined up
const FURY_TICKS = 7 * TICKS_PER_SECOND;
const FURY_SWING_SPEED = 26; // instead of SWING_SPEED
const REVERSE_TICKS = 5 * TICKS_PER_SECOND;
const BOOGIE_TICKS = 5 * TICKS_PER_SECOND; // the boogie bomb: the other knight dances this long, and can't attack
const DISCO_COLORS = [[255, 90, 200], [90, 210, 255], [255, 230, 90], [130, 255, 130]];
const THROW_SPEED = 2.8; // pixels per tick: fast, but you can step out of the way
const THROW_RANGE = 160; // how far it flies before it drops
const NEW_SWORD_TICKS = 2 * TICKS_PER_SECOND; // a sword lost in water or lava comes back from the sky after this
const GUN_AMMO = 3;
const GUN_COOLDOWN_TICKS = 0.45 * TICKS_PER_SECOND;
const BULLET_SPEED = 4.5;
const GUN_RECOIL = 1.2;
const SNIPE_DISTANCE = 100; // a shot from further than this is "SNIPED!"
const SHOWDOWN_GUN_COOLDOWN_TICKS = 0.6 * TICKS_PER_SECOND; // between shots in a showdown, where ammo never runs out
const SHOWDOWN_MIN_ROUNDS = 5; // a showdown comes up every this many rounds...
const SHOWDOWN_MAX_ROUNDS = 7; // ...to this many, when the arena's mixed
const CRATE_HITS = 3; // shots or boulders a crate can take before it breaks

// Hazards that come out of nowhere: horses, catapult rocks and fireballs
const HAZARD_FIRST_WAIT = 9 * TICKS_PER_SECOND;
const HAZARD_MIN_WAIT = 9 * TICKS_PER_SECOND;
const HAZARD_MAX_WAIT = 15 * TICKS_PER_SECOND;
const HORSE_SPEED = 2.2;
const HORSE_WARNING_TICKS = 1.3 * TICKS_PER_SECOND;
const SKY_FALL_TICKS = 1.5 * TICKS_PER_SECOND; // from the target showing up to the rock landing
const SKY_RADIUS = 13;

// Holes that crack open in the ground (ice holes on the snowfield, lava on the volcano)
const HOLE_FIRST_WAIT = 14 * TICKS_PER_SECOND;
const HOLE_MIN_WAIT = 9 * TICKS_PER_SECOND;
const HOLE_MAX_WAIT = 14 * TICKS_PER_SECOND;
const HOLE_CRACK_TICKS = 2 * TICKS_PER_SECOND; // the warning before it opens
const MAX_HOLES = 4;
const FALL_TICKS = 36; // how long falling in takes

const CRITTER_COUNT = {butterflies: 6, fireflies: 10};

const TAUNT_TICKS = TICKS_PER_SECOND; // stuck in place this long while taunting
const TAUNTS = ["TOO SLOW!", "NYAH NYAH!", "COME ON!", "IS THAT IT?", "YAWN...", "MISSED ME!", "TRY HARDER!", "HA HA!"];

const SUMO_SPEED = 0.7; // everyone walks this much as fast in sumo
const SUMO_KNOCKBACK = 3.4; // a hit shoves this hard instead of knocking down
const SUMO_STUN_TICKS = 18;
const SUMO_GRACE_TICKS = 24; // can't be shoved again right away

const PLANK_STRENGTH = 1.6 * TICKS_PER_SECOND; // how long a plank can be stood on before it breaks
const PLANK_SIZE = 6;
const HAND_RISE_TICKS = 0.45 * TICKS_PER_SECOND; // a grave's hand coming up, before it grabs
const GRAB_TICKS = 1.4 * TICKS_PER_SECOND;
const GRAB_SLOW = 0.3; // walking speed while a hand has your ankle
const GRAVE_COOLDOWN_TICKS = 4 * TICKS_PER_SECOND;
const TILT_PERIOD = 200; // the ship rocks back and forth every 2 pi times this many ticks (about 8 seconds)
const TILT_PUSH = 0.022; // how hard the tipped deck slides everything
const EXPLOSION_RADIUS = 38; // a barrel's blast
const BARREL_CHAIN_TICKS = 10; // a barrel caught in a blast goes up this soon after
const CHICKEN_FIRST_TICKS = 60 * TICKS_PER_SECOND; // the first chicken comes after this long with nobody hit...
const CHICKEN_EVERY_TICKS = 20 * TICKS_PER_SECOND; // ...and another this often after that
const CHICKEN_SPEED = 0.33; // a little slower than walking, so you can get away (it doesn't give up, though)
const CHICKEN_REPATH_TICKS = 8; // how often a chicken works out its way to whoever it's chasing again
const PATH_CELL = 4; // the size of the squares things find their way round the field on
const PECK_KNOCKBACK = 2.4; // a peck knocks you back (about 17 pixels), but doesn't stun
const PECK_COOLDOWN_TICKS = 70;
const DRAGON_SPEED = 2.4;
const DRAGON_MIN_WAIT_TICKS = 7 * TICKS_PER_SECOND; // on the volcano, between dragons
const DRAGON_MAX_WAIT_TICKS = 13 * TICKS_PER_SECOND;
// The volcano's fissures: a crack spreads across the field (the warning), splits open into lava, then closes again
const FISSURE_FIRST_WAIT_TICKS = 5 * TICKS_PER_SECOND;
const FISSURE_MIN_WAIT_TICKS = 9 * TICKS_PER_SECOND; // from one opening to the next starting
const FISSURE_MAX_WAIT_TICKS = 15 * TICKS_PER_SECOND;
const FISSURE_CRACK_TICKS = 2 * TICKS_PER_SECOND;
const FISSURE_OPENING_TICKS = 24;
const FISSURE_OPEN_TICKS = 5 * TICKS_PER_SECOND;
const FISSURE_CLOSING_TICKS = 80;
const FISSURE_WIDTH = 12;
const FISSURE_SAFE_DISTANCE = 30; // how far from both knights a new one has to be
const FISSURE_MIN_AREA_WIDTH = 90; // the smallest the field gets boxed in to, across...
const FISSURE_MIN_AREA_HEIGHT = 70; // ...and up and down
const DRAGON_FIRE_DELAY_TICKS = 0.35 * TICKS_PER_SECOND; // the fire comes this long after the shadow passes
const DRAGON_FIRE_TICKS = 1.8 * TICKS_PER_SECOND;
const DRAGON_FIRE_RADIUS = 7;
const BEAR_ANGRY_TICKS = 9 * TICKS_PER_SECOND;
const BEAR_WINDUP_TICKS = 0.5 * TICKS_PER_SECOND;
const BEAR_CHARGE_TICKS = 1.3 * TICKS_PER_SECOND;
const BEAR_SPEED = 0.9;
const BEAR_SELF_WAKE_TICKS = 15 * TICKS_PER_SECOND; // a sleeping bear wakes up on its own after this long
// Anything loud or rough this close to a sleeping bear wakes it
const BEAR_WAKE_BLAST = 16; // past the edge of a lightning strike, a landing boulder or an explosion
const BEAR_WAKE_CLANG = 40; // swords clashing
const BEAR_WAKE_TAUNT = 36; // someone taunting right next to it
const BEAR_WAKE_FIRE = 12; // past the edge of the dragon's fire
const BEAR_WAKE_TORNADO = 45; // the tornado's middle
const BEAR_REST_TICKS = 0.5 * TICKS_PER_SECOND;
const BEAR_LOOK_AHEAD = 24; // how far ahead it checks the way is clear before it charges
const BEAR_SLIDE_TURN = 45; // a charge that only clips something turns up to this many degrees to slide past it
// A minecart comes along one of the mine's tracks about every 2 seconds
const MINECART_MIN_WAIT_TICKS = 1.6 * TICKS_PER_SECOND;
const MINECART_MAX_WAIT_TICKS = 2.4 * TICKS_PER_SECOND;
const MINECART_SPEED = 2.6;
const QUICKSAND_TICKS = 2.5 * TICKS_PER_SECOND; // standing still in quicksand this long swallows you
const QUICKSAND_SLOW = 0.5;
const LIGHTHOUSE_TURN_SPEED = Math.PI * 2 / (7 * TICKS_PER_SECOND); // once around every 7 seconds
const LIGHTHOUSE_BEAM_WIDTH = 1.5; // how much wider than a plain light trail the beams are
const TORNADO_TICKS = 9 * TICKS_PER_SECOND;
const TORNADO_SPEED = 0.3;
const TORNADO_RADIUS = 75; // how far away it pulls from
const TORNADO_PULL = 0.06;
const TORNADO_CATCH = 11; // how close to the middle it catches (and flings) a knight
const TORNADO_HEIGHT = 16; // rings in its funnel
const TORNADO_FLING = 4;
const JUGGERNAUT_LIVES = 3;
const JUGGERNAUT_SCALE = 1.75;
const JUGGERNAUT_SPEED = 0.75;
const JUGGERNAUT_GRACE_TICKS = 70; // can't lose another heart right away
const JUGGERNAUT_WINDUP_TICKS = 0.25 * TICKS_PER_SECOND; // he holds his wind-up this long before the swing comes
const JUGGERNAUT_TURN_TICKS = 0.25 * TICKS_PER_SECOND; // and takes this long to turn round
const JUGGERNAUT_MIN_ROUNDS = 5; // a juggernaut round comes up every this many rounds...
const JUGGERNAUT_MAX_ROUNDS = 7; // ...to this many
const GRASS_CUT_REACH = 2; // how far past the sword's edge tall grass gets cut
// Horses build up speed slowly, and there's no top speed: just a little drag, so one that keeps galloping the same
// way gets very fast (about 2.4 pixels per tick, after a few seconds)
const JOUST_ACCEL = 0.012; // how hard holding a direction speeds up a horse
const JOUST_FRICTION = 0.995; // horses coast a long way
const JOUST_SAFETY_SPEED = 4; // only so nothing can pass through a fence (or another rider) in one tick
const LANCE_REACH_ACROSS = 20; // how far in front of a horse the lance tip is, going sideways...
const LANCE_REACH_UP_DOWN = 12; // ...and going up or down the screen
const LANCE_TIP_REACH = 1; // how close the lance tip has to get to count, past the edge of the other rider
const RIDER_LIFT = 9; // how far up a knight sits on his horse
const DEMO_EDGE_ROOM = 4; // how far the title screen's knights keep from edges
const RAFT_LEEWAY = 2; // on the lava lake, how far past a raft's edge your feet can be before you fall in
const JOUST_TIE = 0.3; // riders going within this much of each other's speed both bounce off
const CHICKEN_MIN_ROUNDS = 5; // a chicken round comes up every this many rounds...
const CHICKEN_MAX_ROUNDS = 8; // ...to this many (waiting for an arena it works on)
const CHICKEN_SWAP_TICKS = 10 * TICKS_PER_SECOND; // in a chicken round, the chicken and the knight swap this often...
const CHICKEN_FREEZE_TICKS = TICKS_PER_SECOND; // ...after everything holds still for this long
// The red pixels of the chicken's comb (the same in both frames), which a blue player's chicken has in blue
const CHICKEN_COMB = [[5, 0], [6, 0], [4, 1]];
const CHICKEN_TAUNTS = ["BAWK BAWK!", "BUK BUK BUKAWK!", "CAN'T CATCH ME!"];
const JOUST_MIN_ROUNDS = 5; // a joust comes up every this many rounds...
const JOUST_MAX_ROUNDS = 8; // ...to this many, when the arena's mixed
const STORM_MIN_WAIT_TICKS = 2.2 * TICKS_PER_SECOND;
const STORM_MAX_WAIT_TICKS = 4 * TICKS_PER_SECOND;
// The storm arena's own storm is much wilder: about one strike a second, nearly all of them at the knights
const WILD_STORM_MIN_WAIT_TICKS = 0.8 * TICKS_PER_SECOND;
const WILD_STORM_MAX_WAIT_TICKS = 1.2 * TICKS_PER_SECOND;
const WILD_STORM_ON_CHANCE = 0.4; // right where a knight is standing (so he has to move)...
const WILD_STORM_NEAR_CHANCE = 0.45; // ...or just next to him (the rest land anywhere)
const WILD_STORM_NEAR_DISTANCE = 34; // how far from him "next to him" can be

// The kill cam only replays cool knockdowns (and always the one that wins the match)
const COOL_RECENT_TICKS = 2.5 * TICKS_PER_SECOND; // a parry, deflect and so on this recent makes the knockdown cool

// The loser of the match bleeds until the next one starts
const BLOOD_POOL_MAX = 15;
const HEARTBEAT_TICKS = 55; // a spurt this often

// ---------- Art ----------

const FONT = "fonts/marsfont.png";
const BOULDER_IMAGE = "knight-knight/boulder.png";
const POWERUP_IMAGE = "knight-knight/powerups.png";
const TREE_IMAGE = "knight-knight/tree.png";
const HORSE_IMAGE = "knight-knight/horse.png";
const SWORD_IMAGE = "knight-knight/sword.png";
const CRATE_IMAGE = "knight-knight/crate.png";
const TOMBSTONE_IMAGE = "knight-knight/tombstone.png";
const MAST_IMAGE = "knight-knight/mast.png";
const BARREL_IMAGE = "knight-knight/barrel.png";
const CHICKEN_IMAGE = "knight-knight/chicken.png";
const BEAR_IMAGE = "knight-knight/bear.png";
const CACTUS_IMAGE = "knight-knight/cactus.png";
const LIGHTHOUSE_IMAGE = "knight-knight/lighthouse.png";
const POWERUP_SIZE = 9;
const POWERUP_TYPES = ["shield", "speed", "thunder", "grow", "avalanche", "freeze", "fury", "throw", "reverse", "gun", "boogie", "frenzy"]; // in the order they are in the image (the boogie bomb's and frenzy's aren't: they're drawn in code)
// The gun isn't found lying around any more, it's what everyone uses in a showdown
// Freeze was taken out (its icon is still in the image, so the others stay in place)
const SPAWNING_POWERUPS = POWERUP_TYPES.filter(type => type !== "gun" && type !== "freeze");
// Sword power-ups don't do anything in a showdown
const SHADOW_COLOR = "rgba(0, 0, 0, 0.22)";
const SPRITE_SIZE = 20;
const ROCK_WIDTH = 16;
const CRATE_SIZE = 14;
const BOULDER_SIZE = 14;
const BOULDER_ROLL_SPEED = 20; // animation speed that looks like it's rolling along the ground, not sliding
const HORSE_WIDTH = 26;
const HORSE_HEIGHT = 18;
const SWORD_SIZE = 11;

const DIRS = {
    south: {x: 0, y: 1},
    east: {x: 1, y: 0},
    north: {x: 0, y: -1},
    west: {x: -1, y: 0},
};

const PLAYERS = [
    {
        color: "red",
        textColor: "#d04848",
        lightTextColor: "#ffa8a8", // for instructions, so they read on any background
        plumeColor: [172, 50, 50],
        // Movement is by key name, swing and taunt by physical key (see wasPressed)
        keys: {south: "s", east: "d", north: "w", west: "a", swing: ["Space"], taunt: ["KeyE"]},
        startX: 50,
        facing: "east",
        scoreSide: -1, // pips go along the left
    },
    {
        color: "blue",
        textColor: "#6a96ea",
        lightTextColor: "#b4ccff",
        plumeColor: [50, 90, 190],
        keys: {south: "ArrowDown", east: "ArrowRight", north: "ArrowUp", west: "ArrowLeft", swing: ["Enter", "NumpadEnter", "MouseLeft"], taunt: ["Slash"]},
        startX: 190,
        facing: "west",
        scoreSide: 1, // pips go along the right
    },
];

// ---------- Hitboxes ----------
// All of these are [left, top, right, bottom] in pixels from the top left of the sprite, measured from the art.

// Head, body and legs, not counting the plume or the sword
const BODY_BOXES = {
    south: [6, 5, 14, 16],
    east: [8, 5, 12, 16],
    north: [6, 5, 14, 16],
    west: [8, 5, 12, 16],
};

// Where the sword's swoosh is on each swing frame. Frame 0 is the wind up and 4 is the follow through, so they
// can't hit.
const SWORD_BOXES = {
    south: {1: [1, 10, 6, 15], 2: [5, 13, 9, 19], 3: [8, 14, 15, 19]},
    east: {1: [8, 12, 14, 17], 2: [11, 11, 18, 15], 3: [12, 6, 17, 12]},
    north: {1: [14, 5, 20, 12], 2: [12, 1, 17, 7], 3: [5, 1, 13, 7]},
    west: {1: [5, 13, 10, 18], 2: [2, 11, 8, 16], 3: [1, 5, 8, 11]},
};

// Where the sword is on the wind up frame, where it glints so the other player can see the swing coming
const SWING_GLINTS = {
    south: [1, 10],
    east: [9, 17],
    north: [19, 10],
    west: [10, 17],
};

// The gun, from the stock to the end of the barrel, in sprite pixels
const GUN_LINES = {
    south: [[13, 11], [13, 18]],
    east: [[10, 12], [18, 12]],
    north: [[7, 11], [7, 4]],
    west: [[10, 12], [2, 12]],
};

// What bumps into things when walking. Just the feet, so knights can walk behind the top of a rock.
const FEET_BOX = [7, 13, 13, 16];
const FEET_Y = 16; // where the ground is in the sprite, for shadows and sorting what's drawn in front

const ROCK_BOX = [1, 5, 15, 12]; // the bottom of the rock, so knights can walk behind its top
const ROCK_BOTTOM = 12;
const TREE_BOX = [9, 25, 15, 30]; // the trunk
const CRATE_BOX = [1, 4, 13, 13]; // most of the crate, so it's good cover
const CRATE_BOTTOM = 13;
const TREE_BOTTOM = 30;
const BOULDER_BOX = [2, 2, 12, 12];

// ---------- Helpers ----------

// Effects (sounds, particles, marks on the ground, music) only happen while fx.on. Online, the game sometimes goes
// back a few ticks and plays them again with the other player's real key presses (see Online.js), and those ticks
// already made their sounds the first time round, so fx is off while it catches back up.
const fx = {on: true};
function onlyWithFx(thing) {
    return new Proxy(thing, {
        get(target, key) {
            const value = target[key];
            if (typeof value !== "function") {
                return value;
            }
            return (...args) => fx.on ? value.apply(target, args) : undefined;
        },
    });
}

const settings = new Settings();
// The settings the match is played with: your own for a local match, or the host's for an online one
let simSettings = settings;
const sound = onlyWithFx(new Sound());
const music = onlyWithFx(new Music(sound));
music.setEnabled(settings.get("music"));
const particles = onlyWithFx(new Particles());
const marks = onlyWithFx(new Marks(SCREEN_WIDTH, SCREEN_HEIGHT));
const killCam = new KillCam(SCREEN_WIDTH, SCREEN_HEIGHT);

// The game's random numbers. They're seeded, and saved with everything else, so both players' games roll the same
// ones online. Anything that only changes how things look (and not what happens) uses Math.random instead, through
// fxRandom, so it can't throw the rolls off.
let rngState = makeRandomState(Date.now());

function rng() {
    return nextRandom(rngState);
}

function random(min, max) {
    return min + rng() * (max - min);
}

function pick(list) {
    return list[Math.floor(rng() * list.length)];
}

function fxRandom(min, max) {
    return min + Math.random() * (max - min);
}

function roundsToWin() {
    return simSettings.get("roundsToWin");
}

// Turns one of the [left, top, right, bottom] boxes above into a box on the screen
function boxAt(box, x, y) {
    return {left: x + box[0], top: y + box[1], right: x + box[2], bottom: y + box[3]};
}

function boxesOverlap(a, b) {
    return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

function boxCenter(box) {
    return {x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2};
}

function growBox(box, amount) {
    return {left: box.left - amount, top: box.top - amount, right: box.right + amount, bottom: box.bottom + amount};
}

function drawBox(box, color) {
    const left = Math.round(box.left);
    const top = Math.round(box.top);
    MDog.Draw.rectangle(left, top, Math.round(box.right) - left, Math.round(box.bottom) - top, color);
}

// A soft oval on the ground, centered at x, with the ground at y
function drawShadow(x, y, width) {
    const left = Math.round(x - width / 2);
    y = Math.round(y);
    MDog.Draw.rectangleFill(left + 1, y - 1, width - 2, 1, SHADOW_COLOR);
    MDog.Draw.rectangleFill(left, y, width, 1, SHADOW_COLOR);
    MDog.Draw.rectangleFill(left + 1, y + 1, width - 2, 1, SHADOW_COLOR);
}

// A filled oval, drawn a row at a time
function drawOval(x, y, rx, ry, color) {
    for (let dy = -Math.floor(ry); dy <= Math.floor(ry); dy++) {
        const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / ry) * (dy / ry))));
        if (half > 0) {
            MDog.Draw.rectangleFill(Math.round(x) - half, Math.round(y) + dy, half * 2, 1, color);
        }
    }
}

// A ring of dots flat on the ground
function drawRing(x, y, radius, color) {
    const dots = Math.max(16, Math.round(radius * 2.5));
    for (let i = 0; i < dots; i++) {
        const angle = i / dots * Math.PI * 2;
        MDog.Draw.rectangleFill(Math.round(x + dcos(angle) * radius), Math.round(y + dsin(angle) * radius * 0.5), 1, 1, color);
    }
}

// A little mirrored disco ball centered at x, y, glinting in colors as time goes on. On a string, unless it's the
// power-up's icon.
function drawDiscoBall(x, y, time, icon) {
    if (!icon) {
        MDog.Draw.rectangleFill(x, y - 5, 1, 3, "rgba(200, 200, 210, 0.7)");
    }
    drawOval(x, y, 4, 4, "#3a3448");
    drawOval(x, y, 3, 3, "#a8a8bc");
    // Its little mirrors catching the light
    const glint = Math.floor(time / 8);
    const spots = [[-2, -1], [0, -2], [1, 0], [-1, 1], [2, 1], [0, 2]];
    spots.forEach(([dx, dy], i) => {
        const [r, g, b] = DISCO_COLORS[(i + glint) % DISCO_COLORS.length];
        MDog.Draw.rectangleFill(x + dx, y + dy, 1, 1, (i + glint) % 3 === 0 ? "#ffffff" : `rgb(${r}, ${g}, ${b})`);
    });
}

// A chicken knight that went down: a roast chicken on a plate, legs in the air, steaming. x and y are the middle of
// the plate, on the ground. (b golden brown, l where it shines, d the crispy edge, w the bones)
const ROAST_CHICKEN = [
    "ww.........ww",
    "wdb.......bdw",
    ".dbb.....bbd.",
    "..dbbbbbbbd..",
    ".dbblllbbbbd.",
    "dbbllbbbbbbbd",
    "dbbbbbbbbbbbd",
    ".dbbbbbbbbbd.",
    "..ddddddddd..",
];
const ROAST_COLORS = {b: "#c8762a", l: "#f0b060", d: "#7a3e14", w: "#f4efe2"};

function drawRoastChicken(x, y, size, flip, time, white) {
    const width = ROAST_CHICKEN[0].length;
    // The plate
    drawOval(x, y, 9 * size, 3 * size, white ? "#ffffff" : "#b8b8c8");
    drawOval(x, y - 1, 8 * size, 2 * size, white ? "#ffffff" : "#eeeef4");
    const left = Math.round(x - width / 2 * size);
    const top = Math.round(y - (ROAST_CHICKEN.length + 1) * size);
    ROAST_CHICKEN.forEach((row, dy) => {
        for (let dx = 0; dx < width; dx++) {
            const pixel = row[flip ? width - 1 - dx : dx];
            if (pixel !== ".") {
                MDog.Draw.rectangleFill(left + dx * size, top + dy * size, size, size, white ? "#ffffff" : ROAST_COLORS[pixel]);
            }
        }
    });
    // Steam curling up off it
    for (let i = 0; i < 3; i++) {
        const rise = (time / 3 + i * 9) % 27;
        const sx = x + (i - 1) * 3 * size + Math.round(dsin((time + i * 40) / 14));
        MDog.Draw.rectangleFill(Math.round(sx), Math.round(top - 2 - rise), 1, 1, `rgba(255, 255, 255, ${0.6 * (1 - rise / 27)})`);
    }
}

// The frenzy power-up's icon: a golden question mark block, 9 by 9, with a shine that sweeps across it now and then
const QUESTION_MARK = [".xxx.", "x...x", "...x.", "..x..", ".....", "..x.."];

function drawQuestionBlock(x, y, time) {
    MDog.Draw.rectangleFill(x, y, 9, 9, "#7a3c08"); // the dark edge
    MDog.Draw.rectangleFill(x, y, 8, 8, "#f8b800");
    MDog.Draw.rectangleFill(x, y, 8, 1, "#ffe080"); // lit from the top left
    MDog.Draw.rectangleFill(x, y, 1, 8, "#ffe080");
    // The question mark, with a shadow
    QUESTION_MARK.forEach((row, dy) => {
        for (let dx = 0; dx < row.length; dx++) {
            if (row[dx] === "x") {
                MDog.Draw.rectangleFill(x + 2 + dx, y + 2 + dy, 1, 1, "#7a3c08");
                MDog.Draw.rectangleFill(x + 1 + dx, y + 1 + dy, 1, 1, "#ffffff");
            }
        }
    });
    // A shine sweeping across every couple of seconds
    const sweep = Math.floor(time / 3) % 60;
    if (sweep < 10) {
        for (let i = 0; i < 8; i++) {
            const sx = sweep - i;
            if (sx >= 0 && sx < 8) {
                MDog.Draw.rectangleFill(x + sx, y + i, 1, 1, "rgba(255, 255, 255, 0.6)");
            }
        }
    }
}

// One strip per animation per direction per color, cut from knight.png
function makeAnimations(color, name, frames, speed, suffix) {
    const animations = {};
    for (const dir in DIRS) {
        animations[dir] = new MDog.Draw.SpriteSheetAnimation("knight-knight/knight-" + color + "-" + name + "-" + dir + (suffix ?? "") + ".png", frames, speed, SPRITE_SIZE);
        MDog.Draw.preloadAnimation(animations[dir]);
    }
    return animations;
}

// ---------- Screen shake ----------

let shake = 0;

function addShake(amount) {
    shake = Math.max(shake, amount);
}

// ---------- The arena ----------

let arena = ARENAS.MEADOW;
let arenaName = "MEADOW";
let arenaLayout = null; // for an arena with a few layouts (the showdown), the one picked this round
let weather = new Weather("clear", SCREEN_WIDTH, SCREEN_HEIGHT);

// Is this spot in the river (and not on a bridge)?
function isInWater(x, y) {
    const river = arena.river;
    if (river === undefined || x < river.left || x > river.right) {
        return false;
    }
    return !river.bridges.some(([top, bottom]) => y > top + 1 && y < bottom - 1);
}

// The river as boxes knights can't walk through: the bits between the bridges
function getWaterBoxes() {
    const river = arena.river;
    if (river === undefined) {
        return [];
    }
    const boxes = [];
    let top = 0;
    for (const [bridgeTop, bridgeBottom] of river.bridges) {
        boxes.push({left: river.left, right: river.right, top: top, bottom: bridgeTop + 1});
        top = bridgeBottom - 1;
    }
    boxes.push({left: river.left, right: river.right, top: top, bottom: SCREEN_HEIGHT});
    return boxes.map(box => ({getBox: () => box}));
}

// The river sparkles as it flows
function drawRiver(ticks) {
    const river = arena.river;
    if (river === undefined) {
        return;
    }
    for (let i = 0; i < 24; i++) {
        const x = river.left + 3 + (i * 7) % (river.right - river.left - 6);
        const y = (i * 37 + ticks * 0.25) % SCREEN_HEIGHT;
        if (isInWater(x, y)) {
            MDog.Draw.rectangleFill(Math.round(x), Math.round(y), i % 3 === 0 ? 2 : 1, 1, "rgba(200, 225, 255, 0.6)");
        }
    }
}

// ---------- Rocks and trees ----------

class Rock {
    constructor(x, y, image) {
        this.x = x;
        this.y = y;
        this.image = image;
        this.hits = 0;
    }

    getBox() {
        return boxAt(ROCK_BOX, this.x, this.y);
    }

    isBroken() {
        return this.hits >= ROCK_HITS;
    }

    // A boulder smashed into it
    hit() {
        this.hits++;
        const center = boxCenter(this.getBox());
        particles.debris(center.x, center.y, this.isBroken() ? 24 : 6);
        if (this.isBroken()) {
            addShake(4);
            marks.rubble(center.x, center.y);
        }
    }

    // A giant boulder rolled right through it
    smash() {
        this.hits = ROCK_HITS;
        const center = boxCenter(this.getBox());
        particles.debris(center.x, center.y, 30);
        marks.rubble(center.x, center.y);
        addShake(5);
    }

    getSortY() {
        return this.y + ROCK_BOTTOM;
    }

    drawShadow() {
        drawShadow(this.x + ROCK_WIDTH / 2, this.y + ROCK_BOTTOM, ROCK_WIDTH);
    }

    draw() {
        // Each frame of the strip is more cracked
        MDog.Draw.image(this.image, this.x, this.y, {width: ROCK_WIDTH, offsetX: ROCK_WIDTH * this.hits});
    }

    drawHitboxes() {
        drawBox(this.getBox(), "#00ffff");
    }
}

class Tree {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    getBox() {
        return boxAt(TREE_BOX, this.x, this.y);
    }

    getSortY() {
        return this.y + TREE_BOTTOM;
    }

    drawShadow() {
        drawShadow(this.x + 12, this.y + TREE_BOTTOM, 16);
    }

    draw() {
        MDog.Draw.image(TREE_IMAGE, this.x, this.y);
    }

    drawHitboxes() {
        drawBox(this.getBox(), "#00ffff");
    }
}

// A wooden crate to hide behind. Bullets and boulders break it up.
class Crate {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.hits = 0;
    }

    getBox() {
        return boxAt(CRATE_BOX, this.x, this.y);
    }

    isBroken() {
        return this.hits >= CRATE_HITS;
    }

    hit() {
        this.hits++;
        const center = boxCenter(this.getBox());
        const wood = [[196, 140, 76], [160, 106, 54], [120, 78, 40]];
        particles.debris(center.x, center.y, this.isBroken() ? 20 : 4, wood);
        if (this.isBroken()) {
            addShake(3);
            sound.crumble();
            // Splinters left on the ground
            for (let i = 0; i < 10; i++) {
                marks.dot(center.x + random(-8, 8), center.y + random(-3, 4), random(1, 3), 1, "rgba(150, 100, 50, 0.8)");
            }
        } else {
            sound.thunk();
        }
    }

    smash() {
        while (!this.isBroken()) {
            this.hit();
        }
    }

    getSortY() {
        return this.y + CRATE_BOTTOM;
    }

    drawShadow() {
        drawShadow(this.x + CRATE_SIZE / 2, this.y + CRATE_BOTTOM, CRATE_SIZE + 2);
    }

    draw() {
        // Each frame of the strip is more broken
        MDog.Draw.image(CRATE_IMAGE, this.x, this.y, {width: CRATE_SIZE, offsetX: CRATE_SIZE * Math.min(this.hits, 2)});
    }

    drawHitboxes() {
        drawBox(this.getBox(), "#00ffff");
    }
}

// One row of tall grass. Each row is sorted with everything else, so a knight standing in the grass has the rows
// in front of him drawn over his legs.
class GrassRow {
    constructor(left, right, y, dark) {
        this.left = left;
        this.right = right;
        this.y = y;
        this.dark = dark;
        this.cut = new Set(); // blades a sword has cut down (by their x), which are gone for the rest of the round
    }

    naturalHeight(x) {
        return 6 + ((x * 7 + this.y * 13) % 4);
    }

    // A sword sweeping through clears away every blade it touches (and a little either side, so nothing's left
    // standing between the swing's frames). Returns how many it cut.
    cutBox(box) {
        const reach = growBox(box, GRASS_CUT_REACH);
        let cut = 0;
        for (let x = this.left; x < this.right; x += 2) {
            if (this.cut.has(x) || x < reach.left || x > reach.right) {
                continue;
            }
            const height = this.naturalHeight(x);
            if (reach.top < this.y + 2 && reach.bottom > this.y - height) {
                this.cut.add(x);
                cut++;
                // The blade bursts into clippings
                particles.clippings(x, this.y - height / 2, 3);
            }
        }
        return cut;
    }

    getSortY() {
        return this.y;
    }

    drawShadow() {}

    drawHitboxes() {}

    draw() {
        const blade = this.dark ? "#2f5a2a" : "#3f7a34";
        const tip = this.dark ? "#4a7a40" : "#7cbc5a";
        for (let x = this.left; x < this.right; x += 2) {
            if (this.cut.has(x)) {
                continue;
            }
            const height = this.naturalHeight(x);
            const sway = Math.round(dsin(roundTicks / 50 + x / 9 + this.y / 5) * 0.8);
            MDog.Draw.rectangleFill(x, this.y - height + 2, 1, height, blade);
            MDog.Draw.rectangleFill(x + sway, this.y - height, 1, 2, tip);
        }
    }
}

// ---------- Holes and lava ----------

// An oval on the ground you fall into: a hole, a hole in the ice, or lava. Ones that crack open mid-round show
// cracks for a while first.
class GroundHazard {
    constructor(x, y, rx, ry, style, cracking) {
        this.x = x;
        this.y = y;
        this.rx = rx;
        this.ry = ry;
        this.style = style;
        this.cracked = cracking; // opened up this round, instead of being part of the arena
        this.ticks = 0;
        this.open = !cracking;
        this.openness = cracking ? 0 : 1; // grows when it opens
        // Cracks spreading out from the middle
        this.cracks = [];
        for (let i = 0; i < 6; i++) {
            const angle = i / 6 * Math.PI * 2 + random(-0.3, 0.3);
            this.cracks.push({angle, length: random(0.7, 1.2), bend: random(-0.5, 0.5)});
        }
    }

    contains(x, y) {
        if (!this.open) {
            return false;
        }
        // A little smaller than it looks, so only really being in it counts
        const dx = (x - this.x) / (this.rx * this.openness * 0.85);
        const dy = (y - this.y) / (this.ry * this.openness * 0.85);
        return dx * dx + dy * dy < 1;
    }

    // Anything near it, open or not (so power-ups and new holes don't go there)
    isNear(x, y, margin) {
        const dx = (x - this.x) / (this.rx + margin);
        const dy = (y - this.y) / (this.ry + margin);
        return dx * dx + dy * dy < 1;
    }

    update() {
        this.ticks++;
        if (!this.open && this.ticks % 50 === 0) {
            sound.crack();
            particles.dust(this.x + random(-this.rx, this.rx), this.y, 1);
        }
        if (!this.open && this.ticks >= HOLE_CRACK_TICKS) {
            this.open = true;
            addShake(3);
            particles.debris(this.x, this.y, 10);
            if (this.style === "lava") {
                particles.embers(this.x, this.y, 10);
                sound.sizzle();
            } else if (this.style === "ice") {
                particles.shards(this.x, this.y, 12);
                sound.splash();
            } else {
                sound.crumble();
            }
        }
        if (this.open && this.openness < 1) {
            this.openness = Math.min(1, this.openness + 0.04);
        }
        if (this.style === "lava" && this.open && rng() < 0.02) {
            particles.embers(this.x + random(-this.rx, this.rx) * 0.6, this.y, 1);
        }
    }

    draw() {
        if (!this.open) {
            // Cracks grow as it gets closer to opening
            const progress = this.ticks / HOLE_CRACK_TICKS;
            const color = this.style === "lava" ? "rgba(255, 120, 40, 0.9)" : this.style === "ice" ? "rgba(60, 90, 130, 0.8)" : "rgba(40, 26, 14, 0.8)";
            for (const crack of this.cracks) {
                const length = this.rx * crack.length * Math.min(1, progress * 1.4);
                const mid = crack.angle + crack.bend;
                const x1 = this.x + dcos(mid) * length * 0.5;
                const y1 = this.y + dsin(mid) * length * 0.25;
                const x2 = this.x + dcos(crack.angle) * length;
                const y2 = this.y + dsin(crack.angle) * length * 0.5;
                MDog.Draw.line(this.x, this.y, x1, y1, color);
                MDog.Draw.line(x1, y1, x2, y2, color);
            }
            return;
        }

        const rx = this.rx * this.openness;
        const ry = this.ry * this.openness;
        if (this.style === "lava") {
            drawOval(this.x, this.y, rx + 1, ry + 1, "#5a1a10");
            drawOval(this.x, this.y, rx, ry, "#e05a1e");
            drawOval(this.x, this.y + 1, rx * 0.7, ry * 0.6, "#f8a030");
            // Bubbles
            for (let i = 0; i < 4; i++) {
                const phase = (this.ticks / 40 + i * 0.7) % 1;
                if (phase < 0.6) {
                    const bx = this.x + dcos(i * 2.1) * rx * 0.5;
                    const by = this.y + dsin(i * 2.1) * ry * 0.4;
                    MDog.Draw.rectangleFill(Math.round(bx), Math.round(by), phase < 0.3 ? 1 : 2, 1, "#ffe080");
                }
            }
        } else if (this.style === "ice") {
            drawOval(this.x, this.y, rx + 1, ry + 1, "#f4f8ff");
            drawOval(this.x, this.y, rx, ry, "#2a4a78");
            drawOval(this.x, this.y + 1, rx * 0.75, ry * 0.6, "#1a3058");
            const shimmer = Math.round(dsin(this.ticks / 30) * rx * 0.4);
            MDog.Draw.rectangleFill(Math.round(this.x + shimmer), Math.round(this.y - ry * 0.3), 2, 1, "rgba(200, 225, 255, 0.7)");
        } else {
            drawOval(this.x, this.y, rx + 1, ry + 1, "#3a2814");
            drawOval(this.x, this.y, rx, ry, "#1e140a");
            drawOval(this.x, this.y + 1, rx * 0.7, ry * 0.6, "#000000");
        }
    }
}

// ---------- Boulders ----------

class Boulder {
    // settings: owner (a knight it can't hurt) and aimAt ({x, y} it lines up with), both for avalanches
    constructor(settings) {
        settings = settings ?? {};
        this.owner = settings.owner ?? null;
        // Giant ones are twice as big, slower, can't be hit back, and smash right through rocks
        this.giant = this.owner === null && getRoundStage() > 0 && rng() < GIANT_CHANCE;
        this.scale = this.giant ? GIANT_SCALE : 1;
        this.size = BOULDER_SIZE * this.scale;
        this.speed = BOULDER_SPEED * (this.giant ? GIANT_SPEED : 1);

        const horizontal = arena.boulderDirection === "horizontal" || rng() < 0.5;
        const forward = rng() < 0.5 ? 1 : -1;
        // Starts just outside the arena, somewhere along one of the edges, lined up with what it's aimed at (if
        // anything)
        const bounds = getBounds();
        const aim = settings.aimAt;
        const across = (spot, low, high) => Math.max(low + 4, Math.min(high - this.size - 4, spot - this.size / 2 + random(-5, 5)));
        if (horizontal) {
            this.x = forward > 0 ? bounds.left - this.size : bounds.right;
            this.y = aim ? across(aim.y, bounds.top, bounds.bottom) : random(bounds.top + 4, bounds.bottom - this.size - 4);
            this.setDirection(forward, 0);
        } else {
            this.x = aim ? across(aim.x, bounds.left, bounds.right) : random(bounds.left + 4, bounds.right - this.size - 4);
            this.y = forward > 0 ? bounds.top - this.size : bounds.bottom;
            this.setDirection(0, forward);
        }
        this.deflectCooldown = 0;
        this.deflectedBy = null;
        this.broken = false;
        // Boulders come in through the air (they're thrown in from off to the side), so one that starts out over the
        // sea or a canyon doesn't fall straight in. It lands on the first solid ground it reaches, and only after that
        // can it fall into water or holes.
        this.landed = false;
        this.trackTimer = 0;
        this.closeCalls = new Map();
    }

    setDirection(dx, dy) {
        this.dx = dx;
        this.dy = dy;
        // The frames turn it clockwise, so it plays backwards going left or up. It turns as fast as it rolls, so
        // big and slow ones turn slower.
        const frames = dx + dy > 0 ? [0, 1, 2, 3] : [3, 2, 1, 0];
        const rollSpeed = BOULDER_ROLL_SPEED * this.speed / BOULDER_SPEED / this.scale;
        this.animation = new MDog.Draw.SpriteSheetAnimation(BOULDER_IMAGE, frames, rollSpeed, BOULDER_SIZE);
    }

    // Where the "!" goes before it rolls in: the spot on the edge of the screen it'll come in from
    getWarningSpot() {
        const center = boxCenter(this.getBox());
        const inset = 12;
        return {
            x: Math.max(inset, Math.min(SCREEN_WIDTH - inset, center.x)),
            y: Math.max(inset + 8, Math.min(SCREEN_HEIGHT - inset, center.y)), // stays under the score
        };
    }

    update() {
        const speed = this.speed * weather.getBoulderSpeed(this.dx) * (1 + 0.5 * getTilt() * this.dx);
        this.x += this.dx * speed;
        this.y += this.dy * speed;
        this.deflectCooldown--;
        this.animation.time++;

        // Flattens a line in the grass behind it
        this.trackTimer += speed;
        if (this.trackTimer > 3 && this.landed) {
            this.trackTimer = 0;
            const center = boxCenter(this.getBox());
            marks.track(center.x, this.y + this.size - 2 * this.scale, this.size * 0.5, this.dx !== 0, "rgba(0, 0, 0, 0.07)");
        }

        const center = boxCenter(this.getBox());
        const hole = holes.find(hole => hole.contains(center.x, center.y));
        const overGround = !isInWater(center.x, center.y) && hole === undefined;
        if (!this.landed) {
            if (overGround) {
                // Thud
                this.landed = true;
                particles.dust(center.x, this.y + this.size, 4);
                sound.thunk();
            }
        } else if (isInWater(center.x, center.y)) {
            this.sink("ice");
            return;
        } else if (hole !== undefined) {
            this.sink(hole.style);
            return;
        }

        const rock = rocks.find(rock => !rock.isBroken() && boxesOverlap(this.getBox(), rock.getBox()));
        if (rock !== undefined) {
            if (this.giant) {
                rock.smash();
                sound.crumble();
            } else {
                rock.hit();
                this.smash();
            }
        }
        // Even giants stop at trees
        if (trees.some(tree => boxesOverlap(this.getBox(), tree.getBox()))) {
            this.smash();
        }
        // Crates get smashed to bits
        const crate = crates.find(crate => !crate.isBroken() && boxesOverlap(this.getBox(), crate.getBox()));
        if (crate !== undefined) {
            crate.smash();
            this.crash();
        }
        for (const feature of features) {
            if (!this.broken) {
                feature.onBoulder?.(this);
            }
        }
    }

    // Rolled into water, lava or a hole
    sink(style) {
        this.broken = true;
        const center = boxCenter(this.getBox());
        if (style === "lava") {
            particles.embers(center.x, center.y, 12);
            sound.sizzle();
        } else if (style === "ice") {
            particles.shards(center.x, center.y, 10);
            sound.splash();
        } else {
            particles.dust(center.x, center.y, 6);
            sound.thunk();
        }
    }

    // Hit by a sword: it goes off the way the knight was facing, faster
    deflect(knight) {
        const dir = DIRS[knight.facing];
        this.deflectedBy = knight;
        // An avalanche boulder that's hit back belongs to the one who hit it, so it can get whoever sent it
        if (this.owner !== null) {
            this.owner = knight;
        }
        this.setDirection(dir.x, dir.y);
        this.speed = Math.min(BOULDER_MAX_SPEED, this.speed * BOULDER_DEFLECT_SPEEDUP);
        this.deflectCooldown = 30; // so one swing only hits it once
    }

    canBeDeflected() {
        return !this.giant && this.deflectCooldown <= 0;
    }

    // A knight who just hit it back can't be run over by it while it rolls away from him
    canHit(knight) {
        if (knight === this.owner || (knight === this.deflectedBy && this.deflectCooldown > 0)) {
            return false;
        }
        return boxesOverlap(this.getBox(), knight.getBodyBox());
    }

    // Ran into something. Giants just keep going.
    crash() {
        if (!this.giant) {
            this.smash();
        }
    }

    smash() {
        this.broken = true;
        const center = boxCenter(this.getBox());
        particles.debris(center.x, center.y, 16);
        addShake(3);
        sound.crumble();
    }

    isDone() {
        const bounds = getBounds();
        const offScreen = this.x < bounds.left - this.size || this.x > bounds.right || this.y < bounds.top - this.size || this.y > bounds.bottom;
        return this.broken || offScreen;
    }

    getBox() {
        const box = BOULDER_BOX.map(edge => edge * this.scale);
        return boxAt(box, this.x, this.y);
    }

    getSortY() {
        return this.y + this.size;
    }

    drawShadow() {
        drawShadow(this.x + this.size / 2, this.y + this.size - this.scale, this.size - 2 * this.scale);
    }

    draw() {
        // Up in the air until it lands, bobbing like it's bouncing in
        const height = this.landed ? 0 : 6 + Math.round(Math.abs(dsin(this.x / 10 + this.y / 10)) * 4);
        MDog.Draw.animation(this.animation, Math.round(this.x), Math.round(this.y) - height, {update: false, scale: this.scale});
    }

    drawHitboxes() {
        drawBox(this.getBox(), "#ff8800");
    }
}

// ---------- Power-ups ----------

class Powerup {
    constructor(type, x, y) {
        this.type = type;
        // The middle of it, on the ground
        this.x = x;
        this.y = y;
        this.life = POWERUP_LIFE_TICKS;
        this.age = 0;
        this.delay = 0; // ticks until it appears (a frenzy's come down one after another)
        this.z = 0; // height, while it's falling
    }

    // Dropped from the sky, after a wait
    drop(delay) {
        this.delay = delay;
        this.z = POWERUP_DROP_HEIGHT;
    }

    // Only once it's down can it be picked up
    isLanded() {
        return this.delay === 0 && this.z === 0;
    }

    update() {
        if (this.delay > 0) {
            this.delay--;
            return;
        }
        if (this.z > 0) {
            this.z = Math.max(0, this.z - 2);
            if (this.z === 0) {
                particles.sparks(this.x, this.y - 4, 6, POWERUP_NAMES[this.type][2]);
                particles.dust(this.x, this.y, 2);
            }
            return;
        }
        this.life--;
        this.age++;
        if (this.age % 50 === 0) {
            particles.glint(this.x + random(-3, 3), this.y - 10 + random(-3, 3));
        }
    }

    getBox() {
        return {left: this.x - 5, right: this.x + 5, top: this.y - 8, bottom: this.y + 1};
    }

    getSortY() {
        return this.y;
    }

    drawShadow() {
        if (this.delay === 0) {
            // (smaller the higher it is)
            drawShadow(this.x, this.y, Math.max(3, Math.round(7 - this.z / 10)));
        }
    }

    draw() {
        // Blinks when it's about to go
        if (this.delay > 0 || (this.life < 2 * TICKS_PER_SECOND && Math.floor(this.life / 8) % 2 === 0)) {
            return;
        }
        // Bobs up and down over its shadow
        const bob = Math.round(dsin(this.age / 20) * 1.5);
        const frame = POWERUP_TYPES.indexOf(this.type);
        const x = Math.round(this.x - POWERUP_SIZE / 2);
        const y = Math.round(this.y - 13 + bob - this.z);
        if (this.type === "boogie") {
            drawDiscoBall(x + 4, y + 4, this.age, true);
            return;
        }
        if (this.type === "frenzy") {
            drawQuestionBlock(x, y, this.age);
            return;
        }
        MDog.Draw.image(POWERUP_IMAGE, x, y, {width: POWERUP_SIZE, offsetX: POWERUP_SIZE * frame});
    }

    drawHitboxes() {
        drawBox(this.getBox(), "#ff00ff");
    }
}

// ---------- Critters ----------

// Butterflies flutter around, and scatter when anything comes close. Fireflies do the same in the dark, and glow.
class Critter {
    constructor(kind) {
        this.kind = kind;
        this.x = random(10, SCREEN_WIDTH - 10);
        this.y = random(20, SCREEN_HEIGHT - 10);
        this.z = random(5, 12);
        this.angle = random(0, Math.PI * 2);
        this.color = kind === "fireflies" ? "#d8ff70" : pick(["#ffffff", "#ffe066", "#f2a0d0"]);
        this.flap = Math.floor(random(0, 100));
        this.scared = 0;
    }

    update(threats) {
        this.flap++;
        const nearest = threats.find(threat => dhypot(threat.x - this.x, threat.y - this.y) < 22);
        if (nearest !== undefined) {
            // Flies away from it, and up
            this.angle = datan2(this.y - nearest.y, this.x - nearest.x) + random(-0.4, 0.4);
            this.scared = 60;
        }
        this.angle += random(-0.15, 0.15);

        // Turns back toward the middle near the edges
        if (this.x < 8 || this.x > SCREEN_WIDTH - 8 || this.y < 20 || this.y > SCREEN_HEIGHT - 6) {
            this.angle = datan2(SCREEN_HEIGHT / 2 - this.y, SCREEN_WIDTH / 2 - this.x);
        }

        const speed = this.scared > 0 ? 0.7 : 0.15;
        this.x += dcos(this.angle) * speed + weather.getWind() * 6;
        this.y += dsin(this.angle) * speed * 0.7;
        const height = this.scared > 0 ? 22 : 8 + dsin(this.flap / 30) * 3;
        this.z += (height - this.z) * 0.05;
        if (this.scared > 0) {
            this.scared--;
        }
    }

    // Fireflies blink on and off
    isLit() {
        return this.kind === "fireflies" && dsin(this.flap / 25 + this.angle) > -0.3;
    }

    draw() {
        const x = Math.round(this.x);
        const y = Math.round(this.y - this.z);
        if (this.kind === "fireflies") {
            if (this.isLit()) {
                MDog.Draw.rectangleFill(x, y, 1, 1, this.color);
                MDog.Draw.rectangleFill(x - 1, y, 3, 1, "rgba(216, 255, 112, 0.3)");
            }
            return;
        }
        // A tiny shadow on the ground under it
        MDog.Draw.rectangleFill(x, Math.round(this.y), 1, 1, SHADOW_COLOR);
        // Wings open and shut, faster when it's scared
        const open = Math.floor(this.flap / (this.scared > 0 ? 3 : 7)) % 2 === 0;
        if (open) {
            MDog.Draw.rectangleFill(x - 1, y, 1, 1, this.color);
            MDog.Draw.rectangleFill(x + 1, y, 1, 1, this.color);
        } else {
            MDog.Draw.rectangleFill(x, y - 1, 1, 1, this.color);
        }
        MDog.Draw.rectangleFill(x, y, 1, 1, "#3a2a20");
    }
}

// ---------- Close calls ----------

// Pops up "CLOSE CALL!" when something dangerous goes right past a knight without touching him. Each dangerous
// thing keeps a map of who it's been near.
let closeCallCooldown = 0;

function checkCloseCall(danger, box, knight, touching) {
    if (knight.dead || danger.owner === knight) {
        return;
    }
    const near = boxesOverlap(growBox(box, CLOSE_CALL_GAP), knight.getBodyBox());
    const state = danger.closeCalls.get(knight);
    if (touching || state === "done") {
        danger.closeCalls.set(knight, "done");
    } else if (near) {
        danger.closeCalls.set(knight, "near");
    } else if (state === "near") {
        danger.closeCalls.set(knight, "done");
        closeCall(knight);
    }
}

function closeCall(knight) {
    knight.lastCloseCall = gameTime;
    if (closeCallCooldown <= 0 && !knight.dead) {
        closeCallCooldown = CLOSE_CALL_COOLDOWN_TICKS;
        popup("CLOSE CALL!", knight.getGroundX(), knight.getTopY() - 4, "#ffffff");
    }
}

// ---------- Knights ----------

class Knight {
    constructor(player) {
        this.player = player;
        this.index = PLAYERS.indexOf(player); // which player's input moves him (see inputs)
        // Top left of the sprite
        const start = arena.starts?.[PLAYERS.indexOf(player)] ?? {x: player.startX, y: 96};
        this.x = start.x - SPRITE_SIZE / 2;
        this.y = start.y - FEET_Y;
        // Pushed by lunges and knockback
        this.vx = 0;
        this.vy = 0;
        this.facing = player.facing;
        this.state = "idle";
        this.stunTicks = 0;
        this.swingBuffer = 0;
        this.walkTicks = 0;
        this.footSide = 1;

        this.shield = 0; // shields, stacked up: each one takes a hit
        this.speedTicks = 0; // speed boots time left
        this.graceTicks = 0; // can't be hit, after his shield breaks
        this.growTicks = 0; // time left being big
        this.growLevel = 0; // how many Bigs he's stacked up (see GROW_SCALES)
        this.scale = 1; // grows and shrinks smoothly toward how big he should be
        this.furyTicks = 0;
        this.reverseTicks = 0; // controls are backwards
        this.danceTicks = 0; // dancing from a boogie bomb: can walk, but can't attack
        this.gunAmmo = 0;
        this.gunCooldown = 0;
        this.throwCharges = 0; // with one, the next swing throws the sword (they stack: throw, pick it up, throw again)
        this.hasSword = true;
        this.newSwordTicks = 0; // counting down to a new sword, after losing his
        this.noSwordCooldown = 0;

        this.windupTicks = 0; // a juggernaut holding his wind-up before the swing comes
        this.turnTicks = 0; // a juggernaut turning round

        // Fading copies of him left behind when he moves fast
        this.trail = [];
        this.trailTimer = 0;

        // So each swing only hits once (and stops once it's blocked), hits a rock once, and knows if it nearly hit
        this.swingSpent = false;
        this.swingHitRock = false;
        this.swingNear = null;

        this.dead = false;
        this.deadTicks = 0;
        this.fallFlip = false;
        this.fallHole = null; // the hole or lava he fell into, if that's how he went
        this.inSand = 0; // in quicksand (counts down when he's out)
        this.sinkTicks = 0; // how far he's sunk
        this.spinTicks = 0; // spinning after a tornado flung him
        this.lastFling = -Infinity;
        this.lives = 1; // more for a juggernaut
        this.maxLives = 1;
        this.baseScale = 1;
        this.speedFactor = 1;
        this.mounted = false; // on horseback, for a joust
        this.isChicken = false; // a chicken, in a chicken round: walks and picks things up, but can't attack
        this.chickenFlip = player.facing === "west"; // which way he faces as a chicken (only ever left or right)
        this.gallop = 0; // how far the horse has run, for its legs
        this.brain = null; // plays him on the title screen, instead of the keyboard
        this.tauntTicks = 0; // stuck taunting
        this.tauntFacing = this.facing;
        this.grabTicks = 0; // a hand from a grave has his ankle
        this.fallSpot = null;
        this.bleeding = false; // lost the match
        this.bloodPool = 0;
        this.bleedTicks = 0;

        // When he last did something cool, for deciding if a knockdown is worth a replay
        this.lastParry = -Infinity;
        this.lastDeflect = -Infinity;
        this.lastBlock = -Infinity;
        this.lastCloseCall = -Infinity;

        this.animations = {
            idle: makeAnimations(player.color, "idle", 2, 2),
            walk: makeAnimations(player.color, "walk", [0, 1, 2, 1], 8), // the middle frame is between steps
            swing: makeAnimations(player.color, "swing", 5, SWING_SPEED),
            // Without his sword, after throwing it
            idleNoSword: makeAnimations(player.color, "idle", 2, 2, "-nosword"),
            walkNoSword: makeAnimations(player.color, "walk", [0, 1, 2, 1], 8, "-nosword"),
        };
        this.deadImage = "knight-knight/knight-" + player.color + "-dead.png";
        MDog.Draw.image(this.deadImage, -1000, -1000);
    }

    getAnimation() {
        const noSword = !this.hasSword && this.state !== "swing";
        return this.animations[noSword ? this.state + "NoSword" : this.state][this.facing];
    }

    // The way the movement keys point, like {x: 1, y: -1} for up and right. Backwards while reversed.
    getMoveInput() {
        if (this.brain !== null) {
            return {...this.brain.move};
        }
        const move = {...inputs[this.index].move};
        if (this.reverseTicks > 0) {
            move.x = -move.x;
            move.y = -move.y;
        }
        return move;
    }

    // Is the move (like {x: 1, y: -1}) going at least partly this way?
    isMovingToward(dir, move) {
        return (DIRS[dir].x !== 0 && DIRS[dir].x === move.x) || (DIRS[dir].y !== 0 && DIRS[dir].y === move.y);
    }

    // Turns to face the way he's being held, right before a swing (or a shot or a throw), so it goes the way the player
    // wants even when swings come one straight after another and he never gets a chance to walk. A juggernaut is too
    // big to turn that fast: he only turns as he walks.
    faceHeldWay() {
        if (this.maxLives > 1) {
            return;
        }
        const move = this.getMoveInput();
        if (move.x !== 0 || move.y !== 0) {
            this.faceToward(move);
        }
    }

    faceToward(move) {
        // Keep facing the same way while still moving that way, so walking diagonally doesn't flicker
        if (!this.isMovingToward(this.facing, move)) {
            this.facing = Object.keys(DIRS).find(dir => this.isMovingToward(dir, move));
        }
    }

    // canAct is false while things are paused, like before a round starts
    update(world, canAct) {
        this.slide(world);
        this.updateTrail();

        if (this.dead) {
            this.deadTicks++;
            this.bleed();
            if (this.fallHole !== null) {
                // Pulled into the middle of the hole as he goes down
                this.x += (this.fallSpot.x - this.getGroundX()) * 0.1;
                this.y += (this.fallSpot.y - this.getGroundY()) * 0.1;
            } else {
                // Slides around the tipping deck
                this.vx += getTilt() * TILT_PUSH;
            }
            return;
        }

        // The wind and the tipping deck push him around
        this.vx += weather.getWind() + getTilt() * TILT_PUSH;

        this.think(world, canAct);

        // Animations move on here, instead of when they're drawn, so they keep time with the game (and a
        // juggernaut's held still while he winds up)
        if (this.stunTicks === 0 && this.windupTicks === 0) {
            this.getAnimation().time++;
        }
    }

    think(world, canAct) {
        this.updateTimers();

        if (this.stunTicks > 0) {
            this.stunTicks--;
            return;
        }

        // Stuck until the taunt's over
        if (this.tauntTicks > 0) {
            return;
        }
        const tauntPressed = this.brain !== null ? this.brain.takeTaunt() : canAct && inputs[this.index].taunt;
        if (tauntPressed && this.state !== "swing") {
            this.taunt();
            return;
        }

        let swingPressed = this.brain !== null ? this.brain.takeSwing() : canAct && inputs[this.index].swing;
        if (swingPressed && this.isChicken) {
            // A chicken can't attack
            swingPressed = false;
            if (this.noSwordCooldown === 0) {
                this.noSwordCooldown = 50;
                popup("BAWK!", this.getGroundX(), this.getTopY() - 4, "#ffffff");
                sound.cluck();
            }
        }

        if (this.mounted) {
            this.ride(canAct);
            return;
        }

        // A juggernaut holds his wind-up for a moment, then swings
        if (this.windupTicks > 0) {
            this.windupTicks--;
            if (this.windupTicks === 0) {
                this.release();
            }
            return;
        }

        if (this.state === "swing") {
            // Can't move until the whole swing has played, but a swing pressed near the end comes right after it
            if (swingPressed) {
                this.swingBuffer = SWING_BUFFER_TICKS;
            }
            this.swingBuffer--;
            const swing = this.getAnimation();
            if (swing.getRawFrame() < swing.order.length) {
                return;
            }
            if (this.swingBuffer > 0 && canAct && this.hasSword && this.danceTicks === 0) {
                this.faceHeldWay();
                this.startSwing();
                return;
            }
        } else if (swingPressed) {
            this.faceHeldWay();
            if (this.attack()) {
                return;
            }
        }

        const move = canAct ? this.getMoveInput() : {x: 0, y: 0};

        let moving = move.x !== 0 || move.y !== 0;
        // A juggernaut takes a moment to turn round, standing still while he does
        if (moving && this.maxLives > 1 && !this.isMovingToward(this.facing, move)) {
            this.turnTicks++;
            if (this.turnTicks < JUGGERNAUT_TURN_TICKS) {
                moving = false;
            } else {
                this.turnTicks = 0;
            }
        } else {
            this.turnTicks = 0;
        }
        if (moving) {
            this.faceToward(move);
            if (move.x !== 0) {
                this.chickenFlip = move.x < 0;
            }

            // Same speed diagonally as straight. Each way is tried on its own, so he slides along rocks.
            const length = Math.sqrt(move.x * move.x + move.y * move.y);
            const speed = WALK_SPEED * (this.speedTicks > 0 ? SPEED_BOOST : 1) * (this.grabTicks > 0 ? GRAB_SLOW : 1) * (arena.sumo ? SUMO_SPEED : 1)
                * (this.inSand > 0 ? QUICKSAND_SLOW : 1) * this.speedFactor;
            if (arena.slippery) {
                // On ice walking pushes him, so he speeds up, slows down and turns slowly
                const vx = this.vx + move.x / length * ICE_ACCEL * (speed / WALK_SPEED);
                const vy = this.vy + move.y / length * ICE_ACCEL * (speed / WALK_SPEED);
                const before = dhypot(this.vx, this.vy);
                const after = dhypot(vx, vy);
                const most = speed * 1.25;
                // Walking can steer but not push him past his top speed (a knockback can, though)
                const keep = after > most && after > before ? before / after : 1;
                this.vx = vx * keep;
                this.vy = vy * keep;
            } else {
                this.tryMove(move.x / length * speed, 0, world);
                this.tryMove(0, move.y / length * speed, world);
            }

            this.walkTicks++;
            // Footprints, one foot then the other
            if (this.walkTicks % 20 === 1) {
                const sideways = DIRS[this.facing].x !== 0;
                this.footSide = -this.footSide;
                marks.footprint(this.getGroundX() - 1 + (sideways ? 0 : this.footSide * 2), this.getGroundY() - 1 + (sideways ? this.footSide : 0), arena.footprint);
                if (this.walkTicks % 40 === 1) {
                    sound.step(arena.slippery);
                }
            }
            // A puff of dust every other step
            if (this.walkTicks % 40 === 1) {
                particles.dust(this.getGroundX(), this.getGroundY(), 1);
            }
            // Rustling through tall grass
            if (this.walkTicks % 30 === 0 && isInTallGrass(this.getGroundX(), this.getGroundY())) {
                particles.clippings(this.getGroundX(), this.getGroundY() - 2, 1);
            }
            // Speed boots leave copies behind, and little yellow sparks
            if (this.speedTicks > 0 && this.walkTicks % 8 === 0) {
                this.leaveGhost();
                particles.sparks(this.getGroundX(), this.getGroundY() - 1, 1, [255, 220, 90]);
            }
        } else {
            this.walkTicks = 0;
        }

        this.setState(moving ? "walk" : "idle");
    }

    updateTimers() {
        if (this.graceTicks > 0) this.graceTicks--;
        if (this.grabTicks > 0) this.grabTicks--;
        if (this.tauntTicks > 0) {
            this.tauntTicks--;
            // Turns back and forth while he gloats
            this.facing = this.tauntTicks === 0 ? this.tauntFacing : (Math.floor(this.tauntTicks / 20) % 2 === 0 ? "east" : "west");
        }
        if (this.speedTicks > 0) this.speedTicks--;
        if (this.reverseTicks > 0) this.reverseTicks--;
        if (this.danceTicks > 0) {
            this.danceTicks--;
            // Sparkles off the disco ball
            if (this.danceTicks % 12 === 0) {
                const ball = this.getDiscoBallSpot();
                particles.sparks(ball.x, ball.y, 1, DISCO_COLORS[Math.floor(this.danceTicks / 12) % DISCO_COLORS.length]);
            }
        }
        if (this.gunCooldown > 0) this.gunCooldown--;
        if (this.noSwordCooldown > 0) this.noSwordCooldown--;
        if (this.furyTicks > 0) {
            this.furyTicks--;
            if (this.furyTicks % 6 === 0) {
                particles.embers(this.getGroundX(), this.getGroundY(), 1);
            }
        }
        if (this.growTicks > 0) {
            this.growTicks--;
            if (this.growTicks === 0) {
                this.growLevel = 0;
                particles.dust(this.getGroundX(), this.getGroundY(), 6);
                sound.shrink();
            }
        }
        if (this.inSand > 0) {
            this.inSand--;
        } else {
            this.sinkTicks = Math.max(0, this.sinkTicks - 2);
        }
        if (this.spinTicks > 0) {
            this.spinTicks--;
            this.facing = ["south", "east", "north", "west"][Math.floor(this.spinTicks / 4) % 4];
        }
        const biggest = GROW_SCALES[GROW_SCALES.length - 1];
        const targetScale = this.growTicks > 0 ? Math.min(biggest, Math.max(GROW_SCALES[this.growLevel], this.baseScale)) : this.baseScale;
        this.scale += (targetScale - this.scale) * 0.08;
        if (Math.abs(targetScale - this.scale) < 0.02) {
            this.scale = targetScale;
        }
        if (this.newSwordTicks > 0) {
            this.newSwordTicks--;
            if (this.newSwordTicks === 0) {
                dropNewSword(this);
            }
        }

    }

    // The swing button: shoots if he has a gun, throws his sword if he has a throw, or swings. Returns if it did
    // anything.
    attack() {
        // Too busy dancing (he can still walk)
        if (this.danceTicks > 0) {
            if (this.noSwordCooldown === 0) {
                this.noSwordCooldown = 50;
                popup("TOO BUSY DANCING!", this.getGroundX(), this.getTopY() - 4, "#ff80e0");
            }
            return false;
        }
        if (this.gunAmmo > 0) {
            if (this.gunCooldown === 0) {
                this.shoot();
            }
            return true;
        }
        if (!this.hasSword) {
            if (this.noSwordCooldown === 0) {
                this.noSwordCooldown = 50;
                popup("NO SWORD!", this.getGroundX(), this.getTopY() - 4, "#c8d4c0");
                sound.noSword();
            }
            return false;
        }
        if (this.throwCharges > 0) {
            this.throwSword();
            return true;
        }
        this.startSwing();
        return true;
    }

    // On horseback: holding a direction speeds the horse up that way, and it keeps going after you let go. That's all:
    // the swing button does nothing on a horse.
    ride(canAct) {
        const move = canAct ? this.getMoveInput() : {x: 0, y: 0};
        const boost = this.speedTicks > 0 ? SPEED_BOOST : 1;
        if (move.x !== 0 || move.y !== 0) {
            const length = dhypot(move.x, move.y);
            this.vx += move.x / length * JOUST_ACCEL * boost;
            this.vy += move.y / length * JOUST_ACCEL * boost;
            // The horse faces left or right, whichever way he's steering
            if (move.x !== 0) {
                this.facing = move.x > 0 ? "east" : "west";
            }
        }
        const speed = dhypot(this.vx, this.vy);
        if (speed > JOUST_SAFETY_SPEED) {
            this.vx *= JOUST_SAFETY_SPEED / speed;
            this.vy *= JOUST_SAFETY_SPEED / speed;
        }
        const before = Math.floor(this.gallop / 12);
        this.gallop += speed;
        if (speed > 0.5 && Math.floor(this.gallop / 12) !== before) {
            sound.hoof();
            particles.dust(this.getGroundX() - Math.sign(this.vx) * 8, this.getGroundY(), 1);
        }
        this.setState("idle");
    }

    // Turned into a chicken in a chicken round, or back into himself
    setChicken(chicken) {
        this.isChicken = chicken;
        this.setState("idle");
        this.windupTicks = 0;
        this.swingBuffer = 0;
        this.vx = 0;
        this.vy = 0;
        this.chickenFlip = this.facing === "west";
    }

    makeMounted() {
        this.mounted = true;
        this.hasSword = false;
    }

    // Lunges and knockback slide him, even when he's down
    slide(world) {
        if (this.vx === 0 && this.vy === 0) {
            return;
        }
        this.tryMove(this.vx, 0, world);
        this.tryMove(0, this.vy, world);
        const friction = this.mounted && !this.dead ? JOUST_FRICTION : arena.slippery ? ICE_FRICTION : FRICTION;
        this.vx *= friction;
        this.vy *= friction;
        if (Math.abs(this.vx) < 0.002) this.vx = 0;
        if (Math.abs(this.vy) < 0.002) this.vy = 0;
        // Skid marks when he's going fast
        if (dhypot(this.vx, this.vy) > 0.7 && this.trailTimer % 2 === 0) {
            marks.dot(this.getGroundX(), this.getGroundY() - 1, 1, 1, arena.footprint);
        }
    }

    updateTrail() {
        for (const ghost of this.trail) {
            ghost.life--;
        }
        this.trail = this.trail.filter(ghost => ghost.life > 0);

        const fast = Math.sqrt(this.vx * this.vx + this.vy * this.vy) > TRAIL_SPEED;
        this.trailTimer++;
        if (fast && !this.dead && this.trailTimer % 4 === 0) {
            this.leaveGhost();
        }
    }

    // A copy of him as he is now, that fades
    leaveGhost() {
        if (this.isChicken) {
            const scale = this.getDrawScale();
            const spot = this.getChickenSpot(scale);
            this.trail.push({chicken: true, x: spot.x, y: spot.y, scale, frame: this.getChickenFrame(), flip: this.chickenFlip, life: TRAIL_TICKS});
            return;
        }
        const animation = this.getAnimation();
        const scale = this.getDrawScale();
        const spot = this.getSpriteSpot(scale);
        this.trail.push({
            x: spot.x, y: spot.y, scale: scale,
            fileName: animation.fileName, frame: animation.getFrame(), life: TRAIL_TICKS,
        });
    }

    startSwing() {
        this.checkSwingNearMiss();
        this.setState("swing");
        // A new swing right after another one is still a swing, so it needs starting over by hand. Fury makes it
        // faster, which is set here so the speed doesn't change partway through a swing.
        for (const dir in DIRS) {
            this.animations.swing[dir].reset();
            this.animations.swing[dir].animationSpeed = this.furyTicks > 0 ? FURY_SWING_SPEED : SWING_SPEED;
        }
        this.swingBuffer = 0;
        this.swingSpent = false;
        this.swingHitRock = false;
        this.swingCutGrass = false; // so the swish only plays once a swing
        this.swingNear = null;

        // The sword catches the light as he winds up, so the other player can see it coming
        const glint = this.scaledPoint(SWING_GLINTS[this.facing][0], SWING_GLINTS[this.facing][1]);
        particles.glint(glint.x, glint.y);
        if (this.furyTicks > 0) {
            particles.embers(glint.x, glint.y + 4, 3);
        }

        // A juggernaut's swing is slow: he holds the wind-up (which can't hit anything) before it comes
        if (this.maxLives > 1) {
            this.windupTicks = JUGGERNAUT_WINDUP_TICKS;
            return;
        }
        this.release();
    }

    // The swing actually coming round: a step forward and a whoosh
    release() {
        const dir = DIRS[this.facing];
        this.vx += dir.x * LUNGE;
        this.vy += dir.y * LUNGE;
        particles.dust(this.getGroundX(), this.getGroundY(), 2);
        sound.swing();
    }

    // If his swing just missed someone by a hair, that's a close call for them
    checkSwingNearMiss() {
        if (this.swingNear !== null && !this.swingSpent && !this.swingNear.dead) {
            closeCall(this.swingNear);
        }
        this.swingNear = null;
    }

    throwSword() {
        this.throwCharges--;
        this.hasSword = false;
        const dir = DIRS[this.facing];
        const hand = this.scaledPoint(SPRITE_SIZE / 2 + dir.x * 4, FEET_Y);
        thrownSwords.push(new ThrownSword(this, hand.x, hand.y, dir));
        this.vx -= dir.x * 0.6;
        this.vy -= dir.y * 0.6;
        this.setState("idle");
        particles.dust(this.getGroundX(), this.getGroundY(), 2);
        sound.throwSword();
    }

    shoot() {
        this.gunAmmo--; // never runs out in a showdown, where it's Infinity
        this.gunCooldown = arena.guns ? SHOWDOWN_GUN_COOLDOWN_TICKS : GUN_COOLDOWN_TICKS;
        const dir = DIRS[this.facing];
        const end = GUN_LINES[this.facing][1];
        const muzzle = this.scaledPoint(end[0], end[1]);
        bullets.push(new Bullet(this, muzzle.x, muzzle.y, this.getGroundY(), dir));
        // Kicks him back
        this.vx -= dir.x * GUN_RECOIL;
        this.vy -= dir.y * GUN_RECOIL;
        particles.sparks(muzzle.x, muzzle.y, 6, [255, 230, 120]);
        particles.dust(muzzle.x, muzzle.y + 2, 3);
        addShake(2);
        sound.gunshot();
        if (this.gunAmmo === 0) {
            popup("OUT OF AMMO", this.getGroundX(), this.getTopY() - 4, "#c8d4c0");
        }
    }

    // Moves if nothing's in the way. Returns if it moved.
    tryMove(dx, dy, world) {
        const x = this.x + dx;
        const y = this.y + dy;
        const feet = boxAt(FEET_BOX, x, y);
        const bounds = getBounds();
        const onScreen = feet.left >= bounds.left && feet.right <= bounds.right && y >= bounds.top && feet.bottom <= bounds.bottom;
        const blocked = !onScreen
            || world.solids.some(solid => boxesOverlap(feet, solid.getBox()))
            // Knights can't walk through each other (but can walk over one that's down). If they're already overlapping
            // (pushed together by moving rafts, say), they can always move, so they can't get stuck.
            || world.knights.some(other => other !== this && !other.dead && !this.dead
                && boxesOverlap(feet, other.getFeetBox()) && !boxesOverlap(this.getFeetBox(), other.getFeetBox()))
            // The title screen's knights treat the edge of lava, holes and water as a wall, however they're moved
            // (walking, lunging or knocked back). They can always step back out, if they ever end up over it.
            || (this.brain !== null && isUnsafeGround(x + SPRITE_SIZE / 2, y + FEET_Y, true) && !isUnsafeGround(this.getGroundX(), this.getGroundY(), true));
        if (blocked) {
            if (this.mounted && !this.dead) {
                // A horse bounces off the fence
                if (dx !== 0) this.vx = -this.vx * 0.5;
                if (dy !== 0) this.vy = -this.vy * 0.5;
                particles.dust(this.getGroundX(), this.getGroundY(), 2);
                return false;
            }
            // Stops a push into a wall, so it doesn't keep pushing
            if (dx !== 0) this.vx = 0;
            if (dy !== 0) this.vy = 0;
            return false;
        }
        this.x = x;
        this.y = y;
        return true;
    }

    setState(state) {
        if (state !== this.state) {
            if (this.state === "swing") {
                this.checkSwingNearMiss();
            }
            this.state = state;
            // Start on the first frame, so walking always starts with a step
            for (const dir in DIRS) {
                this.animations[state][dir].reset();
                if (this.animations[state + "NoSword"] !== undefined) {
                    this.animations[state + "NoSword"][dir].reset();
                }
            }
        }
    }

    // Taunting: stuck in place for a second, hopping and gloating, and there's no stopping it
    taunt() {
        this.tauntTicks = TAUNT_TICKS;
        this.tauntFacing = this.facing;
        this.setState("idle");
        popup(pick(this.isChicken ? CHICKEN_TAUNTS : TAUNTS), this.getGroundX(), this.getTopY() - 4, this.player.textColor);
        stats[this.player.color].taunts++;
        sound.taunt();
    }

    // A hand from a grave grabbed his ankle
    grab() {
        this.grabTicks = GRAB_TICKS;
        popup("GRABBED!", this.getGroundX(), this.getTopY() - 4, "#9cbf88");
        sound.grab();
    }

    // Pecked by a chicken: knocked back (away from it), but he can keep going
    peck(dx, dy) {
        if (this.dead) {
            return;
        }
        this.vx += dx * PECK_KNOCKBACK;
        this.vy += dy * PECK_KNOCKBACK;
        popup("PECK!", this.getGroundX(), this.getTopY() - 4, "#ffffff");
        particles.feathers(this.getGroundX(), this.getGroundY(), [245, 245, 240], 2);
        sound.cluck();
    }

    // Caught by a tornado and thrown out
    fling(dir) {
        if (this.dead) {
            return;
        }
        const strength = TORNADO_FLING * (this.maxLives > 1 ? 0.6 : 1);
        this.setState("idle");
        this.vx = dir.x * strength;
        this.vy = dir.y * strength;
        this.stunTicks = 34;
        this.spinTicks = 34;
        this.tauntTicks = 0;
        this.lastFling = gameTime;
        popup("WHOOSH!", this.getGroundX(), this.getTopY() - 4, "#d8d8e0");
        particles.dust(this.getGroundX(), this.getGroundY(), 6);
    }

    // The juggernaut: huge and slow, with hearts
    makeJuggernaut() {
        this.lives = JUGGERNAUT_LIVES;
        this.maxLives = JUGGERNAUT_LIVES;
        this.baseScale = JUGGERNAUT_SCALE;
        this.scale = JUGGERNAUT_SCALE;
        this.speedFactor = JUGGERNAUT_SPEED;
    }

    // A juggernaut losing a heart instead of going down
    loseLife(push) {
        this.lives--;
        this.graceTicks = JUGGERNAUT_GRACE_TICKS;
        this.setState("idle");
        this.vx = push.x * 2.6;
        this.vy = push.y * 2.6;
        this.stunTicks = 16;
        this.tauntTicks = 0;
        popup(this.lives === 1 ? "LAST HEART!" : "OUCH!", this.getGroundX(), this.getTopY() - 12, "#ff6060");
        particles.sparks(this.getGroundX(), this.getTopY() - 6, 10, [230, 40, 50]);
        sound.hit();
    }

    // In sumo a hit shoves him a long way instead of knocking him down
    shove(push) {
        this.setState("idle");
        this.vx = push.x * SUMO_KNOCKBACK;
        this.vy = push.y * SUMO_KNOCKBACK;
        this.stunTicks = SUMO_STUN_TICKS;
        this.graceTicks = SUMO_GRACE_TICKS;
        this.tauntTicks = 0;
        popup("SHOVE!", this.getGroundX(), this.getTopY() - 4, "#ffffff");
        particles.sparks(this.getGroundX(), this.getGroundY() - 8, 6);
        particles.dust(this.getGroundX(), this.getGroundY(), 4);
    }

    // For a moment after his shield breaks (and so on) nothing can hit him
    isInvulnerable() {
        return this.graceTicks > 0;
    }

    // His shield takes the hit instead of him
    breakShield(pushX, pushY) {
        this.lastBlock = gameTime;
        this.shield--;
        this.graceTicks = SHIELD_GRACE_TICKS;
        this.vx = pushX * SHIELD_KNOCKBACK;
        this.vy = pushY * SHIELD_KNOCKBACK;
        this.setState("idle");
        this.stunTicks = SHIELD_STUN_TICKS;
        particles.shards(this.getGroundX(), this.getGroundY(), 18);
        popup("BLOCKED!", this.getGroundX(), this.getTopY() - 4, "#aad4ff");
        sound.shatter();
    }

    // One of the [left, top, right, bottom] sprite boxes on the screen, grown around his feet when he's big
    scaledBox(box) {
        const groundX = this.getGroundX();
        const groundY = this.getGroundY();
        return {
            left: groundX + (box[0] - SPRITE_SIZE / 2) * this.scale,
            right: groundX + (box[2] - SPRITE_SIZE / 2) * this.scale,
            top: groundY + (box[1] - FEET_Y) * this.scale,
            bottom: groundY + (box[3] - FEET_Y) * this.scale,
        };
    }

    // A spot in the sprite on the screen, grown around his feet when he's big
    scaledPoint(x, y) {
        return {x: this.getGroundX() + (x - SPRITE_SIZE / 2) * this.scale, y: this.getGroundY() + (y - FEET_Y) * this.scale};
    }

    // The top of his head, for popups
    getTopY() {
        if (this.isChicken) {
            return this.getGroundY() - 10 * this.scale;
        }
        return this.scaledPoint(0, 4).y - this.getRiderLift();
    }

    // How far up he's drawn, sitting on his horse
    getRiderLift() {
        return this.mounted && !this.dead ? RIDER_LIFT : 0;
    }

    // Drawn in quarter steps, so while he grows the pixels don't come out every size
    getDrawScale() {
        return Math.round(this.scale * 4) / 4;
    }

    // Where the sprite's top left goes, so that his feet stay put however big he is
    getSpriteSpot(scale) {
        return {
            x: Math.round(this.getGroundX() - SPRITE_SIZE / 2 * scale),
            y: Math.round(this.getGroundY() - FEET_Y * scale),
        };
    }

    getBodyBox() {
        if (this.mounted && !this.dead) {
            // The horse and rider together
            return {left: this.getGroundX() - 11, right: this.getGroundX() + 11, top: this.getGroundY() - 22, bottom: this.getGroundY()};
        }
        if (this.isChicken && !this.dead) {
            // As small as a chicken
            return {left: this.getGroundX() - 4 * this.scale, right: this.getGroundX() + 4 * this.scale, top: this.getGroundY() - 8 * this.scale, bottom: this.getGroundY()};
        }
        return this.scaledBox(BODY_BOXES[this.facing]);
    }

    getFeetBox() {
        return boxAt(FEET_BOX, this.x, this.y);
    }

    getGroundX() {
        return this.x + SPRITE_SIZE / 2;
    }

    getGroundY() {
        return this.y + FEET_Y;
    }

    // Where the sword can hit right now, or null when it can't
    getSwordBox() {
        if (this.dead || this.state !== "swing") {
            return null;
        }
        const box = SWORD_BOXES[this.facing][this.getAnimation().getFrame()];
        return box === undefined ? null : this.scaledBox(box);
    }

    swordReaches(other) {
        const swordBox = this.getSwordBox();
        if (other.dead || this.swingSpent || swordBox === null) {
            return false;
        }
        const reaches = boxesOverlap(swordBox, other.getBodyBox());
        // Remembers if it nearly hit, for a close call when the swing ends
        if (!reaches && boxesOverlap(growBox(swordBox, CLOSE_CALL_GAP), other.getBodyBox())) {
            this.swingNear = other;
        }
        return reaches;
    }

    // Swords met: knocked back away from the other knight, and can't do anything for a moment
    clash(awayX, awayY) {
        this.lastParry = gameTime;
        const length = Math.sqrt(awayX * awayX + awayY * awayY) || 1;
        this.vx = awayX / length * CLASH_KNOCKBACK;
        this.vy = awayY / length * CLASH_KNOCKBACK;
        this.swingNear = null;
        this.setState("idle");
        this.stunTicks = CLASH_STUN_TICKS;
    }

    // Sword bounced off a rock
    recoil() {
        const dir = DIRS[this.facing];
        this.vx = -dir.x * ROCK_RECOIL;
        this.vy = -dir.y * ROCK_RECOIL;
    }

    // Knocked down, sent flying the way he was hit
    die(pushX, pushY) {
        this.goDown();
        this.vx = pushX * DEATH_KNOCKBACK;
        this.vy = pushY * DEATH_KNOCKBACK;
        // The fallen sprite has his head to the left, so it's flipped when he's knocked to the right
        this.fallFlip = pushX !== 0 ? pushX > 0 : rng() < 0.5;
        particles.feathers(this.getGroundX(), this.getGroundY(), this.player.plumeColor, 12);
        particles.sparks(this.getGroundX(), this.getGroundY() - 8, 10);
        particles.debris(this.getGroundX(), this.getGroundY() - 2, 4); // bits of armor
        particles.dust(this.getGroundX(), this.getGroundY(), 6);
    }

    // Fell into a hole, the river or lava
    fall(hole) {
        this.goDown();
        this.fallHole = hole;
        this.fallSpot = hole.getFallSpot !== undefined ? hole.getFallSpot(this.getGroundX(), this.getGroundY()) : {x: hole.x, y: hole.y};
        const animation = this.getAnimation();
        this.fallFrame = this.isChicken ? {chicken: true, frame: this.getChickenFrame(), flip: this.chickenFlip}
            : {fileName: animation.fileName, frame: animation.getFrame()};
        this.vx = 0;
        this.vy = 0;
        sound.fall();
        if (hole.style === "lava") {
            particles.embers(this.getGroundX(), this.getGroundY(), 16);
            sound.sizzle();
        } else if (hole.style === "ice") {
            particles.shards(this.getGroundX(), this.getGroundY(), 12);
            sound.splash();
        } else {
            particles.dust(this.getGroundX(), this.getGroundY(), 8);
        }
        particles.feathers(this.getGroundX(), this.getGroundY(), this.player.plumeColor, 6);
    }

    // Bleeds in spurts, like a heartbeat, and a pool of blood spreads under him
    bleed() {
        if (!this.bleeding) {
            return;
        }
        this.bleedTicks++;
        this.bloodPool = Math.min(BLOOD_POOL_MAX, this.bloodPool + 0.02);
        const x = this.getGroundX() + random(-3, 3);
        const y = this.getGroundY() - 1;
        if (this.bleedTicks % HEARTBEAT_TICKS === 0) {
            particles.blood(x, y, 6, bloodLanded);
        } else if (this.bleedTicks % 11 === 0) {
            particles.blood(x, y, 1, bloodLanded);
        }
    }

    goDown() {
        if (this.isChicken) {
            particles.feathers(this.getGroundX(), this.getGroundY() - 4, [245, 245, 240], 24);
        }
        this.checkSwingNearMiss();
        this.dead = true;
        this.deadTicks = 0;
        this.shield = 0;
        this.speedTicks = 0;
        this.furyTicks = 0;
        this.reverseTicks = 0;
        this.danceTicks = 0;
        this.gunAmmo = 0;
    }

    getSortY() {
        return this.getGroundY();
    }

    drawShadow() {
        if (this.danceTicks > 0 && !this.dead) {
            this.drawDiscoLights();
        }
        if (this.bloodPool > 0) {
            // Spreading out from under the middle of his body, which lies a few pixels above his feet
            const poolY = this.getGroundY() - Math.round(3 * this.scale);
            drawOval(this.getGroundX(), poolY, this.bloodPool, this.bloodPool * 0.45, "rgba(110, 8, 10, 0.85)");
            drawOval(this.getGroundX() - 1, poolY, this.bloodPool * 0.6, this.bloodPool * 0.25, "rgba(150, 20, 20, 0.6)");
        }
        if (this.fallHole === null) {
            const size = this.mounted && !this.dead ? 22 : Math.round((this.dead ? (this.isChicken ? 10 : 13) : this.isChicken ? 6 : 10) * this.scale);
            drawShadow(this.getGroundX(), this.getGroundY(), size);
        }
    }

    // Draws one frame of a strip, optionally tinted
    drawFrame(fileName, frame, x, y, tint, scale) {
        MDog.Draw.image(fileName, x, y, {width: SPRITE_SIZE, offsetX: SPRITE_SIZE * frame, tint: tint, scale: scale});
    }

    draw() {
        const [r, g, b] = this.player.plumeColor;
        for (const ghost of this.trail) {
            const alpha = 0.5 * ghost.life / TRAIL_TICKS;
            const tint = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            if (ghost.chicken) {
                MDog.Draw.image(CHICKEN_IMAGE, ghost.x, ghost.y, {width: 10, offsetX: 10 * ghost.frame, flipX: ghost.flip, tint, scale: ghost.scale});
            } else {
                this.drawFrame(ghost.fileName, ghost.frame, ghost.x, ghost.y, tint, ghost.scale);
            }
        }

        const scale = this.getDrawScale();
        const spot = this.getSpriteSpot(scale);
        const x = spot.x;
        const bop = this.getBop();
        const y = spot.y - bop;

        if (this.fallHole !== null) {
            // Shrinks away into the hole
            const left = 1 - this.deadTicks / FALL_TICKS;
            if (left > 0) {
                const fallScale = Math.max(0.25, Math.round(scale * left * 4) / 4);
                const fallSpot = this.getSpriteSpot(fallScale);
                const tint = this.fallHole.style === "lava" ? `rgba(255, 110, 30, ${0.8 * (1 - left)})` : undefined;
                if (this.fallFrame.chicken) {
                    const spot = this.getChickenSpot(fallScale);
                    MDog.Draw.image(CHICKEN_IMAGE, spot.x, spot.y + Math.round((1 - left) * 4), {width: 10, offsetX: 10 * this.fallFrame.frame, flipX: this.fallFrame.flip, tint, scale: fallScale});
                } else {
                    this.drawFrame(this.fallFrame.fileName, this.fallFrame.frame, fallSpot.x, fallSpot.y + Math.round((1 - left) * 4), tint, fallScale);
                }
            }
            return;
        }

        if (this.dead) {
            // Flashes white for a moment as he goes down, then lies there
            const flash = this.deadTicks < 30 && Math.floor(this.deadTicks / 6) % 2 === 0;
            if (this.isChicken) {
                drawRoastChicken(Math.round(this.getGroundX()), Math.round(this.getGroundY()), Math.max(1, Math.round(this.scale)), this.fallFlip, this.deadTicks, flash);
                return;
            }
            MDog.Draw.image(this.deadImage, x, y + Math.round(2 * scale), {flipX: this.fallFlip, tint: flash ? "#ffffff" : undefined, scale: scale});
            return;
        }

        const animation = this.getAnimation();
        // On horseback he sits up on the horse
        if (this.mounted) {
            this.drawHorse();
        }
        const riderY = y - this.getRiderLift();
        let overlay;
        if (this.isChicken) {
            overlay = tint => this.drawChicken(scale, bop, tint);
            overlay(undefined);
        } else {
            // (mirrored is only ever set for cover screenshots, to draw him as the mirror image of facing the other
            // way: see tests/cover-shot.mjs)
            MDog.Draw.animation(animation, x, riderY, {update: false, scale: scale, flipX: this.mirrored === true});
            overlay = tint => this.drawFrame(animation.fileName, animation.getFrame(), x, riderY, tint, scale);
        }
        if (this.mounted) {
            this.drawLance();
        }

        if (chickenFreeze > 0 && Math.floor(chickenFreeze / 8) % 2 === 0) {
            // About to swap
            overlay(`rgba(255, 255, 255, ${0.3 + 0.5 * (1 - chickenFreeze / CHICKEN_FREEZE_TICKS)})`);
        } else if (this.stunTicks > 0 && Math.floor(this.stunTicks / 4) % 2 === 0) {
            // Flickers while stunned
            overlay("rgba(255, 255, 255, 0.6)");
        } else if (this.graceTicks > 0 && Math.floor(this.graceTicks / 4) % 2 === 0) {
            // Washed out while he can't be hit
            overlay("rgba(255, 255, 255, 0.4)");
        } else if (this.furyTicks > 0) {
            // Glowing red hot
            overlay(`rgba(255, 90, 40, ${0.15 + 0.12 * dsin(this.trailTimer / 8)})`);
        } else if (this.reverseTicks > 0) {
            overlay(`rgba(190, 110, 230, ${0.15 + 0.1 * dsin(this.trailTimer / 6)})`);
        } else if (this.danceTicks > 0) {
            // Lit up by the disco lights, a different color every beat
            const [r, g, b] = DISCO_COLORS[Math.floor(this.danceTicks / 10) % DISCO_COLORS.length];
            overlay(`rgba(${r}, ${g}, ${b}, 0.35)`);
        }

        if (this.gunAmmo > 0) {
            this.drawGun();
        }
        if (this.reverseTicks > 0) {
            this.drawDizzy();
        }
        if (this.danceTicks > 0) {
            const ball = this.getDiscoBallSpot();
            drawDiscoBall(ball.x, ball.y, this.danceTicks, false);
        }
        if (this.shield) {
            this.drawShield();
        }
        if (this.sinkTicks > 0) {
            this.drawSand();
        }
        if (isLeading(this)) {
            this.drawCrown();
        }
        if (this.maxLives > 1) {
            this.drawHearts();
        }
        this.drawTimers();
    }

    // Where the chicken sprite's top left goes, with its feet where his are
    getChickenSpot(scale) {
        return {x: Math.round(this.getGroundX() - 5 * scale), y: Math.round(this.getGroundY() - 10 * scale)};
    }

    // Flapping along while he walks
    getChickenFrame() {
        return this.state === "walk" ? Math.floor(this.walkTicks / 6) % 2 : 0;
    }

    // As a chicken: red's looks like any chicken, and blue's has a blue comb
    drawChicken(scale, bop, tint) {
        const spot = this.getChickenSpot(scale);
        const y = spot.y - bop;
        MDog.Draw.image(CHICKEN_IMAGE, spot.x, y, {width: 10, offsetX: 10 * this.getChickenFrame(), flipX: this.chickenFlip, tint, scale});
        if (tint === undefined && this.player.color === "blue") {
            const [r, g, b] = this.player.plumeColor;
            for (const [px, py] of CHICKEN_COMB) {
                const left = spot.x + (this.chickenFlip ? 9 - px : px) * scale;
                MDog.Draw.rectangleFill(Math.round(left), Math.round(y + py * scale), Math.ceil(scale), Math.ceil(scale), `rgb(${r + 20}, ${g + 30}, ${b + 40})`);
            }
        }
    }

    // How far up he's hopped: up and down while taunting or dancing
    getBop() {
        return this.tauntTicks > 0 ? Math.round(Math.abs(dsin(this.tauntTicks / 8)) * 3)
            : this.danceTicks > 0 ? Math.round(Math.abs(dsin(this.danceTicks / 6)) * 2) : 0;
    }

    // Quicksand up his legs, higher the further he's sunk
    drawSand() {
        const height = Math.round(Math.min(1, this.sinkTicks / QUICKSAND_TICKS) * 14 * this.scale);
        const width = Math.round(12 * this.scale);
        const left = Math.round(this.getGroundX() - width / 2);
        const bottom = Math.round(this.getGroundY());
        MDog.Draw.rectangleFill(left, bottom - height, width, height + 1, "#c49a5e");
        MDog.Draw.rectangleFill(left, bottom - height, width, 1, "#a87c48");
    }

    // A juggernaut's hearts over his head: full ones red, lost ones dark
    drawHearts() {
        const HEART = ["x.x", "xxx", ".x."];
        const spacing = 5;
        const left = Math.round(this.getGroundX() - (this.maxLives * spacing - 2) / 2);
        // Above his crown, if he's wearing one
        const top = Math.min(Math.round(this.getTopY() - 10), isLeading(this) ? this.getCrownTop() - 6 : Infinity) - this.getBop();
        for (let i = 0; i < this.maxLives; i++) {
            const color = i < this.lives ? "#e8303c" : "rgba(40, 20, 24, 0.7)";
            HEART.forEach((row, y) => {
                for (let x = 0; x < row.length; x++) {
                    if (row[x] === "x") {
                        MDog.Draw.rectangleFill(left + i * spacing + x, top + y, 1, 1, color);
                    }
                }
            });
        }
    }

    // His horse, galloping faster the faster it goes
    drawHorse() {
        const speed = dhypot(this.vx, this.vy);
        const frame = speed < 0.1 ? 0 : Math.floor(this.gallop / 6) % 4;
        MDog.Draw.image(HORSE_IMAGE, Math.round(this.getGroundX() - HORSE_WIDTH / 2), Math.round(this.getGroundY() - HORSE_HEIGHT), {
            width: HORSE_WIDTH, offsetX: HORSE_WIDTH * frame, flipX: this.facing === "west",
        });
    }

    // Which way his lance points: the way he's going, or the way he's facing when he's standing still
    getLanceDir() {
        const speed = dhypot(this.vx, this.vy);
        return speed > 0.15 ? {x: this.vx / speed, y: this.vy / speed} : {x: this.facing === "west" ? -1 : 1, y: 0};
    }

    // The patch of ground his horse covers, seen from above. Jousts are judged on the ground, so it works the same
    // whichever way the riders are going.
    getHorseFootprint() {
        return {left: this.getGroundX() - 11, right: this.getGroundX() + 11, top: this.getGroundY() - 6, bottom: this.getGroundY() + 1};
    }

    // Where the point of his lance is, over the ground. It reaches out past the front of his horse.
    getLanceTip() {
        const dir = this.getLanceDir();
        return {x: this.getGroundX() + dir.x * LANCE_REACH_ACROSS, y: this.getGroundY() - 2 + dir.y * LANCE_REACH_UP_DOWN};
    }

    // Is his lance tip in the other rider's horse?
    lanceHits(other) {
        const tip = this.getLanceTip();
        const box = growBox(other.getHorseFootprint(), LANCE_TIP_REACH);
        return !this.dead && !other.dead && tip.x > box.left && tip.x < box.right && tip.y > box.top && tip.y < box.bottom;
    }

    // Held at his chest, out to the tip
    drawLance() {
        const dir = this.getLanceDir();
        const tip = this.getLanceTip();
        const startX = this.getGroundX() + dir.x * 3;
        const startY = this.getGroundY() - 14;
        const tipY = tip.y - 10;
        MDog.Draw.line(startX, startY, tip.x, tipY, "#8a5a2c");
        MDog.Draw.rectangleFill(Math.round(tip.x), Math.round(tipY), 1, 1, "#e0e0e8");
    }

    // A little musket in his hands
    drawGun() {
        const [start, end] = GUN_LINES[this.facing];
        const a = this.scaledPoint(start[0], start[1]);
        const b = this.scaledPoint(end[0], end[1]);
        MDog.Draw.line(a.x, a.y, b.x, b.y, "#6e6a78");
        MDog.Draw.rectangleFill(Math.floor(a.x), Math.floor(a.y), 2, 2, "#82502c");
    }

    // Where the disco ball hangs, over his head (the sparkles come from here too)
    getDiscoBallSpot() {
        return {x: Math.round(this.getGroundX()), y: Math.round(this.getTopY() - 7)};
    }

    // Spots of colored light going round on the ground under him while he dances
    drawDiscoLights() {
        for (let i = 0; i < DISCO_COLORS.length; i++) {
            const angle = this.danceTicks / 14 + i * Math.PI / 2;
            const [r, g, b] = DISCO_COLORS[i];
            drawOval(this.getGroundX() + dcos(angle) * 12 * this.scale, this.getGroundY() + dsin(angle) * 5 * this.scale, 4, 2, `rgba(${r}, ${g}, ${b}, 0.45)`);
        }
    }

    // Little purple stars going round his head while his controls are backwards
    drawDizzy() {
        const head = this.isChicken ? {x: this.getGroundX(), y: this.getGroundY() - 10 * this.scale} : this.scaledPoint(SPRITE_SIZE / 2, 2);
        head.y -= this.getBop();
        for (let i = 0; i < 2; i++) {
            const angle = this.trailTimer / 10 + i * Math.PI;
            MDog.Draw.rectangleFill(Math.round(head.x + dcos(angle) * 5), Math.round(head.y + dsin(angle) * 2), 1, 1, "#d8a0ff");
        }
    }

    // A shimmering bubble around him (a ring for each shield he has)
    drawShield() {
        const center = this.isChicken ? {x: this.getGroundX(), y: this.getGroundY() - 5 * this.scale} : this.scaledPoint(SPRITE_SIZE / 2, 10);
        const size = (this.isChicken ? 7 : 10) * this.scale;
        const time = this.trailTimer / 12;
        for (let ring = 0; ring < this.shield; ring++) {
            const radius = size + ring * 3;
            const dots = Math.round(4.4 * radius);
            for (let i = 0; i < dots; i++) {
                const angle = i / dots * Math.PI * 2;
                const alpha = 0.3 + 0.3 * dsin(time + i / 3 + ring);
                MDog.Draw.rectangleFill(Math.round(center.x + dcos(angle) * radius), Math.round(center.y + dsin(angle) * radius), 1, 1, `rgba(170, 215, 255, ${alpha})`);
            }
        }
        // A shine at the top left
        const shine = {x: center.x - size * 0.6, y: center.y - size * 0.6};
        MDog.Draw.rectangleFill(Math.round(shine.x), Math.round(shine.y), 2, 1, "rgba(255, 255, 255, 0.8)");
        MDog.Draw.rectangleFill(Math.round(shine.x) - 1, Math.round(shine.y) + 1, 1, 1, "rgba(255, 255, 255, 0.8)");
    }

    // Whoever's winning wears a little crown over his plume
    drawCrown() {
        const size = Math.max(1, Math.round(this.scale));
        const left = this.isChicken ? Math.round(this.getGroundX() - 2.5 * size) : Math.round(this.scaledPoint(7, -1).x);
        // Bobbing a pixel up and down
        const top = this.getCrownTop() + (Math.floor(this.trailTimer / 40) % 2) - this.getBop();
        const pixel = (x, y, width, color) => MDog.Draw.rectangleFill(left + x * size, top + y * size, width * size, size, color);
        pixel(0, 0, 1, "#ffd84a");
        pixel(2, 0, 1, "#ffd84a");
        pixel(4, 0, 1, "#ffd84a");
        pixel(0, 1, 5, "#ffd84a");
        pixel(0, 2, 5, "#c8961e");
    }

    // The top of his crown (before it bobs)
    getCrownTop() {
        if (this.isChicken) {
            return Math.round(this.getGroundY() - 14 * this.scale);
        }
        return Math.round(this.scaledPoint(7, -1).y) - this.getRiderLift();
    }

    // Little bars under his feet for the power-ups that run out, and dots for shots and throws left
    drawTimers() {
        const timers = [
            [this.speedTicks, SPEED_BOOST_TICKS, "#ffdc5a"],
            [this.growTicks, GROW_TICKS, "#e05040"],
            [this.furyTicks, FURY_TICKS, "#ff8a30"],
            [this.reverseTicks, REVERSE_TICKS, "#c890f0"],
            [this.danceTicks, BOOGIE_TICKS, "#ff80e0"],
        ].filter(([ticks]) => ticks > 0);
        const left = Math.round(this.getGroundX()) - 6;
        let y = Math.round(this.getGroundY()) + 3;
        for (const [ticks, max, color] of timers) {
            MDog.Draw.rectangleFill(left, y, 12, 1, "rgba(0, 0, 0, 0.35)");
            MDog.Draw.rectangleFill(left, y, Math.ceil(12 * ticks / max), 1, color);
            y += 2;
        }
        if (Number.isFinite(this.gunAmmo)) {
            const dots = [...Array(this.gunAmmo).fill("#e0e0e8"), ...Array(this.throwCharges).fill("#ffd84a")];
            dots.forEach((color, i) => MDog.Draw.rectangleFill(left + i * 3, y, 2, 1, color));
        } else if (this.gunCooldown > 0) {
            // In a showdown: reloading
            MDog.Draw.rectangleFill(left, y, 12, 1, "rgba(0, 0, 0, 0.35)");
            MDog.Draw.rectangleFill(left, y, Math.ceil(12 * (1 - this.gunCooldown / SHOWDOWN_GUN_COOLDOWN_TICKS)), 1, "#e0e0e8");
        }
    }

    drawHitboxes() {
        if (this.dead) {
            return;
        }
        drawBox(this.getBodyBox(), this.isInvulnerable() ? "#ffffff" : "#00ff00");
        drawBox(this.getFeetBox(), "#0088ff");
        const swordBox = this.getSwordBox();
        if (swordBox !== null) {
            drawBox(swordBox, "#ff0000");
        }
    }
}

// ---------- Thrown swords and bullets ----------

// A sword that was thrown. It flies really fast, then lands on the ground, and its owner can't attack again until
// he picks it up. A sword lost in water or lava comes back down from the sky near him a little later.
class ThrownSword {
    constructor(owner, x, y, dir, falling) {
        this.owner = owner;
        this.x = x; // on the ground
        this.y = y;
        this.dx = dir.x;
        this.dy = dir.y;
        this.z = falling ? 90 : 8; // height above the ground
        this.state = falling ? "falling" : "flying"; // then dropping, then grounded
        this.distance = 0;
        this.ticks = 0;
        this.closeCalls = new Map();
    }

    update(solids) {
        this.ticks++;
        if (this.state === "flying") {
            // In small steps, so it can't skip through anything
            for (let i = 0; i < 3 && this.state === "flying"; i++) {
                this.x += this.dx * THROW_SPEED / 3;
                this.y += this.dy * THROW_SPEED / 3;
                this.distance += THROW_SPEED / 3;
                const hitWall = solids.some(solid => boxesOverlap(this.getGroundBox(), solid.getBox()));
                const bounds = getBounds();
                const offScreen = this.x < bounds.left + 4 || this.x > bounds.right - 4 || this.y < Math.max(14, bounds.top + 14) || this.y > bounds.bottom - 2;
                if (hitWall) {
                    // Bounces off a little
                    this.x -= this.dx * 4;
                    this.y -= this.dy * 4;
                    particles.sparks(this.x, this.y - this.z, 6);
                    sound.tink();
                    this.drop();
                } else if (offScreen || this.distance > THROW_RANGE) {
                    this.x = Math.max(bounds.left + 4, Math.min(bounds.right - 4, this.x));
                    this.y = Math.max(Math.max(14, bounds.top + 14), Math.min(bounds.bottom - 2, this.y));
                    this.drop();
                }
            }
            if (this.ticks % 2 === 0) {
                particles.sparks(this.x, this.y - this.z, 1, [220, 220, 235]);
            }
        } else if (this.state === "dropping" || this.state === "falling") {
            this.z -= this.state === "falling" ? 2.2 : 0.9;
            if (this.z <= 0) {
                this.z = 0;
                this.land();
            }
        } else if (this.state === "grounded" && this.ticks % 60 === 0) {
            particles.glint(this.x, this.y - 8);
        }
    }

    drop() {
        this.state = "dropping";
    }

    land() {
        // (On the lava lake that means really on a raft, not in the bit of leeway past its edge that stops knights
        // falling in, since a sword there wouldn't be carried along with the raft)
        if (isInWater(this.x, this.y) || holes.some(hole => (hole.containsStrictly ?? hole.contains).call(hole, this.x, this.y))) {
            // Gone. A new one comes from the sky.
            const lava = holes.some(hole => hole.style === "lava" && hole.contains(this.x, this.y));
            if (lava) {
                particles.embers(this.x, this.y, 8);
                sound.sizzle();
            } else {
                particles.shards(this.x, this.y, 8);
                sound.splash();
            }
            this.state = "lost";
            if (!this.owner.dead) {
                this.owner.newSwordTicks = NEW_SWORD_TICKS;
                popup("SWORD LOST!", this.x, this.y - 12, "#c8d4c0");
            }
            return;
        }
        this.state = "grounded";
        this.ticks = 0;
        particles.dust(this.x, this.y, 3);
        sound.thunk();
    }

    // Swords and boulders hit it as it flies
    getBox() {
        return {left: this.x - 3, right: this.x + 3, top: this.y - this.z - 3, bottom: this.y - this.z + 3};
    }

    // For bumping into rocks
    getGroundBox() {
        return {left: this.x - 1, right: this.x + 1, top: this.y - 2, bottom: this.y + 1};
    }

    isFlying() {
        return this.state === "flying";
    }

    canHit(knight) {
        return this.isFlying() && knight !== this.owner && boxesOverlap(this.getBox(), knight.getBodyBox());
    }

    // Can its owner pick it up?
    canPickUp(knight) {
        return this.state === "grounded" && knight === this.owner && !knight.dead
            && boxesOverlap(knight.getFeetBox(), {left: this.x - 5, right: this.x + 5, top: this.y - 4, bottom: this.y + 3});
    }

    isDone() {
        return this.state === "lost" || this.state === "picked";
    }

    getSortY() {
        return this.y;
    }

    drawShadow() {
        drawShadow(this.x, this.y, this.state === "falling" ? Math.max(3, Math.round(8 - this.z / 15)) : 6);
    }

    draw() {
        const x = Math.round(this.x - SWORD_SIZE / 2);
        if (this.state === "flying" || this.state === "dropping") {
            // Spinning
            const frame = Math.floor(this.ticks / 2) % 4;
            MDog.Draw.image(SWORD_IMAGE, x, Math.round(this.y - this.z - SWORD_SIZE / 2), {width: SWORD_SIZE, offsetX: SWORD_SIZE * frame});
        } else {
            // Point down, stuck in the ground (or coming down to be)
            MDog.Draw.image(SWORD_IMAGE, x, Math.round(this.y - this.z - 9), {width: SWORD_SIZE, offsetX: SWORD_SIZE * 4});
        }
    }

    drawHitboxes() {
        drawBox(this.getBox(), "#ff0000");
    }
}

class Bullet {
    constructor(owner, x, y, groundY, dir) {
        this.owner = owner;
        this.x = x;
        this.y = y; // on the screen, at chest height
        this.height = groundY - y; // how far above the ground that is
        this.dx = dir.x;
        this.dy = dir.y;
        this.speed = BULLET_SPEED;
        this.travelled = 0;
        this.dead = false;
        this.ticks = 0;
        this.closeCalls = new Map();
    }

    getGroundY() {
        return this.y + this.height;
    }

    update(solids) {
        this.ticks++;
        for (let i = 0; i < 3 && !this.dead; i++) {
            this.x += this.dx * this.speed / 3;
            this.y += this.dy * this.speed / 3;
            this.travelled += this.speed / 3;
            const ground = {left: this.x - 1, right: this.x + 1, top: this.getGroundY() - 2, bottom: this.getGroundY() + 1};
            const wall = solids.find(solid => boxesOverlap(ground, solid.getBox()));
            if (wall !== undefined) {
                this.dead = true;
                particles.sparks(this.x, this.y, 6);
                if (wall instanceof Crate) {
                    wall.hit();
                } else {
                    sound.ricochet();
                }
            } else if (boulders.some(boulder => boxesOverlap(this.getBox(), boulder.getBox()))) {
                this.dead = true;
                particles.sparks(this.x, this.y, 6);
                sound.ricochet();
            } else if (features.some(feature => feature.onBullet?.(this))) {
                this.dead = true;
                particles.sparks(this.x, this.y, 4);
            }
        }
        const bounds = getBounds();
        if (this.x < bounds.left - 4 || this.x > bounds.right + 4 || this.y < bounds.top - 4 || this.y > bounds.bottom + 4) {
            this.dead = true;
        }
        if (this.ticks % 3 === 0) {
            particles.dust(this.x, this.getGroundY(), 1);
        }
    }

    // Hit by a sword: it goes back the way the knight is facing, a bit faster, and it's his bullet now
    reflect(knight) {
        const dir = DIRS[knight.facing];
        this.dx = dir.x;
        this.dy = dir.y;
        this.owner = knight;
        this.speed *= 1.2;
        this.travelled = 0;
        this.reflected = true;
    }

    getBox() {
        return {left: this.x - 1, right: this.x + 1, top: this.y - 1, bottom: this.y + 1};
    }

    canHit(knight) {
        return !this.dead && knight !== this.owner && boxesOverlap(this.getBox(), knight.getBodyBox());
    }

    getSortY() {
        return this.getGroundY();
    }

    drawShadow() {
        MDog.Draw.rectangleFill(Math.round(this.x), Math.round(this.getGroundY()), 2, 1, SHADOW_COLOR);
    }

    draw() {
        const x = Math.round(this.x);
        const y = Math.round(this.y);
        MDog.Draw.rectangleFill(x - 1, y - 1, 2, 2, "#2a2630");
        MDog.Draw.rectangleFill(x - 1, y - 1, 1, 1, "#c8c4d0");
        // A streak behind it
        MDog.Draw.rectangleFill(x - 1 - this.dx * 4, y - this.dy * 4, 1 + Math.abs(this.dx) * 3, 1 + Math.abs(this.dy) * 3, "rgba(255, 255, 255, 0.35)");
    }

    drawHitboxes() {
        drawBox(this.getBox(), "#ff0000");
    }
}

// ---------- Hazards ----------

// A runaway horse that gallops straight across. It jumps over rocks and holes, but not knights.
class Horse {
    constructor() {
        this.dir = rng() < 0.5 ? 1 : -1;
        this.y = random(36, SCREEN_HEIGHT - 6); // its feet
        this.x = this.dir > 0 ? -HORSE_WIDTH : SCREEN_WIDTH + HORSE_WIDTH;
        this.z = 0;
        this.ticks = 0;
        this.state = "warning";
        this.closeCalls = new Map();
    }

    update(solids) {
        this.ticks++;
        if (this.state === "warning") {
            // Hooves getting closer
            if (this.ticks % 24 === 0) {
                sound.hoof();
            }
            if (this.ticks >= HORSE_WARNING_TICKS) {
                this.state = "running";
                this.ticks = 0;
                sound.neigh();
            }
            return;
        }
        this.x += this.dir * HORSE_SPEED;
        if (this.ticks % 12 === 0) {
            sound.hoof();
            particles.dust(this.x - this.dir * 8, this.y, 2);
            marks.footprint(this.x - this.dir * 6, this.y - 1, arena.footprint);
        }
        if (isInWater(this.x, this.y) && this.ticks % 4 === 0) {
            particles.shards(this.x, this.y, 1);
        }
        // Jumps over anything in its way
        const feet = {left: this.x - 14, right: this.x + 14, top: this.y - 3, bottom: this.y + 1};
        const jumping = solids.some(solid => boxesOverlap(feet, solid.getBox())) || holes.some(hole => hole.isNear(this.x, this.y, 8));
        this.z += ((jumping ? 9 : 0) - this.z) * 0.2;
    }

    isActive() {
        return this.state === "running";
    }

    getBox() {
        return {left: this.x - 11, right: this.x + 11, top: this.y - 14 - this.z, bottom: this.y - this.z};
    }

    canHit(knight) {
        return this.canHitBox(knight.getBodyBox());
    }

    canHitBox(box) {
        return this.isActive() && boxesOverlap(this.getBox(), box);
    }

    isDone() {
        return this.isActive() && (this.x < -HORSE_WIDTH * 2 || this.x > SCREEN_WIDTH + HORSE_WIDTH * 2);
    }

    getWarningSpot() {
        return {x: this.dir > 0 ? 12 : SCREEN_WIDTH - 12, y: Math.max(20, this.y - 8)};
    }

    getSortY() {
        return this.y;
    }

    drawShadow() {
        if (this.isActive()) {
            drawShadow(this.x, this.y, 20);
        }
    }

    draw() {
        if (!this.isActive()) {
            return;
        }
        const frame = Math.floor(this.ticks / 6) % 4;
        MDog.Draw.image(HORSE_IMAGE, Math.round(this.x - HORSE_WIDTH / 2), Math.round(this.y - HORSE_HEIGHT - this.z), {
            width: HORSE_WIDTH, offsetX: HORSE_WIDTH * frame, flipX: this.dir < 0,
        });
    }

    drawHitboxes() {
        if (this.isActive()) {
            drawBox(this.getBox(), "#ff8800");
        }
    }
}

// Something dropped out of the sky on someone: a catapult rock, or a fireball on the volcano. A target on the
// ground shows where, and grows with its shadow as it comes down.
class SkyRock {
    constructor(x, y, style) {
        this.x = x;
        this.y = y;
        this.style = style;
        this.ticks = 0;
        this.firedNow = false;
        sound.incoming();
    }

    getProgress() {
        return this.ticks / SKY_FALL_TICKS;
    }

    update() {
        this.ticks++;
        this.firedNow = false;
        if (this.style === "fireball" && this.getProgress() > 0.4 && this.ticks % 2 === 0) {
            particles.embers(this.x, this.y - this.getHeight(), 1);
        }
        if (this.ticks === Math.round(SKY_FALL_TICKS)) {
            this.firedNow = true;
            disturbBears(this.x, this.y, SKY_RADIUS + BEAR_WAKE_BLAST, null);
            addShake(6);
            sound.impact();
            if (this.style === "fireball") {
                particles.embers(this.x, this.y, 18);
                particles.sparks(this.x, this.y - 2, 12, [255, 160, 60]);
                marks.scorch(this.x, this.y);
                sound.sizzle();
            } else {
                particles.debris(this.x, this.y, 20);
                marks.crater(this.x, this.y);
            }
            particles.dust(this.x, this.y, 8);
            for (const hole of holes) {
                hole.breakAround?.(this.x, this.y, 12);
            }
            // Close calls for anyone just outside it
            for (const knight of knights) {
                const distance = dhypot(knight.getGroundX() - this.x, knight.getGroundY() - this.y);
                if (distance >= SKY_RADIUS && distance < SKY_RADIUS + 8) {
                    closeCall(knight);
                }
            }
        }
    }

    getHeight() {
        return (1 - this.getProgress()) * 150;
    }

    reaches(knight) {
        return this.firedNow && dhypot(knight.getGroundX() - this.x, knight.getGroundY() - this.y) < SKY_RADIUS;
    }

    isDone() {
        return this.ticks > SKY_FALL_TICKS + 2;
    }

    // The target and the shadow, on the ground
    drawGround() {
        const progress = this.getProgress();
        const on = Math.floor(this.ticks / (progress > 0.7 ? 4 : 10)) % 2 === 0;
        drawRing(this.x, this.y, SKY_RADIUS, on ? "rgba(255, 90, 60, 0.9)" : "rgba(255, 200, 80, 0.6)");
        drawOval(this.x, this.y, 2 + progress * 7, 1 + progress * 3, SHADOW_COLOR);
    }

    // The rock itself, coming down
    drawSky() {
        if (this.getProgress() < 0.35) {
            return;
        }
        const x = Math.round(this.x);
        const y = Math.round(this.y - this.getHeight());
        if (this.style === "fireball") {
            drawOval(x, y - 4, 5, 5, "#e05a1e");
            drawOval(x, y - 4, 3, 3, "#ffc040");
            MDog.Draw.rectangleFill(x - 1, y - 5, 2, 2, "#fff4c0");
        } else {
            MDog.Draw.image(BOULDER_IMAGE, x - BOULDER_SIZE / 2, y - BOULDER_SIZE, {width: BOULDER_SIZE});
        }
    }
}

// ---------- Arena features ----------
// The things that only some arenas have (walls, graves, barrels...) and the hazards that turn up during a round
// (chickens, dragons, explosions...). They all live in the features list, and can do any of these:
//   update()                       every tick
//   done                           true once it should be removed
//   getSolids()                    boxes that block walking, swords, thrown swords and bullets
//   getSortY(), draw(), drawShadow(), drawHitboxes()   drawn in front of or behind things, like a knight
//   drawGround(), drawSky()        drawn flat on the ground under everything, or over everything
//   danger(knight)                 what would knock this knight down: {cause, push, source}, or null
//   onSword(knight, swordBox)      a sword swing touching it (like waking a bear)
//   onBullet(bullet)               a bullet touching it. Returns true if it stopped the bullet.
//   onBoulder(boulder)             a boulder touching it
//   harms(box)                     whether it would hurt a chicken there

let features = [];

function getBounds() {
    return arena.bounds ?? {left: 0, top: 0, right: SCREEN_WIDTH, bottom: SCREEN_HEIGHT};
}

// How far the ship's deck is tipped, from -1 to 1
function getTilt() {
    return arena.tilt ? dsin(gameTime / TILT_PERIOD) : 0;
}

function getFeatureSolids() {
    return features.flatMap(feature => feature.getSolids?.() ?? []);
}

// A wall drawn in the field image, that just blocks things
class Wall {
    constructor([left, top, right, bottom]) {
        this.box = {left, top, right, bottom};
    }

    getBox() {
        return this.box;
    }

    getSolids() {
        return [this];
    }

    onBoulder(boulder) {
        if (boxesOverlap(boulder.getBox(), this.box)) {
            boulder.smash();
        }
    }

    drawHitboxes() {
        drawBox(this.box, "#00ffff");
    }
}

// Something solid with a sprite, like a tombstone or a mast
class Prop {
    constructor(x, y, image, box, bottom, shadowWidth) {
        this.x = x;
        this.y = y;
        this.image = image;
        this.box = box;
        this.bottom = bottom;
        this.shadowWidth = shadowWidth;
    }

    getBox() {
        return boxAt(this.box, this.x, this.y);
    }

    getSolids() {
        return [this];
    }

    onBoulder(boulder) {
        if (boxesOverlap(boulder.getBox(), this.getBox())) {
            boulder.smash();
        }
    }

    getSortY() {
        return this.y + this.bottom;
    }

    drawShadow() {
        const box = this.getBox();
        drawShadow((box.left + box.right) / 2, this.y + this.bottom, this.shadowWidth);
    }

    draw() {
        MDog.Draw.image(this.image, this.x, this.y);
    }

    drawHitboxes() {
        drawBox(this.getBox(), "#00ffff");
    }
}

// ----- The bridge -----

// The canyon, with planks across it. Everything that isn't a cliff or an unbroken plank is a long way down. It acts
// like a hole, so knights, boulders, chickens and swords fall into it.
class Canyon {
    constructor(cliffs, bridges) {
        this.cliffs = cliffs.map(([left, top, right, bottom]) => ({left, top, right, bottom}));
        this.bridges = bridges.map(([left, top, right, bottom]) => ({left, top, right, bottom}));
        this.style = "dirt";
        this.cracked = false;
        this.planks = [];
        for (const bridge of this.bridges) {
            const across = bridge.right - bridge.left >= bridge.bottom - bridge.top;
            const start = across ? bridge.left : bridge.top;
            const end = across ? bridge.right : bridge.bottom;
            for (let at = start; at < end; at += PLANK_SIZE) {
                const box = across
                    ? {left: at, right: Math.min(at + PLANK_SIZE, end), top: bridge.top, bottom: bridge.bottom}
                    : {left: bridge.left, right: bridge.right, top: at, bottom: Math.min(at + PLANK_SIZE, end)};
                this.planks.push({box, across, strength: PLANK_STRENGTH, broken: false, shade: rng() < 0.5});
            }
        }
    }

    isSupported(x, y) {
        const inside = box => x >= box.left && x < box.right && y >= box.top && y < box.bottom;
        return this.cliffs.some(inside) || this.planks.some(plank => !plank.broken && inside(plank.box));
    }

    contains(x, y) {
        return !this.isSupported(x, y);
    }

    isNear(x, y, margin) {
        return [[x, y], [x - margin, y], [x + margin, y], [x, y - margin], [x, y + margin]].some(([px, py]) => !this.isSupported(px, py));
    }

    // Where a knight who falls in goes: straight down where he was
    getFallSpot(x, y) {
        return {x, y};
    }

    plankAt(x, y) {
        return this.planks.find(plank => !plank.broken && x >= plank.box.left && x < plank.box.right && y >= plank.box.top && y < plank.box.bottom);
    }

    // Weight on a plank wears it out
    weigh(x, y, amount) {
        const plank = this.plankAt(x, y);
        if (plank === undefined) {
            return;
        }
        const before = plank.strength;
        plank.strength -= amount;
        if (before > PLANK_STRENGTH / 2 && plank.strength <= PLANK_STRENGTH / 2) {
            sound.creak();
        }
        if (plank.strength <= 0) {
            this.breakPlank(plank);
        }
    }

    breakPlank(plank) {
        plank.broken = true;
        const center = boxCenter(plank.box);
        particles.debris(center.x, center.y, 6, [[150, 102, 58], [96, 62, 34]]);
        sound.crack();
    }

    // Catapult rocks, explosions and fire break the planks around them
    breakAround(x, y, radius) {
        for (const plank of this.planks) {
            const center = boxCenter(plank.box);
            if (!plank.broken && dhypot(center.x - x, center.y - y) < radius) {
                this.breakPlank(plank);
            }
        }
    }

    burn(x, y) {
        this.weigh(x, y, 3);
    }

    update() {
        for (const knight of knights) {
            if (!knight.dead) {
                this.weigh(knight.getGroundX(), knight.getGroundY(), knight.scale);
            }
        }
        for (const boulder of boulders) {
            const center = boxCenter(boulder.getBox());
            this.weigh(center.x, center.y, 8);
        }
    }

    draw() {
        for (const plank of this.planks) {
            if (plank.broken) {
                continue;
            }
            const box = plank.box;
            const wobble = plank.strength < PLANK_STRENGTH / 4 && Math.floor(gameTime / 4) % 2 === 0 ? 1 : 0;
            const width = box.right - box.left;
            const height = box.bottom - box.top;
            MDog.Draw.rectangleFill(box.left, box.top + wobble, width, height, plank.shade ? "#96663a" : "#a8743f");
            // The gap between planks
            if (plank.across) {
                MDog.Draw.rectangleFill(box.right - 1, box.top + wobble, 1, height, "#5c3a1c");
            } else {
                MDog.Draw.rectangleFill(box.left, box.bottom - 1 + wobble, width, 1, "#5c3a1c");
            }
            if (plank.strength < PLANK_STRENGTH * 0.6) {
                // Cracked
                const center = boxCenter(box);
                MDog.Draw.rectangleFill(Math.round(center.x) - 1, box.top + 2 + wobble, 1, Math.max(1, height - 4), "#3c2410");
            }
        }
        // Ropes along the sides of each bridge, with posts
        for (const bridge of this.bridges) {
            const across = bridge.right - bridge.left >= bridge.bottom - bridge.top;
            if (across) {
                MDog.Draw.rectangleFill(bridge.left, bridge.top, bridge.right - bridge.left, 1, "#d8b878");
                MDog.Draw.rectangleFill(bridge.left, bridge.bottom - 1, bridge.right - bridge.left, 1, "#d8b878");
                for (let x = bridge.left; x < bridge.right; x += 24) {
                    MDog.Draw.rectangleFill(x, bridge.top - 1, 2, 2, "#5c3a1c");
                    MDog.Draw.rectangleFill(x, bridge.bottom - 1, 2, 2, "#5c3a1c");
                }
            } else {
                MDog.Draw.rectangleFill(bridge.left, bridge.top, 1, bridge.bottom - bridge.top, "#d8b878");
                MDog.Draw.rectangleFill(bridge.right - 1, bridge.top, 1, bridge.bottom - bridge.top, "#d8b878");
            }
        }
    }
}

// ----- Sumo -----

// The water around the sumo platform. Like the canyon, falling in is how you lose.
class Platform {
    constructor({x, y, rx, ry}) {
        this.x = x;
        this.y = y;
        this.rx = rx;
        this.ry = ry;
        this.style = "ice";
        this.cracked = false;
    }

    contains(x, y) {
        const dx = (x - this.x) / this.rx;
        const dy = (y - this.y) / this.ry;
        return dx * dx + dy * dy > 1;
    }

    isNear(x, y, margin) {
        const dx = (x - this.x) / (this.rx - margin);
        const dy = (y - this.y) / (this.ry - margin);
        return dx * dx + dy * dy > 1;
    }

    getFallSpot(x, y) {
        return {x, y};
    }

    update() {}

    draw() {}
}

// ----- The graveyard -----

// A grave a hand reaches out of when someone walks by, and grabs their ankle
class Grave {
    constructor(x, y) {
        this.x = x; // the middle of the mound
        this.y = y;
        this.state = "hidden"; // hidden, rising, holding, sinking
        this.ticks = 0;
        this.cooldown = 0;
        this.target = null;
        this.tombstone = new Prop(x - 5, y - 16, TOMBSTONE_IMAGE, [1, 8, 9, 13], 13, 10);
    }

    getSolids() {
        return [this.tombstone];
    }

    update() {
        this.ticks++;
        if (this.cooldown > 0) {
            this.cooldown--;
        }
        if (this.state === "hidden") {
            const victim = knights.find(knight => !knight.dead && dhypot(knight.getGroundX() - this.x, knight.getGroundY() - this.y) < 11);
            if (victim !== undefined && this.cooldown === 0 && phase === "playing") {
                this.state = "rising";
                this.ticks = 0;
                this.target = victim;
                particles.dust(this.x, this.y, 5);
                sound.grab();
            }
        } else if (this.state === "rising" && this.ticks >= HAND_RISE_TICKS) {
            const target = this.target;
            if (!target.dead && dhypot(target.getGroundX() - this.x, target.getGroundY() - this.y) < 15) {
                target.grab();
                this.state = "holding";
            } else {
                this.state = "sinking";
            }
            this.ticks = 0;
        } else if (this.state === "holding" && (this.target.grabTicks <= 0 || this.target.dead)) {
            this.state = "sinking";
            this.ticks = 0;
        } else if (this.state === "sinking" && this.ticks >= 20) {
            this.state = "hidden";
            this.cooldown = GRAVE_COOLDOWN_TICKS;
        }
    }

    getSortY() {
        return this.y;
    }

    drawShadow() {
        this.tombstone.drawShadow();
    }

    draw() {
        this.tombstone.draw();
        let height = 0;
        if (this.state === "rising") {
            height = Math.min(7, Math.round(7 * this.ticks / HAND_RISE_TICKS));
        } else if (this.state === "holding") {
            height = 7;
        } else if (this.state === "sinking") {
            height = Math.max(0, 7 - Math.round(this.ticks / 3));
        }
        if (height > 0) {
            drawHand(this.x, this.y, height);
        }
        // A bony hand around his ankle while it's got him
        if (this.state === "holding") {
            drawHand(this.target.getGroundX(), this.target.getGroundY() + 1, 3);
        }
    }

    drawHitboxes() {
        this.tombstone.drawHitboxes();
    }
}

// A zombie hand reaching up out of the ground, this many pixels tall
function drawHand(x, y, height) {
    x = Math.round(x);
    y = Math.round(y);
    const skin = "#9cbf88";
    MDog.Draw.rectangleFill(x - 1, y - height, 3, height, skin);
    // Fingers
    if (height > 3) {
        MDog.Draw.rectangleFill(x - 2, y - height - 2, 1, 3, skin);
        MDog.Draw.rectangleFill(x, y - height - 3, 1, 3, skin);
        MDog.Draw.rectangleFill(x + 2, y - height - 2, 1, 3, skin);
    }
    MDog.Draw.rectangleFill(x - 2, y, 5, 1, "#5a3a20");
}

// Fog drifting slowly across the graveyard
function drawFog() {
    for (let i = 0; i < 5; i++) {
        const x = ((liveTicks * 0.08 * (1 + i * 0.3) + i * 70) % (SCREEN_WIDTH + 80)) - 40;
        const y = 30 + i * 30;
        drawOval(x, y, 34, 7, "rgba(220, 220, 240, 0.08)");
        drawOval(x + 10, y + 2, 22, 4, "rgba(220, 220, 240, 0.06)");
    }
}

// ----- The ship -----

// The sea past the rails. Its edge slopes as the ship tips, which is what shows the tilt.
function drawSea() {
    const tilt = getTilt();
    for (let x = 0; x < SCREEN_WIDTH; x += 4) {
        const slope = tilt * (x - SCREEN_WIDTH / 2) / 18;
        const top = Math.round(10 + slope);
        const bottom = Math.round(170 - slope);
        MDog.Draw.rectangleFill(x, 0, 4, Math.max(0, top), "#2e5c96");
        MDog.Draw.rectangleFill(x, Math.max(0, top - 1), 4, 1, "#e8f0f8");
        MDog.Draw.rectangleFill(x, bottom, 4, SCREEN_HEIGHT - bottom, "#2e5c96");
        MDog.Draw.rectangleFill(x, bottom, 4, 1, "#e8f0f8");
        if ((x / 4 + Math.floor(liveTicks / 20)) % 7 === 0) {
            MDog.Draw.rectangleFill(x, Math.max(1, top - 5), 3, 1, "rgba(200, 225, 255, 0.6)");
            MDog.Draw.rectangleFill(x + 1, Math.min(SCREEN_HEIGHT - 2, bottom + 5), 3, 1, "rgba(200, 225, 255, 0.6)");
        }
    }
}

// ----- The showdown's barrels -----

class Barrel {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.fuse = 0; // set off by another barrel going up, after a moment
        this.owner = null;
        this.done = false;
    }

    getBox() {
        return boxAt([1, 6, 9, 13], this.x, this.y);
    }

    // The whole barrel, for bullets
    getHitBox() {
        return boxAt([0, 0, 10, 13], this.x, this.y);
    }

    getCenter() {
        return {x: this.x + 5, y: this.y + 12};
    }

    getSolids() {
        return [this];
    }

    explode(by) {
        if (this.done) {
            return;
        }
        this.done = true;
        const center = this.getCenter();
        features.push(new Explosion(center.x, center.y, by));
    }

    light(by, delay) {
        if (this.fuse === 0 && !this.done) {
            this.fuse = delay;
            this.owner = by;
        }
    }

    update() {
        if (this.fuse > 0) {
            this.fuse--;
            if (this.fuse === 0) {
                this.explode(this.owner);
            }
        }
    }

    onBullet(bullet) {
        if (boxesOverlap(bullet.getBox(), this.getHitBox())) {
            this.explode(bullet.owner);
            return true;
        }
        return false;
    }

    onSword(knight, swordBox) {
        if (boxesOverlap(swordBox, this.getHitBox())) {
            this.explode(knight);
        }
    }

    onBoulder(boulder) {
        if (boxesOverlap(boulder.getBox(), this.getHitBox())) {
            this.explode(boulder.deflectedBy ?? boulder.owner);
            boulder.smash();
        }
    }

    getSortY() {
        return this.y + 13;
    }

    drawShadow() {
        drawShadow(this.x + 5, this.y + 13, 10);
    }

    draw() {
        MDog.Draw.image(BARREL_IMAGE, this.x, this.y);
        // Shaking when it's about to go off
        if (this.fuse > 0) {
            MDog.Draw.image(BARREL_IMAGE, this.x + (this.fuse % 2 ? 1 : -1), this.y, {tint: "rgba(255, 220, 120, 0.5)"});
        }
    }

    drawHitboxes() {
        drawBox(this.getHitBox(), "#ff00ff");
    }
}

class Explosion {
    constructor(x, y, owner) {
        this.x = x;
        this.y = y;
        this.owner = owner;
        this.ticks = 0;
        this.firedNow = true; // it hurts on the tick it goes off
        this.done = false;
        disturbBears(x, y, EXPLOSION_RADIUS + BEAR_WAKE_BLAST, owner);

        addShake(10);
        flash = FLASH_TICKS;
        sound.explosion();
        particles.embers(x, y, 30);
        particles.sparks(x, y - 4, 30, [255, 170, 60]);
        particles.debris(x, y, 26, [[60, 40, 30], [190, 46, 36], [40, 30, 26]]);
        particles.dust(x, y, 20);
        marks.scorch(x, y);
        marks.scorch(x + 6, y + 2);
        marks.crater(x, y);

        // Breaks everything nearby, and sets off other barrels
        const near = box => {
            const center = boxCenter(box);
            return dhypot(center.x - x, center.y - y) < EXPLOSION_RADIUS;
        };
        for (const crate of crates) {
            if (!crate.isBroken() && near(crate.getBox())) {
                crate.smash();
            }
        }
        for (const rock of rocks) {
            if (near(rock.getBox())) {
                rock.smash();
            }
        }
        for (const boulder of boulders) {
            if (near(boulder.getBox())) {
                boulder.smash();
            }
        }
        for (const feature of features) {
            if (feature instanceof Barrel && !feature.done && near(feature.getHitBox())) {
                feature.light(owner, BARREL_CHAIN_TICKS);
            }
        }
        for (const hole of holes) {
            hole.breakAround?.(x, y, EXPLOSION_RADIUS * 0.6);
        }
    }

    update() {
        this.firedNow = false;
        this.ticks++;
        if (this.ticks > 30) {
            this.done = true;
        }
    }

    reaches(point) {
        return dhypot(point.x - this.x, point.y - this.y) < EXPLOSION_RADIUS;
    }

    danger(knight) {
        if (!this.firedNow || !this.reaches({x: knight.getGroundX(), y: knight.getGroundY()})) {
            return null;
        }
        const awayX = knight.getGroundX() - this.x;
        const awayY = knight.getGroundY() - this.y;
        const length = dhypot(awayX, awayY) || 1;
        return {cause: "explosion", push: {x: awayX / length, y: awayY / length}, source: this};
    }

    harms(box) {
        return this.firedNow && this.reaches(boxCenter(box));
    }

    // A fireball that swells up fast and fades
    drawSky() {
        const grow = Math.min(1, this.ticks / 5);
        const fade = Math.max(0, 1 - this.ticks / 30);
        const radius = EXPLOSION_RADIUS * (0.4 + 0.6 * grow);
        drawOval(this.x, this.y - 6, radius, radius * 0.75, `rgba(255, 120, 40, ${0.55 * fade})`);
        drawOval(this.x, this.y - 8, radius * 0.6, radius * 0.45, `rgba(255, 210, 90, ${0.7 * fade})`);
        drawOval(this.x, this.y - 9, radius * 0.25, radius * 0.2, `rgba(255, 255, 230, ${0.9 * fade})`);
    }
}

// ----- Finding the way -----

// The way from one spot to another round rocks, trees, water and holes, worked out on a grid of squares over the
// field (a breadth-first search, going diagonally only past open corners). feet is the size of whatever's going
// (half its width, and its height). Returns the middles of the squares to walk through, the first one next, or null
// if there's no way there at all.
function findPath(from, to, feet) {
    const columns = Math.ceil(SCREEN_WIDTH / PATH_CELL);
    const rows = Math.ceil(SCREEN_HEIGHT / PATH_CELL);
    const solids = getSolids();
    const bounds = getBounds();
    const cellOf = (x, y) => ({column: Math.max(0, Math.min(columns - 1, Math.floor(x / PATH_CELL))), row: Math.max(0, Math.min(rows - 1, Math.floor(y / PATH_CELL)))});
    const start = cellOf(from.x, from.y);
    const goal = cellOf(to.x, to.y);
    const goalIndex = goal.row * columns + goal.column;

    // Which squares it can stand in the middle of, with a pixel to spare all round (so the way never runs exactly
    // along an edge, where it could get caught on it), worked out as they're needed
    const open = new Int8Array(columns * rows).fill(-1);
    const isOpen = index => {
        if (index === goalIndex) {
            return true;
        }
        if (open[index] === -1) {
            const x = (index % columns + 0.5) * PATH_CELL;
            const y = (Math.floor(index / columns) + 0.5) * PATH_CELL;
            const box = {left: x - feet.halfWidth - 1, right: x + feet.halfWidth + 1, top: y - feet.height - 1, bottom: y + 1};
            const inside = box.left >= bounds.left && box.right <= bounds.right && box.top >= bounds.top && box.bottom <= bounds.bottom;
            // Safe ground all over it, not just in the middle (so it doesn't hang over the edge of a bridge, say)
            const safe = [[x, y], [box.left, box.top], [box.right, box.top], [box.left, box.bottom], [box.right, box.bottom]]
                .every(([px, py]) => !isUnsafeGround(px, py, true));
            open[index] = inside && safe && !solids.some(solid => boxesOverlap(box, solid.getBox())) ? 1 : 0;
        }
        return open[index] === 1;
    };

    const cameFrom = new Int32Array(columns * rows).fill(-1);
    const startIndex = start.row * columns + start.column;
    cameFrom[startIndex] = startIndex;
    const queue = [startIndex];
    for (let head = 0; head < queue.length; head++) {
        const index = queue[head];
        if (index === goalIndex) {
            // Back from the goal to the start, then turned round
            const path = [];
            for (let at = goalIndex; at !== startIndex; at = cameFrom[at]) {
                path.push({x: (at % columns + 0.5) * PATH_CELL, y: (Math.floor(at / columns) + 0.5) * PATH_CELL});
            }
            return path.reverse();
        }
        const column = index % columns;
        const row = Math.floor(index / columns);
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            const c = column + dc;
            const r = row + dr;
            if (c < 0 || c >= columns || r < 0 || r >= rows) {
                continue;
            }
            const next = r * columns + c;
            if (cameFrom[next] !== -1 || !isOpen(next)) {
                continue;
            }
            // No cutting corners
            if (dc !== 0 && dr !== 0 && (!isOpen(row * columns + c) || !isOpen(r * columns + column))) {
                continue;
            }
            cameFrom[next] = index;
            queue.push(next);
        }
    }
    return null;
}

// ----- Chickens -----

// Angry chickens show up when nobody's been hit for a while, and chase whoever's closest. A peck stuns.
class Chicken {
    constructor(x, y) {
        this.x = x; // its feet
        this.y = y;
        this.ticks = Math.floor(random(0, 100));
        this.peckCooldown = 0;
        this.flip = false;
        this.done = false;
        this.path = null; // the squares it's walking through to get to whoever it's chasing
        this.pathTicks = 0;
    }

    getBox() {
        return {left: this.x - 4, right: this.x + 4, top: this.y - 8, bottom: this.y};
    }

    getFeet() {
        return {left: this.x - 2, right: this.x + 2, top: this.y - 2, bottom: this.y};
    }

    update() {
        this.ticks++;
        if (this.peckCooldown > 0) {
            this.peckCooldown--;
        }

        const target = knights
            .filter(knight => !knight.dead)
            .sort((a, b) => dhypot(a.getGroundX() - this.x, a.getGroundY() - this.y) - dhypot(b.getGroundX() - this.x, b.getGroundY() - this.y))[0];
        if (target !== undefined && phase === "playing") {
            const dx = target.getGroundX() - this.x;
            const dy = target.getGroundY() - this.y;
            const length = dhypot(dx, dy) || 1;
            // Finds its way round anything in the way (every so often, since whoever it's chasing keeps moving)
            this.pathTicks--;
            if (this.pathTicks <= 0) {
                this.path = findPath({x: this.x, y: this.y}, {x: target.getGroundX(), y: target.getGroundY()}, {halfWidth: 3, height: 3});
                // With no way there at all (he's across the water, say), it looks again less often, since that's the
                // slowest search
                this.pathTicks = this.path === null ? CHICKEN_REPATH_TICKS * 5 : CHICKEN_REPATH_TICKS;
            }
            // Heads for the next square on the way, or straight at him once he's close (or there's no way round)
            while (this.path !== null && this.path.length > 1 && dhypot(this.path[0].x - this.x, this.path[0].y - this.y) < 1.5) {
                this.path.shift();
            }
            const close = length < PATH_CELL * 2;
            const goal = this.path !== null && this.path.length > 0 && !close ? this.path[0] : {x: target.getGroundX(), y: target.getGroundY()};
            const gx = goal.x - this.x;
            const gy = goal.y - this.y;
            const goalLength = dhypot(gx, gy) || 1;
            if (length > 3) {
                this.flip = dx < 0;
                const step = Math.min(CHICKEN_SPEED, goalLength);
                this.move(gx / goalLength * step, 0);
                this.move(0, gy / goalLength * step);
            }
            // Peck!
            if (this.peckCooldown === 0 && boxesOverlap(this.getBox(), target.getBodyBox()) && !target.isInvulnerable()) {
                target.peck(dx / length, dy / length);
                this.peckCooldown = PECK_COOLDOWN_TICKS;
            }
        }
        // The tipped deck slides it about (but not into the masts, or off the deck)
        this.move(getTilt() * TILT_PUSH * 4, 0);
        if (this.ticks % 140 === 0) {
            sound.cluck();
        }

        // Falls into holes, the water, the canyon...
        if (holes.some(hole => hole.contains(this.x, this.y)) || isInWater(this.x, this.y)) {
            this.die();
        }
        // ...and gets hit by everything else too
        const body = this.getBox();
        if (boulders.some(boulder => boxesOverlap(boulder.getBox(), body))
            || horses.some(horse => horse.canHitBox(body))
            || [...strikes, ...skyRocks].some(blast => blast.firedNow && dhypot(blast.x - this.x, blast.y - this.y) < 14)
            || features.some(feature => feature !== this && feature.harms?.(body))) {
            this.die();
        }
    }

    // Moves unless something's in the way, it'd go off the field, or it'd walk into water, lava or a hole. (Anything
    // it's somehow already in doesn't count, and it can always head back onto the field, so it can never get stuck.)
    move(dx, dy) {
        const feet = this.getFeet();
        const moved = {left: feet.left + dx, right: feet.right + dx, top: feet.top + dy, bottom: feet.bottom + dy};
        const bounds = getBounds();
        const offField = box => Math.max(0, bounds.left - box.left) + Math.max(0, box.right - bounds.right) + Math.max(0, bounds.top - box.top) + Math.max(0, box.bottom - bounds.bottom);
        const intoDanger = isUnsafeGround(this.x + dx, this.y + dy, true) && !isUnsafeGround(this.x, this.y, true);
        if (offField(moved) <= offField(feet) && !intoDanger && !getSolids().some(solid => boxesOverlap(moved, solid.getBox()) && !boxesOverlap(feet, solid.getBox()))) {
            this.x += dx;
            this.y += dy;
        }
    }

    die() {
        if (this.done) {
            return;
        }
        this.done = true;
        particles.feathers(this.x, this.y, [245, 245, 240], 14);
        particles.dust(this.x, this.y, 4);
        popup("BAWK!", this.x, this.y - 14, "#ffffff");
        sound.bawk();
    }

    onSword(knight, swordBox) {
        if (boxesOverlap(swordBox, this.getBox())) {
            this.die();
        }
    }

    onBullet(bullet) {
        if (boxesOverlap(bullet.getBox(), this.getBox())) {
            this.die();
            return true;
        }
        return false;
    }

    getSortY() {
        return this.y;
    }

    drawShadow() {
        drawShadow(this.x, this.y, 6);
    }

    draw() {
        const frame = Math.floor(this.ticks / 6) % 2;
        MDog.Draw.image(CHICKEN_IMAGE, Math.round(this.x - 5), Math.round(this.y - 10), {width: 10, offsetX: 10 * frame, flipX: this.flip});
    }

    drawHitboxes() {
        drawBox(this.getBox(), "#ff8800");
    }
}

// ----- The dragon -----

// A dragon flies over: only its shadow is seen, and a line of fire follows behind it
class Dragon {
    constructor() {
        const bounds = getBounds();
        this.dir = rng() < 0.5 ? 1 : -1;
        this.y = random(Math.max(36, bounds.top + 20), bounds.bottom - 10);
        this.x = this.dir > 0 ? -50 : SCREEN_WIDTH + 50;
        this.ticks = 0;
        this.path = []; // where it's been, for the fire to follow
        this.travelled = 0;
        this.done = false;
        sound.dragon();
    }

    update() {
        this.ticks++;
        this.x += this.dir * DRAGON_SPEED;
        this.travelled += DRAGON_SPEED;
        const bounds = getBounds();
        if (this.travelled >= 5) {
            this.travelled = 0;
            if (this.x > bounds.left && this.x < bounds.right) {
                this.path.push({x: this.x, y: this.y + random(-3, 3), ticks: this.ticks});
            }
        }
        for (const spot of this.path) {
            if (!spot.lit && this.ticks - spot.ticks >= DRAGON_FIRE_DELAY_TICKS) {
                spot.lit = true;
                features.push(new FirePatch(spot.x, spot.y));
                if (rng() < 0.15) {
                    sound.flames();
                }
            }
        }
        if (Math.abs(this.x - SCREEN_WIDTH / 2) > SCREEN_WIDTH / 2 + 60 && this.ticks > 60 && this.path.every(spot => spot.lit)) {
            this.done = true;
        }
    }

    // A big shadow with flapping wings
    drawGround() {
        const flap = dsin(this.ticks / 6);
        const color = "rgba(0, 0, 0, 0.32)";
        drawOval(this.x, this.y, 13, 4, color);
        drawOval(this.x - this.dir * 14, this.y + 1, 6, 2, color); // tail
        drawOval(this.x + 4 * this.dir, this.y - 6 - flap * 3, 9, 3 + flap * 1.5, color);
        drawOval(this.x + 4 * this.dir, this.y + 6 + flap * 3, 9, 3 + flap * 1.5, color);
    }
}

class FirePatch {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.ticks = 0;
        this.done = false;
        marks.scorch(x, y);
    }

    update() {
        this.ticks++;
        if (this.ticks % 5 === 0) {
            particles.embers(this.x, this.y, 1);
        }
        for (const hole of holes) {
            hole.burn?.(this.x, this.y);
        }
        if (this.ticks > DRAGON_FIRE_TICKS) {
            this.done = true;
        }
    }

    reaches(x, y) {
        return dhypot(x - this.x, (y - this.y) * 1.5) < DRAGON_FIRE_RADIUS;
    }

    danger(knight) {
        return this.reaches(knight.getGroundX(), knight.getGroundY()) ? {cause: "fire", push: {x: 0, y: -1}, source: this} : null;
    }

    harms(box) {
        const center = boxCenter(box);
        return this.reaches(center.x, box.bottom);
    }

    getSortY() {
        return this.y;
    }

    draw() {
        // Flickering flames, dying down at the end
        const size = this.ticks > DRAGON_FIRE_TICKS - 30 ? (DRAGON_FIRE_TICKS - this.ticks) / 30 : Math.min(1, this.ticks / 8);
        const flicker = dsin(this.ticks / 3 + this.x) * 1.5;
        drawOval(this.x, this.y, 6 * size, 2.5 * size, "rgba(220, 70, 20, 0.85)");
        drawOval(this.x, this.y - 3 - flicker, 4 * size, 4 * size, "rgba(250, 140, 40, 0.85)");
        drawOval(this.x, this.y - 5 - flicker, 2 * size, 3 * size, "rgba(255, 230, 120, 0.9)");
    }

    drawShadow() {}

    drawHitboxes() {
        drawRing(this.x, this.y, DRAGON_FIRE_RADIUS, "#ff8800");
    }
}

// ----- The volcano -----

// A dragon every so often, on the volcano
class DragonSpawner {
    constructor() {
        this.wait = random(DRAGON_MIN_WAIT_TICKS, DRAGON_MAX_WAIT_TICKS) * 0.5;
    }

    update() {
        if (phase !== "playing") {
            return;
        }
        this.wait--;
        if (this.wait <= 0) {
            this.wait = random(DRAGON_MIN_WAIT_TICKS, DRAGON_MAX_WAIT_TICKS);
            features.push(new Dragon());
        }
    }
}

// The volcano's fissures box the knights in. Each one cuts off part of the field that neither knight is in (well away
// from both of them), and stays open for the rest of the round, so the field gets smaller and smaller. If the knights
// end up on different sides of one anyway (one crossed over while it was cracking, say), it doesn't stay: it closes
// up again after a while, like any crack.
function getPlayArea() {
    const bounds = getBounds();
    const area = {left: bounds.left, right: bounds.right, top: Math.max(bounds.top, 20), bottom: bounds.bottom};
    for (const hole of holes) {
        if (hole instanceof Fissure && hole.permanent && hole.keepSide !== null) {
            const [low, high] = hole.getExtent();
            if (hole.axis === "y") {
                if (hole.keepSide > 0) area.left = Math.max(area.left, high);
                else area.right = Math.min(area.right, low);
            } else {
                if (hole.keepSide > 0) area.top = Math.max(area.top, high);
                else area.bottom = Math.min(area.bottom, low);
            }
        }
    }
    return area;
}

// Plans the next fissure: across the part of the field that's left, beyond both knights (so they're on the same side,
// well clear of it), and leaving them enough room. Null if there's nowhere it can go.
function planFissure() {
    const alive = knights.filter(knight => !knight.dead);
    if (alive.length === 0) {
        return null;
    }
    const area = getPlayArea();
    for (let tries = 0; tries < 30; tries++) {
        const axis = rng() < 0.5 ? "y" : "x";
        const vertical = axis === "y";
        const spots = alive.map(knight => vertical ? knight.getGroundX() : knight.getGroundY());
        const low = vertical ? area.left : area.top;
        const high = vertical ? area.right : area.bottom;
        // Cutting off the side before both knights (they're on its far side, 1), or after both (-1)
        const knightsSide = rng() < 0.5 ? 1 : -1;
        const from = knightsSide > 0 ? low + 10 : Math.max(...spots) + FISSURE_SAFE_DISTANCE;
        const to = knightsSide > 0 ? Math.min(...spots) - FISSURE_SAFE_DISTANCE : high - 10;
        if (to - from < 4) {
            continue;
        }
        const fissure = new Fissure(axis, random(from, to));
        const [cutLow, cutHigh] = fissure.getExtent();
        const room = knightsSide > 0 ? high - cutHigh : cutLow - low;
        const enoughRoom = room >= (vertical ? FISSURE_MIN_AREA_WIDTH : FISSURE_MIN_AREA_HEIGHT);
        const insideArea = cutLow >= low + 4 && cutHigh <= high - 4;
        const clearOfKnights = alive.every(knight => fissure.distanceFrom(knight.getGroundX(), knight.getGroundY()) >= FISSURE_SAFE_DISTANCE
            && fissure.sideOf(knight.getGroundX(), knight.getGroundY()) === knightsSide);
        if (enoughRoom && insideArea && clearOfKnights) {
            return fissure;
        }
    }
    return null;
}

// Starts the next fissure every so often: one at a time (not while one is still cracking or opening, or is one that
// is going to close again)
class FissureSpawner {
    constructor() {
        this.wait = FISSURE_FIRST_WAIT_TICKS;
    }

    update() {
        if (phase !== "playing") {
            return;
        }
        if (holes.some(hole => hole instanceof Fissure && (!hole.permanent || hole.state === "cracking" || hole.state === "opening"))) {
            return;
        }
        this.wait--;
        if (this.wait <= 0) {
            this.wait = random(FISSURE_MIN_WAIT_TICKS, FISSURE_MAX_WAIT_TICKS);
            const fissure = planFissure();
            if (fissure !== null) {
                holes.push(fissure);
                sound.rumble(true);
            }
        }
    }
}

// A crack right across the field, up and down or side to side. First it spreads across (glowing, as a warning, and
// harmless), then it splits open into a river of lava. If both knights are on the same side of it then, it stays open
// for the rest of the round; if not, it closes up again after a while. It's a hole while it's open: knights,
// boulders, chickens and dropped swords fall in.
class Fissure {
    // axis "y" runs up and down (its middle moves in x as it goes down), "x" side to side. middle is where it crosses
    // the field. Without them it goes anywhere near the middle.
    constructor(axis, middle) {
        const bounds = getBounds();
        this.axis = axis ?? (rng() < 0.5 ? "y" : "x");
        const vertical = this.axis === "y";
        // Where it runs from and to: a little past the edges of the field, so it cuts right across
        this.start = (vertical ? bounds.top : bounds.left) - 8;
        this.end = (vertical ? bounds.bottom : bounds.right) + 8;
        if (middle === undefined) {
            const low = vertical ? bounds.left : Math.max(bounds.top, 20);
            const high = vertical ? bounds.right : bounds.bottom;
            middle = low + (high - low) * random(0.3, 0.7);
        }
        const slope = random(-0.1, 0.1);
        const halfway = (this.start + this.end) / 2;
        // Its middle, every few pixels along it, wandering a little
        this.step = 6;
        this.points = [];
        for (let along = this.start; along <= this.end + this.step; along += this.step) {
            this.points.push(middle + (along - halfway) * slope + random(-3, 3));
        }
        this.style = "lava";
        this.cracked = false; // it's not one of the holes that cracked open and stay (see MAX_HOLES)
        this.state = "cracking";
        this.ticks = 0;
        this.width = 0;
        this.done = false;
        this.permanent = true; // stays open, unless the knights turn out to be on different sides of it
        this.keepSide = null; // the side the knights are on (1 or -1), once it's open
    }

    // How far across the field it reaches, both ways: [lowest, highest], counting its full width
    getExtent() {
        return [Math.min(...this.points) - FISSURE_WIDTH / 2, Math.max(...this.points) + FISSURE_WIDTH / 2];
    }

    // Which side of it a spot is on: 1 (right of it, or below it) or -1
    sideOf(x, y) {
        return this.axis === "y" ? (x > this.centerAt(y) ? 1 : -1) : (y > this.centerAt(x) ? 1 : -1);
    }

    // The side both knights still standing are on, or null if they're on different sides
    getKnightsSide() {
        const sides = new Set(knights.filter(knight => !knight.dead).map(knight => this.sideOf(knight.getGroundX(), knight.getGroundY())));
        if (sides.size === 0) {
            return this.keepSide ?? 1;
        }
        return sides.size === 1 ? [...sides][0] : null;
    }

    // Is this spot in a part of the field it has cut off (so nothing should be put there)?
    isCutOff(x, y) {
        return this.permanent && this.keepSide !== null && this.sideOf(x, y) !== this.keepSide;
    }

    // As it opens, whatever's lying in its way or in the part it cuts off (where nobody can get to it) is gone: power-ups
    // sink into the lava, and a sword lying there is lost (so a new one comes down for its owner, like one lost in
    // water)
    swallow() {
        const gone = (x, y) => this.distanceFrom(x, y) < FISSURE_WIDTH / 2 + 4 || this.isCutOff(x, y);
        for (const powerup of powerups) {
            if (gone(powerup.x, powerup.y)) {
                powerup.life = 0;
                particles.embers(powerup.x, powerup.y, 6);
            }
        }
        for (const sword of thrownSwords) {
            if (sword.state === "grounded" && gone(sword.x, sword.y)) {
                sword.state = "lost";
                particles.embers(sword.x, sword.y, 6);
                if (!sword.owner.dead && !sword.owner.hasSword) {
                    sword.owner.newSwordTicks = NEW_SWORD_TICKS;
                    popup("SWORD LOST!", sword.x, sword.y - 12, "#c8d4c0");
                }
            }
        }
    }

    // Where its middle is, this far along
    centerAt(along) {
        const position = (along - this.start) / this.step;
        const i = Math.max(0, Math.min(this.points.length - 2, Math.floor(position)));
        const t = Math.max(0, Math.min(1, position - i));
        return this.points[i] + (this.points[i + 1] - this.points[i]) * t;
    }

    // How far a spot is from its middle, across it
    distanceFrom(x, y) {
        return this.axis === "y" ? Math.abs(x - this.centerAt(y)) : Math.abs(y - this.centerAt(x));
    }

    contains(x, y) {
        // A little narrower than it looks, so only really being in it counts
        return this.width > 2 && this.distanceFrom(x, y) < this.width * 0.85 / 2;
    }

    isNear(x, y, margin) {
        return this.distanceFrom(x, y) < FISSURE_WIDTH / 2 + margin;
    }

    // A knight who falls in goes down where he is, in the middle of it
    getFallSpot(x, y) {
        return this.axis === "y" ? {x: this.centerAt(y), y} : {x, y: this.centerAt(x)};
    }

    update() {
        this.ticks++;
        if (this.state === "cracking") {
            if (this.ticks % 40 === 0) {
                sound.crack();
            }
            if (this.ticks >= FISSURE_CRACK_TICKS) {
                this.setState("opening");
                addShake(4);
                sound.sizzle();
                sound.crumble();
                // It only stays if both knights are on the same side of it
                const side = this.getKnightsSide();
                if (side === null) {
                    this.permanent = false;
                } else {
                    this.keepSide = side;
                }
                this.swallow();
            }
        } else if (this.state === "opening") {
            this.width = FISSURE_WIDTH * Math.min(1, this.ticks / FISSURE_OPENING_TICKS);
            if (this.ticks >= FISSURE_OPENING_TICKS) {
                this.setState("open");
            }
        } else if (this.state === "open") {
            if (this.permanent && this.getKnightsSide() === null) {
                // Somehow they have ended up on different sides of it (flung over by a tornado, say): it does not stay
                this.permanent = false;
                this.setState("open");
            } else if (!this.permanent && this.ticks >= FISSURE_OPEN_TICKS) {
                this.setState("closing");
                sound.crumble();
            }
        } else if (this.state === "closing") {
            this.width = FISSURE_WIDTH * Math.max(0, 1 - this.ticks / FISSURE_CLOSING_TICKS);
            if (this.ticks >= FISSURE_CLOSING_TICKS) {
                this.done = true;
            }
        }
        // Embers rising off the lava
        if (this.width > 2 && this.ticks % 6 === 0) {
            const along = random(this.start, this.end);
            const spot = this.getFallSpot(along, along);
            particles.embers(spot.x, spot.y, 1);
        }
    }

    setState(state) {
        this.state = state;
        this.ticks = 0;
    }

    // A strip one pixel across, from a to b across it, at along
    fillAcross(along, a, b, color) {
        const from = Math.round(a);
        const size = Math.round(b) - from;
        if (size <= 0) {
            return;
        }
        if (this.axis === "y") {
            MDog.Draw.rectangleFill(from, along, size, 1, color);
        } else {
            MDog.Draw.rectangleFill(along, from, 1, size, color);
        }
    }

    draw() {
        if (this.state === "cracking") {
            // The crack spreads from one end to the other, glowing brighter as it's about to open
            const progress = this.ticks / FISSURE_CRACK_TICKS;
            const reach = this.start + (this.end - this.start) * Math.min(1, progress / 0.6);
            const glow = progress > 0.6 && Math.floor(this.ticks / 6) % 2 === 0 ? 0.95 : 0.7;
            for (let along = this.start; along < reach; along++) {
                const center = this.centerAt(along);
                this.fillAcross(along, center - 1.5, center + 1.5, "rgba(40, 14, 8, 0.6)");
                this.fillAcross(along, center - 0.5, center + 0.5, `rgba(255, 120, 40, ${glow})`);
            }
            return;
        }
        const half = this.width / 2;
        for (let along = this.start; along < this.end; along++) {
            const center = this.centerAt(along);
            this.fillAcross(along, center - half - 1, center + half + 1, "#5a1a10");
            this.fillAcross(along, center - half, center + half, "#e05a1e");
            this.fillAcross(along, center - half * 0.45, center + half * 0.45, "#f8a030");
        }
    }
}

// ----- The bear -----

// Wakes any sleeping bear within reach of something that just happened here (by is whoever caused it, if anyone)
function disturbBears(x, y, reach, by) {
    for (const bear of features.filter(feature => feature instanceof Bear)) {
        if (dhypot(bear.x - x, bear.y - 6 - y) < reach) {
            bear.wake(by);
        }
    }
}

// A sleeping bear. Hit it and it wakes up angry, and charges at whoever's closest until it calms down.
class Bear {
    constructor(x, y) {
        this.x = x; // its feet
        this.y = y;
        this.state = "sleeping"; // sleeping, waking, aiming, charging, resting
        this.ticks = 0;
        this.angry = 0;
        this.dir = {x: 1, y: 0};
        this.owner = null; // whoever woke it
        this.sleepTicks = 0; // how long it's been asleep in this round
    }

    getBox() {
        return {left: this.x - 10, right: this.x + 10, top: this.y - 12, bottom: this.y};
    }

    getSolids() {
        // Only in the way while it's asleep
        return this.state === "sleeping" ? [{getBox: () => ({left: this.x - 9, right: this.x + 9, top: this.y - 6, bottom: this.y})}] : [];
    }

    wake(by) {
        if (this.state !== "sleeping") {
            return;
        }
        this.state = "waking";
        this.ticks = 0;
        this.sleepTicks = 0;
        this.angry = BEAR_ANGRY_TICKS;
        this.owner = by;
        popup("ROAR!", this.x, this.y - 20, "#ff8060");
        addShake(3);
        sound.roar();
    }

    onSword(knight, swordBox) {
        if (this.state === "sleeping" && boxesOverlap(swordBox, this.getBox())) {
            knight.swingHitRock = true;
            this.wake(knight);
        }
    }

    onBullet(bullet) {
        if (boxesOverlap(bullet.getBox(), this.getBox())) {
            this.wake(bullet.owner);
            return true;
        }
        return false;
    }

    onBoulder(boulder) {
        if (boxesOverlap(boulder.getBox(), this.getBox())) {
            this.wake(boulder.deflectedBy ?? boulder.owner);
            boulder.smash();
        }
    }

    update() {
        this.ticks++;
        if (this.state === "sleeping") {
            // A thrown sword hitting it wakes it up (and bounces off)
            const sword = thrownSwords.find(sword => sword.isFlying() && boxesOverlap(sword.getBox(), this.getBox()));
            if (sword !== undefined) {
                sword.drop();
                particles.sparks(sword.x, sword.y - sword.z, 6);
                this.wake(sword.owner);
                return;
            }
            // So does being taunted right in its ear...
            const taunter = knights.find(knight => !knight.dead && knight.tauntTicks > 0
                && dhypot(knight.getGroundX() - this.x, knight.getGroundY() - this.y) < BEAR_WAKE_TAUNT);
            if (taunter !== undefined) {
                this.wake(taunter);
                return;
            }
            // ...a horse running into it, the dragon's fire reaching it, or the tornado coming right up to it
            const near = (x, y, reach) => dhypot(x - this.x, y - this.y) < reach;
            if (horses.some(horse => horse.canHitBox(this.getBox()))
                || features.some(feature => (feature instanceof FirePatch && near(feature.x, feature.y, DRAGON_FIRE_RADIUS + BEAR_WAKE_FIRE))
                    || (feature instanceof Tornado && near(feature.x, feature.y, BEAR_WAKE_TORNADO)))) {
                this.wake(null);
                return;
            }
            // And it won't sleep forever
            if (phase === "playing") {
                this.sleepTicks++;
                if (this.sleepTicks >= BEAR_SELF_WAKE_TICKS) {
                    this.wake(null);
                }
            }
            return;
        }
        this.angry--;
        const target = knights
            .filter(knight => !knight.dead)
            .sort((a, b) => dhypot(a.getGroundX() - this.x, a.getGroundY() - this.y) - dhypot(b.getGroundX() - this.x, b.getGroundY() - this.y))[0];

        if (this.state === "waking" && this.ticks > 40) {
            this.setState("aiming");
        } else if (this.state === "aiming") {
            if (target !== undefined) {
                const dx = target.getGroundX() - this.x;
                const dy = target.getGroundY() - this.y;
                const length = dhypot(dx, dy) || 1;
                // Straight at him, unless that's straight into something: then the nearest way that's clear, so it
                // goes round rocks instead of thumping into the same one again and again
                this.dir = this.findClearWay({x: dx / length, y: dy / length});
            }
            if (this.ticks % 10 === 0) {
                particles.dust(this.x - this.dir.x * 6, this.y, 1);
            }
            if (this.ticks >= BEAR_WINDUP_TICKS) {
                this.setState(target === undefined || this.angry <= 0 ? "sleeping" : "charging");
            }
        } else if (this.state === "charging") {
            // If it only clips something, it slides off it; head on, it thumps into it
            const slide = this.findSlide();
            if (slide !== null) {
                this.dir = slide;
            }
            const nextX = this.x + this.dir.x * BEAR_SPEED;
            const nextY = this.y + this.dir.y * BEAR_SPEED;
            if (slide === null) {
                // Thumps into it
                addShake(2);
                particles.dust(this.x + this.dir.x * 8, this.y, 6);
                sound.thunk();
                this.setState("resting");
            } else {
                this.x = nextX;
                this.y = nextY;
                if (this.ticks % 6 === 0) {
                    particles.dust(this.x, this.y, 1);
                    marks.footprint(this.x, this.y - 1, arena.footprint);
                }
            }
            if (this.ticks >= BEAR_CHARGE_TICKS) {
                this.setState("resting");
            }
        } else if (this.state === "resting" && this.ticks >= BEAR_REST_TICKS) {
            this.setState(this.angry <= 0 ? "sleeping" : "aiming");
        }
    }

    setState(state) {
        this.state = state;
        this.ticks = 0;
    }

    // Where its feet are, standing here
    getFeet(x, y) {
        return {left: x - 6, right: x + 6, top: y - 4, bottom: y};
    }

    // Could it stand here? Anything it's already in doesn't count, so it can always get itself out. (solids is
    // getSolids(), passed in so it's only worked out once for all the spots it tries.)
    canStandAt(x, y, solids) {
        const bounds = getBounds();
        if (x < bounds.left + 10 || x > bounds.right - 10 || y < bounds.top + 16 || y > bounds.bottom) {
            return false;
        }
        const here = this.getFeet(this.x, this.y);
        const feet = this.getFeet(x, y);
        return !solids.some(solid => {
            const box = solid.getBox();
            return boxesOverlap(feet, box) && !boxesOverlap(here, box);
        });
    }

    // Is the way clear for a little while, going this way? Checked from its very first step, a pixel at a time, so
    // it can't miss the corner of something it's right up against.
    isClearWay(dir, distance, solids) {
        for (let step = BEAR_SPEED; step <= distance; step = Math.floor(step) + 1) {
            if (!this.canStandAt(this.x + dir.x * step, this.y + dir.y * step, solids)) {
                return false;
            }
        }
        return true;
    }

    // The way closest to the one it wants that's clear (or the one it wants, if nothing is)
    findClearWay(dir) {
        const solids = getSolids();
        const angle = datan2(dir.y, dir.x);
        for (let turn = 0; turn <= 180; turn += 15) {
            for (const side of turn === 0 ? [1] : [1, -1]) {
                const turned = angle + side * turn * Math.PI / 180;
                const way = {x: dcos(turned), y: dsin(turned)};
                if (this.isClearWay(way, BEAR_LOOK_AHEAD, solids)) {
                    return way;
                }
            }
        }
        return dir;
    }

    // Mid-charge: the way to go this step. Its own way if that's clear, turned a little if that slides it past
    // something it's only clipping, or null if it's run head on into something.
    findSlide() {
        const solids = getSolids();
        const angle = datan2(this.dir.y, this.dir.x);
        for (let turn = 0; turn <= BEAR_SLIDE_TURN; turn += 15) {
            for (const side of turn === 0 ? [1] : [1, -1]) {
                const turned = angle + side * turn * Math.PI / 180;
                const way = {x: dcos(turned), y: dsin(turned)};
                if (this.canStandAt(this.x + way.x * BEAR_SPEED, this.y + way.y * BEAR_SPEED, solids)) {
                    return way;
                }
            }
        }
        return null;
    }

    danger(knight) {
        if (this.state === "charging" && boxesOverlap(this.getBox(), knight.getBodyBox())) {
            return {cause: "bear", push: this.dir, source: this};
        }
        return null;
    }

    harms(box) {
        return this.state === "charging" && boxesOverlap(this.getBox(), box);
    }

    getSortY() {
        return this.y;
    }

    drawShadow() {
        drawShadow(this.x, this.y, 20);
    }

    draw() {
        const left = Math.round(this.x - 12);
        const top = Math.round(this.y - 16);
        if (this.state === "sleeping") {
            MDog.Draw.image(BEAR_IMAGE, left, top, {width: 24, offsetX: 0});
            // Z's floating up
            const z = (this.ticks % 90) / 90;
            MDog.Draw.textImage("z", Math.round(this.x + 6 + z * 4), Math.round(this.y - 12 - z * 10), "rgba(255, 255, 255, 0.8)", FONT, {alignX: "center", alignY: "center"});
            return;
        }
        const speed = this.state === "charging" ? 4 : 12;
        const frame = 1 + Math.floor(this.ticks / speed) % 2;
        MDog.Draw.image(BEAR_IMAGE, left, top, {width: 24, offsetX: 24 * frame, flipX: this.dir.x < 0});
    }

    drawHitboxes() {
        drawBox(this.getBox(), this.state === "charging" ? "#ff0000" : "#ff8800");
    }
}

// ----- The storm -----

// Lightning striking on its own, at random places and near the knights. The storm arena's is wild: about once a
// second, and nearly always at someone, either right on him or just next to him.
class Storm {
    // slower makes the strikes further apart
    constructor(slower, wild) {
        this.slower = slower ?? 1;
        this.wild = wild ?? false;
        this.wait = this.nextWait();
    }

    nextWait() {
        return this.wild
            ? random(WILD_STORM_MIN_WAIT_TICKS, WILD_STORM_MAX_WAIT_TICKS)
            : random(STORM_MIN_WAIT_TICKS, STORM_MAX_WAIT_TICKS) * this.slower;
    }

    update() {
        if (phase !== "playing") {
            return;
        }
        this.wait--;
        if (this.wait <= 0) {
            this.wait = this.nextWait();
            const spot = this.wild ? this.pickWildSpot() : this.pickSpot();
            if (spot !== null) {
                strikes.push(new Strike(null, null, spot));
            }
        }
    }

    pickSpot() {
        const near = pick(knights.filter(knight => !knight.dead));
        if (near !== undefined && rng() < 0.5) {
            return {x: near.getGroundX() + random(-26, 26), y: near.getGroundY() + random(-18, 18)};
        }
        return findClearSpot(0);
    }

    pickWildSpot() {
        const near = pick(knights.filter(knight => !knight.dead));
        const roll = rng();
        if (near === undefined || roll >= WILD_STORM_ON_CHANCE + WILD_STORM_NEAR_CHANCE) {
            return findClearSpot(0);
        }
        let x = near.getGroundX();
        let y = near.getGroundY();
        if (roll < WILD_STORM_ON_CHANCE) {
            // On him, give or take a step
            x += random(-4, 4);
            y += random(-3, 3);
        } else {
            // Just past the edge of where it'd hit him, so it's a close call if he stays put
            const angle = random(0, Math.PI * 2);
            const distance = random(THUNDER_RADIUS + 3, WILD_STORM_NEAR_DISTANCE);
            x += dcos(angle) * distance;
            y += dsin(angle) * distance * 0.7;
        }
        // Not off the edge of the field
        const bounds = getBounds();
        return {
            x: Math.max(bounds.left + 8, Math.min(bounds.right - 8, x)),
            y: Math.max(Math.max(24, bounds.top + 8), Math.min(bounds.bottom - 4, y)),
        };
    }
}

// ----- The ring's crowd -----

// Camera flashes going off in the crowd
function drawCrowdFlashes() {
    const bounds = getBounds();
    for (let i = 0; i < 3; i++) {
        if (Math.random() < 0.1) {
            let x = fxRandom(0, SCREEN_WIDTH);
            let y = fxRandom(0, SCREEN_HEIGHT);
            if (x > bounds.left - 10 && x < bounds.right + 10 && y > bounds.top && y < bounds.bottom + 12) {
                continue;
            }
            MDog.Draw.rectangleFill(Math.round(x) - 1, Math.round(y), 3, 1, "rgba(255, 255, 255, 0.9)");
            MDog.Draw.rectangleFill(Math.round(x), Math.round(y) - 1, 1, 3, "rgba(255, 255, 255, 0.9)");
        }
    }
}

// ----- The mine -----

// The mine's cart tracks. Every couple of seconds a minecart races along one of them (never the same one twice in a
// row), with no warning.
class Tracks {
    constructor(ys) {
        this.ys = ys; // the ground along each track
        this.wait = MINECART_MIN_WAIT_TICKS;
        this.last = null;
    }

    update() {
        if (phase !== "playing") {
            return;
        }
        this.wait--;
        if (this.wait <= 0) {
            const y = pick(this.ys.length > 1 ? this.ys.filter(y => y !== this.last) : this.ys);
            features.push(new Minecart(y, rng() < 0.5 ? 1 : -1));
            this.last = y;
            this.wait = random(MINECART_MIN_WAIT_TICKS, MINECART_MAX_WAIT_TICKS);
        }
    }
}

class Minecart {
    constructor(y, dir) {
        this.y = y;
        this.dir = dir;
        this.x = dir > 0 ? -14 : SCREEN_WIDTH + 14;
        this.ticks = 0;
        this.done = false;
        this.closeCalls = new Map();
        this.ore = [pick(["#78dcf0", "#f0c85a", "#b478e6"]), pick(["#78dcf0", "#f0c85a", "#b478e6"])];
    }

    getBox() {
        return {left: this.x - 10, right: this.x + 10, top: this.y - 12, bottom: this.y};
    }

    update() {
        this.ticks++;
        this.x += this.dir * MINECART_SPEED;
        if (this.ticks % 10 === 0) {
            sound.hoof();
            particles.sparks(this.x - this.dir * 9, this.y - 1, 1, [255, 220, 120]);
        }
        // Smashes anything on the track
        for (const boulder of boulders) {
            if (boxesOverlap(boulder.getBox(), this.getBox())) {
                boulder.smash();
            }
        }
        if (this.x < -30 || this.x > SCREEN_WIDTH + 30) {
            this.done = true;
        }
    }

    danger(knight) {
        return boxesOverlap(this.getBox(), knight.getBodyBox()) ? {cause: "minecart", push: {x: this.dir, y: -0.3}, source: this} : null;
    }

    harms(box) {
        return boxesOverlap(this.getBox(), box);
    }

    getSortY() {
        return this.y;
    }

    drawShadow() {
        drawShadow(this.x, this.y, 20);
    }

    draw() {
        const left = Math.round(this.x - 10);
        const top = this.y - 12;
        MDog.Draw.rectangleFill(left, top + 2, 20, 8, "#5a4232");
        MDog.Draw.rectangleFill(left, top + 2, 20, 1, "#8a8a96");
        MDog.Draw.rectangleFill(left, top + 9, 20, 1, "#3a2a20");
        // Ore piled on top
        MDog.Draw.rectangleFill(left + 3, top, 6, 2, this.ore[0]);
        MDog.Draw.rectangleFill(left + 10, top + 1, 6, 1, this.ore[1]);
        // Wheels
        for (const wheel of [left + 3, left + 14]) {
            MDog.Draw.rectangleFill(wheel, top + 10, 3, 2, "#202024");
        }
    }

    drawHitboxes() {
        drawBox(this.getBox(), "#ff0000");
    }
}

// A lantern on a post, lighting up a bit of the dark
class Lantern {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.ticks = Math.floor(random(0, 100));
    }

    update() {
        this.ticks++;
    }

    getLights() {
        // Flickers a little
        return [{x: this.x, y: this.y - 6, r: 30 + dsin(this.ticks / 9) * 2}];
    }

    getSortY() {
        return this.y;
    }

    drawShadow() {}

    draw() {
        MDog.Draw.rectangleFill(this.x, this.y - 9, 1, 9, "#4a3424");
        MDog.Draw.rectangleFill(this.x - 1, this.y - 12, 3, 3, Math.floor(this.ticks / 7) % 5 === 0 ? "#ffd070" : "#ffe8a0");
    }

    drawHitboxes() {}
}

// ----- The desert -----

// Quicksand: walking through it is slow, and standing still in it sinks you. Sink all the way and you're gone.
class Quicksand {
    constructor(x, y, rx, ry) {
        this.x = x;
        this.y = y;
        this.rx = rx;
        this.ry = ry;
        this.ticks = 0;
    }

    contains(x, y) {
        const dx = (x - this.x) / this.rx;
        const dy = (y - this.y) / this.ry;
        return dx * dx + dy * dy < 1;
    }

    // Power-ups and holes stay out of it
    isNear(x, y, margin) {
        const dx = (x - this.x) / (this.rx + margin);
        const dy = (y - this.y) / (this.ry + margin);
        return dx * dx + dy * dy < 1;
    }

    update() {
        this.ticks++;
        for (const knight of knights) {
            if (knight.dead) {
                continue;
            }
            if (this.contains(knight.getGroundX(), knight.getGroundY())) {
                knight.inSand = 2; // still in it next tick
                // Struggling slows the sinking, but doesn't stop it
                const before = knight.sinkTicks;
                knight.sinkTicks += knight.walkTicks > 0 ? 0.35 : 1;
                if (Math.floor(before / 40) !== Math.floor(knight.sinkTicks / 40)) {
                    sound.grab();
                }
            }
        }
    }

    danger(knight) {
        return knight.sinkTicks >= QUICKSAND_TICKS && this.contains(knight.getGroundX(), knight.getGroundY())
            ? {cause: "quicksand", push: {x: 0, y: 0}, source: this}
            : null;
    }

    drawGround() {
        drawOval(this.x, this.y, this.rx + 1, this.ry + 1, "#b48a52");
        drawOval(this.x, this.y, this.rx, this.ry, "#c49a5e");
        // A ripple slowly closing in on the middle
        const ripple = 1 - (this.ticks % 120) / 120;
        drawRing(this.x, this.y, this.rx * ripple * 0.9, "rgba(150, 110, 60, 0.6)");
        drawOval(this.x, this.y, this.rx * 0.25, this.ry * 0.25, "#a87c48");
    }
}

// A tumbleweed bouncing along with the wind. It doesn't hurt anyone.
class Tumbleweed {
    constructor() {
        const bounds = getBounds();
        this.dir = weather.kind === "wind" ? Math.sign(weather.getWind()) || 1 : (rng() < 0.5 ? 1 : -1);
        this.x = this.dir > 0 ? -8 : SCREEN_WIDTH + 8;
        this.y = random(Math.max(30, bounds.top + 20), bounds.bottom - 6);
        this.speed = random(0.5, 0.9) * (weather.kind === "wind" ? 1.8 : 1);
        this.ticks = 0;
        this.done = false;
    }

    update() {
        this.ticks++;
        this.x += this.dir * this.speed;
        if (this.x < -12 || this.x > SCREEN_WIDTH + 12) {
            this.done = true;
        }
    }

    getSortY() {
        return this.y;
    }

    drawShadow() {
        drawShadow(this.x, this.y, 7);
    }

    draw() {
        const hop = Math.abs(dsin(this.ticks / 14)) * 5;
        const x = Math.round(this.x);
        const y = Math.round(this.y - 4 - hop);
        const spin = this.ticks / 8 * this.dir;
        for (let i = 0; i < 6; i++) {
            const angle = spin + i * Math.PI / 3;
            MDog.Draw.line(x, y, x + dcos(angle) * 4, y + dsin(angle) * 4, "#9a7a48");
        }
        drawRing(x, y + 2, 4, "#7a5a30");
    }

    drawHitboxes() {}
}

class TumbleweedSpawner {
    constructor() {
        this.wait = random(60, 300);
    }

    update() {
        this.wait--;
        if (this.wait <= 0) {
            this.wait = random(240, 600) * (weather.kind === "wind" ? 0.5 : 1);
            features.push(new Tumbleweed());
        }
    }
}

// ----- The lighthouse -----

// Two beams, pointing opposite ways, sweep around the island from the lamp at the top of the tower. They're the
// only light there is. They start out pointing at the two knights, who start on opposite sides of the lamp.
class LighthouseBeam {
    constructor(lampX, lampY) {
        this.x = lampX;
        this.y = lampY;
        // Pointing at blue's start (and the other beam at red's). Beams are squashed up and down, like the ground.
        const start = arena.starts[1];
        this.angle = datan2((start.y - 6 - lampY) / 0.7, start.x - lampX);
    }

    update() {
        this.angle += LIGHTHOUSE_TURN_SPEED;
    }

    // The spots along both beams, from near the tower out past the edge of the island
    getBeamSpots() {
        const spots = [];
        for (const angle of [this.angle, this.angle + Math.PI]) {
            for (let distance = 10; distance < 190; distance += 10) {
                spots.push({
                    x: this.x + dcos(angle) * distance,
                    y: this.y + dsin(angle) * distance * 0.7,
                    r: (5 + distance * 0.2) * LIGHTHOUSE_BEAM_WIDTH,
                });
            }
        }
        return spots;
    }

    getLights() {
        return this.getBeamSpots();
    }

    // A faint warm glow along the beams, and the lamp itself shining
    drawSky() {
        for (const spot of this.getBeamSpots()) {
            drawOval(spot.x, spot.y, spot.r * 0.6, spot.r * 0.42, "rgba(255, 240, 180, 0.06)");
        }
        drawOval(this.x, this.y, 3, 2, "rgba(255, 250, 200, 0.9)");
    }
}

// ----- The tornado -----

// Wanders around, pulling everything toward it. Anyone it catches gets flung out the other side.
class Tornado {
    constructor() {
        const spot = findClearSpot(50) ?? {x: SCREEN_WIDTH / 2, y: SCREEN_HEIGHT / 2};
        this.x = spot.x;
        this.y = spot.y;
        this.angle = random(0, Math.PI * 2);
        this.ticks = 0;
        this.done = false;
        this.caught = new Map(); // knight: ticks until it can catch him again
        // Bits of grass, leaves and stones whirling round inside it
        this.debris = [];
        for (let i = 0; i < 28; i++) {
            this.debris.push({
                angle: random(0, Math.PI * 2),
                height: random(2, TORNADO_HEIGHT * 4),
                speed: random(0.08, 0.16),
                color: pick(["#6aa04a", "#a07a3a", "#8a8490", "#c8b080", "#4a8030"]),
                size: rng() < 0.3 ? 2 : 1,
            });
        }
        popup("TORNADO!", this.x, this.y - 70, "#d8d8e0");
        addShake(4);
        sound.dragon();
        sound.rumble(true);
    }

    getStrength() {
        // Spins up and dies down
        return Math.min(1, this.ticks / 60, (TORNADO_TICKS - this.ticks) / 60);
    }

    update() {
        this.ticks++;
        if (this.ticks >= TORNADO_TICKS) {
            this.done = true;
            return;
        }
        // Wanders, turning back toward the middle near the edges
        const bounds = getBounds();
        this.angle += random(-0.08, 0.08);
        if (this.x < bounds.left + 30 || this.x > bounds.right - 30 || this.y < bounds.top + 40 || this.y > bounds.bottom - 20) {
            this.angle = datan2((bounds.top + bounds.bottom) / 2 - this.y, (bounds.left + bounds.right) / 2 - this.x);
        }
        this.x += dcos(this.angle) * TORNADO_SPEED;
        this.y += dsin(this.angle) * TORNADO_SPEED * 0.7;

        const strength = this.getStrength();
        for (const knight of knights) {
            const cooldown = this.caught.get(knight) ?? 0;
            this.caught.set(knight, Math.max(0, cooldown - 1));
            if (knight.dead) {
                continue;
            }
            const dx = this.x - knight.getGroundX();
            const dy = this.y - knight.getGroundY();
            const distance = dhypot(dx, dy);
            if (distance < TORNADO_RADIUS && distance > 0.1) {
                // Pulled in, and around
                const pull = TORNADO_PULL * strength * (1 - distance / TORNADO_RADIUS) * (knight.maxLives > 1 ? 0.5 : 1);
                knight.vx += (dx / distance) * pull - (dy / distance) * pull * 0.6;
                knight.vy += (dy / distance) * pull + (dx / distance) * pull * 0.6;
            }
            if (distance < TORNADO_CATCH && cooldown === 0 && strength > 0.5) {
                // Caught! Flung out in a random direction
                this.caught.set(knight, 90);
                const angle = random(0, Math.PI * 2);
                knight.fling({x: dcos(angle), y: dsin(angle)});
            }
        }
        // A ring of dust kicking up round its base, and grass torn up as it goes
        if (this.ticks % 2 === 0) {
            const angle = random(0, Math.PI * 2);
            particles.dust(this.x + dcos(angle) * 14, this.y + dsin(angle) * 5, 1);
        }
        if (this.ticks % 9 === 0) {
            particles.clippings(this.x + random(-10, 10), this.y, 1);
        }
        for (const bit of this.debris) {
            bit.angle += bit.speed * strength;
        }
        if (this.ticks % 40 === 0) {
            sound.flames();
        }
        if (this.ticks % 90 === 0) {
            sound.rumble(false);
        }
        // The ground shakes when a knight's near it
        if (knights.some(knight => !knight.dead && dhypot(knight.getGroundX() - this.x, knight.getGroundY() - this.y) < TORNADO_RADIUS)) {
            addShake(1.2 * strength);
        }
    }

    harms(box) {
        const center = boxCenter(box);
        return this.getStrength() > 0.5 && dhypot(center.x - this.x, box.bottom - this.y) < TORNADO_CATCH;
    }

    // How wide the funnel is at a ring (0 at the bottom), and how far that ring sways
    ringRadius(layer) {
        return (3 + layer * 1.7 + layer * layer * 0.05) * this.getStrength();
    }

    ringSway(layer) {
        return dsin(this.ticks / 11 + layer * 0.45) * layer * 0.35;
    }

    // Its shadow, and a churning ring of dust round its base
    drawGround() {
        const strength = this.getStrength();
        drawOval(this.x, this.y, 20 * strength, 7 * strength, "rgba(0, 0, 0, 0.25)");
        const dots = 22;
        for (let i = 0; i < dots; i++) {
            const angle = i / dots * Math.PI * 2 + this.ticks / 6;
            const radius = (13 + dsin(this.ticks / 5 + i) * 2) * strength;
            MDog.Draw.rectangleFill(Math.round(this.x + dcos(angle) * radius), Math.round(this.y + dsin(angle) * radius * 0.35), 2, 1, "rgba(190, 170, 130, 0.55)");
        }
    }

    // A tall swirling funnel, wider at the top, swaying, with debris whirling round inside it
    drawSky() {
        const strength = this.getStrength();
        // The back half of everything first, then the front half, so it looks round
        for (const front of [false, true]) {
            for (let layer = 0; layer < TORNADO_HEIGHT; layer++) {
                const y = this.y - layer * 4;
                const radius = this.ringRadius(layer);
                const sway = this.ringSway(layer);
                const dots = 12 + layer * 3;
                for (let i = 0; i < dots; i++) {
                    const angle = i / dots * Math.PI * 2 + this.ticks / 3.5 + layer * 0.7;
                    const depth = dsin(angle);
                    if ((depth > 0) !== front) {
                        continue;
                    }
                    // Darker and thicker toward the top, lighter at the front
                    const shade = front ? 215 - layer * 3 : 150 - layer * 2;
                    const alpha = (front ? 0.55 : 0.35) * strength;
                    MDog.Draw.rectangleFill(Math.round(this.x + sway + dcos(angle) * radius), Math.round(y + depth * radius * 0.3), 1, 1, `rgba(${shade}, ${shade}, ${shade + 12}, ${alpha})`);
                }
            }
            for (const bit of this.debris) {
                const depth = dsin(bit.angle);
                if ((depth > 0) !== front) {
                    continue;
                }
                const layer = bit.height / 4;
                const radius = this.ringRadius(layer) * 0.85;
                const x = this.x + this.ringSway(layer) + dcos(bit.angle) * radius;
                const y = this.y - bit.height + depth * radius * 0.3;
                MDog.Draw.rectangleFill(Math.round(x), Math.round(y), bit.size, bit.size, bit.color);
            }
        }
    }
}

// ----- The lava lake -----

// A lake of lava, edge to edge, with stone rafts moving around on it. Some slide back and forth in a line, some go
// round in a big loop, and their paths cross, so you can hop from one to another. Whoever's on a raft (and anything
// lying on it) is carried along. Anywhere that isn't a raft is lava.
class LavaLake {
    constructor(rafts) {
        this.rafts = rafts.map(raft => ({...raft, box: null}));
        this.style = "lava";
        this.cracked = false;
        this.ticks = 0;
        for (const raft of this.rafts) {
            raft.box = this.raftBox(raft);
        }
    }

    // Where a raft's middle is now
    raftCenter(raft) {
        const angle = this.ticks * raft.speed + raft.phase;
        if (raft.path === "loop") {
            return {x: raft.x + dcos(angle) * raft.rx, y: raft.y + dsin(angle) * raft.ry};
        }
        const offset = dsin(angle) * raft.range;
        return {x: raft.x + (raft.axis === "x" ? offset : 0), y: raft.y + (raft.axis === "y" ? offset : 0)};
    }

    raftBox(raft) {
        const center = this.raftCenter(raft);
        return {left: center.x - raft.w / 2, right: center.x + raft.w / 2, top: center.y - raft.h / 2, bottom: center.y + raft.h / 2};
    }

    // The raft at a spot. Rafts are drawn in order, so later ones are on top, and where they overlap it's the one on
    // top that counts. leeway lets the spot be a little past the raft's edge.
    raftAt(x, y, boxOf, leeway) {
        const extra = leeway ?? 0;
        for (let i = this.rafts.length - 1; i >= 0; i--) {
            const raft = this.rafts[i];
            const box = boxOf !== undefined ? boxOf(raft) : raft.box;
            if (x >= box.left - extra && x < box.right + extra && y >= box.top - extra && y < box.bottom + extra) {
                return raft;
            }
        }
        return undefined;
    }

    // A knight whose feet are just past a raft's edge doesn't fall in yet, so it doesn't feel unfair
    contains(x, y) {
        return this.raftAt(x, y, undefined, RAFT_LEEWAY) === undefined;
    }

    // Without the leeway: for things that need to be carried along, like a dropped sword
    containsStrictly(x, y) {
        return this.raftAt(x, y) === undefined;
    }

    // Power-ups go on rafts (well inside one)
    isNear(x, y, margin) {
        return [[x, y], [x - margin, y], [x + margin, y], [x, y - margin], [x, y + margin]].some(([px, py]) => this.raftAt(px, py) === undefined);
    }

    getFallSpot(x, y) {
        return {x, y};
    }

    update() {
        const before = new Map(this.rafts.map(raft => [raft, raft.box]));
        this.ticks++;
        for (const raft of this.rafts) {
            raft.box = this.raftBox(raft);
        }
        // Anything on a raft moves with it. Where two rafts overlap, it goes with the one drawn on top. Only the raft
        // something is really standing on carries it: the leeway past the edge just stops it falling in, so a raft
        // passing close by can't grab someone off the raft they're on.
        const carry = (x, y) => {
            const raft = this.raftAt(x, y, raft => before.get(raft));
            if (raft === undefined) {
                return {dx: 0, dy: 0};
            }
            return {dx: raft.box.left - before.get(raft).left, dy: raft.box.top - before.get(raft).top};
        };
        for (const knight of knights) {
            if (knight.fallHole === null) {
                const {dx, dy} = carry(knight.getGroundX(), knight.getGroundY());
                knight.x += dx;
                knight.y += dy;
            }
        }
        for (const powerup of powerups) {
            const {dx, dy} = carry(powerup.x, powerup.y);
            powerup.x += dx;
            powerup.y += dy;
        }
        for (const sword of thrownSwords) {
            if (sword.state === "grounded") {
                const {dx, dy} = carry(sword.x, sword.y);
                sword.x += dx;
                sword.y += dy;
            }
        }
        for (const chicken of features.filter(feature => feature instanceof Chicken)) {
            const {dx, dy} = carry(chicken.x, chicken.y);
            chicken.x += dx;
            chicken.y += dy;
        }
        if (rng() < 0.08) {
            particles.embers(random(0, SCREEN_WIDTH), random(20, SCREEN_HEIGHT), 1);
        }
    }

    draw() {
        // Bubbles popping in the lava
        for (let i = 0; i < 8; i++) {
            const phase = (this.ticks / 50 + i * 0.37) % 1;
            if (phase < 0.5) {
                const x = 10 + (i * 53) % 220;
                const y = 20 + (i * 71) % 150;
                MDog.Draw.rectangleFill(x, y, phase < 0.25 ? 1 : 2, 1, "#ffe080");
            }
        }
        for (const raft of this.rafts) {
            const box = raft.box;
            const left = Math.round(box.left);
            const top = Math.round(box.top);
            const width = Math.round(box.right - box.left);
            const height = Math.round(box.bottom - box.top);
            MDog.Draw.rectangleFill(left - 1, top + 1, width + 2, height, "#f08a30"); // glowing edge
            MDog.Draw.rectangleFill(left, top, width, height, "#4a3a3c");
            MDog.Draw.rectangleFill(left, top, width, 1, "#6c5a5a");
            MDog.Draw.rectangleFill(left, top + height - 1, width, 1, "#2e2224");
            MDog.Draw.rectangleFill(left + Math.round(width * 0.3), top + 3, 1, height - 6, "#2e2224");
            MDog.Draw.rectangleFill(left + Math.round(width * 0.65), top + 2, 1, Math.max(1, height - 8), "#2e2224");
        }
    }
}

// ----- The title screen's knights -----

// Plays a knight on the title screen: circling, rushing in to swing, backing off, wandering, now and then taunting
class DemoBrain {
    constructor(knight, other) {
        this.knight = knight;
        this.other = other;
        this.mode = "circle";
        this.timer = random(60, 160);
        this.turn = rng() < 0.5 ? 1 : -1;
        this.move = {x: 0, y: 0};
        this.swing = false;
        this.taunt = false;
        this.spot = null;
    }

    update() {
        const knight = this.knight;
        const dx = this.other.getGroundX() - knight.getGroundX();
        const dy = this.other.getGroundY() - knight.getGroundY();
        const distance = dhypot(dx, dy) || 1;
        this.timer--;
        if (this.timer <= 0) {
            this.pickMode(distance);
        }

        let wantX = 0;
        let wantY = 0;
        if (this.mode === "circle") {
            // Around the other knight, keeping about 40 pixels away
            const inOut = Math.max(-1, Math.min(1, (distance - 40) / 20));
            wantX = (dx / distance) * inOut - (dy / distance) * this.turn;
            wantY = (dy / distance) * inOut + (dx / distance) * this.turn;
        } else if (this.mode === "attack") {
            wantX = dx / distance;
            wantY = dy / distance;
            if (distance < 16) {
                this.swing = true;
                this.mode = "retreat";
                this.timer = random(40, 70);
            }
        } else if (this.mode === "retreat") {
            wantX = -dx / distance;
            wantY = -dy / distance;
        } else if (this.mode === "wander") {
            const toX = this.spot.x - knight.getGroundX();
            const toY = this.spot.y - knight.getGroundY();
            const length = dhypot(toX, toY) || 1;
            if (length < 6) {
                this.timer = 0;
            }
            wantX = toX / length;
            wantY = toY / length;
        }
        // Like pressing arrow keys: each way is on or off
        const move = {x: Math.abs(wantX) > 0.38 ? Math.sign(wantX) : 0, y: Math.abs(wantY) > 0.38 ? Math.sign(wantY) : 0};
        // If he's somehow over danger (it's moved out from under him), getting back to safe ground comes first
        const rescue = isUnsafeGround(knight.getGroundX(), knight.getGroundY()) ? this.findWayToSafety() : null;
        this.move = rescue ?? this.findSafeMove(move);
    }

    // The way toward the nearest safe ground, looking out in every direction
    findWayToSafety() {
        for (let distance = 3; distance <= 60; distance += 3) {
            for (let i = 0; i < 16; i++) {
                const angle = i / 16 * Math.PI * 2;
                const x = this.knight.getGroundX() + dcos(angle) * distance;
                const y = this.knight.getGroundY() + dsin(angle) * distance;
                if (this.isSafeSpot(x, y)) {
                    return {x: Math.abs(dcos(angle)) > 0.38 ? Math.sign(dcos(angle)) : 0, y: Math.abs(dsin(angle)) > 0.38 ? Math.sign(dsin(angle)) : 0};
                }
            }
        }
        return null;
    }

    // Safe, with a little room around it so he keeps away from edges
    isSafeSpot(x, y) {
        const room = DEMO_EDGE_ROOM;
        return [[x, y], [x - room, y], [x + room, y], [x, y - room], [x, y + room]].every(([px, py]) => !isUnsafeGround(px, py, true));
    }

    // The way closest to the one he wants that doesn't walk him into lava, a hole or water (or standing still, if
    // every way does)
    findSafeMove(move) {
        if (move.x === 0 && move.y === 0) {
            return move;
        }
        const ways = [];
        for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
                if (x !== 0 || y !== 0) {
                    ways.push({x, y});
                }
            }
        }
        // Most like the wanted way first
        ways.sort((a, b) => (b.x * move.x + b.y * move.y) / dhypot(b.x, b.y) - (a.x * move.x + a.y * move.y) / dhypot(a.x, a.y));
        return ways.find(way => this.isSafeWay(way)) ?? {x: 0, y: 0};
    }

    isSafeWay(way) {
        const length = dhypot(way.x, way.y);
        for (const distance of [4, 9]) {
            const x = this.knight.getGroundX() + way.x / length * distance;
            const y = this.knight.getGroundY() + way.y / length * distance;
            if (!this.isSafeSpot(x, y)) {
                return false;
            }
        }
        return true;
    }

    pickMode(distance) {
        const roll = rng();
        if (roll < 0.35) {
            this.mode = "circle";
            this.turn = rng() < 0.5 ? 1 : -1;
            this.timer = random(80, 180);
        } else if (roll < 0.7) {
            this.mode = "attack";
            this.timer = random(90, 160);
        } else if (roll < 0.85) {
            this.mode = "wander";
            this.spot = {x: random(30, SCREEN_WIDTH - 30), y: random(50, SCREEN_HEIGHT - 20)};
            this.timer = random(100, 200);
        } else if (roll < 0.95 || distance < 40) {
            this.mode = "retreat";
            this.timer = random(40, 80);
        } else {
            this.taunt = true;
            this.mode = "circle";
            this.timer = random(120, 200);
        }
    }

    takeSwing() {
        const swing = this.swing;
        this.swing = false;
        return swing;
    }

    takeTaunt() {
        const taunt = this.taunt;
        this.taunt = false;
        return taunt;
    }
}

// ----- Jousting -----

// Jousting knights meeting. What counts is the tip of the lance:
//   - only one lance tip in the other rider (a hit from the side or behind): that rider wins
//   - both lance tips in each other (head on): the faster one wins, and if they're about as fast, both bounce off
//   - horses bumping without a lance tip landing: they just push apart
// The wins are seen by checkHits, through findJoustDanger. This handles the bouncing.
function checkJousts() {
    if (!arena.joust) {
        return;
    }
    const [a, b] = knights;
    if (a.dead || b.dead) {
        return;
    }
    const aHits = a.lanceHits(b);
    const bHits = b.lanceHits(a);
    const speedA = dhypot(a.vx, a.vy);
    const speedB = dhypot(b.vx, b.vy);
    if (!aHits && !bHits) {
        if (boxesOverlap(a.getHorseFootprint(), b.getHorseFootprint())) {
            // Bump
            const awayX = a.getGroundX() - b.getGroundX();
            const awayY = a.getGroundY() - b.getGroundY();
            const length = dhypot(awayX, awayY) || 1;
            a.vx += awayX / length * 0.4;
            a.vy += awayY / length * 0.4;
            b.vx -= awayX / length * 0.4;
            b.vy -= awayY / length * 0.4;
        }
        return;
    }
    if (!(aHits && bHits) || Math.abs(speedA - speedB) > JOUST_TIE) {
        return;
    }
    // Even: lances clash and both are thrown back
    const awayX = a.getGroundX() - b.getGroundX();
    const awayY = a.getGroundY() - b.getGroundY();
    const length = dhypot(awayX, awayY) || 1;
    const bounce = Math.max(speedA, speedB) + 0.8;
    for (const [knight, sign] of [[a, 1], [b, -1]]) {
        knight.vx = sign * awayX / length * bounce;
        knight.vy = sign * awayY / length * bounce;
        knight.stunTicks = 20;
        stats[knight.player.color].parries++;
        knight.lastParry = gameTime;
    }
    const spot = {x: (a.getGroundX() + b.getGroundX()) / 2, y: (a.getGroundY() + b.getGroundY()) / 2 - 10};
    particles.sparks(spot.x, spot.y, 18);
    popup("CLANG!", spot.x, spot.y - 6, "#ffe680");
    addShake(4);
    hitstop = Math.max(hitstop, HITSTOP_CLASH);
    sound.clang();
}

// The other jousting knight, if his lance tip is in this one and it's a win (see checkJousts)
function findJoustDanger(target) {
    if (!arena.joust) {
        return null;
    }
    const rider = knights.find(knight => knight !== target && knight.mounted && knight.lanceHits(target));
    if (rider === undefined) {
        return null;
    }
    // Head on, the faster one wins
    if (target.lanceHits(rider) && dhypot(rider.vx, rider.vy) <= dhypot(target.vx, target.vy) + JOUST_TIE) {
        return null;
    }
    return {cause: "joust", push: rider.getLanceDir(), source: rider};
}

// The arena's own features, made fresh each round
function makeArenaFeatures() {
    const made = [];
    for (const wall of arena.walls ?? []) made.push(new Wall(wall));
    for (const mast of arena.masts ?? []) made.push(new Prop(mast.x, mast.y, MAST_IMAGE, [3, 4, 11, 11], 11, 12));
    for (const grave of arena.graves ?? []) made.push(new Grave(grave.x, grave.y));
    for (const barrel of (arenaLayout ?? arena).barrels ?? []) made.push(new Barrel(barrel.x, barrel.y));
    for (const lantern of arena.lanterns ?? []) made.push(new Lantern(lantern.x, lantern.y));
    for (const sand of arena.quicksand ?? []) made.push(new Quicksand(sand.x, sand.y, sand.rx, sand.ry));
    for (const cactus of arena.cacti ?? []) made.push(new Prop(cactus.x, cactus.y, CACTUS_IMAGE, [2, 9, 8, 16], 16, 8));
    if (arena.tumbleweeds) made.push(new TumbleweedSpawner());
    if (arena.dragons && isHazardOn("dragon")) made.push(new DragonSpawner());
    if (arena.fissures && isHazardOn("holes")) made.push(new FissureSpawner());
    if (arena.lighthouse !== undefined) {
        made.push(new Prop(arena.lighthouse.x, arena.lighthouse.y, LIGHTHOUSE_IMAGE, [3, 18, 17, 24], 24, 18));
        made.push(new LighthouseBeam(arena.lighthouse.x + 9, arena.lighthouse.y + 3));
    }
    // Things that attack on their own are hazards, which can be turned off in the settings
    // (and wait until round 3, since the first rounds are kept simple)
    if (getRoundStage() === 2) {
        if (arena.bear !== undefined && isHazardOn("bear")) made.push(new Bear(arena.bear.x, arena.bear.y));
        if (arena.storm && isHazardOn("lightning")) made.push(new Storm(1, true));
    }
    // The mine's carts aren't a hazard you can turn off, they're what the mine is (like the lava lake's rafts)
    if (arena.tracks !== undefined) {
        made.push(new Tracks(arena.tracks.map(track => track.y)));
    }
    if (roundModifier === "lightning") {
        // Round 2's lightning: like the storm, but not as often
        made.push(new Storm(1.6));
    }
    return made;
}

// A chicken comes in from the edge of the arena: the first clear ground in from a spot on the edge (so not in the
// sea round the lighthouse, say), or anywhere clear if the edges are all water
function spawnChicken() {
    const bounds = getBounds();
    const top = Math.max(bounds.top + 20, 30);
    let spot = null;
    for (let tries = 0; tries < 30 && spot === null; tries++) {
        const side = Math.floor(rng() * 4);
        let x = side === 0 ? bounds.left + 6 : side === 1 ? bounds.right - 6 : random(bounds.left + 10, bounds.right - 10);
        let y = side === 2 ? top : side === 3 ? bounds.bottom - 4 : random(top, bounds.bottom - 4);
        const inward = [{x: 1, y: 0}, {x: -1, y: 0}, {x: 0, y: 1}, {x: 0, y: -1}][side];
        for (let step = 0; step < 30 && spot === null; step++) {
            if (isClearSpot(x, y, 30)) {
                spot = {x, y};
            }
            x += inward.x * 4;
            y += inward.y * 4;
        }
    }
    spot = spot ?? findClearSpot(30);
    if (spot === null) {
        return;
    }
    features.push(new Chicken(spot.x, spot.y));
    popup("BAWK!", spot.x, spot.y - 14, "#ffffff");
    sound.bawk();
}

// ---------- Effects ----------

// Words that pop up where something happened, so players learn what's going on
class Popup {
    constructor(text, x, y, color) {
        this.text = text;
        // Kept far enough from the edges that none of it gets cut off
        const halfWidth = Math.ceil(text.length * 5 / 2) + 2;
        this.x = Math.round(Math.max(halfWidth, Math.min(SCREEN_WIDTH - halfWidth, x)));
        this.y = Math.max(16, Math.min(SCREEN_HEIGHT - 6, y));
        this.color = color;
        this.life = POPUP_TICKS;
    }

    update() {
        this.y = Math.max(16, this.y - 0.12);
        this.life--;
    }

    draw() {
        // Blinks out at the end
        if (this.life < 20 && Math.floor(this.life / 3) % 2 === 0) {
            return;
        }
        const y = Math.round(this.y);
        MDog.Draw.textImage(this.text, this.x, y + 1, "#1c3a18", FONT, {alignX: "center", alignY: "center"});
        MDog.Draw.textImage(this.text, this.x, y, this.color, FONT, {alignX: "center", alignY: "center"});
    }
}

// The white streak a killing blow leaves across a knight
class Slash {
    constructor(x, y, pushX, pushY) {
        this.x = x;
        this.y = y;
        // Across the way he was hit, at a slant
        const angle = datan2(pushY, pushX) + 1;
        this.dx = dcos(angle);
        this.dy = dsin(angle);
        this.life = SLASH_TICKS;
    }

    update() {
        this.life--;
    }

    draw() {
        const age = SLASH_TICKS - this.life;
        const half = SLASH_LENGTH / 2 * Math.min(1, age / 4); // shoots out fast, then fades
        const alpha = Math.min(1, this.life / (SLASH_TICKS / 2));
        const color = `rgba(255, 255, 255, ${alpha})`;
        const x1 = this.x - this.dx * half;
        const y1 = this.y - this.dy * half;
        const x2 = this.x + this.dx * half;
        const y2 = this.y + this.dy * half;
        MDog.Draw.line(x1, y1, x2, y2, color);
        if (this.life > SLASH_TICKS / 2) {
            // Thick at first
            MDog.Draw.line(x1 + 1, y1, x2 + 1, y2, color);
        }
    }
}

// Lightning from the thunder power-up. A target follows the knight for a moment, stops, then lightning hits it.
class Strike {
    // target is the knight it follows, or null to strike spot instead (for the storm)
    constructor(target, owner, spot) {
        this.target = target;
        this.owner = owner;
        this.x = target !== null ? target.getGroundX() : spot.x;
        this.y = target !== null ? target.getGroundY() : spot.y;
        this.ticks = 0;
        this.firedNow = false; // true on the one tick it hits
        this.bolt = null;
        sound.charge();
    }

    getFireTick() {
        return THUNDER_TRACK_TICKS + THUNDER_LOCK_TICKS;
    }

    update() {
        this.ticks++;
        this.firedNow = false;
        if (this.ticks < THUNDER_TRACK_TICKS && this.target !== null && !this.target.dead) {
            // Chases him, a little slower than he can walk, so it can be outrun
            this.x += (this.target.getGroundX() - this.x) * 0.06;
            this.y += (this.target.getGroundY() - this.y) * 0.06;
        }
        if (this.ticks === this.getFireTick()) {
            this.fire();
        }
    }

    fire() {
        this.firedNow = true;
        // A jagged line from the top of the screen down to the spot
        this.bolt = [{x: this.x + random(-8, 8), y: -4}];
        const steps = 7;
        for (let i = 1; i < steps; i++) {
            this.bolt.push({x: this.x + random(-6, 6), y: -4 + (this.y + 4) * i / steps});
        }
        this.bolt.push({x: this.x, y: this.y});

        marks.scorch(this.x, this.y);
        disturbBears(this.x, this.y, THUNDER_RADIUS + BEAR_WAKE_BLAST, this.owner);
        particles.sparks(this.x, this.y - 2, 16, [255, 240, 140]);
        particles.clippings(this.x, this.y, 6);
        particles.dust(this.x, this.y, 5);
        addShake(6);
        flash = Math.max(flash, FLASH_TICKS * 0.6);
        lightningGlow = LIGHTNING_GLOW_TICKS;
        sound.thunder();
        for (const knight of knights) {
            const distance = dhypot(knight.getGroundX() - this.x, knight.getGroundY() - this.y);
            if (distance >= THUNDER_RADIUS && distance < THUNDER_RADIUS + 8) {
                closeCall(knight);
            }
        }
    }

    reaches(knight) {
        return this.firedNow && dhypot(knight.getGroundX() - this.x, knight.getGroundY() - this.y) < THUNDER_RADIUS * Math.max(1, knight.scale * 0.8);
    }

    isDone() {
        return this.ticks > this.getFireTick() + 16;
    }

    // The target: a ring on the ground that blinks faster once it's stopped following
    drawGround() {
        if (this.bolt !== null) {
            return;
        }
        const locked = this.ticks >= THUNDER_TRACK_TICKS;
        const on = Math.floor(this.ticks / (locked ? 4 : 10)) % 2 === 0;
        const color = on ? "rgba(255, 230, 90, 0.9)" : "rgba(255, 120, 60, 0.6)";
        drawRing(this.x, this.y, THUNDER_RADIUS, color);
        MDog.Draw.rectangleFill(Math.round(this.x), Math.round(this.y), 1, 1, color);
    }

    // The bolt, in front of everything. It flickers.
    drawSky() {
        if (this.bolt === null || Math.floor(this.ticks / 2) % 2 === 1) {
            return;
        }
        for (let i = 0; i < this.bolt.length - 1; i++) {
            const a = this.bolt[i];
            const b = this.bolt[i + 1];
            MDog.Draw.line(a.x + 1, a.y, b.x + 1, b.y, "rgba(255, 230, 90, 0.9)");
            MDog.Draw.line(a.x, a.y, b.x, b.y, "#ffffff");
        }
    }
}

// ---------- The match ----------

let knights = [];
let rocks = [];
let trees = [];
let crates = [];
let grassRows = [];
let holes = []; // holes and lava, including the arena's own lava pools
let boulders = [];
let incoming = []; // boulders on their way, while their warnings show: {boulder, ticks}
let strikes = [];
let skyRocks = [];
let horses = [];
let bullets = [];
let thrownSwords = [];
let popups = [];
let slashes = [];
let powerups = [];
let critters = [];
let boulderWait = 0;
let powerupWait = 0;
let hazardWait = 0;
let holeWait = 0;

let stats = {}; // for the end of the match, by color

let scores = {};
let phase = "ready"; // ready, playing, roundOver, matchOver
let phaseTicks = 0;
let roundTicks = 0; // time spent fighting this round
let roundNumber = 0;
let resultText = null; // {text, color} shown when a round or the match is over
let commentary = null; // a line under it, like "REVENGE!"
let lastRoundWinner = null;
let streak = 0; // rounds in a row the last winner has won
let worstDeficit = {}; // the furthest behind each knight has been this match, by color

let hitstop = 0; // ticks the game is frozen for
let slowmo = 0; // ticks the game runs slowly for
let flash = 0; // ticks the screen flashes white for
let lightningGlow = 0; // ticks left of a lightning strike lighting up the dark
let ticks = 0; // every tick since the game started, frozen or not
let liveTicks = 0; // the same, but not counting while paused, for the kill cam
let showHitboxes = false;
let replayBlowTick = null; // when the kill cam should play back a blow, the tick it happened
let roundsUntilShowdown = 0;
let roundsUntilJuggernaut = 0;
let roundsUntilJoust = 0;
let roundsUntilChicken = 0;
let chickenRound = false; // one knight's a chicken, and every so often they swap
let chickenTicks = 0; // since the last swap
let chickenFreeze = 0; // ticks left of everything holding still before they swap
let roundModifier = null; // round 2's one twist: wind, rain, lightning, holes, horse or catapult
let roundHazards = []; // which of the arena's hazards are on this round
let roundBoulders = true; // whether boulders roll in this round

// 0 for the plain first round, 1 for the second round with one twist, 2 for everything after that
function getRoundStage() {
    return roundNumber <= 1 ? 0 : roundNumber === 2 ? 1 : 2;
}

const MODIFIER_LABELS = {lightning: "LIGHTNING STORM", holes: "SHAKY GROUND", horse: "RUNAWAY HORSES", catapult: "CATAPULT FIRE"};

// Which hazards (and whether boulders) are on this round. The first two rounds are set: boulders, and round 2's
// twist if it's a horse or catapult. After that it's random, like the weather.
function pickRoundHazards() {
    roundBoulders = !arena.calm && (getRoundStage() < 2 || rng() < BOULDER_ROUND_CHANCE);
    roundHazards = [];
    if (getRoundStage() < 2) {
        if (roundModifier === "horse" || roundModifier === "catapult") {
            roundHazards = [roundModifier];
        }
        return;
    }
    const kinds = [...new Set(arena.hazards)].filter(kind => isHazardOn(kind)).filter(() => rng() < HAZARD_ROUND_CHANCE);
    while (kinds.length > MAX_ROUND_HAZARDS) {
        kinds.splice(Math.floor(rng() * kinds.length), 1);
    }
    roundHazards = kinds;
}

// Round 2's twist, from whatever the settings (and the arena) allow
// Can a knight be pushed off this arena (into the sea, off the sumo platform, into the canyon, off a raft)? Then
// there's never any wind: it could blow you off.
function canFallOff(someArena) {
    return someArena.platform !== undefined || someArena.cliffs !== undefined || someArena.rafts !== undefined;
}

function pickRoundModifier(nextArena) {
    if (roundNumber !== 2 || nextArena.calm) {
        return null;
    }
    const options = [];
    if (isWeatherOn("wind") && !canFallOff(nextArena)) options.push("wind");
    if (isWeatherOn("rain")) options.push("rain");
    if (nextArena.quiet) {
        return options.length > 0 ? pick(options) : null;
    }
    for (const kind of ["lightning", "catapult"]) {
        if (isHazardOn(kind)) options.push(kind);
    }
    // Horses only run on grass
    if (isHazardOn("horse") && nextArena.grassy) options.push("horse");
    if (isHazardOn("holes") && !nextArena.solidGround) options.push("holes");
    return options.length > 0 ? pick(options) : null;
}

// Which hazards and weather the match's settings allow
function isHazardOn(kind) {
    return simSettings.isOn("hazards", kind);
}

function isWeatherOn(kind) {
    return simSettings.isOn("weathers", kind);
}
let juggernaut = null; // the knight who's the juggernaut this round, if anyone
let calmTicks = 0; // since anyone got hit, for the chickens
let replayReason = null; // why the knockdown being replayed was cool
let aftermath = false; // after the match's replay: everything holds still except the blood
let gameTime = 0; // ticks the game has moved on, for how long ago things happened

// Swing and taunt are read by physical key (so they work the same on any keyboard layout), and are kept until the
// game uses them, so a press during hitstop isn't lost
const pressedCodes = new Set();
window.addEventListener("keydown", e => {
    // Tab normally moves focus around the page, which would take the keyboard away from the game
    if (e.key === "Tab") {
        e.preventDefault();
    }
    if (!e.repeat) {
        pressedCodes.add(e.code);
    }
});

// A left click swings too: for blue in a local match (whose swing is Enter), or your own knight online
window.addEventListener("mousedown", e => {
    if (e.button === 0) {
        pressedCodes.add("MouseLeft");
    }
});

function wasPressed(codes) {
    return codes.some(code => pressedCodes.has(code));
}

// What each player is doing this tick: the way they're holding (like {x: 1, y: -1}), and whether they've pressed
// swing or taunt. Presses stay until the game uses them (at the end of a tick that isn't frozen), like pressedCodes.
// This is part of the game's state, so online it's saved and rolled back with everything else.
let inputs = PLAYERS.map(() => ({move: {x: 0, y: 0}, swing: false, taunt: false}));

// Bits for sending a tick's input over the network
const INPUT_NORTH = 1;
const INPUT_SOUTH = 2;
const INPUT_WEST = 4;
const INPUT_EAST = 8;
const INPUT_SWING = 16;
const INPUT_TAUNT = 32;
const INPUT_REMATCH = 64;
const INPUT_HELD = INPUT_NORTH | INPUT_SOUTH | INPUT_WEST | INPUT_EAST; // the ones that are held, not pressed

// The keyboard, for a local match: each player their own keys
function readLocalInputs() {
    PLAYERS.forEach((player, i) => {
        const move = {x: 0, y: 0};
        for (const dir in DIRS) {
            if (Keyboard.isDown(player.keys[dir])) {
                move.x += DIRS[dir].x;
                move.y += DIRS[dir].y;
            }
        }
        inputs[i].move = move;
        if (wasPressed(player.keys.swing)) {
            inputs[i].swing = true;
        }
        if (wasPressed(player.keys.taunt)) {
            inputs[i].taunt = true;
        }
    });
}

// The keys being held, for an online match: either set of keys moves your knight
function readHeldBits() {
    let bits = 0;
    for (const player of PLAYERS) {
        if (Keyboard.isDown(player.keys.north)) bits |= INPUT_NORTH;
        if (Keyboard.isDown(player.keys.south)) bits |= INPUT_SOUTH;
        if (Keyboard.isDown(player.keys.west)) bits |= INPUT_WEST;
        if (Keyboard.isDown(player.keys.east)) bits |= INPUT_EAST;
    }
    return bits;
}

// And the keys pressed since last time
function readOnlineInputBits(rematchKey) {
    let bits = readHeldBits();
    for (const player of PLAYERS) {
        if (wasPressed(player.keys.swing)) bits |= INPUT_SWING;
        if (wasPressed(player.keys.taunt)) bits |= INPUT_TAUNT;
    }
    if (rematchKey) {
        bits |= INPUT_REMATCH;
    }
    // Pressed keys are sent once
    pressedCodes.clear();
    return bits;
}

function applyInputBits(i, bits) {
    inputs[i].move = {
        x: ((bits & INPUT_EAST) ? 1 : 0) - ((bits & INPUT_WEST) ? 1 : 0),
        y: ((bits & INPUT_SOUTH) ? 1 : 0) - ((bits & INPUT_NORTH) ? 1 : 0),
    };
    if (bits & INPUT_SWING) {
        inputs[i].swing = true;
    }
    if (bits & INPUT_TAUNT) {
        inputs[i].taunt = true;
    }
    if (bits & INPUT_REMATCH) {
        rematchVotes[i] = true;
    }
}

// Presses are used up once the game has had a chance to see them
function usePresses() {
    if (mode === "local") {
        pressedCodes.clear();
    }
    for (const input of inputs) {
        input.swing = false;
        input.taunt = false;
    }
}

function popup(text, x, y, color) {
    popups.push(new Popup(text, x, y, color ?? "#ffffff"));
}

// Would someone standing here fall in: water, lava, a hole, off the bridge or into the sea? strictly leaves out the
// lava lake's bit of leeway past a raft's edge (where you don't fall in, but aren't carried along either).
function isUnsafeGround(x, y, strictly) {
    return isInWater(x, y) || holes.some(hole => strictly && hole.containsStrictly !== undefined ? hole.containsStrictly(x, y) : hole.contains(x, y));
}

function isInTallGrass(x, y) {
    return arena.tallGrass.some(([left, top, right, bottom]) => x > left && x < right && y > top && y < bottom + 2);
}

function getSolids() {
    return [...rocks, ...trees, ...crates, ...getWaterBoxes(), ...getFeatureSolids()];
}

// quiet: no round-start beep (for the title screen's match, which nobody's playing)
function startMatch(quiet = false) {
    scores = {};
    stats = {};
    worstDeficit = {};
    for (const player of PLAYERS) {
        scores[player.color] = 0;
        stats[player.color] = {parries: 0, deflects: 0, powerups: 0, taunts: 0};
        worstDeficit[player.color] = 0;
    }
    roundNumber = 0;
    rematchVotes = PLAYERS.map(() => false);
    lastRoundWinner = null;
    streak = 0;
    roundsUntilShowdown = Math.floor(random(SHOWDOWN_MIN_ROUNDS, SHOWDOWN_MAX_ROUNDS + 1));
    roundsUntilJuggernaut = Math.floor(random(3, 6));
    roundsUntilJoust = Math.floor(random(4, 7));
    roundsUntilChicken = Math.floor(random(2, 5));
    marks.clear();
    killCam.clear();
    startRound(quiet);
}

// ---------- Game modes ----------

// The game modes besides normal rounds. Showdowns and jousts are arenas, so they're on when their arena is.
const GAME_MODES = ["juggernaut", "chicken", "showdown", "joust"];

function isModeOn(values, mode) {
    return mode === "normal" ? values.normalRounds !== false
        : mode === "juggernaut" ? values.juggernaut !== false
        : mode === "chicken" ? values.chickenRounds !== false
        : isOnIn(values, "arenas", mode.toUpperCase());
}

// The arenas a game mode can be played on, of the ones that are on
function getModeArenas(mode) {
    const on = getArenasOn(simSettings.values);
    if (mode === "showdown" || mode === "joust") {
        return on.filter(name => name === mode.toUpperCase());
    }
    if (mode === "chicken") {
        return on.filter(name => canHaveChickenRound(ARENAS[name]));
    }
    // A juggernaut: anywhere he can swing a sword, except the sumo ring
    return on.filter(name => !ARENAS[name].special && !ARENAS[name].sumo);
}

// With normal rounds off: which mode this round is, from the ones that are on and have an arena to be played on. If
// none can be (only chickens on, say, with only the sumo ring on), it's a normal round after all. Null with normal
// rounds on.
function pickForcedMode() {
    if (simSettings.get("normalRounds") !== false) {
        return null;
    }
    const modes = GAME_MODES.filter(mode => isModeOn(simSettings.values, mode) && getModeArenas(mode).length > 0);
    return modes.length > 0 ? pick(modes) : null;
}

// A different arena from last round, if there's another one the mode works on
function pickArenaForMode(mode) {
    const arenas = getModeArenas(mode);
    const others = arenas.filter(name => name !== arenaName);
    return pick(others.length > 0 ? others : arenas);
}

// The arenas the settings have on
function getArenasOn(values) {
    return ARENA_NAMES.filter(name => ARENAS[name] !== undefined && !ARENAS[name].disabled && isOnIn(values, "arenas", name));
}

// Picks the arena for the next round. With just one on, it's always that one. Otherwise it's a different one each
// round (starting on the meadow and river, if they're on), with a showdown or a joust now and then, if they're on.
function pickArena() {
    const on = getArenasOn(simSettings.values);
    if (on.length <= 1) {
        return on[0] ?? "MEADOW";
    }
    const usual = on.filter(name => !ARENAS[name].special);
    // Only special ones: they take turns
    if (usual.length === 0) {
        return pick(on.filter(name => name !== arenaName));
    }
    const easy = ["MEADOW", "RIVER"].filter(name => usual.includes(name));
    if (roundNumber === 1) {
        return easy[0] ?? pick(usual);
    }
    if (roundNumber === 2 && easy.length > 0) {
        return pick(easy);
    }
    if (on.includes("SHOWDOWN")) {
        roundsUntilShowdown--;
        if (roundsUntilShowdown <= 0) {
            roundsUntilShowdown = Math.floor(random(SHOWDOWN_MIN_ROUNDS, SHOWDOWN_MAX_ROUNDS + 1));
            return "SHOWDOWN";
        }
    }
    if (on.includes("JOUST")) {
        roundsUntilJoust--;
        if (roundsUntilJoust <= 0) {
            roundsUntilJoust = Math.floor(random(JOUST_MIN_ROUNDS, JOUST_MAX_ROUNDS + 1));
            return "JOUST";
        }
    }
    const others = usual.filter(name => name !== arenaName);
    return pick(others.length > 0 ? others : usual);
}

function setArena(name) {
    if (name !== arenaName) {
        // Marks belong to the ground they were made on
        marks.clear();
    }
    arenaName = name;
    arena = ARENAS[name];
    arenaLayout = arena.layouts !== undefined ? pick(arena.layouts) : null;
    const layout = arenaLayout ?? arena;
    rocks = layout.rocks.map(rock => new Rock(rock.x, rock.y, arena.rockImage));
    trees = (arena.trees ?? []).map(tree => new Tree(tree.x, tree.y));
    crates = (layout.crates ?? []).map(crate => new Crate(crate.x, crate.y));
    grassRows = [];
    for (const [left, top, right, bottom] of arena.tallGrass) {
        for (let y = top; y <= bottom; y += 4) {
            grassRows.push(new GrassRow(left, right, y, arena.dark === true));
        }
    }
    holes = (arena.lava ?? []).map(pool => new GroundHazard(pool.x, pool.y, pool.rx, pool.ry, "lava", false));
    if (arena.cliffs !== undefined) {
        holes.push(new Canyon(arena.cliffs, arena.bridges));
    }
    if (arena.platform !== undefined) {
        holes.push(new Platform(arena.platform));
    }
    if (arena.rafts !== undefined) {
        holes.push(new LavaLake(arena.rafts));
    }
    features = makeArenaFeatures();
    critters = [];
    for (let i = 0; i < (CRITTER_COUNT[arena.critters] ?? 0); i++) {
        critters.push(new Critter(arena.critters));
    }
    // Clear for the first round, only round 2's twist if that's wind or rain, then whatever the arena has
    let kind = "clear";
    if (!arena.calm) {
        if (getRoundStage() === 2) {
            const weathers = arena.weathers.filter(choice => (choice === "clear" || isWeatherOn(choice)) && (choice !== "wind" || !canFallOff(arena)));
            kind = weathers.length > 0 ? pick(weathers) : "clear";
        } else if (roundModifier === "wind" || roundModifier === "rain") {
            kind = roundModifier;
        }
    }
    weather = new Weather(kind, SCREEN_WIDTH, SCREEN_HEIGHT, arena.slippery ? 0.25 : 1, rng);
    sound.setAmbience(weather.getAmbience());
    music.setSong(arena.music);
}

function startRound(quiet = false) {
    roundNumber++;
    // With normal rounds turned off, every round is one of the game modes that are on (but not the title screen's)
    const roundMode = quiet ? null : pickForcedMode();
    // The twist depends on the arena (no horses off the grass), and setting up the arena depends on the twist
    const nextArena = roundMode !== null ? pickArenaForMode(roundMode) : pickArena();
    roundModifier = pickRoundModifier(ARENAS[nextArena]);
    setArena(nextArena);
    pickRoundHazards();
    knights = PLAYERS.map(player => new Knight(player));
    if (arena.guns) {
        // A showdown: guns instead of swords, and they never run out
        for (const knight of knights) {
            knight.hasSword = false;
            knight.gunAmmo = Infinity;
        }
    }
    if (arena.joust) {
        // A joust: both on horseback, with lances instead of swords
        for (const knight of knights) {
            knight.makeMounted();
        }
    }
    // Every few rounds, one of the knights (at random) starts as a chicken, on an arena where that works (and it waits
    // for the next round if it lands on one that doesn't)
    chickenRound = false;
    chickenTicks = 0;
    chickenFreeze = 0;
    if (roundMode === "chicken") {
        chickenRound = true;
        pick(knights).setChicken(true);
    } else if (roundMode === null && simSettings.get("chickenRounds") !== false && getRoundStage() === 2) {
        roundsUntilChicken--;
        if (roundsUntilChicken <= 0 && canHaveChickenRound(arena)) {
            roundsUntilChicken = Math.floor(random(CHICKEN_MIN_ROUNDS, CHICKEN_MAX_ROUNDS + 1));
            chickenRound = true;
            pick(knights).setChicken(true);
        }
    }
    // Every few rounds, one of the knights (at random) is the juggernaut (but not in a showdown, sumo or a chicken
    // round, and it waits for the next round if it lands on one)
    juggernaut = null;
    if (roundMode === "juggernaut") {
        juggernaut = pick(knights);
        juggernaut.makeJuggernaut();
    } else if (roundMode === null && simSettings.get("juggernaut") && getRoundStage() === 2) {
        roundsUntilJuggernaut--;
        if (roundsUntilJuggernaut <= 0 && !arena.guns && !arena.sumo && !arena.joust && !chickenRound) {
            roundsUntilJuggernaut = Math.floor(random(JUGGERNAUT_MIN_ROUNDS, JUGGERNAUT_MAX_ROUNDS + 1));
            // Either knight, at random (not whoever's behind)
            juggernaut = pick(knights);
            juggernaut.makeJuggernaut();
        }
    }
    boulders = [];
    incoming = [];
    strikes = [];
    skyRocks = [];
    horses = [];
    bullets = [];
    thrownSwords = [];
    // Boulders set to OFF means none at all, including the first
    boulderWait = BOULDER_FIRST_WAIT * BOULDER_SETTING_WAIT[simSettings.get("boulders")];
    hazardWait = HAZARD_FIRST_WAIT;
    holeWait = HOLE_FIRST_WAIT;
    particles.clear();
    popups = [];
    slashes = [];
    powerups = [];
    powerupWait = POWERUP_RESPAWN_TICKS;
    resultText = null;
    commentary = null;
    roundTicks = 0;
    replayBlowTick = null;
    replayReason = null;
    aftermath = false;
    calmTicks = 0;
    hitstop = 0;
    slowmo = 0;
    lightningGlow = 0;
    music.setIntense(isMatchPoint());
    setPhase("ready");
    if (!quiet) {
        sound.ready();
        if (arena.westernIntro) {
            sound.western();
        }
    }
}

// Chicken rounds are on the normal arenas, but not the bridge, sumo or the lighthouse
function canHaveChickenRound(someArena) {
    return !someArena.special && !someArena.calm && !someArena.guns && !someArena.sumo
        && someArena.cliffs === undefined && someArena.lighthouse === undefined;
}

// Feathers bursting off a knight: the chicken's white ones and his plume's
function featherBurst(knight, count) {
    const x = knight.getGroundX();
    const y = knight.getGroundY() - 5;
    particles.feathers(x, y, [245, 245, 240], count);
    particles.feathers(x, y, knight.player.plumeColor, Math.ceil(count / 2));
}

// Everything held still for a moment (with feathers swirling off both of them), then the chicken and the knight swap
// in an explosion of feathers
function updateChickenFreeze() {
    chickenFreeze--;
    const alive = knights.filter(knight => !knight.dead);
    if (chickenFreeze > 0 && chickenFreeze % 16 === 0) {
        for (const knight of alive) {
            featherBurst(knight, 3);
        }
    }
    if (chickenFreeze === 0) {
        for (const knight of alive) {
            knight.setChicken(!knight.isChicken);
            featherBurst(knight, 30);
            particles.dust(knight.getGroundX(), knight.getGroundY(), 10);
            particles.sparks(knight.getGroundX(), knight.getGroundY() - 6, 10, [255, 255, 255]);
        }
        addShake(4);
        flash = Math.max(flash, 6);
        sound.bawk();
    }
    weather.update();
    marks.update();
    particles.update();
    for (const effect of [...popups, ...slashes]) {
        effect.update();
    }
    popups = popups.filter(popup => popup.life > 0);
    slashes = slashes.filter(slash => slash.life > 0);
    usePresses();
}

function setPhase(newPhase) {
    phase = newPhase;
    phaseTicks = 0;
}

// The one with the most points, who gets the crown
function isLeading(knight) {
    return PLAYERS.every(player => player === knight.player || scores[player.color] < scores[knight.player.color]);
}

function isMatchPoint() {
    return PLAYERS.some(player => scores[player.color] === roundsToWin() - 1);
}

// ---------- Spawning things ----------

function nextBoulderWait() {
    const rush = Math.max(BOULDER_RUSH_WAIT, 1 - roundTicks / BOULDER_RUSH_TICKS);
    return random(BOULDER_MIN_WAIT, BOULDER_MAX_WAIT) * rush * BOULDER_SETTING_WAIT[simSettings.get("boulders")];
}

function updateBoulders() {
    if (phase === "playing" && roundBoulders && !arena.noBoulders) {
        boulderWait--;
        if (boulderWait <= 0) {
            const boulder = new Boulder();
            incoming.push({boulder, ticks: BOULDER_WARNING_TICKS});
            sound.rumble(boulder.giant);
            boulderWait = BOULDER_WARNING_TICKS + nextBoulderWait();
        }
    }

    for (const coming of incoming) {
        coming.ticks--;
        if (coming.ticks <= 0) {
            boulders.push(coming.boulder);
        }
    }
    incoming = incoming.filter(coming => coming.ticks > 0);

    for (const boulder of boulders) {
        boulder.update();
    }
    boulders = boulders.filter(boulder => !boulder.isDone());
    rocks = rocks.filter(rock => !rock.isBroken());
}

// Is this a good spot to put something on the ground: not in a rock, tree, water or hole, and not right next to
// a knight?
function isClearSpot(x, y, knightDistance) {
    const box = {left: x - 8, right: x + 8, top: y - 6, bottom: y + 4};
    return !getSolids().some(solid => boxesOverlap(box, solid.getBox()))
        && !isInWater(x - 8, y) && !isInWater(x + 8, y)
        && !holes.some(hole => hole.isNear(x, y, 8) || hole.isCutOff?.(x, y))
        && !features.some(feature => feature.isNear?.(x, y, 8))
        && !knights.some(knight => dhypot(knight.getGroundX() - x, knight.getGroundY() - y) < knightDistance);
}

function findClearSpot(knightDistance) {
    const bounds = getBounds();
    for (let i = 0; i < 40; i++) {
        const x = random(bounds.left + 24, bounds.right - 24);
        const y = random(Math.max(34, bounds.top + 18), bounds.bottom - 16);
        if (isClearSpot(x, y, knightDistance)) {
            return {x, y};
        }
    }
    return null;
}

// The power-ups that can show up right now (none in a calm arena or a showdown, no sword throws in a chicken round)
function getAllowedPowerups() {
    if (arena.calm || arena.guns) {
        return [];
    }
    return SPAWNING_POWERUPS.filter(type => simSettings.isPowerupOn(type) && !(chickenRound && type === "throw"));
}

// A frenzy: a shower of power-ups, all over the arena, but not right next to anyone
function dropFrenzy() {
    const types = getAllowedPowerups().filter(type => type !== "frenzy");
    if (types.length === 0) {
        return;
    }
    let dropped = 0;
    for (let tries = 0; tries < FRENZY_COUNT * 4 && dropped < FRENZY_COUNT; tries++) {
        const spot = findClearSpot(FRENZY_KNIGHT_DISTANCE);
        // Not on top of each other either
        if (spot === null || powerups.some(other => other.life > 0 && dhypot(other.x - spot.x, other.y - spot.y) < 14)) {
            continue;
        }
        const powerup = new Powerup(pick(types), spot.x, spot.y);
        powerup.drop(dropped * FRENZY_DROP_GAP_TICKS);
        powerups.push(powerup);
        dropped++;
    }
    particles.confetti(SCREEN_WIDTH, 2);
    addShake(2);
}

// Tall grass gets flattened by more than swords: rolling boulders, stampeding horses, lightning, catapult rocks,
// fireballs, explosions, dragon fire and tornadoes
function cutGrass() {
    if (grassRows.length === 0) {
        return;
    }
    const around = (x, y, radius) => ({left: x - radius, right: x + radius, top: y - radius * 0.6, bottom: y + radius * 0.6});
    const boxes = [];
    for (const boulder of boulders) {
        if (boulder.landed) boxes.push(boulder.getBox());
    }
    for (const horse of horses) {
        if (horse.isActive() && horse.z === 0) boxes.push(horse.getBox());
    }
    for (const blast of [...strikes, ...skyRocks]) {
        if (blast.firedNow) boxes.push(around(blast.x, blast.y, 14));
    }
    for (const feature of features) {
        if (feature instanceof Explosion && feature.ticks <= 1) boxes.push(around(feature.x, feature.y, 24));
        if (feature instanceof FirePatch) boxes.push(around(feature.x, feature.y, DRAGON_FIRE_RADIUS));
        if (feature instanceof Tornado) boxes.push(around(feature.x, feature.y, TORNADO_CATCH + 4));
    }
    for (const box of boxes) {
        for (const row of grassRows) {
            row.cutBox(box);
        }
    }
}

function updatePowerups() {
    // There's always one on the field: a new one comes soon after the last one's gone
    // (none at all in a calm arena, like the jousting yard, or in a showdown, where it's just guns)
    const allowed = getAllowedPowerups();
    if (phase === "playing" && powerups.length === 0 && allowed.length > 0) {
        powerupWait--;
        if (powerupWait <= 0) {
            const spot = findClearSpot(36);
            if (spot !== null) {
                // Each one's in the list a few times, except frenzy, so that's rarer
                const choices = allowed.flatMap(type => Array(type === "frenzy" ? 1 : FRENZY_RARITY).fill(type));
                // Throwing a sword is a good way to wake a bear from a safe distance, so it comes up more with one around
                if (allowed.includes("throw") && features.some(feature => feature instanceof Bear)) {
                    choices.push(...Array(2 * FRENZY_RARITY).fill("throw"));
                }
                powerups.push(new Powerup(pick(choices), spot.x, spot.y));
                particles.sparks(spot.x, spot.y - 6, 10, [255, 255, 255]);
            }
            powerupWait = POWERUP_RESPAWN_TICKS;
        }
    }

    for (const powerup of powerups) {
        powerup.update();
        const knight = !powerup.isLanded() ? undefined : knights.find(knight => !knight.dead && boxesOverlap(knight.getFeetBox(), powerup.getBox()));
        if (knight !== undefined) {
            givePowerup(knight, powerup.type);
            stats[knight.player.color].powerups++;
            powerup.life = 0;
        }
    }
    powerups = powerups.filter(powerup => powerup.life > 0);
}

function updateHazards(walls) {
    // Only the ones picked for this round
    if (phase === "playing" && roundHazards.length > 0) {
        hazardWait--;
        if (hazardWait <= 0) {
            hazardWait = random(HAZARD_MIN_WAIT, HAZARD_MAX_WAIT);
            const kind = pick(roundHazards);
            if (kind === "horse") {
                if (arena.grassy) {
                    horses.push(new Horse());
                }
            } else if (kind === "dragon") {
                features.push(new Dragon());
            } else if (kind === "tornado") {
                features.push(new Tornado());
            } else {
                // Aimed at someone, give or take
                const target = pick(knights.filter(knight => !knight.dead));
                if (target !== undefined) {
                    const bounds = getBounds();
                    const x = Math.max(bounds.left + 16, Math.min(bounds.right - 16, target.getGroundX() + random(-18, 18)));
                    const y = Math.max(Math.max(30, bounds.top + 16), Math.min(bounds.bottom - 8, target.getGroundY() + random(-12, 12)));
                    skyRocks.push(new SkyRock(x, y, kind === "fireball" ? "fireball" : "rock"));
                }
            }
        }
    }

    // The ground cracking open
    if (phase === "playing" && isHazardOn("holes") && !arena.solidGround && (getRoundStage() === 2 || roundModifier === "holes")) {
        holeWait--;
        if (holeWait <= 0) {
            holeWait = random(HOLE_MIN_WAIT, HOLE_MAX_WAIT);
            const spot = findClearSpot(14);
            if (spot !== null && holes.filter(hole => hole.cracked).length < MAX_HOLES) {
                const rx = random(9, 13);
                holes.push(new GroundHazard(spot.x, spot.y, rx, rx * 0.55, arena.holeStyle, true));
            }
        }
    }

    for (const hole of holes) {
        hole.update();
    }
    holes = holes.filter(hole => !hole.done);
    for (const horse of horses) {
        horse.update(walls);
    }
    horses = horses.filter(horse => !horse.isDone());
    for (const skyRock of skyRocks) {
        skyRock.update();
    }
    for (const strike of strikes) {
        strike.update();
    }

    // Chickens, when nobody's been hit for a while (from round 3 on)
    if (phase === "playing" && isHazardOn("chicken") && getRoundStage() === 2 && !arena.calm && !arena.quiet && !chickenRound) {
        calmTicks++;
        if (calmTicks >= CHICKEN_FIRST_TICKS && (calmTicks - CHICKEN_FIRST_TICKS) % CHICKEN_EVERY_TICKS === 0) {
            spawnChicken();
        }
    }
    for (const feature of features) {
        feature.update?.();
    }
    features = features.filter(feature => !feature.done);
}

function updateProjectiles(walls) {
    for (const sword of thrownSwords) {
        sword.update(walls);
        const owner = sword.owner;
        if (sword.canPickUp(owner)) {
            owner.hasSword = true;
            sword.state = "picked";
            popup("GOT IT!", owner.getGroundX(), owner.getTopY() - 4, "#ffffff");
            particles.glint(sword.x, sword.y - 6);
            sound.shing();
        }
    }
    thrownSwords = thrownSwords.filter(sword => !sword.isDone());
    for (const bullet of bullets) {
        bullet.update(walls);
    }
    // Two bullets that hit each other both stop
    for (const a of bullets) {
        for (const b of bullets) {
            if (a !== b && !a.dead && !b.dead && dhypot(a.x - b.x, a.y - b.y) < 4) {
                a.dead = true;
                b.dead = true;
                particles.sparks((a.x + b.x) / 2, (a.y + b.y) / 2, 12);
                popup("CLINK!", a.x, a.y - 10, "#ffe680");
                sound.reflect();
            }
        }
    }
    bullets = bullets.filter(bullet => !bullet.dead);
    crates = crates.filter(crate => !crate.isBroken());
}

// A new sword drops out of the sky near a knight who lost his
function dropNewSword(knight) {
    if (knight.dead || knight.hasSword) {
        return;
    }
    let spot = null;
    for (let i = 0; i < 30 && spot === null; i++) {
        const x = knight.getGroundX() + random(-30, 30);
        const y = knight.getGroundY() + random(-20, 20);
        if (x > 10 && x < SCREEN_WIDTH - 10 && y > 24 && y < SCREEN_HEIGHT - 4 && isClearSpot(x, y, 0)) {
            spot = {x, y};
        }
    }
    spot = spot ?? {x: knight.getGroundX(), y: knight.getGroundY()};
    thrownSwords.push(new ThrownSword(knight, spot.x, spot.y, {x: 0, y: 0}, true));
    popup("NEW SWORD!", spot.x, spot.y - 14, "#ffffff");
}

const POWERUP_NAMES = {
    shield: ["SHIELD!", "#aad4ff", [170, 210, 250]],
    speed: ["SPEED!", "#ffdc5a", [255, 220, 90]],
    thunder: ["THUNDER!", "#ffe680", [255, 240, 140]],
    grow: ["BIG!", "#ff8070", [224, 80, 64]],
    avalanche: ["AVALANCHE!", "#d8d4e0", [176, 172, 184]],
    fury: ["FURY!", "#ff8a30", [255, 138, 48]],
    throw: ["THROW SWORD!", "#e8e8f0", [230, 230, 240]],
    reverse: ["REVERSE!", "#c890f0", [190, 110, 230]],
    gun: ["GUN!", "#d0d0d8", [200, 200, 210]],
    boogie: ["BOOGIE BOMB!", "#ff80e0", [255, 128, 224]],
    frenzy: ["FRENZY!", "#ffd84a", [248, 184, 0]],
};

function givePowerup(knight, type) {
    const [name, textColor, sparkColor] = POWERUP_NAMES[type];
    // The ones that stack say how many he has now, like "SHIELD X2!"
    const stack = type === "shield" ? Math.min(MAX_STACK, knight.shield + 1)
        : type === "grow" ? Math.min(GROW_SCALES.length - 1, knight.growLevel + 1)
        : type === "throw" ? Math.min(MAX_STACK, knight.throwCharges + 1) : 1;
    const label = stack > 1 ? name.replace("!", "") + " X" + stack + "!" : name;
    popup(label, knight.getGroundX(), knight.getTopY() - 4, textColor);
    particles.sparks(knight.getGroundX(), knight.getGroundY() - 8, 12, sparkColor);
    sound.pickup();

    // The ones that go after the other knight
    const others = knights.filter(other => other !== knight && !other.dead);

    if (type === "shield") {
        knight.shield = stack;
    } else if (type === "speed") {
        knight.speedTicks = SPEED_BOOST_TICKS;
    } else if (type === "grow") {
        knight.growLevel = stack;
        knight.growTicks = GROW_TICKS;
        sound.grow();
    } else if (type === "fury") {
        knight.furyTicks = FURY_TICKS;
        sound.fury();
    } else if (type === "throw") {
        knight.throwCharges = stack;
    } else if (type === "gun") {
        knight.gunAmmo = GUN_AMMO;
        knight.gunCooldown = 0;
    } else if (type === "thunder") {
        for (const other of others) {
            strikes.push(new Strike(other, knight));
        }
    } else if (type === "frenzy") {
        dropFrenzy();
    } else if (type === "boogie") {
        // The other knight has to dance: he can walk about, but can't attack
        for (const other of others) {
            other.danceTicks = BOOGIE_TICKS;
            popup("DANCE!", other.getGroundX(), other.getTopY() - 4, "#ff80e0");
            particles.confetti(SCREEN_WIDTH, 2);
        }
        sound.boogie();
    } else if (type === "reverse") {
        for (const other of others) {
            other.reverseTicks = REVERSE_TICKS;
            popup("REVERSED!", other.getGroundX(), other.getTopY() - 4, "#c890f0");
        }
        sound.reverse();
    } else if (type === "avalanche") {
        for (const other of others) {
            for (let i = 0; i < AVALANCHE_COUNT; i++) {
                // Lined up with where he is now, so he has to move
                const aimAt = {x: other.getGroundX() + random(-AVALANCHE_SPREAD, AVALANCHE_SPREAD), y: other.getGroundY() - 6 + random(-AVALANCHE_SPREAD, AVALANCHE_SPREAD)};
                const boulder = new Boulder({owner: knight, aimAt});
                incoming.push({boulder, ticks: BOULDER_WARNING_TICKS + i * AVALANCHE_GAP_TICKS});
            }
        }
        sound.rumble(true);
    }
}

// ---------- Hits ----------

function checkSwords() {
    const alive = knights.filter(knight => !knight.dead);

    // Two swords meeting clang off each other
    for (let i = 0; i < alive.length; i++) {
        for (let j = i + 1; j < alive.length; j++) {
            const a = alive[i];
            const b = alive[j];
            const swordA = a.getSwordBox();
            const swordB = b.getSwordBox();
            if (swordA !== null && swordB !== null && boxesOverlap(swordA, swordB)) {
                const awayX = a.getGroundX() - b.getGroundX();
                const awayY = a.getGroundY() - b.getGroundY();
                a.clash(awayX, awayY);
                b.clash(-awayX, -awayY);
                stats[a.player.color].parries++;
                stats[b.player.color].parries++;
                const spot = boxCenter(swordA);
                particles.sparks(spot.x, spot.y, 16);
                popup("PARRY!", spot.x, spot.y - 10, "#ffe680");
                disturbBears(spot.x, spot.y, BEAR_WAKE_CLANG, null);
                addShake(3);
                hitstop = HITSTOP_CLASH;
                sound.clang();
            }
        }
    }

    const walls = [...rocks, ...trees, ...crates, ...getFeatureSolids()];
    for (const knight of alive) {
        const swordBox = knight.getSwordBox();
        if (swordBox === null) {
            continue;
        }

        // Bears, chickens, barrels and so on
        for (const feature of features) {
            feature.onSword?.(knight, swordBox);
        }

        // Cutting the grass: tall grass gets chopped down, and on grassy ground the sword shaves a lighter streak
        let cut = 0;
        for (const row of grassRows) {
            cut += row.cutBox(swordBox);
        }
        if (cut > 0 && !knight.swingCutGrass) {
            knight.swingCutGrass = true;
            sound.grassCut();
        }
        if (arena.grassy && rng() < 0.6) {
            const groundY = Math.max(knight.getGroundY() - 3, Math.min(knight.getGroundY() + 4, swordBox.bottom));
            const color = rng() < 0.6 ? "rgba(160, 210, 120, 0.6)" : "rgba(40, 80, 30, 0.4)";
            marks.dot(random(swordBox.left, swordBox.right), groundY + random(-1, 1), 1, 1, color);
        }
        if (rng() < (isInTallGrass(knight.getGroundX(), knight.getGroundY()) ? 0.8 : 0.3)) {
            const spot = boxCenter(swordBox);
            particles.clippings(spot.x, spot.y + 3, 1);
        }

        // Swords hitting boulders send them back
        for (const boulder of boulders) {
            if (boulder.giant && !knight.swingHitRock && boxesOverlap(swordBox, boulder.getBox())) {
                // Too big to hit back, the sword just bounces off
                knight.swingHitRock = true;
                knight.recoil();
                const spot = boxCenter(swordBox);
                particles.sparks(spot.x, spot.y, 6);
                popup("TOO BIG!", spot.x, spot.y - 10, "#ffe680");
                sound.tink();
            }
            if (boulder.canBeDeflected() && boxesOverlap(swordBox, boulder.getBox())) {
                boulder.deflect(knight);
                stats[knight.player.color].deflects++;
                knight.lastDeflect = gameTime;
                const spot = boxCenter(boulder.getBox());
                particles.sparks(spot.x, spot.y, 8);
                popup("DEFLECT!", spot.x, spot.y - 10, "#ffe680");
                addShake(2);
                hitstop = Math.max(hitstop, HITSTOP_DEFLECT);
                sound.tink();
            }
        }

        // Swords bounce bullets back, and knock thrown swords out of the air
        for (const bullet of bullets) {
            if (bullet.owner !== knight && boxesOverlap(swordBox, growBox(bullet.getBox(), 1))) {
                bullet.reflect(knight);
                stats[knight.player.color].deflects++;
                knight.lastDeflect = gameTime;
                particles.sparks(bullet.x, bullet.y, 8);
                popup("REFLECT!", bullet.x, bullet.y - 10, "#ffe680");
                hitstop = Math.max(hitstop, HITSTOP_DEFLECT);
                sound.reflect();
            }
        }
        for (const sword of thrownSwords) {
            if (sword.isFlying() && sword.owner !== knight && boxesOverlap(swordBox, sword.getBox())) {
                sword.drop();
                particles.sparks(sword.x, sword.y - sword.z, 12);
                popup("PARRY!", sword.x, sword.y - 16, "#ffe680");
                disturbBears(sword.x, sword.y, BEAR_WAKE_CLANG, null);
                stats[knight.player.color].parries++;
                hitstop = Math.max(hitstop, HITSTOP_CLASH);
                sound.clang();
            }
        }

        // Swords bounce off rocks and trees
        const wall = walls.find(wall => boxesOverlap(swordBox, wall.getBox()));
        if (wall !== undefined && !knight.swingHitRock) {
            knight.swingHitRock = true;
            knight.recoil();
            const spot = boxCenter(swordBox);
            particles.sparks(spot.x, spot.y, 6);
            addShake(1);
            sound.tink();
        }
    }
}

// What would hit this knight right now, if anything: {cause, push, source}
function findDanger(target) {
    const joust = findJoustDanger(target);
    if (joust !== null) {
        return joust;
    }
    const attacker = knights.find(attacker => attacker !== target && attacker.swordReaches(target));
    if (attacker !== undefined) {
        return {cause: "sword", push: DIRS[attacker.facing], source: attacker};
    }
    const thrown = thrownSwords.find(sword => sword.canHit(target));
    if (thrown !== undefined) {
        return {cause: "thrown", push: {x: thrown.dx, y: thrown.dy}, source: thrown};
    }
    const bullet = bullets.find(bullet => bullet.canHit(target));
    if (bullet !== undefined) {
        return {cause: "bullet", push: {x: bullet.dx, y: bullet.dy}, source: bullet};
    }
    const boulder = boulders.find(boulder => boulder.canHit(target));
    if (boulder !== undefined) {
        return {cause: "boulder", push: {x: boulder.dx, y: boulder.dy}, source: boulder};
    }
    const horse = horses.find(horse => horse.canHit(target));
    if (horse !== undefined) {
        return {cause: "horse", push: {x: horse.dir, y: -0.3}, source: horse};
    }
    const blast = [...strikes, ...skyRocks].find(blast => blast.reaches(target));
    if (blast !== undefined) {
        // Away from where it hit
        const awayX = target.getGroundX() - blast.x;
        const awayY = target.getGroundY() - blast.y;
        const length = dhypot(awayX, awayY);
        const push = length < 1 ? {x: 0, y: 1} : {x: awayX / length, y: awayY / length};
        return {cause: blast instanceof Strike ? "lightning" : blast.style, push, source: blast};
    }
    for (const feature of features) {
        const danger = feature.danger?.(target);
        if (danger !== null && danger !== undefined) {
            return danger;
        }
    }
    return null;
}

// The word that pops up over a knight who went down, for how it happened
function getKnockdownWord(hit) {
    const words = {
        thrown: "BULLSEYE!", boulder: "CRUSHED!", horse: "TRAMPLED!", lightning: "ZAPPED!", rock: "SQUASHED!",
        fireball: "TOASTED!", explosion: "KABOOM!", fire: "TOASTED!", bear: "MAULED!", minecart: "RUN OVER!",
        quicksand: "SWALLOWED!", joust: "UNHORSED!",
    };
    if (hit.cause === "fall" && arena.sumo) {
        return "RING OUT!";
    }
    if (hit.cause === "bullet") {
        return hit.source.travelled > SNIPE_DISTANCE ? "SNIPED!" : "SHOT!";
    }
    if (hit.cause === "fall") {
        return {lava: "TOASTED!", ice: "SPLASH!", dirt: "FELL!"}[hit.source.style];
    }
    return words[hit.cause] ?? null;
}

// Whatever hit a shield or a juggernaut's heart is used up
function useUp(danger) {
    if (danger.cause === "sword") {
        danger.source.swingSpent = true;
    } else if (danger.cause === "boulder") {
        danger.source.crash();
    } else if (danger.cause === "bullet") {
        danger.source.dead = true;
    } else if (danger.cause === "thrown") {
        danger.source.drop();
    }
}

// late: the round's already decided, so anyone going down doesn't change the score
function checkHits(late = false) {
    // Close calls: dangerous things going right past someone
    if (closeCallCooldown > 0) {
        closeCallCooldown--;
    }
    for (const knight of knights) {
        for (const boulder of boulders) {
            checkCloseCall(boulder, boulder.getBox(), knight, boulder.canHit(knight));
        }
        for (const horse of horses) {
            if (horse.isActive()) {
                checkCloseCall(horse, horse.getBox(), knight, horse.canHit(knight));
            }
        }
        for (const bullet of bullets) {
            checkCloseCall(bullet, bullet.getBox(), knight, bullet.canHit(knight));
        }
        for (const sword of thrownSwords) {
            if (sword.isFlying()) {
                checkCloseCall(sword, sword.getBox(), knight, sword.canHit(knight));
            }
        }
    }

    // Every hit is found before anyone goes down, so two knights hitting each other at once both go down
    const hits = [];
    for (const target of knights) {
        if (target.dead) {
            continue;
        }

        // Falling in
        const hole = holes.find(hole => hole.contains(target.getGroundX(), target.getGroundY()));
        if (hole !== undefined) {
            hits.push({target, cause: "fall", push: {x: 0, y: 0}, source: hole});
            continue;
        }

        const danger = findDanger(target);
        if (danger === null) {
            continue;
        }

        if (target.isInvulnerable()) {
            continue;
        }

        if (target.shield) {
            // The shield takes it, and whatever hit it is used up
            target.breakShield(danger.push.x, danger.push.y);
            if (danger.cause === "sword") {
                danger.source.swingSpent = true;
            } else if (danger.cause === "boulder") {
                danger.source.crash();
            } else if (danger.cause === "bullet") {
                danger.source.dead = true;
            } else if (danger.cause === "thrown") {
                danger.source.drop();
            }
            addShake(4);
            hitstop = Math.max(hitstop, HITSTOP_BLOCK);
            calmTicks = 0;
            continue;
        }

        if (arena.sumo) {
            // In sumo nothing knocks you down, it just shoves you (hopefully into the water)
            target.shove(danger.push);
            if (danger.cause === "sword") {
                danger.source.swingSpent = true;
            } else if (danger.cause === "boulder") {
                danger.source.crash();
            } else if (danger.cause === "bullet") {
                danger.source.dead = true;
            } else if (danger.cause === "thrown") {
                danger.source.drop();
            }
            addShake(3);
            hitstop = Math.max(hitstop, HITSTOP_CLASH);
            calmTicks = 0;
            sound.thunk();
            continue;
        }

        if (target.lives > 1) {
            // A juggernaut loses a heart instead
            target.loseLife(danger.push);
            useUp(danger);
            addShake(5);
            hitstop = Math.max(hitstop, HITSTOP_BLOCK);
            calmTicks = 0;
            continue;
        }

        hits.push({target, ...danger});
    }
    if (hits.length === 0) {
        return;
    }

    for (const hit of hits) {
        const body = boxCenter(hit.target.getBodyBox());
        hit.wasChicken = hit.target.isChicken;
        if (hit.wasChicken) {
            sound.bawk();
        }
        if (hit.cause === "fall" || hit.cause === "quicksand") {
            hit.target.fall(hit.source);
        } else {
            hit.target.die(hit.push.x, hit.push.y);
        }
        if (hit.cause === "sword" || hit.cause === "thrown") {
            slashes.push(new Slash(body.x, body.y, hit.push.x, hit.push.y));
        }
        if (hit.cause === "boulder") {
            hit.source.crash();
        } else if (hit.cause === "bullet") {
            hit.source.dead = true;
        } else if (hit.cause === "thrown") {
            hit.source.drop();
        }
        // Knocked down by his own lightning, avalanche, bullet...
        const ownGoal = hit.source.owner === hit.target;
        const word = ownGoal ? "OWN GOAL!" : hit.wasChicken && hit.cause === "sword" ? "PLUCKED!" : getKnockdownWord(hit);
        if (word !== null) {
            popup(word, body.x, body.y - 14, "#ffe680");
        }
        hit.ownGoal = ownGoal;
    }
    if (late) {
        // Too late to count, so it's just a bump, not the big knockdown
        sound.hit();
        addShake(4);
        return;
    }
    sound.hit();
    addShake(6);
    flash = FLASH_TICKS;
    hitstop = HITSTOP_KILL;
    slowmo = SLOWMO_KILL;

    scoreRound(hits);
}

// Blood that lands stays on the ground
function bloodLanded(x, y) {
    marks.dot(x, y, 1, 1, "rgba(130, 12, 12, 0.85)");
}

// Who knocked him down, if it was a knight
function getKiller(hit) {
    if (hit.cause === "sword") {
        return hit.source;
    }
    if (hit.cause === "thrown" || hit.cause === "bullet" || hit.cause === "lightning") {
        return hit.source.owner;
    }
    if (hit.cause === "boulder") {
        return hit.source.deflectedBy ?? hit.source.owner;
    }
    if (hit.cause === "explosion" || hit.cause === "bear") {
        return hit.source.owner ?? null;
    }
    if (hit.cause === "joust") {
        return hit.source;
    }
    return null;
}

// Why a knockdown is worth replaying, or null if it's just a normal one
function getCoolReason(hits, winner) {
    if (hits.length > 1) {
        return "DOUBLE KO";
    }
    const hit = hits[0];
    const killer = getKiller(hit);
    const recent = time => gameTime - time < COOL_RECENT_TICKS;
    const reasons = [
        // Abilities and power-ups
        [hit.ownGoal, "OWN GOAL"],
        [hit.target.tauntTicks > 0, "TAUNT PUNISHED"],
        [gameTime - hit.target.lastFling < COOL_RECENT_TICKS, "TORNADO"],
        [hit.cause === "minecart", "RUN OVER"],
        [hit.cause === "explosion", "KABOOM"],
        [hit.cause === "fire", "DRAGON FIRE"],
        [hit.cause === "bear", "MAULED"],
        [hit.target.grabTicks > 0, "GRAVE GRAB"],
        [hit.cause === "thrown", "SWORD THROW"],
        [hit.cause === "bullet" && hit.source.reflected === true, "REFLECTED"],
        [hit.cause === "boulder" && hit.source.deflectedBy === killer && killer !== null, "DEFLECTED BOULDER"],
        // The arena
        [hit.cause === "horse", "TRAMPLED"],
        // Something the winner just pulled off
        [winner !== null && recent(winner.lastParry), "PARRY COUNTER"],
        [winner !== null && recent(winner.lastDeflect), "DEFLECT"],
    ];
    return reasons.find(([happened]) => happened)?.[1] ?? null;
}

function replay(reason) {
    // Never in a joust: the round just ends
    if (arena.joust) {
        return;
    }
    replayBlowTick = mode === "online" ? simTicks : liveTicks;
    replayReason = reason;
}

function scoreRound(hits) {
    const alive = knights.filter(knight => !knight.dead);
    const killCamSetting = simSettings.get("killCam");
    const coolReason = getCoolReason(hits, alive[0] ?? null);
    // "COOL KILLS" (or anything older) replays every cool knockdown, "FINAL BLOW" only the match's last one if it
    // was cool
    const replayCool = killCamSetting !== "OFF" && killCamSetting !== "FINAL BLOW";
    if (alive.length === 0) {
        resultText = {text: "DOUBLE KO!", color: "#ffffff"};
        commentary = null;
        setPhase("roundOver");
        if (replayCool) {
            replay(coolReason);
        }
        return;
    }

    const winner = alive[0].player;
    const loser = PLAYERS.find(player => player !== winner);
    const totalBefore = PLAYERS.reduce((total, player) => total + scores[player.color], 0);
    scores[winner.color]++;

    // Commentary
    streak = lastRoundWinner === winner ? streak + 1 : 1;
    const revenge = lastRoundWinner !== null && lastRoundWinner !== winner;
    lastRoundWinner = winner;
    for (const player of PLAYERS) {
        const other = PLAYERS.find(p => p !== player);
        worstDeficit[player.color] = Math.max(worstDeficit[player.color], scores[other.color] - scores[player.color]);
    }
    const lines = [
        [hits.some(hit => hit.ownGoal), "OWN GOAL!"],
        [totalBefore === 0, "FIRST BLOOD!"],
        [streak >= 4, "UNSTOPPABLE!"],
        [streak === 3, "ON FIRE!"],
        [scores[winner.color] === scores[loser.color] && worstDeficit[winner.color] >= 2, "COMEBACK!"],
        [revenge, "REVENGE!"],
        [roundTicks < QUICK_ROUND_TICKS, "QUICK KILL!"],
        [roundTicks > EPIC_ROUND_TICKS, "WHAT A FIGHT!"],
    ];
    commentary = lines.find(([happened]) => happened)?.[1] ?? null;

    sound.cheer();
    if (scores[winner.color] >= roundsToWin()) {
        resultText = {text: winner.color.toUpperCase() + " WINS!", color: winner.textColor};
        hitstop = HITSTOP_MATCH_POINT;
        slowmo = SLOWMO_MATCH_POINT;
        addShake(9);
        setPhase("matchOver");
        sound.finalHit();
        sound.matchWin();
        music.setSong(null);
        // The loser bleeds, from now until the next match
        const loserKnight = knights.find(knight => knight.player === loser);
        if (loserKnight.fallHole === null && !loserKnight.isChicken) {
            loserKnight.bleeding = true;
            particles.blood(loserKnight.getGroundX(), loserKnight.getGroundY() - 6, 24, bloodLanded);
        }
        // Replayed only if it was cool, like any other knockdown
        if (killCamSetting !== "OFF" && coolReason !== null) {
            replay(coolReason);
        }
    } else {
        resultText = {text: winner.color.toUpperCase() + " SCORES!", color: winner.textColor};
        setPhase("roundOver");
        sound.roundWin();
        if (replayCool && coolReason !== null) {
            replay(coolReason);
        }
    }
}

// After the match's replay nothing moves any more, except the blood, the confetti and the weather
function updateAftermath() {
    phaseTicks++;
    for (const knight of knights) {
        if (knight.dead) {
            knight.bleed();
        } else {
            knight.setState("idle");
            knight.getAnimation().time++;
        }
    }
    if (phaseTicks < 4 * TICKS_PER_SECOND && phaseTicks % 3 === 0) {
        particles.confetti(SCREEN_WIDTH, 2);
    }
    for (const critter of critters) {
        critter.update([]);
    }
    weather.update();
    marks.update();
    particles.update();
    for (const effect of [...popups, ...slashes]) {
        effect.update();
    }
    popups = popups.filter(popup => popup.life > 0);
    slashes = slashes.filter(slash => slash.life > 0);
    usePresses();
}

// The title screen: the knights stand around on the meadow (now and then swinging at the air) until someone starts
function showTitle() {
    startMatch(true);
    setPhase("title");
    const [red, blue] = knights;
    red.brain = new DemoBrain(red, blue);
    blue.brain = new DemoBrain(blue, red);
}

function updateTitle() {
    phaseTicks++;
    const world = {solids: getSolids(), knights};
    for (const knight of knights) {
        knight.brain?.update();
        knight.update(world, true);
    }
    // The ground moves like it does in a match (the lava lake's rafts drift, and so on), except that bridge planks
    // don't break under them
    for (const hole of holes) {
        if (!(hole instanceof Canyon)) {
            hole.update();
        }
    }
    // The arena's moving parts and anything fired keep going too (the lighthouse's beam, bullets in a showdown...)
    for (const feature of features) {
        feature.update?.();
    }
    features = features.filter(feature => !feature.done);
    updateProjectiles([...rocks, ...trees, ...crates, ...getFeatureSolids()]);
    // Their swords clang when they meet (but nobody gets knocked down here)
    checkSwords();
    for (const critter of critters) {
        critter.update(knights.map(knight => ({x: knight.getGroundX(), y: knight.getGroundY()})));
    }
    for (const effect of [...popups, ...slashes]) {
        effect.update();
    }
    popups = popups.filter(popup => popup.life > 0);
    marks.update();
    weather.update();
    particles.update();
    usePresses();
}

function update() {
    if (phase === "title") {
        updateTitle();
        return;
    }
    if (aftermath) {
        updateAftermath();
        return;
    }
    if (chickenFreeze > 0) {
        updateChickenFreeze();
        return;
    }
    gameTime++;
    phaseTicks++;

    if (phase === "ready" && phaseTicks >= READY_TICKS) {
        setPhase("playing");
        sound.fight();
    }
    if (phase === "playing") {
        roundTicks++;
        if (chickenRound) {
            chickenTicks++;
            const left = CHICKEN_SWAP_TICKS - chickenTicks;
            if (left > 0 && left <= 3 * TICKS_PER_SECOND && left % TICKS_PER_SECOND === 0) {
                sound.menuMove(); // ticking down to the swap
            }
            if (left <= 0) {
                chickenTicks = 0;
                chickenFreeze = CHICKEN_FREEZE_TICKS;
                sound.cluck();
                for (const knight of knights.filter(knight => !knight.dead)) {
                    featherBurst(knight, 14);
                }
            }
        }
    }
    if (phase === "roundOver" && phaseTicks >= ROUND_OVER_TICKS) {
        startRound();
        return;
    }

    const solids = getSolids();
    const world = {solids, knights};
    const canAct = phase !== "ready";
    for (const knight of knights) {
        knight.update(world, canAct);
    }

    // Thrown swords, bullets and horses go over the river, so they only bump into rocks and trees
    const walls = [...rocks, ...trees, ...crates, ...getFeatureSolids()];
    updateBoulders();
    updatePowerups();
    updateHazards(walls);
    updateProjectiles(walls);
    cutGrass();
    checkSwords();
    if (phase === "playing") {
        checkJousts();
    }
    // Once the round's decided the score can't change, but the winner can still go down (walking into lava, say)
    if (phase === "playing") {
        checkHits();
    } else if (phase === "roundOver" || phase === "matchOver") {
        checkHits(true);
    }

    // Anything that moves scares the butterflies
    const threats = [
        ...knights.map(knight => ({x: knight.getGroundX(), y: knight.getGroundY()})),
        ...boulders.map(boulder => boxCenter(boulder.getBox())),
        ...horses.map(horse => ({x: horse.x, y: horse.y})),
    ];
    for (const critter of critters) {
        critter.update(threats);
    }
    // Embers drifting up off the volcano
    if (arena.critters === "embers" && rng() < 1 / 14) {
        particles.embers(random(0, SCREEN_WIDTH), random(20, SCREEN_HEIGHT), 1);
    }

    // Confetti for the winner
    if (phase === "matchOver" && phaseTicks < 4 * TICKS_PER_SECOND && phaseTicks % 3 === 0) {
        particles.confetti(SCREEN_WIDTH, 2);
    }

    weather.update();
    marks.update();
    particles.update();
    for (const effect of [...popups, ...slashes]) {
        effect.update();
    }
    popups = popups.filter(popup => popup.life > 0);
    slashes = slashes.filter(slash => slash.life > 0);
    strikes = strikes.filter(strike => !strike.isDone());
    skyRocks = skyRocks.filter(skyRock => !skyRock.isDone());

    // Presses are used up once the game has had a chance to see them
    usePresses();
}

// ---------- Drawing ----------

function drawScore() {
    const rounds = roundsToWin();
    for (const player of PLAYERS) {
        for (let i = 0; i < rounds; i++) {
            const x = player.scoreSide < 0 ? 6 + i * 8 : SCREEN_WIDTH - 11 - i * 8;
            // A dark edge round each, so they show up on water, banners and anything else
            MDog.Draw.rectangle(x - 1, 5, 7, 7, "rgba(0, 0, 0, 0.45)");
            if (i < scores[player.color]) {
                MDog.Draw.rectangleFill(x, 6, 5, 5, player.textColor);
            } else {
                MDog.Draw.rectangleFill(x, 6, 5, 5, "rgba(0, 0, 0, 0.25)");
                MDog.Draw.rectangle(x, 6, 5, 5, "rgba(255, 255, 255, 0.35)");
            }
        }
    }
}

function drawText(text, y, color, size, x) {
    x = x ?? CENTER_X;
    // A dark copy one pixel down, so it reads on anything
    MDog.Draw.textImage(text, x, y + size, "#1c2a18", FONT, {alignX: "center", alignY: "center", size: size});
    MDog.Draw.textImage(text, x, y, color, FONT, {alignX: "center", alignY: "center", size: size});
}

// How each knight did, side by side: red's number, what it is, blue's number
function drawStats() {
    const rows = [["PARRIES", "parries"], ["DEFLECTS", "deflects"], ["POWER-UPS", "powerups"], ["TAUNTS", "taunts"]];
    rows.forEach(([label, key], i) => {
        const y = 92 + i * 11;
        drawText(label, y, "#ffffff", 1);
        drawText("" + stats[PLAYERS[0].color][key], y, PLAYERS[0].textColor, 1, CENTER_X - 50);
        drawText("" + stats[PLAYERS[1].color][key], y, PLAYERS[1].textColor, 1, CENTER_X + 50);
    });
}

// A warning "!" (or a few side by side) centered on a spot, with a dark edge so it shows up on anything
function drawBang(x, y, color, count = 1) {
    const width = count * 4 - 2;
    const left = Math.round(x - width / 2);
    const top = Math.round(y - 5);
    for (let i = 0; i < count; i++) {
        const bangX = left + i * 4;
        MDog.Draw.rectangleFill(bangX - 1, top - 1, 4, 8, "rgba(20, 20, 20, 0.6)");
        MDog.Draw.rectangleFill(bangX - 1, top + 8, 4, 4, "rgba(20, 20, 20, 0.6)");
        MDog.Draw.rectangleFill(bangX, top, 2, 6, color);
        MDog.Draw.rectangleFill(bangX, top + 9, 2, 2, color);
    }
}

function drawWarnings() {
    const blink = Math.floor(ticks / 10) % 2 === 0;
    for (const coming of incoming) {
        // Only shows for the last second, so an avalanche's later boulders don't all warn at once
        if (coming.ticks > BOULDER_WARNING_TICKS) {
            continue;
        }
        const spot = coming.boulder.getWarningSpot();
        // An avalanche's boulders blink in the color of the knight who sent them
        const owner = coming.boulder.owner;
        const color = blink ? "#ffffff" : (owner !== null ? owner.player.textColor : "#ffcc33");
        drawBang(spot.x, spot.y, color, coming.boulder.giant ? 2 : 1);
    }
    for (const feature of features) {
        feature.drawWarning?.(blink);
    }
    for (const horse of horses) {
        if (!horse.isActive()) {
            const spot = horse.getWarningSpot();
            drawBang(spot.x, spot.y, blink ? "#ffffff" : "#c08040");
        }
    }
}

// In the dark forest everything's dark except near the knights and anything that glows. Drawn as strips: dark
// away from all the lights, dim near them, and clear right by them. On the lighthouse's island only the beams light
// anything up, and away from them it's pitch black.
function drawDarkness() {
    const lights = [];
    for (const feature of features) {
        lights.push(...(feature.getLights?.() ?? []));
    }
    if (!arena.beamOnly) {
        addGlowingLights(lights);
    }
    // Lightning about to strike lights up where it's going to hit, even where nothing else gives off light, and it
    // flickers brighter as it's about to come down
    for (const strike of strikes) {
        if (strike.bolt === null) {
            const locked = strike.ticks >= THUNDER_TRACK_TICKS;
            const flicker = locked && Math.floor(strike.ticks / 4) % 2 === 0 ? 4 : 0;
            lights.push({x: strike.x, y: strike.y, r: THUNDER_RADIUS + 8 + flicker});
        }
    }

    // A lightning flash lights up everything for a moment
    const flashLift = Math.min(1, flash / (FLASH_TICKS * 0.5));
    const strength = 1 - Math.max(flashLift, getLightningLift());
    if (strength <= 0) {
        return;
    }
    const dark = `rgba(4, 8, 20, ${(arena.beamOnly ? 1 : 0.8) * strength})`;
    const dim = `rgba(4, 8, 20, ${(arena.beamOnly ? 0.7 : 0.42) * strength})`;
    drawLightStrips(lights, dark, dim);
}

// How much a lightning strike is lighting up the dark right now, from 0 to 1
function getLightningLift() {
    if (lightningGlow <= 0) {
        return 0;
    }
    const age = LIGHTNING_GLOW_TICKS - lightningGlow;
    if (age < 6) return 1;
    if (age < 10) return 0.35; // the flicker
    if (age < 24) return 1;
    return Math.max(0, 1 - (age - 24) / (LIGHTNING_GLOW_TICKS - 24));
}

// Everything that gives off a little light of its own: the knights, power-ups, fireflies...
function addGlowingLights(lights) {
    for (const knight of knights) {
        const glow = arena.knightLight ?? 34;
        lights.push({x: knight.getGroundX(), y: knight.getGroundY() - 8 * knight.scale, r: knight.dead ? glow * 0.5 : glow * Math.max(1, knight.scale * 0.8)});
    }
    for (const powerup of powerups) lights.push({x: powerup.x, y: powerup.y - 6, r: 14});
    for (const sword of thrownSwords) lights.push({x: sword.x, y: sword.y - sword.z, r: 9});
    for (const bullet of bullets) lights.push({x: bullet.x, y: bullet.y, r: 8});
    for (const critter of critters) {
        if (critter.isLit()) lights.push({x: critter.x, y: critter.y - critter.z, r: 6});
    }
    for (const skyRock of skyRocks) lights.push({x: skyRock.x, y: skyRock.y, r: skyRock.style === "fireball" ? 22 : 14});
}

// Covers the screen in darkness, a strip at a time, leaving the lights clear
function drawLightStrips(lights, dark, dim) {
    const clamp = x => Math.max(0, Math.min(SCREEN_WIDTH, Math.round(x)));
    for (let y = 0; y < SCREEN_HEIGHT; y += 2) {
        // Where each light's dim (level 1) and bright (level 2) parts start and stop along this row
        const events = [];
        for (const light of lights) {
            const dy = (y + 1 - light.y) / 0.8; // a little squashed, like it's lighting up the ground
            for (const [radius, level] of [[light.r, 1], [light.r * 0.6, 2]]) {
                if (Math.abs(dy) < radius) {
                    const half = Math.sqrt(radius * radius - dy * dy);
                    const a = clamp(light.x - half);
                    const b = clamp(light.x + half);
                    if (b > a) {
                        events.push([a, level, 1], [b, level, -1]);
                    }
                }
            }
        }
        events.sort((a, b) => a[0] - b[0]);

        // Goes along the row once, keeping count of how many lights of each level it's inside. Each stretch is as
        // bright as the brightest light covering it, and only the dark and dim stretches need drawing.
        const inside = [0, 0, 0];
        let runStart = 0;
        let runLevel = 0;
        let i = 0;
        while (i <= events.length) {
            const x = i < events.length ? events[i][0] : SCREEN_WIDTH;
            for (; i < events.length && events[i][0] === x; i++) {
                inside[events[i][1]] += events[i][2];
            }
            const level = inside[2] > 0 ? 2 : inside[1] > 0 ? 1 : 0;
            if (level !== runLevel || x === SCREEN_WIDTH) {
                if (x > runStart && runLevel < 2) {
                    MDog.Draw.rectangleFill(runStart, y, x - runStart, 2, runLevel === 0 ? dark : dim);
                }
                runStart = x;
                runLevel = level;
            }
            if (i >= events.length && x === SCREEN_WIDTH) {
                break;
            }
        }
    }
}

function drawTitle() {
    MDog.Draw.rectangleFill(0, 26, SCREEN_WIDTH, 70, "rgba(10, 16, 10, 0.55)");
    drawText("KNIGHT KNIGHT", 48, "#ffd84a", 3);
    drawText("BY MILO KESTELOOT, TRENT SCHROER,", 74, "#ffffff", 1);
    drawText("AND JAMES MILESTONE", 86, "#ffffff", 1);
    // The menu: local or online
    TITLE_CHOICES.forEach((choice, i) => {
        const y = 102 + i * 10;
        const selected = i === titleChoice && titleSelectorShown;
        drawText(choice, y, selected ? "#ffcc33" : "#ffffff", 1);
        if (selected && Math.floor(liveTicks / 40) % 2 === 0) {
            const half = Math.ceil(choice.length * 5 / 2);
            drawText(">", y, "#ffcc33", 1, CENTER_X - half - 8);
            drawText("<", y, "#ffcc33", 1, CENTER_X + half + 7);
        }
    });
    // The box at the bottom says about whichever choice is picked
    MDog.Draw.rectangleFill(0, TITLE_BOX_TOP, SCREEN_WIDTH, TITLE_BOX_BOTTOM - TITLE_BOX_TOP, "rgba(10, 16, 10, 0.6)");
    drawCenteredLines(getTitleBoxLines(), TITLE_BOX_TOP, TITLE_BOX_BOTTOM);
}

const TITLE_BOX_TOP = 139;
const TITLE_BOX_BOTTOM = 176;

// What goes in the title screen's bottom box, for the choice that's picked
function getTitleBoxLines() {
    const choice = TITLE_CHOICES[titleChoice];
    const hint = "#c8d4c0";
    if (choice === "QUICK MATCH") {
        const lines = [line("PLAY ANYONE LOOKING, WITH STANDARD SETTINGS", "#ffffff")];
        if (quickStats === null) {
            lines.push(loadingLine("CHECKING WHO'S AROUND", hint));
        } else {
            lines.push(quickStats.waiting > 0
                ? line("SOMEONE IS WAITING RIGHT NOW!", "#9cf09c")
                : line("NOBODY'S WAITING - YOU'LL BE FIRST IN LINE", "#ffcc33"));
            lines.push(line(describeMatches(quickStats.matches), hint));
        }
        return lines;
    }
    if (choice === "HOST ONLINE MATCH") {
        return [
            line("HOST A MATCH, AND GET A CODE TO SEND A FRIEND", "#ffffff"),
            gap(2),
            line("YOU PICK THE SETTINGS WHILE YOU WAIT", hint),
        ];
    }
    if (choice === "JOIN ONLINE MATCH") {
        // Online, either set of keys moves your own knight
        return [
            line("JOIN A FRIEND'S MATCH WITH THEIR CODE", "#ffffff"),
            gap(2),
            line("WASD/ARROWS MOVE, SPACE/ENTER/CLICK SWING", hint, 9),
            line("E OR / TAUNT", hint, 9),
        ];
    }
    return [
        line("RED: WASD MOVE, SPACE SWING, E TAUNT", PLAYERS[0].lightTextColor, 9),
        line("BLUE: ARROWS MOVE, ENTER/CLICK SWING, / TAUNT", PLAYERS[1].lightTextColor, 9),
        gap(3),
        line("ESC: SETTINGS", hint, 9),
    ];
}

// ---------- Laying out text ----------

// A line of text for drawCenteredLines, taking up height pixels
function line(text, color, height) {
    return {text, color, height: height ?? 10};
}

// A line with "..." after it, while something's happening
function loadingLine(text, color) {
    return {text, color, height: 10, dots: true};
}

// Some space between lines
function gap(height) {
    return {height};
}

// The join code's boxes
function codeBoxes(code) {
    return {code, height: 26};
}

// Lines (from line, gap and codeBoxes), one under the other, as a block centered between top and bottom
function drawCenteredLines(lines, top, bottom) {
    const total = lines.reduce((sum, item) => sum + item.height, 0);
    let y = (top + bottom) / 2 - total / 2;
    for (const item of lines) {
        const middle = Math.round(y + item.height / 2);
        if (item.dots) {
            drawTextWithDots(item.text, middle, item.color);
        } else if (item.text !== undefined) {
            drawText(item.text, middle, item.color, 1);
        } else if (item.code !== undefined) {
            drawCodeBoxes(item.code, middle);
        }
        y += item.height;
    }
}

// Text centered on the screen, with "..." growing one dot at a time just after it. The text itself stays put.
function drawTextWithDots(text, y, color) {
    drawText(text, y, color, 1);
    const dots = ".".repeat(1 + Math.floor(liveTicks / 30) % 3);
    const x = CENTER_X + Math.ceil(text.length * 5 / 2);
    MDog.Draw.textImage(dots, x, y + 1, "#1c2a18", FONT, {alignX: "left", alignY: "center"});
    MDog.Draw.textImage(dots, x, y, color, FONT, {alignX: "left", alignY: "center"});
}

// How many of a list are on, in a few words: "ALL", "NONE", or like "6 OF 9"
function countOn(values, group, names) {
    const on = names.filter(name => isOnIn(values, group, name)).length;
    return on === names.length ? "ALL" : on === 0 ? "NONE" : on + " OF " + names.length;
}

// The game modes in a few words: which special rounds come up, or (with normal rounds off) which are the only ones
function describeModes(values) {
    const names = {juggernaut: "JUGGERNAUT", chicken: "CHICKEN", showdown: "SHOWDOWN", joust: "JOUST"};
    const on = GAME_MODES.filter(mode => isModeOn(values, mode));
    if (values.normalRounds === false) {
        return on.length === GAME_MODES.length ? "ONLY SPECIAL ROUNDS" : "ONLY " + on.map(mode => names[mode]).join("/");
    }
    return on.length === GAME_MODES.length ? "ALL GAME MODES" : on.length === 0 ? "NO SPECIAL ROUNDS" : on.length + " OF " + GAME_MODES.length + " SPECIAL ROUNDS";
}

function describeArenas(values) {
    const on = getArenasOn(values);
    // (by its short name, so the line fits)
    return on.length === 1 ? on[0] + " ONLY" : on.length === ARENA_NAMES.length ? "ALL ARENAS" : on.length + " ARENAS";
}

// A match's settings in three short lines, for showing before it starts
function describeSettings(saved) {
    const values = normalizeSettings(saved);
    const killCam = {"COOL KILLS": "ON", "FINAL BLOW": "LAST", OFF: "OFF"}[values.killCam] ?? values.killCam;
    const words = (group, names, what) => {
        const count = countOn(values, group, names);
        return count === "NONE" ? "NO " + what : count + " " + what;
    };
    return [
        "FIRST TO " + values.roundsToWin + " - " + describeArenas(values) + ", " + words("powerups", SPAWNING_POWERUPS, "POWER-UPS"),
        "BOULDERS " + values.boulders + ", " + words("hazards", HAZARD_KINDS, "HAZARDS") + ", " + words("weathers", WEATHER_KINDS, "WEATHER"),
        describeModes(values) + ", KILL CAM " + killCam,
    ];
}

// For taking cover screenshots: just the field, with none of the score, round text and so on over it
let hideUI = false;

function drawUI() {
    if (hideUI) {
        return;
    }
    if (phase === "title") {
        // With the settings open, just the arena shows behind them
        if (!isPaused() && !isOnTitleScreens()) {
            drawTitle();
        }
        return;
    }
    drawScore();
    drawWarnings();

    if (phase === "ready") {
        drawText(roundNumber === 1 ? "READY" : "ROUND " + roundNumber, 56, "#ffffff", 2);
        const label = weather.getLabel() ?? MODIFIER_LABELS[roundModifier] ?? null;
        drawText(arena.title + (label !== null ? " - " + label : ""), 74, "#e8f0e0", 1);
        if (isMatchPoint()) {
            drawText("MATCH POINT", 86, "#ffcc33", 1);
        }
        if (arena.guns) {
            drawText("GUNS ONLY!  SWING TO SHOOT", 100, "#ffcc33", 1);
        }
        if (arena.sumo) {
            drawText("PUSH THEM INTO THE WATER!", 100, "#ffcc33", 1);
        }
        if (arena.joust) {
            drawText("JOUST! WHEN YOU CLASH, THE FASTER HORSE WINS", 100, "#ffcc33", 1);
            drawText("HOLD A DIRECTION TO BUILD UP SPEED", 110, "#ffffff", 1);
        }
        if (juggernaut !== null) {
            drawText(juggernaut.player.color.toUpperCase() + " IS THE JUGGERNAUT!", 100, juggernaut.player.lightTextColor, 1);
            drawText("HUGE AND SLOW, WITH 3 HEARTS", 110, "#ffcc33", 1);
        }
        const chicken = knights.find(knight => knight.isChicken);
        if (chickenRound && chicken !== undefined) {
            drawText("CHICKEN ROUND! " + chicken.player.color.toUpperCase() + " STARTS AS THE CHICKEN", 100, chicken.player.lightTextColor, 1);
            drawText("CHICKENS CAN'T ATTACK", 110, "#ffcc33", 1);
            drawText("EVERY 10 SECONDS, YOU SWAP", 120, "#ffffff", 1);
        }
    } else if (phase === "playing" && phaseTicks < FIGHT_TEXT_TICKS) {
        drawText("FIGHT!", 60, "#ffffff", 2);
    }
    if (chickenRound && phase === "playing") {
        if (chickenFreeze > 0) {
            drawText("SWAP!", 60, "#ffffff", 2);
        } else {
            const left = Math.ceil((CHICKEN_SWAP_TICKS - chickenTicks) / TICKS_PER_SECOND);
            drawText("SWAP IN " + left, 20, left <= 3 ? "#ffcc33" : "#e8f0e0", 1);
        }
    }

    if (resultText !== null && !killCam.playing) {
        // At the end of the match, a dark band behind it all so it reads over the field (like the title's)
        if (phase === "matchOver") {
            MDog.Draw.rectangleFill(0, 26, SCREEN_WIDTH, 112, "rgba(10, 16, 10, 0.55)");
        }
        drawText(resultText.text, 40, resultText.color, 2);
        if (commentary !== null && Math.floor(phaseTicks / 30) % 4 !== 3) {
            drawText(commentary, 58, "#ffcc33", 1);
        }
        if (phase === "matchOver") {
            const flawless = PLAYERS.some(player => scores[player.color] === 0);
            if (flawless) {
                drawText("FLAWLESS!", commentary !== null ? 70 : 58, "#ffcc33", 1);
            }
            if (phaseTicks >= RESTART_DELAY_TICKS) {
                drawStats();
                drawText("PRESS R TO PLAY AGAIN", 160, "#ffffff", 1);
            }
        }
    }

    if (flash > 0) {
        MDog.Draw.rectangleFill(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, `rgba(255, 255, 255, ${0.55 * flash / FLASH_TICKS})`);
    }
}

function draw() {
    MDog.Draw.clear({color: arena.fieldColor});

    // Everything on the field shakes, the score and text don't. It holds still while paused.
    const shakeX = isPaused() ? 0 : Math.round(fxRandom(-shake, shake));
    const shakeY = isPaused() ? 0 : Math.round(fxRandom(-shake, shake));
    MDog.Draw.translate(shakeX, shakeY);

    // The ground, and things flat on it
    MDog.Draw.image(arena.field, 0, 0);
    if (arena.tilt) {
        drawSea();
    }
    drawRiver(liveTicks);
    marks.draw();
    for (const hole of holes) {
        hole.draw();
    }
    for (const strike of strikes) {
        strike.drawGround();
    }
    for (const skyRock of skyRocks) {
        skyRock.drawGround();
    }
    for (const feature of features) {
        feature.drawGround?.();
    }

    // Things lower on the screen are drawn last, so they're in front
    const things = [...rocks, ...trees, ...crates, ...grassRows, ...powerups, ...boulders, ...knights, ...horses, ...thrownSwords, ...bullets, ...features.filter(feature => feature.getSortY !== undefined)]
        .sort((a, b) => a.getSortY() - b.getSortY());
    for (const thing of things) {
        thing.drawShadow();
    }
    for (const thing of things) {
        thing.draw();
    }
    particles.draw();

    if (arena.tint !== undefined) {
        MDog.Draw.rectangleFill(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, arena.tint);
    }
    if (arena.fog) {
        drawFog();
    }
    if (arena.crowd) {
        drawCrowdFlashes();
    }
    if (arena.dark) {
        drawDarkness();
    }
    for (const critter of critters) {
        critter.draw();
    }
    weather.draw();
    drawSkyFlash();
    for (const skyRock of skyRocks) {
        skyRock.drawSky();
    }
    for (const strike of strikes) {
        strike.drawSky();
    }
    for (const feature of features) {
        feature.drawSky?.();
    }
    for (const effect of [...slashes, ...popups]) {
        effect.draw();
    }

    if (showHitboxes) {
        for (const thing of things) {
            thing.drawHitboxes();
        }
        for (const feature of features) {
            if (feature.getSortY === undefined) {
                feature.drawHitboxes?.();
            }
        }
    }

    MDog.Draw.translate(0, 0);
    drawUI();
}

// In a quiet arena's rain (the showdown's), lightning flashes now and then far off, with thunder. It's only for show
// (nothing gets struck), so it uses Math.random and isn't part of the game's state.
let skyFlash = 0;

function drawSkyFlash() {
    if (!arena.quiet || weather.kind !== "rain" || phase === "title") {
        skyFlash = 0;
        return;
    }
    if (isPaused()) {
        return;
    }
    if (skyFlash > 0) {
        skyFlash--;
    } else if (Math.random() < 1 / 500) {
        skyFlash = 16;
        sound.thunder();
    }
    // Two flickers
    if (skyFlash > 10 || (skyFlash > 2 && skyFlash < 6)) {
        MDog.Draw.rectangleFill(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, `rgba(235, 240, 255, ${skyFlash > 10 ? 0.45 : 0.25})`);
    }
}

// Once a replay is over, the next round starts right away. After the match's replay, everything holds still on
// the win screen.
function finishReplay() {
    hitstop = 0;
    slowmo = 0;
    flash = 0;
    if (phase === "roundOver") {
        startRound();
    } else if (phase === "matchOver") {
        aftermath = true;
        phaseTicks = Math.max(phaseTicks, RESTART_DELAY_TICKS); // straight to the stats
    }
}

// The kill cam playing back the winning blow, with bars over the top and bottom like a film
function drawReplay() {
    MDog.Draw.clear({color: "#000000"});
    killCam.draw();
    MDog.Draw.rectangleFill(0, 0, SCREEN_WIDTH, 16, "#000000");
    MDog.Draw.rectangleFill(0, SCREEN_HEIGHT - 16, SCREEN_WIDTH, 16, "#000000");
    if (Math.floor(ticks / 40) % 2 === 0) {
        MDog.Draw.rectangleFill(8, 6, 4, 4, "#e03030");
    }
    MDog.Draw.textImage("REPLAY" + (replayReason !== null ? " - " + replayReason : ""), 16, 8, "#ffffff", FONT, {alignX: "left", alignY: "center"});
    MDog.Draw.textImage(mode === "online" ? "SWING TO SKIP" : "SPACE OR ENTER TO SKIP", SCREEN_WIDTH - 8, SCREEN_HEIGHT - 8, "#a0a0a0", FONT, {alignX: "right", alignY: "center"});
    // How far through it is
    MDog.Draw.rectangleFill(8, SCREEN_HEIGHT - 9, Math.round(80 * killCam.getProgress()), 1, "#e03030");
    MDog.Draw.rectangleFill(8 + Math.round(80 * killCam.getProgress()), SCREEN_HEIGHT - 9, 80 - Math.round(80 * killCam.getProgress()), 1, "#404040");
}

// ---------- Pause menu ----------

// A list of choices. Each one has a label (which can change, like "SOUND: ON"), and can be picked, or changed
// left and right.
class Menu {
    constructor(title, items, hint) {
        this.title = title;
        this.items = items;
        this.hint = hint ?? null;
        this.choice = 0;
        // The yellow selector only shows once it's been moved to (with the keys or the mouse). Moving the mouse off
        // the items hides it again.
        this.showSelection = false;
        this.isPauseMenu = false; // the pause menu is laid out a bit differently, with the controls under it
    }
}

let menus = []; // the open menus, the one on top is the one being used
let menuTicks = 0; // for blinking

function isPaused() {
    return menus.length > 0;
}

function onOff(on) {
    return on ? "ON" : "OFF";
}

const POWERUP_MENU_NAMES = {
    shield: "SHIELD", speed: "SPEED", thunder: "THUNDER", grow: "BIG", avalanche: "AVALANCHE",
    fury: "FURY", throw: "THROW SWORD", reverse: "REVERSE", gun: "GUN", boogie: "BOOGIE BOMB", frenzy: "FRENZY",
};

function makePauseMenu() {
    const menu = new Menu("PAUSED", [
        {label: () => "RESUME", pick: () => closeMenus()},
        {label: () => "RESTART MATCH", pick: () => { startMatch(); closeMenus(); }},
        {label: () => "TITLE SCREEN", pick: () => { showTitle(); closeMenus(); }},
        {label: () => "HITBOXES: " + onOff(showHitboxes), pick: () => { showHitboxes = !showHitboxes; }},
    ]);
    menu.isPauseMenu = true;
    return menu;
}

// info is a line about the setting, shown under the menu while it's picked
function settingToggle(label, key, info, after) {
    return {
        onOff: true,
        label: () => label + ": " + onOff(settings.get(key) !== false),
        change: () => { settings.set(key, settings.get(key) === false); after?.(); },
        info,
    };
}

function settingCycle(label, key, choices, info, after) {
    return {
        label: () => label + ": " + settings.get(key),
        change: direction => { settings.cycle(key, choices, direction); after?.(); },
        info,
    };
}

// One thing in an on-or-off list (a hazard, a kind of weather...)
function listToggle(label, group, name, info) {
    return {
        onOff: true,
        label: () => label + ": " + onOff(settings.isOn(group, name)),
        change: () => settings.setOn(group, name, !settings.isOn(group, name)),
        info,
    };
}

// Turns a whole list on, or (if it's all on already) off
function allToggle(group, names) {
    const allOn = () => names.every(name => settings.isOn(group, name));
    return {
        label: () => allOn() ? "TURN ALL OFF" : "TURN ALL ON",
        pick: () => {
            const on = !allOn();
            for (const name of names) {
                settings.setOn(group, name, on);
            }
            sound.menuMove();
        },
    };
}

// A setting that opens its own menu, showing how much of it is on
function submenuItem(label, summary, makeMenu, info) {
    return {
        label: () => label + ": " + summary(),
        pick: () => openMenu(makeMenu()),
        change: direction => { if (direction > 0) openMenu(makeMenu()); },
        info,
    };
}

const backItem = () => ({label: () => "BACK", pick: () => backMenu()});

const HAZARD_LABELS = {
    holes: ["SHAKY GROUND", "HOLES CRACK OPEN, AND THE VOLCANO SPLITS"],
    horse: ["RUNAWAY HORSES", "HORSES STAMPEDE ACROSS THE GRASSY ARENAS"],
    catapult: ["CATAPULTS", "ROCKS FLY IN. WATCH FOR WHERE THEY LAND"],
    lightning: ["LIGHTNING", "STRIKES WHERE THE TARGET SHOWS, AND THE STORM"],
    tornado: ["TORNADOES", "WANDER AROUND, AND FLING ANYONE THEY CATCH"],
    dragon: ["DRAGONS", "FLY OVER, LEAVING A LINE OF FIRE"],
    fireball: ["FIREBALLS", "THE VOLCANO AND LAVA LAKE RAIN FIRE"],
    bear: ["BEARS", "ONE SLEEPS IN THE FOREST. DON'T WAKE IT"],
    chicken: ["WILD CHICKENS", "SHOW UP IF NOBODY'S BEEN HIT IN A WHILE"],
};
const WEATHER_LABELS = {
    wind: ["WIND", "PUSHES EVERYONE AROUND (NEVER NEAR EDGES)"],
    rain: ["RAIN", "SLOWS BOULDERS DOWN"],
    snow: ["SNOW", "FALLS ON THE SNOWFIELD, JUST FOR LOOKS"],
    ash: ["ASH", "FALLS ON THE VOLCANO, JUST FOR LOOKS"],
};
const ARENA_BLURBS = {
    MEADOW: "GRASS, ROCKS, AND TALL GRASS TO HIDE IN",
    RIVER: "A RIVER DOWN THE MIDDLE, WITH TWO BRIDGES",
    SNOW: "SLIPPERY ICE: YOU SLIDE AROUND",
    VOLCANO: "LAVA POOLS, FIREBALLS, AND THE GROUND SPLITS",
    FOREST: "DARK TREES, AND A BEAR ASLEEP",
    MINE: "DARK, WITH MINECARTS RACING ALONG TRACKS",
    LIGHTHOUSE: "AN ISLAND AT NIGHT, LIT BY THE BEAMS",
    BRIDGE: "PLANK BRIDGES THAT BREAK IF YOU STAND STILL",
    LAVALAKE: "STONE RAFTS MOVING ROUND A LAKE OF LAVA",
    RING: "A TINY BOXING RING. THE CROWD THROWS ROCKS",
    STORM: "A HILLTOP WITH LIGHTNING ALL ROUND",
    SUMO: "PUSH THEM OFF THE PLATFORM TO WIN",
    SHIP: "THE DECK TIPS, SO EVERYTHING SLIDES",
    SHOWDOWN: "GAME MODE: GUNS ONLY. COMES UP NOW AND THEN",
    JOUST: "GAME MODE: ON HORSEBACK. NOW AND THEN",
};

function describeArenaSetting() {
    const on = getArenasOn(settings.values);
    return on.length === 1 ? ARENAS[on[0]].title + " ONLY" : on.length === ARENA_NAMES.length ? "ALL" : on.length + " OF " + ARENA_NAMES.length;
}

// The settings that change how a match plays (the rest, like the music, are just yours)
function matchSettingItems() {
    return [
        settingCycle("ROUNDS TO WIN", "roundsToWin", ROUNDS_CHOICES, "ROUNDS YOU NEED TO WIN THE MATCH"),
        submenuItem("ARENAS", describeArenaSetting, makeArenaMenu, "PICK WHICH ARENAS YOU FIGHT IN"),
        submenuItem("POWER-UPS", () => countOn(settings.values, "powerups", SPAWNING_POWERUPS), makePowerupMenu, "PICK WHICH POWER-UPS CAN SHOW UP"),
        submenuItem("HAZARDS", () => countOn(settings.values, "hazards", HAZARD_KINDS), makeHazardMenu, "BOULDERS, HORSES, DRAGONS, BEARS..."),
        submenuItem("WEATHER", () => countOn(settings.values, "weathers", WEATHER_KINDS), makeWeatherMenu, "WIND, RAIN, SNOW AND ASH"),
        submenuItem("GAME MODES", () => countGameModes(), makeGameModesMenu, "NORMAL ROUNDS, JUGGERNAUTS, CHICKENS..."),
        settingCycle("KILL CAM", "killCam", KILL_CAM_CHOICES, "REPLAYS THE COOLEST KNOCKDOWNS"),
    ];
}

function makeHazardMenu() {
    return new Menu("HAZARDS", [
        settingCycle("BOULDERS", "boulders", BOULDER_CHOICES, "ROLL IN FROM THE EDGES. SWING TO HIT THEM BACK"),
        ...HAZARD_KINDS.map(kind => listToggle(HAZARD_LABELS[kind][0], "hazards", kind, HAZARD_LABELS[kind][1])),
        allToggle("hazards", HAZARD_KINDS),
        backItem(),
    ], "ENTER OR CLICK: ON/OFF.  ESC: BACK");
}

function makeWeatherMenu() {
    return new Menu("WEATHER", [
        ...WEATHER_KINDS.map(kind => listToggle(WEATHER_LABELS[kind][0], "weathers", kind, WEATHER_LABELS[kind][1])),
        allToggle("weathers", WEATHER_KINDS),
        backItem(),
    ], "ENTER OR CLICK: ON/OFF.  ESC: BACK");
}

// Showdowns and jousts are arenas (they're in the arena picker too)
function countGameModes() {
    const on = ["normal", ...GAME_MODES].filter(mode => isModeOn(settings.values, mode));
    if (!on.includes("normal")) {
        return on.length === 1 ? on[0].toUpperCase() + " ONLY" : "NO NORMAL ROUNDS";
    }
    return on.length === GAME_MODES.length + 1 ? "ALL" : on.length + " OF " + (GAME_MODES.length + 1);
}

// Turning off normal rounds or a game mode, there has to be something left on to play
function isLastModeOn(mode) {
    return isModeOn(settings.values, mode) && ["normal", ...GAME_MODES].filter(other => isModeOn(settings.values, other)).length === 1;
}

let modeWarningTicks = 0; // showing that at least one game mode has to be on

function refuseLastMode() {
    sound.noSword();
    modeWarningTicks = 2 * TICKS_PER_SECOND;
}

function makeGameModesMenu() {
    const modeToggle = (label, mode, key, info) => ({
        onOff: true,
        label: () => label + ": " + onOff(isModeOn(settings.values, mode)),
        change: () => {
            if (isLastModeOn(mode)) {
                refuseLastMode();
            } else {
                settings.set(key, !isModeOn(settings.values, mode));
            }
        },
        info: () => modeWarningTicks > 0 ? "AT LEAST ONE HAS TO BE ON" : info,
    });
    const arenaToggle = (label, name, info) => ({
        onOff: true,
        label: () => label + ": " + onOff(settings.isOn("arenas", name)),
        change: () => toggleArena(name),
        info: () => modeWarningTicks > 0 ? "AT LEAST ONE HAS TO BE ON" : info,
    });
    const menu = new Menu("GAME MODES", [
        modeToggle("NORMAL ROUNDS", "normal", "normalRounds", "OFF: EVERY ROUND IS ONE OF THE OTHERS"),
        modeToggle("JUGGERNAUTS", "juggernaut", "juggernaut", "ONE KNIGHT IS HUGE AND SLOW, WITH 3 HEARTS"),
        modeToggle("CHICKENS", "chicken", "chickenRounds", "ONE'S A CHICKEN, AND EVERY 10 SECONDS YOU SWAP"),
        arenaToggle("SHOWDOWNS", "SHOWDOWN", "GUNS ONLY, AMONG CRATES"),
        arenaToggle("JOUSTS", "JOUST", "ON HORSEBACK: THE FASTER HORSE WINS"),
        backItem(),
    ], "ENTER OR CLICK: ON/OFF.  ESC: BACK");
    // (the warning counts down while this menu's open)
    menu.everyTick = () => { if (modeWarningTicks > 0) modeWarningTicks--; };
    return menu;
}

// Turns an arena on or off, but never the last one that's on (or a showdown or joust that's the last game mode on).
// Returns whether it changed.
function toggleArena(name) {
    const on = getArenasOn(settings.values);
    if (on.length === 1 && on[0] === name) {
        sound.noSword();
        arenaWarningTicks = 2 * TICKS_PER_SECOND;
        return false;
    }
    if ((name === "SHOWDOWN" || name === "JOUST") && isLastModeOn(name.toLowerCase())) {
        refuseLastMode();
        arenaWarningTicks = 2 * TICKS_PER_SECOND;
        return false;
    }
    settings.setOn("arenas", name, !settings.isOn("arenas", name));
    sound.menuMove();
    if (phase === "title") {
        // The field behind the menu changes to the first arena a match would be on
        showTitle();
    }
    return true;
}

// ---------- The arena picker ----------

const ARENA_THUMB_WIDTH = 40; // a sixth of the screen
const ARENA_THUMB_HEIGHT = 30;
const ARENA_COLUMNS = 5;
const ARENA_GAP_X = 6;
const ARENA_GAP_Y = 6;
const ARENA_GRID_LEFT = Math.round((SCREEN_WIDTH - ARENA_COLUMNS * ARENA_THUMB_WIDTH - (ARENA_COLUMNS - 1) * ARENA_GAP_X) / 2);
const ARENA_GRID_TOP = 26;
const ARENA_BUTTONS_Y = 158;
let arenaWarningTicks = 0; // showing that at least one arena has to be on

function getArenaThumb(name) {
    return "knight-knight-online/arena-" + name.toLowerCase() + ".png";
}

function getArenaCell(i) {
    const column = i % ARENA_COLUMNS;
    const row = Math.floor(i / ARENA_COLUMNS);
    return {
        left: ARENA_GRID_LEFT + column * (ARENA_THUMB_WIDTH + ARENA_GAP_X),
        top: ARENA_GRID_TOP + row * (ARENA_THUMB_HEIGHT + ARENA_GAP_Y),
        width: ARENA_THUMB_WIDTH,
        height: ARENA_THUMB_HEIGHT,
    };
}

// A grid of pictures of the arenas to turn on and off, then ALL ON and BACK under it. choice is which arena (or,
// past the arenas, which button) is picked.
function makeArenaMenu() {
    const menu = new Menu("ARENAS", []);
    const buttons = [
        {text: "ALL ON", x: CENTER_X - 32, pick: () => {
            for (const name of ARENA_NAMES) settings.setOn("arenas", name, true);
            if (phase === "title") showTitle();
            sound.menuMove();
        }},
        {text: "BACK", x: CENTER_X + 32, pick: () => backMenu()},
    ];
    const count = ARENA_NAMES.length + buttons.length;
    const pickChoice = i => i < ARENA_NAMES.length ? toggleArena(ARENA_NAMES[i]) : buttons[i - ARENA_NAMES.length].pick();
    const getBox = i => {
        if (i < ARENA_NAMES.length) {
            const cell = getArenaCell(i);
            return {left: cell.left - 1, right: cell.left + cell.width + 1, top: cell.top - 1, bottom: cell.top + cell.height + 1};
        }
        const button = buttons[i - ARENA_NAMES.length];
        const half = Math.ceil(button.text.length * 5 / 2) + 4;
        return {left: button.x - half, right: button.x + half, top: ARENA_BUTTONS_Y - 5, bottom: ARENA_BUTTONS_Y + 5};
    };
    const rows = Math.ceil(ARENA_NAMES.length / ARENA_COLUMNS);

    menu.update = () => {
        // The mouse: over one picks it, and a click turns it on or off
        let over = -1;
        if (Mouse.getOnScreen()) {
            const x = Mouse.getX();
            const y = Mouse.getY();
            for (let i = 0; i < count; i++) {
                const box = getBox(i);
                if (x >= box.left && x < box.right && y >= box.top && y < box.bottom) {
                    over = i;
                }
            }
        }
        Mouse.requestStyle(over >= 0 ? "pointer" : "default");
        if (mouseMoved()) {
            menu.showSelection = over >= 0;
            if (over >= 0) {
                menu.choice = over;
            }
        }
        if (Mouse.getClick(0) && over >= 0) {
            menu.choice = over;
            menu.showSelection = true;
            useClick();
            pickChoice(over);
            return;
        }

        const clicked = keys => keys.some(key => Keyboard.isClicked(key));
        const left = clicked(["a", "ArrowLeft"]);
        const right = clicked(["d", "ArrowRight"]);
        const up = clicked(["w", "ArrowUp"]);
        const down = clicked(["s", "ArrowDown"]);
        const enter = clicked([" ", "Enter"]);
        if ((left || right || up || down || enter) && !menu.showSelection) {
            menu.showSelection = true;
            menuTicks = 0;
            sound.menuMove();
            return;
        }
        const old = menu.choice;
        const onButtons = menu.choice >= ARENA_NAMES.length;
        if (left || right) {
            const step = right ? 1 : -1;
            if (onButtons) {
                menu.choice = ARENA_NAMES.length + (menu.choice - ARENA_NAMES.length + step + buttons.length) % buttons.length;
            } else {
                const rowStart = menu.choice - menu.choice % ARENA_COLUMNS;
                const rowLength = Math.min(ARENA_COLUMNS, ARENA_NAMES.length - rowStart);
                menu.choice = rowStart + (menu.choice - rowStart + step + rowLength) % rowLength;
            }
        } else if (down) {
            if (onButtons) {
                menu.choice = menu.choice - ARENA_NAMES.length === 0 ? 0 : Math.min(ARENA_COLUMNS - 1, ARENA_NAMES.length - 1);
            } else if (Math.floor(menu.choice / ARENA_COLUMNS) === rows - 1 || menu.choice + ARENA_COLUMNS >= ARENA_NAMES.length) {
                // Off the bottom of the pictures, to whichever button's nearer
                menu.choice = ARENA_NAMES.length + (menu.choice % ARENA_COLUMNS < ARENA_COLUMNS / 2 ? 0 : 1);
            } else {
                menu.choice += ARENA_COLUMNS;
            }
        } else if (up) {
            if (onButtons) {
                const column = menu.choice - ARENA_NAMES.length === 0 ? 1 : 3;
                menu.choice = Math.min(ARENA_NAMES.length - 1, (rows - 1) * ARENA_COLUMNS + column);
            } else if (menu.choice < ARENA_COLUMNS) {
                menu.choice = ARENA_NAMES.length + (menu.choice < ARENA_COLUMNS / 2 ? 0 : 1);
            } else {
                menu.choice -= ARENA_COLUMNS;
            }
        } else if (enter) {
            pickChoice(menu.choice);
        }
        if (menu.choice !== old) {
            menuTicks = 0;
            sound.menuMove();
        }
    };

    menu.draw = () => {
        if (arenaWarningTicks > 0) {
            arenaWarningTicks--;
        }
        ARENA_NAMES.forEach((name, i) => {
            const cell = getArenaCell(i);
            const on = settings.isOn("arenas", name);
            const selected = menu.showSelection && menu.choice === i;
            // A frame round each: yellow round the one that's picked, green round the ones that are on
            const frame = selected ? (Math.floor(menuTicks / 40) % 2 === 0 ? "#ffcc33" : "#c89a20") : on ? "#5cbf5c" : "#3a443a";
            MDog.Draw.rectangleFill(cell.left - 1, cell.top - 1, cell.width + 2, cell.height + 2, frame);
            MDog.Draw.image(getArenaThumb(name), cell.left, cell.top);
            if (!on) {
                // Dimmed, with OFF over it
                MDog.Draw.rectangleFill(cell.left, cell.top, cell.width, cell.height, "rgba(8, 12, 8, 0.7)");
                drawText("OFF", cell.top + cell.height / 2, "#c8d4c0", 1, cell.left + cell.width / 2);
            }
        });
        // The picked one's name and what it's like
        const picked = menu.showSelection && menu.choice < ARENA_NAMES.length ? ARENA_NAMES[menu.choice] : null;
        if (arenaWarningTicks > 0) {
            drawText(modeWarningTicks > 0 ? "AT LEAST ONE GAME MODE HAS TO BE ON" : "AT LEAST ONE ARENA HAS TO BE ON", 140, "#ff9a8a", 1);
        } else if (picked !== null) {
            const on = settings.isOn("arenas", picked);
            drawText(ARENAS[picked].title + ": " + onOff(on), 134, on ? "#9cf09c" : "#c8d4c0", 1);
            drawText(ARENA_BLURBS[picked] ?? "", 145, "#8a9a88", 1);
        } else {
            drawText(describeArenaSetting() === "ALL" ? "ALL ARENAS ARE ON" : describeArenaSetting() + " ARENAS ON", 140, "#c8d4c0", 1);
        }
        buttons.forEach((button, i) => {
            const selected = menu.showSelection && menu.choice === ARENA_NAMES.length + i;
            drawText(button.text, ARENA_BUTTONS_Y, selected ? "#ffcc33" : "#c8d4c0", 1, button.x);
            if (selected && Math.floor(menuTicks / 40) % 2 === 0) {
                const half = Math.ceil(button.text.length * 5 / 2);
                drawText(">", ARENA_BUTTONS_Y, "#ffcc33", 1, button.x - half - 8);
                drawText("<", ARENA_BUTTONS_Y, "#ffcc33", 1, button.x + half + 7);
            }
        });
        drawText("ENTER OR CLICK: ON/OFF.  ESC: BACK", 170, "#8a9a88", 1);
    };
    return menu;
}

function makeSettingsMenu() {
    // Asks first, so it can't be hit by accident: the first press only arms it
    let resetArmed = false;
    const resetItem = {
        label: () => resetArmed ? "PRESS AGAIN TO RESET" : "RESET TO DEFAULTS",
        pick: () => {
            if (!resetArmed) {
                resetArmed = true;
                sound.menuMove();
                return;
            }
            resetArmed = false;
            settings.reset();
            music.setEnabled(settings.get("music"));
            if (phase === "title") {
                showTitle();
            }
            sound.menuSelect();
        },
    };
    return new Menu("SETTINGS", [
        ...matchSettingItems(),
        settingToggle("MUSIC", "music", null, () => music.setEnabled(settings.get("music"))),
        {onOff: true, label: () => "SOUND: " + onOff(!sound.muted), change: () => sound.toggleMute()},
        resetItem,
        {label: () => "BACK", pick: () => backMenu()},
    ], "ENTER: OPEN.  LEFT/RIGHT: CHANGE.  ESC: BACK");
}

const POWERUP_INFO = {
    shield: "TAKES A HIT FOR YOU (THEY STACK)",
    speed: "RUN FASTER FOR A WHILE",
    thunder: "LIGHTNING STRIKES YOUR OPPONENT",
    grow: "GROW BIGGER, WITH A LONGER REACH",
    avalanche: "BOULDERS ROLL AT YOUR OPPONENT",
    fury: "SWING FASTER FOR A WHILE",
    throw: "YOUR NEXT SWING THROWS YOUR SWORD",
    reverse: "YOUR OPPONENT'S CONTROLS GO BACKWARDS",
    boogie: "YOUR OPPONENT HAS TO DANCE: NO ATTACKING",
    frenzy: "RARE! DROPS 12 POWER-UPS ALL OVER",
};

function makePowerupMenu() {
    return new Menu("POWER-UPS", [
        ...SPAWNING_POWERUPS.map(type => listToggle(POWERUP_MENU_NAMES[type], "powerups", type, POWERUP_INFO[type])),
        allToggle("powerups", SPAWNING_POWERUPS),
        backItem(),
    ], "ENTER OR CLICK: ON/OFF.  ESC: BACK");
}

function openMenu(menu) {
    menus.push(menu);
    menuTicks = 0;
    music.setDucked(true);
    sound.setDucked(true);
    sound.menuSelect();
}

function backMenu() {
    menus.pop();
    menuTicks = 0;
    if (!isPaused()) {
        music.setDucked(false);
        sound.setDucked(false);
    }
    sound.menuMove();
}

function closeMenus() {
    menus = [];
    music.setDucked(false);
    sound.setDucked(false);
    sound.menuSelect();
}

// Clicking away from the game pauses it, so nobody loses a round while the window isn't focused
window.addEventListener("blur", () => {
    if (mode === "local" && !isPaused() && phase !== "title") {
        openMenu(makePauseMenu());
    }
});

// ---------- The mouse in menus ----------

const Mouse = MDog.Input.Mouse;
let lastMouse = null; // where the mouse was last tick, so only moving it changes what's selected

// Which of a list of lines of text the mouse is over (lines are {y, text}, centered on the screen), or -1
function getMouseOverLine(lines, rowHeight) {
    if (!Mouse.getOnScreen()) {
        return -1;
    }
    const x = Mouse.getX();
    const y = Mouse.getY();
    return lines.findIndex(line => Math.abs(y - line.y) <= rowHeight / 2
        && Math.abs(x - CENTER_X) <= Math.ceil(line.text.length * 5 / 2) + 10);
}

// Has the mouse moved since last tick? (Checked once a tick.)
function mouseMoved() {
    const now = Mouse.getOnScreen() ? Mouse.getX() + "," + Mouse.getY() : "off";
    const moved = lastMouse !== null && now !== lastMouse;
    lastMouse = now;
    return moved;
}

// A click that a menu used isn't also a swing
function useClick() {
    pressedCodes.delete("MouseLeft");
}

// Where a menu's items are on the screen (see drawMenu)
function getMenuLines(menu) {
    const top = menu.isPauseMenu ? 34 : 14;
    const spacing = menu.items.length > 8 ? 10 : 14;
    const firstY = top + (menu.isPauseMenu ? 30 : 20);
    return {lines: menu.items.map((item, i) => ({y: firstY + i * spacing, text: item.label()})), spacing};
}

// The mouse moving over a list's items selects the one it's on (and nothing when it's off them), and a click picks
// it. select(index) and pick(index) do those; -1 is nothing. Returns whether it used a click.
function updateMouseOverList(lines, rowHeight, select, pick) {
    const over = getMouseOverLine(lines, rowHeight);
    Mouse.requestStyle(over >= 0 ? "pointer" : "default");
    if (mouseMoved()) {
        select(over);
    }
    if (Mouse.getClick(0) && over >= 0) {
        select(over);
        pick(over);
        useClick();
        return true;
    }
    return false;
}

function updateMenu() {
    menuTicks++;
    const menu = menus[menus.length - 1];
    menu.everyTick?.();
    if (modeWarningTicks > 0 && menu.everyTick === undefined) {
        modeWarningTicks--;
    }
    if (menu.update !== undefined) {
        menu.update();
        return;
    }
    const {lines, spacing} = getMenuLines(menu);
    const clickedItem = updateMouseOverList(lines, spacing, index => {
        if (index >= 0 && (index !== menu.choice || !menu.showSelection)) {
            menuTicks = 0;
        }
        menu.showSelection = index >= 0;
        if (index >= 0) {
            menu.choice = index;
        }
    }, index => {
        // A click does what Space or Enter would, and steps a list of choices along (like right does)
        const item = menu.items[index];
        if (item.pick !== undefined) {
            item.pick();
        } else if (item.change !== undefined) {
            item.change(1);
            sound.menuMove();
        }
    });
    if (clickedItem || menus[menus.length - 1] !== menu) {
        return;
    }
    // Either player can use the menu
    const clicked = keys => keys.some(key => Keyboard.isClicked(key));
    const anyKey = clicked(["w", "ArrowUp", "s", "ArrowDown", "a", "ArrowLeft", "d", "ArrowRight", " ", "Enter"]);
    if (anyKey && !menu.showSelection) {
        // The selector comes back where it was, before anything happens
        menu.showSelection = true;
        menuTicks = 0;
        sound.menuMove();
        return;
    }
    if (clicked(["w", "ArrowUp", "s", "ArrowDown"])) {
        const down = clicked(["s", "ArrowDown"]);
        menu.choice = (menu.choice + (down ? 1 : -1) + menu.items.length) % menu.items.length;
        menuTicks = 0;
        sound.menuMove();
    }
    const item = menu.items[menu.choice];
    if (clicked(["a", "ArrowLeft", "d", "ArrowRight"]) && item.change !== undefined) {
        item.change(clicked(["d", "ArrowRight"]) ? 1 : -1);
        sound.menuMove();
    }
    // Space or Enter flips an ON/OFF setting, but does nothing on one with a list of choices (that's left and right)
    if (clicked([" ", "Enter"])) {
        if (item.pick !== undefined) {
            item.pick();
        } else if (item.onOff === true) {
            item.change(1);
            sound.menuMove();
        }
    }
}

function drawMenu() {
    const menu = menus[menus.length - 1];
    // Online the match keeps going behind it, so it's lighter, to see what's happening
    MDog.Draw.rectangleFill(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, mode === "online" ? "rgba(8, 14, 8, 0.6)" : "rgba(8, 14, 8, 0.85)");
    const top = menu.isPauseMenu ? 34 : 14;
    drawText(menu.title, top, "#ffffff", 2);
    if (menu.draw !== undefined) {
        menu.draw();
        return;
    }

    const spacing = menu.items.length > 8 ? 10 : 14;
    const firstY = top + (menu.isPauseMenu ? 30 : 20);
    menu.items.forEach((item, i) => {
        const y = firstY + i * spacing;
        const selected = i === menu.choice && menu.showSelection;
        const label = item.label();
        drawText(label, y, selected ? "#ffcc33" : "#c8d4c0", 1);
        // Arrows either side of the one that's picked, blinking slowly
        if (selected && Math.floor(menuTicks / 40) % 2 === 0) {
            const half = Math.ceil(label.length * 5 / 2);
            drawText(">", y, "#ffcc33", 1, CENTER_X - half - 8);
            drawText("<", y, "#ffcc33", 1, CENTER_X + half + 7);
        }
    });

    if (menu.isPauseMenu) {
        drawText("RED: WASD MOVE, SPACE SWING, E TAUNT", 136, PLAYERS[0].lightTextColor, 1);
        drawText("BLUE: ARROWS MOVE, ENTER/CLICK SWING, / TAUNT", 146, PLAYERS[1].lightTextColor, 1);
        drawText("ESC: RESUME", 162, "#c8d4c0", 1);
    } else {
        // A line about whichever setting's picked
        const info = menu.showSelection ? menu.items[menu.choice]?.info : null;
        if (info) {
            drawText(typeof info === "function" ? info() : info, 158, "#e8f0e0", 1);
        }
        drawText(menu.hint ?? "LEFT AND RIGHT TO CHANGE.  ESC: BACK", 170, "#8a9a88", 1);
    }
}

// ---------- Saving and restoring the game (for online) ----------

// Everything about the game that changes as it's played, in one object, so it can be copied, put back, and
// fingerprinted. Anything left out of here has to be just for show (sounds, particles, marks, the menus).
function captureState() {
    return {
        arena, arenaName, weather, knights, rocks, trees, crates, grassRows, holes, boulders, incoming, strikes,
        skyRocks, horses, bullets, thrownSwords, popups, slashes, powerups, critters, features,
        boulderWait, powerupWait, hazardWait, holeWait, stats, scores, phase, phaseTicks, roundTicks, roundNumber,
        resultText, commentary, lastRoundWinner, streak, worstDeficit, hitstop, slowmo, flash, shake,
        closeCallCooldown, roundsUntilShowdown, roundsUntilJuggernaut, roundsUntilJoust, roundModifier,
        roundsUntilChicken, chickenRound, chickenTicks, chickenFreeze,
        roundHazards, roundBoulders, juggernaut, calmTicks, replayBlowTick, replayReason, aftermath, gameTime,
        rngState, inputs, rematchVotes, simTicks, replayTicksLeft, replayFrom, lightningGlow, arenaLayout,
    };
}

function restoreState(state) {
    ({
        arena, arenaName, weather, knights, rocks, trees, crates, grassRows, holes, boulders, incoming, strikes,
        skyRocks, horses, bullets, thrownSwords, popups, slashes, powerups, critters, features,
        boulderWait, powerupWait, hazardWait, holeWait, stats, scores, phase, phaseTicks, roundTicks, roundNumber,
        resultText, commentary, lastRoundWinner, streak, worstDeficit, hitstop, slowmo, flash, shake,
        closeCallCooldown, roundsUntilShowdown, roundsUntilJuggernaut, roundsUntilJoust, roundModifier,
        roundsUntilChicken, chickenRound, chickenTicks, chickenFreeze,
        roundHazards, roundBoulders, juggernaut, calmTicks, replayBlowTick, replayReason, aftermath, gameTime,
        rngState, inputs, rematchVotes, simTicks, replayTicksLeft, replayFrom, lightningGlow, arenaLayout,
    } = state);
}

// Raindrops and leaves use Math.random (they're just for show), so they're allowed to be in different places
function skipInHash(object, key) {
    return object instanceof Weather && (key === "bits" || key === "splashes");
}

// The arenas, players and hitbox tables never change, so copies of the game share them instead of copying them.
// Freezing them also means anything that tried to change one would stop with an error, instead of quietly making
// the two players' games different.
const FROZEN_TABLES = {ARENAS, PLAYERS, DIRS, BODY_BOXES, SWORD_BOXES, SWING_GLINTS, GUN_LINES, FEET_BOX, ROCK_BOX, TREE_BOX,
    CRATE_BOX, BOULDER_BOX, POWERUP_NAMES, TAUNTS, POWERUP_TYPES, SPAWNING_POWERUPS, CRITTER_COUNT, BOULDER_SETTING_WAIT};
for (const table of Object.values(FROZEN_TABLES)) {
    deepFreeze(table);
}
const frozenThings = nameFrozenThings(FROZEN_TABLES);

// Every kind of thing in the game, so a copy sent over the network comes back as the right kinds of things
const CLASSES = {
    Rock, Tree, Crate, GrassRow, GroundHazard, Boulder, Powerup, Critter, Knight, ThrownSword, Bullet, Horse, SkyRock, Wall,
    Prop, Canyon, Platform, Grave, Barrel, Explosion, Chicken, Dragon, FirePatch, Bear, Storm, Tracks, Minecart, Lantern,
    Quicksand, Tumbleweed, TumbleweedSpawner, LighthouseBeam, Tornado, LavaLake, DemoBrain, Popup, Slash, Strike, Weather,
    DragonSpawner, FissureSpawner, Fissure,
    SpriteSheetAnimation: MDog.Draw.SpriteSheetAnimation,
};

// The settings an online match is played with: the host's, sent over when it starts
class MatchSettings {
    constructor(values) {
        // (older-style settings are turned into the new kind)
        this.values = normalizeSettings(values);
    }

    get(key) {
        return this.values[key];
    }

    isOn(group, name) {
        return isOnIn(this.values, group, name);
    }

    isPowerupOn(type) {
        return this.isOn("powerups", type);
    }
}

let mode = "local"; // or "online", while an online match is being played
let rematchVotes = PLAYERS.map(() => false); // online, a new match starts once both have pressed R
// Online, the kill cam is part of the game, so it starts and ends at the same moment for both players: the game holds
// still while it plays, and either player can skip it by swinging. Each player's computer shows its own recording.
let simTicks = 0; // every tick of an online match, frozen or not (the kill cam's clock)
let replayTicksLeft = 0;
let replayFrom = null; // the tick of the blow being replayed
const REPLAY_TICKS = Math.ceil((REPLAY_BEFORE_TICKS + REPLAY_AFTER_TICKS) / REPLAY_SPEED);

// One tick of the game itself: frozen for hitstop, every few ticks in slow motion, or normal
function stepSim() {
    if (hitstop > 0) {
        hitstop--;
    } else if (slowmo > 0 && slowmo-- % SLOWMO_RATE !== 0) {
        // Skipped for slow motion
    } else {
        update();
    }
    shake = shake * 0.9 < 0.3 ? 0 : shake * 0.9;
    if (flash > 0) {
        flash--;
    }
    if (lightningGlow > 0) {
        lightningGlow--;
    }
}

// One tick of an online match, with both players' input bits
function stepOnline(bits) {
    bits.forEach((playerBits, i) => {
        applyInputBits(i, playerBits & ~INPUT_REMATCH);
        if ((playerBits & INPUT_REMATCH) && phase === "matchOver") {
            rematchVotes[i] = true;
        }
    });
    simTicks++;
    if (replayTicksLeft > 0) {
        replayTicksLeft--;
        if (inputs.some(input => input.swing)) {
            replayTicksLeft = 0;
        }
        usePresses();
        if (replayTicksLeft === 0) {
            replayFrom = null;
            finishReplay();
        }
        return;
    }
    if (replayBlowTick !== null && simTicks >= replayBlowTick + REPLAY_AFTER_TICKS) {
        replayFrom = replayBlowTick;
        replayBlowTick = null;
        replayTicksLeft = REPLAY_TICKS;
        usePresses();
        return;
    }
    if (phase === "matchOver" && phaseTicks >= RESTART_DELAY_TICKS && rematchVotes.every(vote => vote)) {
        startMatch();
    }
    stepSim();
}

function startOnlineMatch(seed, values, localIndex) {
    // Anything that could be left over from the title screen (which isn't the same on both computers) is reset, so
    // both games start exactly the same
    simSettings = new MatchSettings(values);
    rngState = makeRandomState(seed);
    arena = ARENAS.MEADOW;
    arenaName = "MEADOW";
    gameTime = 0;
    closeCallCooldown = 0;
    shake = 0;
    flash = 0;
    lightningGlow = 0;
    inputs = PLAYERS.map(() => ({move: {x: 0, y: 0}, swing: false, taunt: false}));
    joinTyping = null;
    menus = [];
    killCam.clear();
    replayBlowTick = null;
    simTicks = 0;
    replayTicksLeft = 0;
    replayFrom = null;
    localPlayer = localIndex;
    mode = "online";
    stopTitleAlert();
    music.setDucked(false);
    sound.setDucked(false);
    startMatch();
}

const online = new Online({
    save: () => cloneState(captureState()),
    load: copy => restoreState(cloneState(copy)),
    step: bits => stepOnline(bits),
    hash: () => hashState(captureState(), skipInHash),
    setFx: on => { fx.on = on; },
    serialize: copy => serializeState(copy, CLASSES, frozenThings.names),
    deserialize: data => deserializeState(data, CLASSES, frozenThings.byName),
    start: startOnlineMatch,
});
online.readHeld = () => readHeldBits();
online.onPeerJoined = () => {
    if (!online.quickMatch) {
        online.hostSettings = JSON.parse(JSON.stringify(settings.values));
        if (menus.some(menu => menu.isWaitingSettings)) {
            closeMenus();
        }
    }
    alertFriendJoined();
};
window.addEventListener("keydown", e => {
    if (e.key === "F3" && mode === "online") {
        e.preventDefault();
    }
});
let localPlayer = 0; // which knight is yours, online

// Back to the title screen and a normal local game
function leaveOnline() {
    online.leave();
    mode = "local";
    simSettings = settings;
    menus = [];
    music.setDucked(false);
    sound.setDucked(false);
    showTitle();
}

// ---------- The title menu and the online screens ----------

const TITLE_CHOICES = ["LOCAL MATCH", "QUICK MATCH", "HOST ONLINE MATCH", "JOIN ONLINE MATCH"];
let titleChoice = 0;
let titleSelectorShown = false; // the selector only shows once it's been moved to, with the keys or the mouse
let joinTyping = null; // the code typed so far on the join screen, or null when it's not open
let copiedTicks = 0; // "COPIED!" shows for a moment after copying the invite link

// A link straight into the host's match: exactly the address the host's on, with the code on the end. Opening it
// joins the match right away.
function inviteLink() {
    const url = new URL(location.href);
    url.searchParams.delete("room");
    url.searchParams.set("game", "knight-knight-online");
    url.searchParams.set("code", online.code);
    return url.toString();
}

// Typing the join code. Letters go straight in from the key presses, on any keyboard layout.
window.addEventListener("keydown", e => {
    if (joinTyping === null || mode !== "local") {
        return;
    }
    if (e.key === "Backspace") {
        joinTyping = joinTyping.slice(0, -1);
        e.preventDefault();
    } else if (isCodeLetter(e.key) && joinTyping.length < CODE_LENGTH) {
        joinTyping += e.key.toUpperCase();
        sound.menuMove();
    }
});

// Pasting a code (or a whole invite link) works too
window.addEventListener("paste", e => {
    if (joinTyping === null) {
        return;
    }
    const text = e.clipboardData?.getData("text") ?? "";
    const room = text.match(/(?:code|room)=([A-Za-z0-9]+)/)?.[1] ?? text;
    joinTyping = cleanCode(room);
});

function startJoin(code) {
    joinTyping = null;
    online.join(code);
    sound.menuSelect();
}

function clickedAny(keys) {
    return keys.some(key => Keyboard.isClicked(key));
}

let escapeUsed = false; // Esc was already used this tick, closing a menu

// The title screen's keys, when no menu's open
function updateTitleMenu() {
    if (copiedTicks > 0) {
        copiedTicks--;
    }

    if (joinTyping !== null) {
        if (Keyboard.isClicked("Escape")) {
            joinTyping = null;
            sound.menuMove();
        } else if (Keyboard.isClicked("Enter") && joinTyping.length === CODE_LENGTH) {
            startJoin(joinTyping);
        }
        return;
    }

    if (online.isActive()) {
        if ((Keyboard.isClicked("Escape") && !escapeUsed) || (online.state === "ended" && clickedAny([" ", "Enter"]))) {
            online.leave();
            sound.menuMove();
        } else if (online.state === "waiting" && Keyboard.isClicked("c")) {
            navigator.clipboard?.writeText(inviteLink()).then(() => { copiedTicks = 180; }, () => {});
        } else if (online.state === "waiting" && !online.quickMatch && clickedAny([" ", "Enter"])) {
            openMenu(makeWaitingSettingsMenu());
        }
        return;
    }

    // The mouse: over a choice selects it, off them selects nothing, and a click picks one
    const lines = TITLE_CHOICES.map((choice, i) => ({y: 102 + i * 10, text: choice}));
    if (updateMouseOverList(lines, 10, index => {
        titleSelectorShown = index >= 0;
        if (index >= 0) {
            if (index !== titleChoice) {
                sound.menuMove();
            }
            titleChoice = index;
        }
    }, index => pickTitleChoice(index))) {
        return;
    }

    const arrows = clickedAny(["w", "ArrowUp", "s", "ArrowDown"]);
    if ((arrows || clickedAny([" ", "Enter"])) && !titleSelectorShown) {
        // The selector comes back where it was, before anything happens
        titleSelectorShown = true;
        sound.menuMove();
    } else if (clickedAny(["w", "ArrowUp"])) {
        titleChoice = (titleChoice + TITLE_CHOICES.length - 1) % TITLE_CHOICES.length;
        sound.menuMove();
    } else if (clickedAny(["s", "ArrowDown"])) {
        titleChoice = (titleChoice + 1) % TITLE_CHOICES.length;
        sound.menuMove();
    } else if (clickedAny([" ", "Enter"])) {
        pickTitleChoice(titleChoice);
    }
    // While QUICK MATCH is picked, it keeps checking if anyone's waiting
    if (TITLE_CHOICES[titleChoice] === "QUICK MATCH") {
        updateQuickStats();
    }
}

function pickTitleChoice(index) {
    const choice = TITLE_CHOICES[index];
    if (choice === "LOCAL MATCH") {
        startMatch();
    } else if (choice === "QUICK MATCH") {
        online.quick(JSON.parse(JSON.stringify(DEFAULTS)));
        sound.menuSelect();
    } else if (choice === "HOST ONLINE MATCH") {
        online.host(JSON.parse(JSON.stringify(settings.values)));
        sound.menuSelect();
    } else {
        joinTyping = "";
        sound.menuSelect();
    }
}

// How many matches are being played, and if someone's waiting, for the title screen: {matches, waiting}
let quickStats = null;
let quickStatsAt = -Infinity;

function updateQuickStats() {
    const time = performance.now();
    if (time - quickStatsAt < 5000) {
        return;
    }
    quickStatsAt = time;
    fetchStats().then(stats => {
        quickStats = stats;
    });
}

function describeMatches(matches) {
    return matches === 1 ? "1 MATCH BEING PLAYED RIGHT NOW" : matches + " MATCHES BEING PLAYED RIGHT NOW";
}

// The host's settings, while waiting for a friend to join: whatever they're set to when the friend joins is the match
function makeWaitingSettingsMenu() {
    const menu = new Menu("MATCH SETTINGS", [
        ...matchSettingItems(),
        {label: () => "DONE", pick: () => backMenu()},
    ], "YOUR FRIEND PLAYS WITH THESE.  ESC: DONE");
    menu.isWaitingSettings = true;
    return menu;
}

function isOnTitleScreens() {
    return phase === "title" && (online.isActive() || joinTyping !== null);
}

// A dark band across the middle of the screen, for the online screens
function drawPanel() {
    MDog.Draw.rectangleFill(0, 26, SCREEN_WIDTH, 112, "rgba(10, 16, 10, 0.8)");
}

function drawCodeBoxes(code, y) {
    const spacing = 22;
    const left = CENTER_X - (CODE_LENGTH - 1) * spacing / 2;
    for (let i = 0; i < CODE_LENGTH; i++) {
        const x = Math.round(left + i * spacing);
        const cursor = i === code.length && Math.floor(liveTicks / 40) % 2 === 0;
        MDog.Draw.rectangleFill(x - 9, y - 11, 18, 21, "rgba(0, 0, 0, 0.45)");
        MDog.Draw.rectangle(x - 9, y - 11, 18, 21, cursor ? "#ffcc33" : "rgba(255, 255, 255, 0.35)");
        if (i < code.length) {
            // Centered in the box: the letter (12 wide, 15 tall at this size) and its shadow under it fit inside
            drawText(code[i], y - 3, "#ffd84a", 3, x);
        }
    }
}

// The online screens on a dark band: a heading at the top, a hint (like "ESC: CANCEL") at the bottom, and whatever
// it's saying centered between them
const PANEL_TOP = 26;
const PANEL_BOTTOM = 138;
const PANEL_HEADING_Y = 42;
const PANEL_HINT_Y = 128;

function drawOnlinePanel(heading, lines, hint) {
    drawPanel();
    drawText(heading, PANEL_HEADING_Y, "#ffd84a", 2);
    drawCenteredLines(lines, 50, 122);
    if (hint !== null) {
        drawText(hint, PANEL_HINT_Y, "#c8d4c0", 1);
    }
}

function drawOnlineScreen() {
    if (joinTyping !== null) {
        drawOnlinePanel("JOIN A MATCH", [
            line("TYPE YOUR FRIEND'S CODE", "#ffffff"),
            gap(4),
            codeBoxes(joinTyping),
            gap(4),
            // Kept in place (just blank) until the code's all typed, so nothing jumps when it shows up
            line(joinTyping.length === CODE_LENGTH ? "ENTER: JOIN" : "", "#ffcc33"),
        ], "ESC: BACK");
        return;
    }
    const heading = online.quickMatch ? "QUICK MATCH" : "ONLINE MATCH";
    const pairedUp = online.quickMatch && online.code !== null;
    if (online.state === "searching") {
        const seconds = online.getSearchSeconds();
        drawOnlinePanel(heading, [
            loadingLine("LOOKING FOR AN OPPONENT", "#ffffff"),
            line("WAITING " + Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0"), "#c8d4c0"),
            gap(6),
            line("YOU'LL PLAY THE NEXT PERSON WHO LOOKS", "#ffcc33"),
            line(online.quickStats !== null ? describeMatches(online.quickStats.matches) : "", "#c8d4c0"),
        ], "ESC: CANCEL");
    } else if (online.state === "connecting" || (pairedUp && online.state === "waiting")) {
        drawOnlinePanel(heading, [
            pairedUp ? loadingLine("OPPONENT FOUND! CONNECTING", "#9cf09c") : loadingLine("CONNECTING", "#ffffff"),
        ], "ESC: CANCEL");
    } else if (online.state === "waiting") {
        drawOnlinePanel(heading, [
            codeBoxes(online.code),
            gap(4),
            loadingLine("WAITING FOR A FRIEND TO JOIN", "#ffffff"),
            copiedTicks > 0
                ? line("LINK COPIED! SEND IT TO A FRIEND", "#9cf09c")
                : line("C: COPY A LINK THAT JOINS IN ONE CLICK", "#ffcc33"),
            gap(4),
            line(describeSettings(settings.values)[0], "#c8d4c0"),
        ], "ENTER: MATCH SETTINGS   ESC: CANCEL");
    } else if (online.state === "syncing") {
        const ping = online.rtt === null ? "" : "PING " + Math.round(online.rtt) + "MS";
        const pingColor = online.rtt === null || online.rtt < 60 ? "#c8d4c0" : online.rtt < 120 ? "#ffcc33" : "#ff7060";
        drawOnlinePanel(heading, [
            loadingLine((online.quickMatch ? "OPPONENT FOUND!" : "FRIEND FOUND!") + " GET READY", "#9cf09c"),
            line(online.role === "host" ? "YOU ARE RED" : "YOU ARE BLUE", PLAYERS[online.getLocalIndex()].lightTextColor),
            gap(4),
            ...getSettingsLines(),
            gap(4),
            line(ping, pingColor),
        ], "ESC: CANCEL");
    } else if (online.state === "ended") {
        drawOnlinePanel(heading, [line(online.message ?? "", "#ff9a8a")], "ENTER: BACK");
    }
}

// The match's settings (the host's), as lines for drawCenteredLines, once they're known (blank until then, so
// nothing jumps about when they arrive)
function getSettingsLines() {
    const lines = online.hostSettings !== null ? describeSettings(online.hostSettings) : ["", "", ""];
    return lines.map(text => line(text, "#e8f0e0"));
}

// ---------- Online matches ----------

// When a friend joins the host's code: a doorbell, and if the host's looking at another tab, its title flashes
let titleAlert = null;

function alertFriendJoined() {
    sound.friendJoined();
    if (typeof document === "undefined" || (!document.hidden && document.hasFocus?.() !== false)) {
        return;
    }
    stopTitleAlert();
    const alert = online.quickMatch ? "OPPONENT FOUND!" : "FRIEND JOINED!";
    let on = true;
    document.title = alert;
    titleAlert = setInterval(() => {
        on = !on;
        document.title = on ? alert : "Knight Knight Online";
    }, 800);
}

function stopTitleAlert() {
    if (titleAlert !== null) {
        clearInterval(titleAlert);
        titleAlert = null;
        document.title = "Knight Knight Online";
    }
}

if (typeof document !== "undefined") {
    window.addEventListener("focus", stopTitleAlert);
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
            stopTitleAlert();
        }
    });
}

// ---------- The lobby (between matches) ----------

// The host's menu in the lobby: the match settings, then start or leave. The guest sees the settings change as the
// host changes them.
function makeLobbyMenu() {
    const menu = new Menu("MATCH SETTINGS", [
        ...matchSettingItems(),
        {label: () => "START MATCH", pick: () => {
            sound.menuSelect();
            online.startFromLobby(JSON.parse(JSON.stringify(settings.values)));
        }},
        {label: () => "LEAVE", pick: () => leaveOnline()},
    ], "YOUR FRIEND SEES THESE CHANGE AS YOU GO");
    menu.isLobby = true;
    return menu;
}

let sentSettings = null; // the settings the guest was last sent, as JSON

// While the two are connected but not playing: getting a new match ready, or in the lobby
function lobbyTick(lastTickOfFrame) {
    liveTicks++;
    const hostInLobby = online.role === "host" && online.state === "lobby";
    if (hostInLobby) {
        if (menus.length === 0) {
            openMenu(makeLobbyMenu());
        }
        if (Keyboard.isClicked("Escape")) {
            // Back out of the power-ups (the lobby itself stays: leaving is on it)
            if (!menus[menus.length - 1].isLobby) {
                backMenu();
            }
        } else {
            updateMenu();
        }
        if (mode !== "online") {
            return; // left
        }
        const values = JSON.stringify(settings.values);
        if (values !== sentSettings) {
            sentSettings = values;
            online.changeSettings(JSON.parse(values));
        }
    } else if (Keyboard.isClicked("Escape")) {
        leaveOnline();
        return;
    }
    if (Keyboard.isClicked("F3")) {
        showConnectionInfo = !showConnectionInfo;
    }

    if (lastTickOfFrame) {
        draw();
        if (hostInLobby && isPaused()) {
            drawMenu();
        } else {
            drawOnlinePanel(online.quickMatch ? "QUICK MATCH" : "ONLINE MATCH", [
                online.state === "lobby"
                    ? loadingLine("THE HOST IS PICKING THE SETTINGS", "#ffffff")
                    : loadingLine("NEW MATCH! GET READY", "#9cf09c"),
                gap(6),
                ...getSettingsLines(),
            ], online.role !== "host" ? "ESC: LEAVE" : null);
        }
        drawConnectionInfo();
    }
}

// ---------- Connection details (F3) ----------

let showConnectionInfo = false;
const connectionStats = {at: 0, rollbacks: 0, rolledBackTicks: 0, perSecond: 0, averageTicks: 0};

// The ping, the input delay, how often it has to go back and replay, which way the messages are going, how in step
// the two games are, and the fingerprint checks
function drawConnectionInfo() {
    if (!showConnectionInfo || isPaused()) {
        return;
    }
    const session = online.session;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (session !== null && now - connectionStats.at >= 1000) {
        if (session.rollbacks < connectionStats.rollbacks) {
            // A new match (and a new session)
            connectionStats.rollbacks = 0;
            connectionStats.rolledBackTicks = 0;
        }
        const rollbacks = session.rollbacks - connectionStats.rollbacks;
        connectionStats.perSecond = rollbacks;
        connectionStats.averageTicks = rollbacks > 0 ? (session.rolledBackTicks - connectionStats.rolledBackTicks) / rollbacks : 0;
        connectionStats.rollbacks = session.rollbacks;
        connectionStats.rolledBackTicks = session.rolledBackTicks;
        connectionStats.at = now;
    }
    const best = online.rttSamples.length > 0 ? Math.round(Math.min(...online.rttSamples)) : null;
    const lines = [
        "PING " + (online.rtt === null ? "?" : Math.round(online.rtt) + "MS") + (best !== null ? "  BEST " + best + "MS" : ""),
        online.isUsingServer() ? "THROUGH THE SERVER" : "DIRECT CONNECTION",
    ];
    if (session !== null) {
        const syncError = session.getSyncError();
        lines.push(
            "DELAY " + session.delay + " TICKS (" + Math.round(session.delay * 1000 / TICKS_PER_SECOND) + "MS)",
            "ROLLBACKS " + connectionStats.perSecond + "/S, AVG " + connectionStats.averageTicks.toFixed(1) + " TICKS",
            "IN STEP " + (syncError >= 0 ? "+" : "") + syncError.toFixed(1) + " TICKS",
            "SYNC CHECKS " + Math.floor(session.nextHashTick / 160) + ", FIXED " + session.resyncs,
        );
    }
    MDog.Draw.rectangleFill(2, 16, 136, lines.length * 9 + 4, "rgba(0, 0, 0, 0.6)");
    lines.forEach((line, i) => {
        MDog.Draw.textImage(line, 5, 22 + i * 9, "#d8f0d8", FONT, {alignX: "left", alignY: "center"});
    });
}

function makeOnlineMenu() {
    const menu = new Menu("MENU", [
        {label: () => "BACK TO THE MATCH", pick: () => closeMenus()},
        {onOff: true, label: () => "SOUND: " + onOff(!sound.muted), change: () => sound.toggleMute()},
        {onOff: true, label: () => "MUSIC: " + onOff(settings.get("music")), change: () => { settings.toggle("music"); music.setEnabled(settings.get("music")); }},
        {label: () => "HITBOXES: " + onOff(showHitboxes), pick: () => { showHitboxes = !showHitboxes; }},
        {label: () => "CONNECTION INFO (F3): " + onOff(showConnectionInfo), pick: () => { showConnectionInfo = !showConnectionInfo; }},
        {label: () => "LEAVE MATCH", pick: () => leaveOnline()},
    ], "THE MATCH KEEPS GOING!  ESC: BACK");
    // After a match, the host can change the settings for the next one, without either of them leaving
    if (online.role === "host" && phase === "matchOver") {
        menu.items.splice(1, 0, {label: () => "CHANGE SETTINGS", pick: () => {
            closeMenus();
            sentSettings = null;
            online.toLobby();
        }});
    }
    return menu;
}

let syncCounter = 0; // time sync: counts ticks while ahead or behind, so it only adjusts one in every few

function onlineTick(lastTickOfFrame) {
    online.update();
    const session = online.session;

    if (online.state !== "ended" && (online.state !== "playing" || session === null)) {
        lobbyTick(lastTickOfFrame);
        return;
    }
    if (online.state === "ended") {
        // The other player's gone: the game holds still, with a message over it
        if (clickedAny([" ", "Enter", "Escape"])) {
            leaveOnline();
            return;
        }
        if (lastTickOfFrame) {
            draw();
            drawOnlineStatus();
        }
        return;
    }

    // The menu doesn't pause anything online
    if (Keyboard.isClicked("Escape")) {
        if (isPaused()) {
            backMenu();
        } else {
            openMenu(makeOnlineMenu());
        }
    } else if (isPaused()) {
        updateMenu();
    } else {
        if (Keyboard.isClicked("Tab")) {
            showHitboxes = !showHitboxes;
        }
        if (Keyboard.isClicked("m")) {
            sound.toggleMute();
        }
    }
    if (Keyboard.isClicked("F3")) {
        showConnectionInfo = !showConnectionInfo;
    }
    if (mode !== "online" || online.session === null) {
        return; // left, or went to the lobby, from the menu
    }

    liveTicks++;
    // While the menu's open your knight just stands there
    const readInput = () => {
        const bits = readOnlineInputBits(Keyboard.isClicked("r"));
        return isPaused() ? 0 : bits;
    };
    // Stays in step with the other player: a tick is skipped now and then when this game's ahead, and an extra one
    // played when it's behind
    const syncError = session.getSyncError();
    if (syncError > 1 && syncCounter++ % 4 === 0) {
        // Waiting a tick for them
    } else {
        session.advance(readInput);
        if (syncError < -1 && syncCounter++ % 4 === 0) {
            session.advance(readInput);
        }
    }

    if (lastTickOfFrame) {
        if (replayTicksLeft > 0 && killCam.available) {
            killCam.show(replayFrom, 1 - replayTicksLeft / REPLAY_TICKS);
            drawReplay();
        } else {
            draw();
            killCam.capture(simTicks);
        }
        drawOnlineStatus();
        drawConnectionInfo();
        if (isPaused()) {
            drawMenu();
        }
    }
}

// The ping, which knight is yours, and messages about the connection
function drawOnlineStatus() {
    if (online.state === "ended" || online.session === null) {
        MDog.Draw.rectangleFill(0, 64, SCREEN_WIDTH, 44, "rgba(10, 16, 10, 0.8)");
        drawText(online.message ?? "DISCONNECTED", 78, "#ff9a8a", 1);
        drawText("ENTER: BACK TO THE TITLE", 94, "#ffffff", 1);
        return;
    }
    const session = online.session;
    if (online.rtt !== null && replayTicksLeft === 0) {
        const ping = Math.round(online.rtt);
        const color = ping < 60 ? "rgba(200, 230, 200, 0.7)" : ping < 120 ? "#ffcc33" : "#ff7060";
        MDog.Draw.textImage(ping + "MS" + (online.isUsingServer() ? " (SERVER)" : ""), SCREEN_WIDTH - 4, SCREEN_HEIGHT - 5, color, FONT, {alignX: "right", alignY: "center"});
    }
    if (session.stallTicks > 40) {
        // Up at the top, out of the way of the round's text and the end of match stats
        MDog.Draw.rectangleFill(0, 18, SCREEN_WIDTH, 12, "rgba(10, 16, 10, 0.75)");
        drawTextWithDots("WAITING FOR YOUR OPPONENT", 24, "#ffffff");
    }
    if (session.desyncTick !== null) {
        // The games drifted apart, and the host's sending its game over to put it right (see Rollback.js)
        MDog.Draw.textImage("FIXING SYNC...", 4, SCREEN_HEIGHT - 5, "#ffcc33", FONT, {alignX: "left", alignY: "center"});
    }
    // Which knight is yours, before each round (and for a moment after the first one starts)
    if (phase === "ready" || (roundNumber === 1 && phase === "playing" && phaseTicks < 2 * TICKS_PER_SECOND)) {
        const knight = knights[localPlayer];
        if (knight !== undefined && Math.floor(phaseTicks / 20) % 4 !== 3) {
            const x = Math.round(knight.getGroundX());
            const y = Math.round(knight.getTopY()) - 12;
            drawText("YOU", y, knight.player.lightTextColor, 1, x);
            MDog.Draw.rectangleFill(x - 1, y + 5, 3, 1, knight.player.lightTextColor);
            MDog.Draw.rectangleFill(x, y + 6, 1, 1, knight.player.lightTextColor);
        }
    }
    if (phase === "matchOver" && phaseTicks >= RESTART_DELAY_TICKS && online.role === "host" && replayTicksLeft === 0) {
        drawText("ESC: CHANGE SETTINGS", 170, "#c8d4c0", 1);
    }
    if (phase === "matchOver" && phaseTicks >= RESTART_DELAY_TICKS) {
        const mine = rematchVotes[localPlayer];
        const theirs = rematchVotes[1 - localPlayer];
        if (mine || theirs) {
            drawText(mine ? "WAITING FOR THEM TO PRESS R" : "THEY WANT A REMATCH!", 148, "#ffcc33", 1);
        }
    }
}

// ---------- Every tick ----------

function gameTick() {
    ticks++;
    sound.update();
    music.update();

    // The game draws once per frame, on the frame's last tick, instead of on every tick
    const lastTickOfFrame = !(MDog.unsimulatedTicks >= 1);

    if (mode === "online") {
        onlineTick(lastTickOfFrame);
        return;
    }

    // There's nothing to pause on the title screen
    const canPause = phase !== "title";
    escapeUsed = false;
    if (isOnTitleScreens() && !isPaused()) {
        // The online screens use the keys themselves
    } else if (Keyboard.isClicked("Escape")) {
        if (isPaused()) {
            // (so the same press doesn't also cancel the online screen behind the menu)
            escapeUsed = true;
            backMenu();
        } else if (canPause) {
            openMenu(makePauseMenu());
        } else if (phase === "title") {
            // On the title screen there's nothing to pause, so it's straight to the settings
            openMenu(makeSettingsMenu());
        }
    } else if (Keyboard.isClicked("p")) {
        if (isPaused()) {
            closeMenus();
        } else if (canPause) {
            openMenu(makePauseMenu());
        }
    }

    if (isPaused()) {
        if (phase === "title") {
            online.update();
        }
        updateMenu();
        // Swings and taunts pressed in the menu don't happen when it closes
        usePresses();
        if (lastTickOfFrame) {
            if (killCam.playing) {
                drawReplay();
            } else {
                draw();
            }
            if (isPaused()) {
                drawMenu();
            }
        }
        return;
    }

    liveTicks++;

    if (phase === "title") {
        online.update();
        updateTitleMenu();
        // A match was found while on the title screen: it's on from the next tick
        if (mode === "online") {
            return;
        }
    }

    // The kill cam, once the blow it's showing is far enough in the past
    if (replayBlowTick !== null && killCam.isReady(replayBlowTick, liveTicks)) {
        killCam.start(replayBlowTick);
        replayBlowTick = null;
        usePresses();
    }
    if (killCam.playing) {
        killCam.update();
        if (wasPressed(["Space", "Enter", "NumpadEnter", "MouseLeft"])) {
            killCam.stop();
        }
        usePresses();
        if (!killCam.playing) {
            finishReplay();
            return;
        }
        if (lastTickOfFrame) {
            drawReplay();
        }
        return;
    }
    if (replayBlowTick !== null && !killCam.available) {
        replayBlowTick = null;
    }

    if (Keyboard.isClicked("Tab")) {
        showHitboxes = !showHitboxes;
    }
    if (Keyboard.isClicked("m")) {
        sound.toggleMute();
    }
    if (phase === "matchOver" && phaseTicks >= RESTART_DELAY_TICKS && Keyboard.isClicked("r")) {
        startMatch();
    }

    readLocalInputs();
    stepSim();

    if (lastTickOfFrame) {
        draw();
        if (isOnTitleScreens()) {
            drawOnlineScreen();
        }
        killCam.capture(liveTicks);
    }
}

// For the tests (tests/), which play the game without a browser
export const testHooks = {
    captureState, restoreState, cloneState, hashState, skipInHash, CLASSES, frozenThings, stepOnline, startOnlineMatch, stepSim,
    readLocalInputs, fx, online, killCam,
    get phase() { return phase; },
    get arenaName() { return arenaName; },
    get scores() { return scores; },
    get roundNumber() { return roundNumber; },
    get knights() { return knights; },
    get gameTime() { return gameTime; },
    get mode() { return mode; },
    // What's selected: the title menu's choice, or the open menu's item (-1 when the selector's hidden)
    get titleSelection() { return titleSelectorShown ? titleChoice : -1; },
    get menuSelection() { const menu = menus[menus.length - 1]; return menu === undefined ? null : menu.showSelection ? menu.choice : -1; },
    get arenaLayout() { return arenaLayout; },
    get chickenRound() { return chickenRound; },
    get chickenTicks() { return chickenTicks; },
    get chickenFreeze() { return chickenFreeze; },
    inviteLink,
    get replayTicksLeft() { return replayTicksLeft; },
    get simTicks() { return simTicks; },
    // For cover screenshots: the sparks and so on move on a few ticks without the game moving, and a twinkle
    moveParticles(ticks) { for (let i = 0; i < ticks; i++) particles.update(); },
    clearParticles() { particles.clear(); },
    twinkle(x, y) { particles.glint(x, y); },
    // Gives a knight a power-up, for testing
    givePowerup(index, type) { givePowerup(knights[index], type); },
    // Just the field, without the score and so on (for screenshots)
    set hideUI(hide) { hideUI = hide; },
    // A lightning strike coming down here, for seeing how it looks
    strikeAt(x, y) { strikes.push(new Strike(null, null, {x, y})); },
};

// Handy from the browser's console too (and the browser tests use it)
globalThis.knightKnightOnline = testHooks;

if (typeof document !== "undefined") {
    document.title = "Knight Knight Online";
}
showTitle();
const images = [FONT, BOULDER_IMAGE, POWERUP_IMAGE, TREE_IMAGE, HORSE_IMAGE, SWORD_IMAGE, CRATE_IMAGE, TOMBSTONE_IMAGE,
    MAST_IMAGE, BARREL_IMAGE, CHICKEN_IMAGE, BEAR_IMAGE, CACTUS_IMAGE, LIGHTHOUSE_IMAGE, ...ARENA_NAMES.map(getArenaThumb)];
for (const name in ARENAS) {
    images.push(ARENAS[name].field, ARENAS[name].rockImage);
}
for (const image of images) {
    MDog.Draw.image(image, -1000, -1000); // starts loading them before they're needed
}
MDog.Draw.setBackgroundColor("#222");
MDog.setActiveFunction(gameTick);

// An invite link (?code=CODE, or ?room=CODE from before) goes straight to joining that match. The code's then taken
// out of the address, so reloading the page later doesn't try to join a match that's long over.
if (typeof location !== "undefined") {
    const params = new URLSearchParams(location.search);
    const code = params.get("code") ?? params.get("room");
    if (code !== null && cleanCode(code).length === CODE_LENGTH) {
        online.join(cleanCode(code));
        const url = new URL(location.href);
        url.searchParams.delete("code");
        url.searchParams.delete("room");
        try {
            history.replaceState(null, "", url.toString());
        } catch (e) {
            // Just stays in the address
        }
    }
}
