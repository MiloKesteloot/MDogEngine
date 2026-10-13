// The arenas a match can be fought in. Positions are in screen pixels (the screen is 240 by 180). Rocks, trees and
// other things are placed by the top left of their sprite, except where it says. Red starts with his feet at
// (50, 96) and blue at (190, 96), unless the arena has its own starts, so nothing solid goes there.
//
// Some extra things an arena can have:
//   starts: where the knights' feet start, red then blue
//   bounds: the area knights stay inside, as {left, top, right, bottom} (top is the top of their sprite)
//   walls: solid areas drawn in the field image, as [left, top, right, bottom]
//   boulderDirection: "horizontal" if boulders should only roll across
//   solidGround: no holes cracking open
//   special: only comes up now and then, instead of being one of the usual picks
//   tint: a color laid over everything, fog: drifting fog
//   disabled: left out of the game for now
//   calm: nothing extra at all: no weather, power-ups, boulders or chickens

const ARENAS = {
    MEADOW: {
        title: "MEADOW",
        grassy: true, // swords leave cuts in the grass
        field: "knight-knight/field.png",
        fieldColor: "#4a8a3c",
        rockImage: "knight-knight/rock.png",
        rocks: [{x: 112, y: 84}, {x: 76, y: 48}, {x: 148, y: 48}, {x: 76, y: 120}, {x: 148, y: 120}],
        // Grass tall enough to hide in, as [left, top, right, bottom]
        tallGrass: [[16, 26, 62, 52], [178, 132, 224, 158]],
        holeStyle: "dirt",
        footprint: "rgba(30, 60, 20, 0.22)",
        critters: "butterflies",
        weathers: ["clear", "clear", "rain", "wind"],
        hazards: ["horse", "catapult", "dragon", "tornado"],
        music: "battle",
        bear: {x: 118, y: 164}, // where its feet are
    },
    RIVER: {
        title: "RIVER",
        grassy: true,
        field: "knight-knight/field-river.png",
        fieldColor: "#4a8a3c",
        rockImage: "knight-knight/rock.png",
        rocks: [{x: 40, y: 40}, {x: 160, y: 40}, {x: 64, y: 128}, {x: 184, y: 128}],
        tallGrass: [[24, 140, 60, 164]],
        // Water down the middle that only the bridges cross
        river: {left: 109, right: 131, bridges: [[30, 50], [130, 150]]},
        holeStyle: "dirt",
        footprint: "rgba(30, 60, 20, 0.22)",
        critters: "butterflies",
        weathers: ["clear", "rain", "rain", "wind"],
        hazards: ["horse", "catapult"],
        music: "battle",
    },
    SNOW: {
        title: "SNOWFIELD",
        field: "knight-knight/field-snow.png",
        fieldColor: "#e2eaf2",
        rockImage: "knight-knight/rock-snow.png",
        rocks: [{x: 112, y: 40}, {x: 112, y: 128}, {x: 70, y: 84}, {x: 154, y: 84}],
        tallGrass: [],
        slippery: true, // knights slide around
        holeStyle: "ice",
        footprint: "rgba(110, 130, 170, 0.5)",
        critters: null,
        weathers: ["snow", "snow", "clear", "wind"],
        hazards: ["catapult", "tornado"],
        music: "snow",
    },
    VOLCANO: {
        title: "VOLCANO",
        field: "knight-knight/field-volcano.png",
        fieldColor: "#3e3032",
        rockImage: "knight-knight/rock-volcano.png",
        rocks: [{x: 76, y: 40}, {x: 150, y: 44}, {x: 74, y: 128}, {x: 148, y: 130}],
        tallGrass: [],
        // Pools of lava, as ovals on the ground
        lava: [{x: 120, y: 92, rx: 16, ry: 9}, {x: 56, y: 152, rx: 12, ry: 6}, {x: 184, y: 34, rx: 12, ry: 6}],
        holeStyle: "lava",
        footprint: "rgba(20, 12, 12, 0.35)",
        critters: "embers",
        weathers: ["ash", "ash", "clear", "wind"],
        hazards: ["fireball", "dragon"],
        music: "volcano",
    },
    FOREST: {
        title: "DARK FOREST",
        grassy: true,
        field: "knight-knight/field-forest.png",
        fieldColor: "#2e5a2c",
        rockImage: "knight-knight/rock.png",
        rocks: [{x: 112, y: 70}],
        trees: [{x: 62, y: 20}, {x: 150, y: 16}, {x: 100, y: 112}, {x: 30, y: 122}, {x: 184, y: 120}],
        tallGrass: [[96, 40, 140, 60], [172, 70, 214, 90]],
        dark: true, // only lit up around the knights
        holeStyle: "dirt",
        footprint: "rgba(20, 36, 18, 0.3)",
        critters: "fireflies",
        weathers: ["clear", "rain", "wind"],
        hazards: ["horse", "catapult"],
        music: "night",
        bear: {x: 156, y: 86},
    },
    // The gunfight: no swords, just guns that never run out, and lots of crates to hide behind (which break when
    // they're shot enough). It comes up every few rounds instead of being one of the usual picks.
    SHOWDOWN: {
        title: "SHOWDOWN",
        field: "knight-knight/field-showdown.png",
        fieldColor: "#ceac74",
        rockImage: "knight-knight/rock.png",
        rocks: [{x: 26, y: 36}, {x: 198, y: 36}, {x: 26, y: 140}, {x: 198, y: 140}],
        crates: [
            {x: 64, y: 86}, {x: 162, y: 86}, {x: 113, y: 88},
            {x: 84, y: 60}, {x: 142, y: 60}, {x: 84, y: 114}, {x: 142, y: 114},
            {x: 100, y: 36}, {x: 126, y: 36}, {x: 100, y: 138}, {x: 126, y: 138},
            {x: 46, y: 60}, {x: 180, y: 114},
        ],
        tallGrass: [],
        // Explode when they're shot, with a huge blast
        barrels: [{x: 58, y: 38}, {x: 170, y: 132}, {x: 110, y: 62}, {x: 122, y: 124}],
        guns: true, // everyone has a gun instead of a sword
        special: true, // only comes up now and then in mixed arenas
        holeStyle: "dirt",
        footprint: "rgba(120, 90, 50, 0.35)",
        critters: null,
        weathers: ["clear", "clear", "wind"],
        hazards: ["catapult"],
        music: "showdown",
    },
    // A dark mine lit by lanterns, with minecarts racing along two tracks
    MINE: {
        title: "MINE",
        field: "knight-knight/field-mine.png",
        fieldColor: "#46383a",
        rockImage: "knight-knight/rock.png",
        rocks: [{x: 112, y: 86}, {x: 24, y: 146}, {x: 200, y: 146}, {x: 112, y: 22}],
        tracks: [{y: 64}, {y: 128}], // the ground along each track
        lanterns: [{x: 20, y: 40}, {x: 220, y: 40}, {x: 20, y: 162}, {x: 220, y: 162}, {x: 120, y: 112}, {x: 80, y: 30}, {x: 160, y: 30}],
        dark: true,
        knightLight: 28,
        boulderDirection: "horizontal",
        tallGrass: [],
        holeStyle: "dirt",
        footprint: "rgba(30, 22, 20, 0.35)",
        critters: null,
        weathers: ["clear"],
        hazards: ["catapult"],
        music: "volcano",
    },
    // Sand, cacti, tumbleweeds, and quicksand that swallows anyone who stands still in it
    DESERT: {
        title: "DESERT",
        disabled: true, // taken out for now: never picked. Remove this line (and add it back to ARENA_CHOICES) to bring it back.
        field: "knight-knight/field-desert.png",
        fieldColor: "#e0c488",
        rockImage: "knight-knight/rock.png",
        rocks: [{x: 40, y: 40}, {x: 182, y: 140}],
        cacti: [{x: 90, y: 40}, {x: 150, y: 36}, {x: 80, y: 130}, {x: 160, y: 128}, {x: 204, y: 70}, {x: 28, y: 118}],
        quicksand: [{x: 120, y: 96, rx: 22, ry: 12}, {x: 60, y: 152, rx: 14, ry: 8}, {x: 182, y: 42, rx: 14, ry: 8}],
        tumbleweeds: true,
        tallGrass: [],
        holeStyle: "dirt",
        footprint: "rgba(150, 110, 60, 0.4)",
        critters: null,
        weathers: ["clear", "wind", "wind"],
        hazards: ["tornado", "dragon", "catapult"],
        music: "showdown",
    },
    // The jousting yard: an open dirt field inside a fence, for joust rounds (which come up now and then, like the
    // showdown). Both knights are on horseback.
    JOUST: {
        title: "JOUSTING YARD",
        field: "knight-knight/field-joust.png",
        fieldColor: "#b09264",
        rockImage: "knight-knight/rock.png",
        rocks: [],
        starts: [{x: 40, y: 96}, {x: 200, y: 96}],
        bounds: {left: 12, top: 12, right: 228, bottom: 162}, // inside the fence
        joust: true,
        special: "joust",
        calm: true, // just the joust: no weather, power-ups, boulders or chickens
        solidGround: true,
        tallGrass: [],
        holeStyle: "dirt",
        footprint: "rgba(120, 90, 50, 0.35)",
        critters: null,
        weathers: ["clear"],
        hazards: [],
        music: "battle",
    },
    // A rocky island at night with the sea all around. The lighthouse's two beams sweeping round are the only light.
    LIGHTHOUSE: {
        title: "LIGHTHOUSE",
        field: "knight-knight/field-lighthouse.png",
        fieldColor: "#16284a",
        rockImage: "knight-knight/rock.png",
        rocks: [{x: 28, y: 90}, {x: 164, y: 140}, {x: 178, y: 46}, {x: 52, y: 132}],
        // Opposite each other through the lamp (at 118, 75), so the two beams start on them
        starts: [{x: 60, y: 56}, {x: 176, y: 94}],
        platform: {x: 120, y: 98, rx: 104, ry: 70}, // the island: off it is the sea
        lighthouse: {x: 109, y: 72},
        dark: true,
        beamOnly: true, // nothing else gives off light: away from the beams it's pitch black
        noBoulders: true,
        solidGround: true,
        tallGrass: [],
        holeStyle: "ice",
        footprint: "rgba(30, 50, 30, 0.3)",
        critters: null,
        weathers: ["clear", "rain", "wind"],
        hazards: ["catapult", "tornado"],
        music: "night",
    },
    // A lake of lava, edge to edge, with stone rafts moving round it that carry whoever's on them. Each knight starts
    // on his own raft. Rafts are placed by their middle. A "line" raft slides `range` pixels either way along its axis;
    // a "loop" raft goes round an oval `rx` by `ry` around its middle. Speeds are in turns (radians) per tick.
    LAVALAKE: {
        title: "LAVA LAKE",
        field: "knight-knight/field-lavalake.png",
        fieldColor: "#d6541c",
        rockImage: "knight-knight/rock-volcano.png",
        rocks: [],
        starts: [{x: 34, y: 96}, {x: 206, y: 96}], // on the first two rafts
        rafts: [
            // The starting rafts, drifting up and down the sides
            {path: "line", x: 34, y: 96, w: 42, h: 30, axis: "y", range: 44, speed: 0.006, phase: 0},
            {path: "line", x: 206, y: 96, w: 42, h: 30, axis: "y", range: 44, speed: 0.006, phase: Math.PI},
            // Two going round a big loop of the whole lake, on opposite sides of it
            {path: "loop", x: 120, y: 96, rx: 72, ry: 52, w: 45, h: 30, speed: 0.004, phase: 0},
            {path: "loop", x: 120, y: 96, rx: 72, ry: 52, w: 45, h: 30, speed: 0.004, phase: Math.PI},
            // One circling the middle the other way
            {path: "loop", x: 120, y: 96, rx: 30, ry: 22, w: 36, h: 33, speed: -0.008, phase: Math.PI / 2},
            // Sliding across the top and bottom
            {path: "line", x: 120, y: 38, w: 45, h: 27, axis: "x", range: 62, speed: 0.005, phase: 0},
            {path: "line", x: 120, y: 154, w: 45, h: 27, axis: "x", range: 62, speed: 0.005, phase: Math.PI},
            // And up and down the middle
            {path: "line", x: 82, y: 96, w: 36, h: 30, axis: "y", range: 50, speed: 0.0055, phase: 1},
            {path: "line", x: 158, y: 96, w: 36, h: 30, axis: "y", range: 50, speed: 0.0055, phase: 1 + Math.PI},
        ],
        noBoulders: true,
        solidGround: true,
        tallGrass: [],
        holeStyle: "lava",
        footprint: "rgba(20, 12, 12, 0.35)",
        critters: "embers",
        weathers: ["ash", "clear"],
        hazards: ["fireball"],
        music: "volcano",
    },
    // Two cliffs with plank bridges over a canyon. Planks break if they're stood on too long.
    BRIDGE: {
        title: "RICKETY BRIDGE",
        field: "knight-knight/field-bridge.png",
        fieldColor: "#22181e",
        rockImage: "knight-knight/rock.png",
        rocks: [{x: 12, y: 30}, {x: 212, y: 140}],
        starts: [{x: 20, y: 96}, {x: 220, y: 96}],
        cliffs: [[0, 0, 36, 180], [204, 0, 240, 180]],
        bridges: [[36, 84, 204, 108], [36, 30, 204, 42], [36, 148, 204, 160], [114, 42, 126, 84], [114, 108, 126, 148]],
        boulderDirection: "horizontal",
        solidGround: true,
        tallGrass: [],
        holeStyle: "dirt",
        footprint: "rgba(30, 60, 20, 0.22)",
        critters: "butterflies",
        weathers: ["clear", "wind"],
        hazards: ["catapult", "dragon"],
        music: "battle",
    },
    // Tombstones to hide behind, and hands that reach out of the graves for your ankles
    GRAVEYARD: {
        title: "GRAVEYARD",
        grassy: true,
        disabled: true, // taken out for now: never picked. Remove this line (and add it back to ARENA_CHOICES) to bring it back.
        field: "knight-knight/field-graveyard.png",
        fieldColor: "#344e34",
        rockImage: "knight-knight/rock.png",
        rocks: [],
        graves: [{x: 40, y: 52}, {x: 84, y: 52}, {x: 156, y: 52}, {x: 200, y: 52}, {x: 60, y: 148}, {x: 120, y: 150}, {x: 180, y: 148}, {x: 120, y: 60}],
        tallGrass: [[96, 100, 144, 124]],
        tint: "rgba(40, 10, 60, 0.22)",
        fog: true,
        holeStyle: "dirt",
        footprint: "rgba(20, 30, 20, 0.3)",
        critters: "fireflies",
        weathers: ["clear", "rain", "wind"],
        hazards: ["horse", "catapult", "dragon", "tornado"],
        music: "night",
    },
    // A pirate ship's deck that tilts back and forth, so everything slides one way and then the other
    SHIP: {
        title: "PIRATE SHIP",
        field: "knight-knight/field-ship.png",
        fieldColor: "#966838",
        rockImage: "knight-knight/rock.png",
        rocks: [],
        starts: [{x: 40, y: 96}, {x: 200, y: 96}],
        walls: [[0, 0, 240, 24], [0, 156, 240, 180]],
        masts: [{x: 113, y: 54}, {x: 113, y: 116}],
        crates: [{x: 30, y: 128}, {x: 196, y: 40}],
        tilt: true,
        boulderDirection: "horizontal",
        solidGround: true,
        tallGrass: [],
        holeStyle: "dirt",
        footprint: "rgba(70, 44, 20, 0.3)",
        critters: null,
        weathers: ["clear", "wind", "rain"],
        hazards: ["catapult"],
        music: "shanty",
    },
    // A tiny boxing ring, with the crowd all around. Boulders get thrown in from the crowd.
    RING: {
        title: "THE RING",
        field: "knight-knight/field-ring.png",
        fieldColor: "#1e1a22",
        rockImage: "knight-knight/rock.png",
        rocks: [],
        starts: [{x: 88, y: 96}, {x: 152, y: 96}],
        bounds: {left: 56, top: 34, right: 184, bottom: 140},
        crowd: true,
        tallGrass: [],
        holeStyle: "dirt",
        footprint: "rgba(120, 110, 100, 0.25)",
        critters: null,
        weathers: ["clear"],
        hazards: ["catapult"],
        music: "volcano",
    },
    // A hilltop in a thunderstorm: lightning keeps striking all round
    STORM: {
        title: "STORM",
        grassy: true,
        field: "knight-knight/field-storm.png",
        fieldColor: "#5c6e54",
        rockImage: "knight-knight/rock.png",
        rocks: [{x: 40, y: 40}, {x: 180, y: 36}, {x: 60, y: 136}, {x: 170, y: 132}, {x: 112, y: 86}],
        storm: true,
        tint: "rgba(20, 24, 44, 0.28)",
        tallGrass: [],
        holeStyle: "dirt",
        footprint: "rgba(30, 40, 26, 0.3)",
        critters: null,
        weathers: ["rain"],
        hazards: ["catapult", "horse", "tornado"],
        music: "night",
    },
    // Sumo: a small platform in the water. Hits shove instead of knocking down, everyone's slower, and the only
    // way to lose is getting pushed off.
    SUMO: {
        title: "SUMO",
        field: "knight-knight/field-sumo.png",
        fieldColor: "#2e609c",
        rockImage: "knight-knight/rock.png",
        rocks: [],
        starts: [{x: 96, y: 98}, {x: 144, y: 98}],
        platform: {x: 120, y: 98, rx: 62, ry: 40},
        sumo: true,
        solidGround: true,
        noBoulders: true,
        tallGrass: [],
        holeStyle: "ice",
        footprint: "rgba(120, 90, 60, 0.3)",
        critters: null,
        weathers: ["clear", "wind"],
        hazards: ["catapult"],
        music: "battle",
    },
};

export default ARENAS;
