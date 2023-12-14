import MDog from "/MDogEngine/MDogModules/MDogMain.js"

MDog.Draw.setBackgroundColor("#0f0f17");

const timeFactor = 160 / MDog.ticksPerSecond;

const dt = 1 / MDog.ticksPerSecond;

const Vector = MDog.Math.Vector;

function rnd(min, max) {
    if (min === undefined) {
        min = 0;
        max = 1;
    }
    if (max === undefined) {
        max = min;
        min = 0;
    }
    return Math.random() * (max - min) + min;
}

class Settings {
    constructor() {
        this.debug = false;
        this.upToJump = false;
    }
}

const settings = new Settings();

class Coin {

    constructor(game, x, y) {
        this.game = game;
        this.position = new Vector(x, y);
        this.hitbox = new MDog.Basics.SquareHitbox(
            this.position,
            0, 0, 13, 13
        )
        this.animation = new MDog.Draw.MultipleFileAnimation("side/coin/coin_?.png", 8, 12);
    }

    getX() {// TODO This is only here because I'm using the state thing instead of animations
        return this.position.getX();
    }
    getY() {
        return this.position.getY();
    }

    draw() {
        MDog.Draw.animation(this.animation,this.getX(), this.getY());
    }

    pickup() {
        for (let i = 0; i < 80; i++) {
            this.game.globalParticleSystem.addParticle(
                new MDog.FX.ChunkParticle(
                    this.hitbox.getLeftX() + Math.floor(rnd(0, this.game.player.hitbox.getWidth())),
                    this.hitbox.getTopY() + Math.floor(rnd(0, this.game.player.hitbox.getHeight())),
                    Math.floor(rnd(10, 40)),
                    "#fabc20",
                    rnd(-1, 1),
                    rnd(-2, 0),
                    {
                        gy: 0.05,
                        size: Math.floor(rnd(1, 3))
                    }
                ));
        }
    }

    // TODO make animation object
}

class Camera {
    constructor(game, follow) {
        this.game = game;
        this.follow = follow;
        this.position = follow.clone();
        this.xRangeLeft = -70;
        this.xRangeRight = 70;

        this.yRangeHeight = 100;
        this.yOffset = -Math.floor(this.yRangeHeight/2);
        this.yRangeTop = this.yOffset;
        this.yRangeBottom = this.yOffset + this.yRangeHeight;
    }

    getX() {
        return this.position.getX();
    }

    getY() {
        return this.position.getY();
    }

    update() {

        // if (this.game.player.velocity.getY() < 0) {
        //     if (this.yOffset > -this.yRangeHeight) {
        //         if (this.position.getY() < Math.floor(this.follow.getY()) + this.yRangeTop) {
        //             this.yOffset -= 1;
        //         }
        //     }
        // }
        // if (this.game.player.velocity.getY() > 0) {
        //     if (this.yOffset < 0) {
        //         if (this.position.getY() > Math.floor(this.follow.getY()) + this.yRangeBottom) {
        //             this.yOffset += 1;
        //         }
        //     }
        // }

        this.yRangeTop = this.yOffset;
        this.yRangeBottom = this.yOffset + this.yRangeHeight;

        if (this.position.getX() < Math.floor(this.follow.getX()) + this.xRangeLeft) {
            this.position.setX(Math.floor(this.follow.getX()) + this.xRangeLeft);
        }
        if (this.position.getX() > Math.floor(this.follow.getX()) + this.xRangeRight) {
            this.position.setX(Math.floor(this.follow.getX()) + this.xRangeRight);
        }

        if (this.position.getY() < Math.floor(this.follow.getY()) + this.yRangeTop) {
            this.position.setY(Math.floor(this.follow.getY()) + this.yRangeTop);
        }
        if (this.position.getY() > Math.floor(this.follow.getY()) + this.yRangeBottom) {
            this.position.setY(Math.floor(this.follow.getY()) + this.yRangeBottom);
        }

        let goalX = -this.getX() + Math.floor(MDog.Draw.getScreenWidthInArtPixels()/2);

        let goalY = -this.getY() + Math.floor(MDog.Draw.getScreenHeightInArtPixels()/2);
        // let goalY = -Math.floor(this.follow.getY()) + Math.floor(MDog.Draw.getScreenHeightInArtPixels()/2) - 27;


        const hbtm = this.game.tilemaps.hitbox;

        goalX = Math.min(goalX, 0);
        goalX = Math.max(goalX, -(hbtm.width-32)*hbtm.tileSize);
        goalY = Math.min(goalY, 0);
        goalY = Math.max(goalY, -(hbtm.height-25)*hbtm.tileSize);

        MDog.Draw.translateX(goalX);
        MDog.Draw.translateY(goalY);
    }
}

// class JumpToFallState extends TransitionState {
//     constructor(player) {
//         super(player, 2, "side/girl/UptoFall/Warrior_UptoFall_?.png", 12 * timeFactor, FallState);
//     }
// }

// class DashAttackState extends TransitionState {
//     constructor(player) {
//         super(player, 10, "side/girl/Dash_Attack/Warrior_Dash-Attack_?.png", 20 * timeFactor, RunningState);
//         this.dashed = false;
//         this.direction = new Vector(0, 0);
//     }
//
//     canWallSlide() {
//         return this.getFrame() > 5;
//     }
//
//     canDashAttack() {
//         return this.getFrame() > 5;
//     }
//
//     canOverrideSelf() {
//         return true;
//     }
// }

// new IdleState(null).loadFrames();
// new RunningState(null).loadFrames();
// new JumpState(null).loadFrames();
// new FallState(null).loadFrames();
// new JumpToFallState(null).loadFrames();
// new WallSlideState(null).loadFrames();
// new DashAttackState(null).loadFrames();
MDog.Draw.preloadAnimation(new MDog.Draw.MultipleFileAnimation("side/coin/coin_?.png", 8, 12));

class Grapple {
    constructor(game, x, y) {
        this.game = game;
        this.position = new Vector(x, y);
        this.range = 150;
    }

    draw() {
        MDog.Draw.circle(this.position.getX(), this.position.getY(), this.range, "#ffffff11");
        MDog.Draw.image("sofiatale/heart.png", this.position.getX()-8, this.position.getY()-8);
    }
}

class Game {
    constructor() {
        this.coins = [];
        this.grapples = [
            // new Grapple(this, 550, 70),

        ];

        this.globalParticleSystem = new MDog.FX.ParticleSystem();
        this.screenSpaceParticleSystem = new MDog.FX.ParticleSystem();

        this.tilemaps = {
            hitbox: new MDog.UI.TilemapInteractable(0, 0, MDog.AssetManager.get("Colors"), 16, "side/city/Colors.png", 4),
            back: [
                new MDog.UI.TilemapInteractable(0, 0, MDog.AssetManager.get("Colors"), 16, "side/city/Colors.png", 4),
                new MDog.UI.TilemapInteractable(0, 0, MDog.AssetManager.get("Building1"), 16, "side/city/Buildings.png", 25),
                new MDog.UI.TilemapInteractable(0, 0, MDog.AssetManager.get("Building2"), 16, "side/city/Buildings.png", 25),
                new MDog.UI.TilemapInteractable(0, 0, MDog.AssetManager.get("Tiles"), 16, "side/city/Tiles.png", 6),
            ],
            front: [
                new MDog.UI.TilemapInteractable(0, 0, MDog.AssetManager.get("Deco"), 16, "side/city/Props-01.png", 8)
            ]
        }

        const hbtm = this.tilemaps.hitbox;

        const playerPos = new Vector(0, 0);

        for (let x = 0; x < hbtm.width; x++) {
            for (let y = 0; y < hbtm.height; y++) {
                const index = hbtm.get(x, y);
                if (index === 1) {
                    hbtm.set(x, y, -1);
                    this.tilemaps.back[0].set(x, y, -1);
                    const pos = hbtm.tileToScreen(x, y);
                    this.coins.push(new Coin(this, pos.x, pos.y));
                }
                if (index === 3) {
                    hbtm.set(x, y, -1);
                    this.tilemaps.back[0].set(x, y, -1);
                    const pos = hbtm.tileToScreen(x, y);
                    playerPos.setX(pos.x-18);
                    playerPos.setY(pos.y-11);
                }
            }
        }

        this.player = new MDog.Basics.Player(this, playerPos.getX(), playerPos.getY());

        this.averageDT = 0;
        this.frames = 0;
    }

    _main() {
        this.player.update();
        this.globalParticleSystem.update();
        this.updateCoins();

        MDog.Draw.clear({color:"#161228"});

        for (let i = 0; i < this.tilemaps.back.length; i++) {
            MDog.Draw.interactable(this.tilemaps.back[i]);
        }

        if (this.tilemaps.back.length === 0 && this.tilemaps.front.length === 0) {
            MDog.Draw.interactable(this.tilemaps.hitbox);
        }

        for (let i = 0; i < this.coins.length; i++) {
            this.coins[i].draw();
        }

        for (let i = 0; i < this.grapples.length; i++) {
            this.grapples[i].draw();
        }

        this.player.draw();

        for (let i = 0; i < this.tilemaps.front.length; i++) {
            MDog.Draw.interactable(this.tilemaps.front[i]);
        }

        MDog.Draw.particleSystem(this.globalParticleSystem);

        if (this.player.startTime !== 0) {
            this.frames += 1;
            this.averageDT += MDog.Math.deltaTime();
            // console.log(this.averageDT/this.frames);
        }
    }

    updateCoins() {
        for (let i = 0; i < this.coins.length; i++) {
            if (this.coins[i].hitbox.colliding(this.player.hitbox)) {
                this.coins[i].pickup();
                this.coins.splice(i, 1);
                i--;
                if (this.coins.length === 0) {
                    console.log((Date.now() - this.player.startTime)/1000);
                }
            }
        }
    }
}

function gameTick() {
    if (game === null) {
        if (MDog.AssetManager.doneLoading()) {
            game = new Game();
            console.log("starting");
        } else {
            console.log("waiting");
            return;
        }
    }

    if (MDog.AssetManager.doneLoading()) {
        if (MDog.Input.Keyboard.isClicked("r")) {
            game = new Game();
            console.log("Restarted!")
            return;
        }

        game._main();
    } else {
        console.log("not done");
    }

    // if (player.startTime !== 0) {
    //     const passedTime = Date.now() - player.startTime;
    //     const seconds = (passedTime / 1000);
    //     frames += 1;
    //     console.log(seconds + " " + frames + " " + frames/seconds);
    // }
}
// let frames = 0;


let game = null;

MDog.AssetManager.loadFile("side/tilemaps/good/test2_Colors_BuildingBottom.csv", "Building1");
MDog.AssetManager.loadFile("side/tilemaps/good/test2_Colors_BuildingTop.csv", "Building2");
MDog.AssetManager.loadFile("side/tilemaps/good/test2_Colors_Tiles.csv", "Tiles");
MDog.AssetManager.loadFile("side/tilemaps/good/test2_Colors_Deco.csv", "Deco");
MDog.AssetManager.loadFile("side/tilemaps/good/test2_Colors_Colors.csv", "Colors");

MDog.setActiveFunction(gameTick);

// TODO SECTION ---

// TODO add menu
// TODO add diagonal down for wave dashing celeste stytyle
// TODO electric fence?
// TODO fix grapple
// TODO if you jump then dash up you don't dash very far/at all


// Player

//  Set acceleration to zero

//  Key input physics
//   Changing x velocity on key input
//   Wind
//   Gravity
//   On conveyer belt
//   Friction

//  Acceleration is added to velocity

//  Game shit - Sets velocity
//   Setting y velocity on jump

//  Velocity is added to position

//  Game shit - Sets velocity
//   Wall collisions
//   Jump pads