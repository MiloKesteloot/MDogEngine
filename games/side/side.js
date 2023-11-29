import MDog from "/MDogMain.js";
import Tilemaps from "/games/side/tilemaps.js";

MDog.Draw.setBackgroundColor("#0f0f17");

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

class Coin {
    constructor(x, y) {
        this.position = new MDog.Math.Vector(x, y);
        this.hitbox = new Hitbox(
            this.position,
            0, 0, 13, 13
        )
        this.state = new CoinState(this);
    }

    getX() {// TODO This is only here because I'm using the state thing instead of animations
        return this.position.getX();
    }
    getY() {
        return this.position.getY();
    }

    draw() {
        this.state.draw();
    }

    pickup() {
        for (let i = 0; i < 80; i++) {
            globalParticleSystem.addParticle(
                new MDog.FX.ChunkParticle(
                    this.hitbox.getLeftX() + Math.floor(rnd(0, player.hitbox.getWidth())),
                    this.hitbox.getTopY() + Math.floor(rnd(0, player.hitbox.getHeight())),
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

class Hitbox {
    constructor(vector, x1, y1, x2, y2) {
        this.vector = vector;
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
    }

    draw() {
        MDog.Draw.rectangle(
            Math.floor(this.vector.getX()) + this.x1,
            Math.floor(this.vector.getY()) + this.y1,
            this.x2-this.x1,
            this.y2-this.y1,
            "#ff0000");
    }

    getX(index) {
        return Math.floor(this.vector.getX()) + this.x1 + [
            -1,
            0,
            this.x2-this.x1,
            this.x2-this.x1 + 1
        ][index];
    }
    getY(index) {
        return Math.floor(this.vector.getY()) + this.y1 + [
            -1,
            0,
            this.y2-this.y1-1,
            this.y2-this.y1
        ][index];
    }
    getWidth() {
        return this.x2 - this.x1;
    }
    getHeight() {
        return this.y2 - this.y1;
    }

    getLeftX() {
        return Math.floor(this.vector.getX()) + this.x1;
    }
    getRightX() {
        return Math.floor(this.vector.getX()) + this.x2 - 1;
    }
    getTopY() {
        return Math.floor(this.vector.getY()) + this.y1;
    }
    getBottomY() {
        return Math.floor(this.vector.getY()) + this.y2 - 1;
    }

    colliding(otherHitbox) {
        const test1 = this.getRightX() < otherHitbox.getLeftX();
        const test2 = this.getLeftX() > otherHitbox.getRightX();
        const test3 = this.getTopY() > otherHitbox.getBottomY();
        const test4 = this.getBottomY() < otherHitbox.getTopY();

        if (test1 || // this hitbox is to the left of the other
            test2 || // this hitbox is to the right of the other
            test3 || // this hitbox is above the other
            test4)   // this hitbox is below the other
        {
            return false;
        } else {
            return true;
        }
    }
}

class Camera {
    constructor(follow) {
        this.follow = follow;
        this.position = follow.clone();
        this.xRange = 100;
        this.yRange = 100;
    }

    getX() {
        return this.position.getX();
    }

    getY() {
        return this.position.getY();
    }

    update() {
        if (this.position.getX() < Math.floor(this.follow.getX()) - this.xRange) {
            this.position.setX(Math.floor(this.follow.getX()) - this.xRange);
        }
        if (this.position.getX() > Math.floor(this.follow.getX()) + this.xRange) {
            this.position.setX(Math.floor(this.follow.getX()) + this.xRange);
        }

        if (this.position.getY() < Math.floor(this.follow.getY()) - this.yRange) {
            this.position.setY(Math.floor(this.follow.getY()) - this.yRange);
        }
        if (this.position.getY() > Math.floor(this.follow.getY()) + this.yRange) {
            this.position.setY(Math.floor(this.follow.getY()) + this.yRange);
        }
    }
}

class Player {
    constructor(x, y) {
        this.position = new MDog.Math.Vector(x, y);
        this.velocity = new MDog.Math.Vector();
        this.camera = new Camera(this.position);
        this.particleSystem = new MDog.FX.ParticleSystem();
        this.startTime = 0;

        this.keys = {
            left: ["a", "ArrowLeft"],
            right: ["d", "ArrowRight"],
            up: ["w", "ArrowUp"],
            down: ["s", "ArrowDown"],
            jump: [" ", "c"], // , "w", "ArrowUp"
            dash: ["Shift", "x"],
        };

        this.keyBuffers = {
            jump: {time: 0, limit: 10},
            dash: {time: 0, limit: 10},
        }

        this.flipMargin = 0.1;
        this.facingLeft = false;

        this.groundCoyoteLimit = 12;
        this.groundCoyoteTime = 0;
        this.wallCoyoteLimit = 15;
        this.wallCoyoteTime = 0;
        this.lastTouchedLeftWall = false;

        this.runMargin = 0.8;
        this.groundAcceleration = 0.07;
        this.airAcceleration = 0.03;
        this.groundDeceleration = 0.07;
        this.airDeceleration = 0.04;
        this.maxRunSpeed = 1.7;

        this.jumpHoldLimit = 30;
        this.jumpHoldTime = 0;
        this.jumpForce = 2;
        this.gravity = 0.08;
        this.maxAirFallSpeed = 2.5;
        this.maxWallSlideFallSpeed = 0.4;
        this.wallDeceleration = 0.1;
        this.wallJumpXStrength = 2.5;
        this.wallJumpYStrength = 2.5;

        this.hasAirDash = false;

        this.attackHorizontalX = 2.5;
        this.attackHorizontalY = 2;
        this.attackDiagonalX = 1.5;
        this.attackDiagonalY = 3;
        this.attackUpX = 0;
        this.attackUpY = 4;
        this.attackDownX = 0;
        this.attackDownY = 5;

        this.state = new IdleState(this);
        this.lastState = this.state;

        this.hitbox = new Hitbox(this.position, 23, 12, 33, 43);

    }

    keyDown(keyList, hold) {
        hold = hold ?? true;
        for (let i = 0; i < keyList.length; i++) {
            if (hold) {
                if (MDog.Input.Keyboard.isDown(keyList[i])) {
                    return true;
                }
            } else {
                if (MDog.Input.Keyboard.isClicked(keyList[i])) {
                    return true;
                }
            }
        }
        return false;
    }

    getX() {
        return Math.floor(this.position.getX());
    }

    getY() {
        return Math.floor(this.position.getY());
    }

    update() {

        if (MDog.Input.Keyboard.isClicked("r")) {
            location.reload();
        }

        if (this.onLeft()) {
            this.lastTouchedLeftWall = true;
        }

        if (this.onRight()) {
            this.lastTouchedLeftWall = false;
        }

        const bufferNames = ["jump", "dash"];
        for (let i = 0; i < bufferNames.length; i++) {
            const name = bufferNames[i];
            if (this.keyBuffers[name].time > 0) {
                this.keyBuffers[name].time -= 1;
            }

            if (this.keyDown(this.keys[name], false)) {
                this.keyBuffers[name].time = this.keyBuffers[name].limit;
            }
        }



        if (MDog.Input.Keyboard.downKeys.length > 0 && this.startTime === 0) {
            this.startTime = Date.now();
            console.log("Started!");
        }

        this.particleSystem.update();

        if (this.onGround()) {

            this.groundCoyoteTime = this.groundCoyoteLimit;
            this.wallCoyoteTime = 0;

            this.hasAirDash = true;
        } else if (this.groundCoyoteTime > 0) {
            this.groundCoyoteTime -= 1;
        }

        if (this.isWallSliding()) {
            this.wallCoyoteTime = this.wallCoyoteLimit;
            this.groundCoyoteTime = 0;
        } else if (this.wallCoyoteTime > 0) {
            this.wallCoyoteTime -= 1;
        }

        if (this.keyBuffers.dash.time > 0 &&
            this.hasAirDash &&
            this.state.canDashAttack()) {

            this.keyBuffers.dash.time = 0;
            this.hasAirDash = false;
            const direction = new MDog.Math.Vector();
            this.setState(DashAttackState);

            if (this.keyDown(this.keys.up)) {
                direction.add(0, -1);
            }
            if (this.keyDown(this.keys.down)) {
                direction.add(0, 1);
            }
            if (this.keyDown(this.keys.right)) {
                direction.add(1, 0);
            }
            if (this.keyDown(this.keys.left)) {
                direction.add(-1, 0);
            }
            if (direction.x === 0 && direction.y === 0) {
                direction.setX(this.facingLeft ? -1 : 1);
            }
            if (direction.x !== 0) {
                this.facingLeft = direction.x === -1;
            }

            let velocityX = 0;
            let velocityY = 0;
            if (direction.x !== 0 && direction.y === 0) {
                velocityX = direction.x * this.attackHorizontalX;
                velocityY = -this.attackHorizontalY;
            } else if (direction.x !== 0 && direction.y === -1) {
                velocityX = direction.x * this.attackDiagonalX;
                velocityY = -this.attackDiagonalY;
            } else if (direction.x === 0 && direction.y === -1) {
                velocityX = this.attackUpX;
                velocityY = -this.attackUpY;
            } else if (direction.y === 1) {
                velocityX = this.attackDownX;
                velocityY = this.attackDownY;
            }

            if (velocityX > 0) {
                velocityX = Math.max(velocityX, this.velocity.getX());
            }
            if (velocityX < 0) {
                velocityX = Math.min(velocityX, this.velocity.getX());
            }
            if (velocityY > 0) {
                velocityY = Math.max(velocityY, this.velocity.getY());
            }
            if (velocityY < 0) {
                velocityY = Math.min(velocityY, this.velocity.getY());
            }

            player.velocity.setX(velocityX);
            player.velocity.setY(velocityY);
        }

        let goalVelX = 0;
        const acc = this.onGround() ? this.groundAcceleration : this.airAcceleration;
        if (this.keyDown(this.keys.right)) {
            goalVelX += acc;
        }
        if (this.keyDown(this.keys.left)) {
            goalVelX -= acc;
        }

        if (!(this.onLeft() && goalVelX < 0) &&
            !(this.onRight() && goalVelX > 0)) {
            if (this.velocity.getX() + goalVelX <= this.maxRunSpeed &&
                this.velocity.getX() + goalVelX >= -this.maxRunSpeed) {

                // This part makes sure that you can turn around on a dime when touching a wall and you don't get stuck with weird velocity timing
                if (this.onLeft() && goalVelX > 0 && this.velocity.getX() < 0) {
                    this.velocity.setX(0);
                }
                if (this.onRight() && goalVelX < 0 && this.velocity.getX() > 0) {
                    this.velocity.setX(0);
                }

                this.velocity.x += goalVelX;
                if (this.velocity.getX() > this.maxRunSpeed) {
                    this.velocity.setX(this.maxRunSpeed);
                }
                if (this.velocity.getX() < -this.maxRunSpeed) {
                    this.velocity.setX(-this.maxRunSpeed);
                }
            }
        }

        // && this.onGround()

        if ((goalVelX === 0) ||
            (Math.sign(goalVelX) !== 0 && Math.sign(goalVelX) !== Math.sign(this.velocity.getX())) ||
            (this.onRight() && this.velocity.getX() > 0) ||
            (this.onLeft() && this.velocity.getX() < 0)) {

            const decel = this.onGround() ? this.groundDeceleration : this.airDeceleration;

            if (this.velocity.getX() > 0) {
                this.velocity.x -= decel;
                if (this.velocity.getX() < 0) {
                    this.velocity.setX(0);
                }
            }
            if (this.velocity.getX() < 0) {
                this.velocity.x += decel;
                if (this.velocity.getX() > 0) {
                    this.velocity.setX(0);
                }
            }
        }

        if (!this.onGround()) {
            if (!this.isWallSliding()) {
                const fallSpeed = this.maxAirFallSpeed;

                if (this.velocity.y < fallSpeed) {
                    this.velocity.y += this.gravity;
                    if (this.velocity.y > fallSpeed) {
                        this.velocity.setY(fallSpeed);
                    }
                }
            } else {
                const fallSpeed = this.maxWallSlideFallSpeed;

                if (this.velocity.y < fallSpeed) {
                    this.velocity.y += this.gravity;
                    if (this.velocity.y > fallSpeed) {
                        this.velocity.setY(fallSpeed);
                    }
                }

                if (this.velocity.y > fallSpeed) {
                    this.velocity.y -= this.wallDeceleration;
                    if (this.velocity.y < fallSpeed) {
                        this.velocity.setY(fallSpeed);
                    }
                }
            }
        } else {
            this.velocity.setY(Math.min(this.velocity.y, 0));
        }

        if (this.keyBuffers.jump.time > 0) {
            if (this.onGround()) {
                this.jumpHoldTime = this.jumpHoldLimit;
                this.groundCoyoteTime = 0;
                this.velocity.setY(-this.jumpForce);

                this.keyBuffers.jump.time = 0;
            } else if (this.groundCoyoteTime > 0) {
                this.jumpHoldTime = this.jumpHoldLimit;
                this.groundCoyoteTime = 0;
                this.velocity.setY(-this.jumpForce);

                this.keyBuffers.jump.time = 0;
            } else if (this.isWallSliding() || this.wallCoyoteTime > 0) {
                this.wallCoyoteTime = 0;
                const xVel = this.lastTouchedLeftWall ? this.wallJumpXStrength : -this.wallJumpXStrength;
                this.velocity.setX(xVel);
                this.velocity.setY(-this.wallJumpYStrength);
                this.facingLeft = this.velocity.getX() < 0;

                this.keyBuffers.jump.time = 0;
            }
        }

        if (this.keyDown(this.keys.jump)) {
            if ((!this.onGround()) &&
                (!this.groundCoyoteTime > 0) &&
                this.jumpHoldTime > 0) {
                this.jumpHoldTime -= 1;
                this.velocity.setY(-this.jumpForce);
            }
        }

        if (!this.keyDown(this.keys.jump)) {
            if (!this.onGround()) {
                this.jumpHoldTime = 0;
            }
        }

        this.position.x += this.velocity.getX();
        if (this.inRight()) {
            this.position.setX(Math.floor(this.position.getX()));
        }
        while (this.inRight()) {
            this.position.setX(Math.floor(this.position.getX()) - 1);
        }
        if (this.inLeft()) {
            this.position.setX(Math.floor(this.position.getX()));
        }
        while (this.inLeft()) {
            this.position.setX(Math.floor(this.position.getX()) + 1);
        }

        this.position.y += this.velocity.getY();
        this.fixCeil();
        this.fixGround();

        this.$doAnimations();
        this.$doParticles();

        this.camera.update();

        this.lastState = this.state;
    }

    $doParticles() {
        if (this.onGround() && this.state.is(RunningState)) {

            const grass = 2;
            const red = 0;

            const groundMaterial = this.getGroundMaterial();

            if (groundMaterial === grass) {
                if (rnd(10) < 3) {

                    let color;
                    let size;
                    if (rnd(10) > 3) {
                        color = "#31930f";
                        size = Math.floor(rnd(1, 3));
                    } else {
                        color = "#963e0a";
                        size = 1;
                    }

                    this.particleSystem.addParticle(
                        new MDog.FX.ChunkParticle(
                            player.hitbox.getLeftX() + Math.floor(Math.floor(rnd(0, player.hitbox.getWidth()))),
                            player.hitbox.getBottomY() + Math.floor(rnd(-2, 2)) + 2,
                            Math.floor(rnd(10, 30)),
                            color,
                            rnd(-1, 1) * 0.5 + (player.facingLeft ? 1 : -1) * 0.5,
                            rnd(-1, -0.5),
                            {
                                gx: 0,
                                gy: 0.05,
                                size: size
                            }
                        ));
                }
            } else if (groundMaterial === red) {
                if (rnd(10) < 3) {

                    let color = "#ff0000";
                    let size = 1; //Math.floor(rnd(1, 3));

                    this.particleSystem.addParticle(
                        new MDog.FX.ChunkParticle(
                            player.hitbox.getLeftX() + Math.floor(Math.floor(rnd(0, player.hitbox.getWidth()))),
                            player.hitbox.getBottomY() + Math.floor(rnd(-2, 2)) + 2,
                            Math.floor(rnd(10, 30)),
                            color,
                            rnd(-1, 1) * 0.5 + (player.facingLeft ? 1 : -1) * 0.5,
                            rnd(-1, -0.5),
                            {
                                gx: 0,
                                gy: 0.05,
                                size: size
                            }
                        ));
                }
            }
        }
    }

    $doAnimations() {
        if (this.onGround()) {
            if ((!(this.state.is(DashAttackState))) || this.state.time < 2) {
                if (this.velocity.x > this.flipMargin) {
                    this.facingLeft = false;
                }
                if (this.velocity.x < -this.flipMargin) {
                    this.facingLeft = true;
                }
            }
        } else if (this.isWallSliding() && this.isFalling()) {
            this.facingLeft = !this.onLeft();
        }

        if (this.isWallSliding() && this.isFalling()) {
            this.setState(WallSlideState);
        } else if (!this.onGround()) {
            if (this.isFalling()) {
                const check = this.check(1, Math.floor(this.hitbox.getWidth()/2), 3, 20);
                if (!check) {
                    this.setState(FallState);
                }
            } else {
                this.setState(JumpState);
            }
        } else {
            if (Math.abs(this.velocity.x) > this.runMargin &&
                !(this.velocity.x > 0 && this.onRight()) &&
                !(this.velocity.x < 0 && this.onLeft())) {
                this.setState(RunningState);
            } else {
                this.setState(IdleState);
            }
        }
    }

    fixGround() {
        if (this.inGround()) {
            this.position.setY(Math.floor(this.position.getY()));
            this.velocity.setY(Math.max(this.velocity.y, 0));
            while(this.inGround()) {
                this.position.y -= 1;
            }
        }
    }

    fixCeil() {
        if (this.inCeil()) {
            this.position.setY(Math.floor(this.position.getY()));
            this.velocity.setY(Math.max(this.velocity.y, 0));
            while(this.inCeil()) {
                this.position.y += 1;
            }
        }
    }

    isFalling() {
        return this.velocity.getY() >= 0;
    }

    isWallSliding() {
        if (!this.state.canWallSlide()) {
            return false;
        }
        return !this.onGround() &&
            // ((this.onLeft() && this.keyDown(this.keys.left)) ||
            //     (this.onRight() && this.keyDown(this.keys.right))) &&
            (this.onLeft() || this.onRight()); // &&
            // this.isFalling();
    }

    getMaterial(x, y) {
        const first = tilemapTest1.screenToTile(x, y);
        return tilemapTest1.get(first.x,first.y)
    }

    check(x1, xp1, y1, yp1) {
        return this.getMaterial(this.hitbox.getX(x1) + xp1, this.hitbox.getY(y1) + yp1)  !== -1;
    }

    getGroundMaterial() {
        return this.getMaterial(this.hitbox.getX(1) + Math.floor(this.hitbox.getWidth()/2), this.hitbox.getY(3) + 14)
    }

    onGround() {
        return this.check(1, 0, 3, 0) || this.check(2, 0, 3, 0);
    }
    inGround() {
        return this.check(1, 0, 2, 0) || this.check(2, 0, 2, 0);
    }

    onLeft() {
        return this.check(0, 0, 1, 0) || this.check(0, 0 , 2, 0) || this.check(0, 0, 1, Math.floor(this.hitbox.getHeight()/2));
    }
    inLeft() {
        return this.check(1, 0, 1, 0) || this.check(1, 0, 2, 0) || this.check(1, 0, 1, Math.floor(this.hitbox.getHeight()/2));
    }

    onRight() {
        return this.check(3, 0, 1, 0) || this.check(3, 0, 2, 0) || this.check(3, 0, 1, Math.floor(this.hitbox.getHeight()/2));
    }
    inRight() {
        return this.check(2, 0, 1, 0) || this.check(2, 0, 2, 0) || this.check(2, 0, 1, Math.floor(this.hitbox.getHeight()/2));
    }

    inCeil() {
        return this.check(1, 0, 0, 0) || this.check(2, 0, 0, 0);
    }

    setState(stateClass) {
        if (this.state.is(DashAttackState)) {
            if (stateClass === DashAttackState) {
                this.state = new stateClass(this);
                return;
            }
            return;
        }
        if (this.state.is(stateClass)) {
            return;
        }
        if (this.state.is(JumpState) && stateClass === FallState) {
            this.state = new JumpToFallState(this);
            return;
        }
        if (this.state.is(JumpToFallState) && stateClass === FallState) {
            return;
        }
        // if ((stateClass === FallState || stateClass === JumpToFallState) && (this.state.is(RunningState) || this.state.is(IdleState))) {
        //     return;
        // }
        this.state = new stateClass(this);
    }

    hardSetState(stateClass) {
        this.state = new stateClass(this);
    }

    draw() {
        this.state.draw();
        MDog.Draw.particleSystem(this.particleSystem);
        // this.hitbox.draw();
    }
}

class State {
    constructor(player, frames, fileName) {
        this.player = player;
        this.frames = frames;
        this.fileName = fileName;
        this.animationSpeed = 12;
        this.time = 0;
    }

    is(stateClass) {
        return this instanceof stateClass;
    }

    getFrame() {
        const localTime = Math.floor(this.time / (167 / this.animationSpeed));
        const localFrame = localTime % this.frames;
        return localFrame;
    }

    loadFrames() {
        for (let i = 0; i < this.frames; i++) {
            const image = this.fileName.replace("?", (i + 1));
            MDog.Draw.image(image, -100, -100);
        }
    }

    canWallSlide() {
        return true;
    }

    canDashAttack() {
        return true;
    }

    canOverrideSelf() {
        return false;
    }

    postDrawUpdate() {}

    draw() {
        const localFrame = this.getFrame();
        const image = this.fileName.replace("?", (localFrame + 1));
        let xOffset = 0;
        if (this.player.facingLeft) {
            xOffset = -8;
        }
        MDog.Draw.image(image, this.player.getX() + xOffset + this.getXOffset(), this.player.getY(), {flipX: this.getFlipX()});
        this.time += 1;
        this.postDrawUpdate();
    }

    getFlipX() {
        return player.facingLeft;
    }

    getXOffset() {
        return 0;
    }

    checkOverride(state) {
        return true;
    }
}

class TransitionState extends State {
    constructor(player, frames, fileName, nextState) {
        super(player, frames, fileName);
        this.nextState = nextState;
    }

    postDrawUpdate() {
        const localTime = Math.floor(this.time / (167 / this.animationSpeed));

        if (localTime >= this.frames) {
            this.player.hardSetState(this.nextState);
        }
    }
}

class CoinState extends State {
    constructor(vector) {
        super(vector, 8, "side/coin/coin_?.png");
    }
}

class RunningState extends State {
    constructor(player) {
        super(player, 8, "side/girl/Run/Warrior_Run_?.png");
    }
}

class IdleState extends State {
    constructor(player) {
        super(player, 6, "side/girl/Idle/Warrior_Idle_?.png");
    }
}

class JumpState extends State {
    constructor(player) {
        super(player, 3, "side/girl/Jump/Warrior_Jump_?.png");
    }
}

class FallState extends State {
    constructor(player) {
        super(player, 3, "side/girl/Fall/Warrior_Fall_?.png");
    }
}

class JumpToFallState extends TransitionState {
    constructor(player) {
        super(player, 2, "side/girl/UptoFall/Warrior_UptoFall_?.png", FallState);
    }
}

class DashAttackState extends TransitionState {
    constructor(player) {
        super(player, 10, "side/girl/Dash_Attack/Warrior_Dash-Attack_?.png", RunningState);
        this.animationSpeed = 20;
    }

    canWallSlide() {
        return this.getFrame() > 5;
    }

    canDashAttack() {
        return this.getFrame() > 5;
    }

    canOverrideSelf() {
        return true;
    }
}

class WallSlideState extends State {
    constructor(player) {
        super(player, 3, "side/girl/WallSlide/Warrior_WallSlide_?.png");
    }

    getFlipX() {
        return !player.facingLeft;
    }

    getXOffset() {
        return this.player.facingLeft ? 10 : -14;
    }
}

const globalParticleSystem = new MDog.FX.ParticleSystem();

const player = new Player(980, 370);

// const tilemapBuilding = new MDog.UI.TilemapInteractable(0, 0, 32*2, 24, 16, "side/city/Buildings.png", 25);
// const tilemapTile = new MDog.UI.TilemapInteractable(tilemapBuilding.x, tilemapBuilding.y, tilemapBuilding.width, tilemapBuilding.height, 16, "side/city/Tiles.png", 6);
// const tilemapDeco = new MDog.UI.TilemapInteractable(tilemapBuilding.x, tilemapBuilding.y, tilemapBuilding.width, tilemapBuilding.height, 16, "side/city/Props-01.png", 8);
const tilemapTest1 = new MDog.UI.TilemapInteractable(0, 0, 120, 40, 16, "side/city/Colors.png", 4);

// tilemapBuilding.importTilemap(tilemapBuildingSheet);
// tilemapTile.importTilemap(tilemapTileSheet);
// tilemapDeco.importTilemap(tilemapDecoSheet);
tilemapTest1.importTilemap(Tilemaps.tilemapTest1Sheet);

const coins = [];

for (let x = 0; x < tilemapTest1.width; x++) {
    for (let y = 0; y < tilemapTest1.height; y++) {
        const index = tilemapTest1.get(x, y);
        if (index === 3) {
            tilemapTest1.set(x, y, -1);
            const pos = tilemapTest1.tileToScreen(x, y);
            coins.push(new Coin(pos.x, pos.y));
        }
    }
}

new CoinState(null).loadFrames();

new IdleState(null).loadFrames();
new RunningState(null).loadFrames();
new JumpState(null).loadFrames();
new FallState(null).loadFrames();
new JumpToFallState(null).loadFrames();
new WallSlideState(null).loadFrames();
new DashAttackState(null).loadFrames();

function main() {

    player.update();
    globalParticleSystem.update();

    for (let i = 0; i < coins.length; i++) {
        if (coins[i].hitbox.colliding(player.hitbox)) {
            coins[i].pickup();
            coins.splice(i, 1);
            i--;
            if (coins.length === 0) {
                console.log((Date.now() - player.startTime)/1000);
            }
        }
    }

    MDog.Draw.clear({color:"#161228"});

    let goalX = -player.camera.getX() + Math.floor(MDog.Draw.getScreenWidthInArtPixels()/2) - 27;
    let goalY = -player.camera.getY() + Math.floor(MDog.Draw.getScreenHeightInArtPixels()/2) - 27;

    goalX = Math.min(goalX, 0);
    goalX = Math.max(goalX, -(tilemapTest1.width-32)*tilemapTest1.tileSize);
    goalY = Math.min(goalY, 0);
    goalY = Math.max(goalY, -(tilemapTest1.height-32)*tilemapTest1.tileSize);

    MDog.Draw.translateX(goalX);
    MDog.Draw.translateY(goalY);

    MDog.Draw.interactable(tilemapTest1);
    // MDog.Draw.interactable(tilemapBuilding);
    // MDog.Draw.interactable(tilemapTile);

    for (let i = 0; i < coins.length; i++) {
        coins[i].draw();
    }

    player.draw();

    MDog.Draw.particleSystem(globalParticleSystem);
    // player.hitbox.draw();

    // MDog.Draw.interactable(tilemapDeco);

    // if (player.startTime !== 0) {
    //     const passedTime = Date.now() - player.startTime;
    //     const seconds = (passedTime / 1000);
    //     frames += 1;
    //     console.log(seconds + " " + frames + " " + frames/seconds);
    // }
}
// let frames = 0;

MDog.setActiveFunction(main);

// TODO SECTION ---

// TODO add setting where up is jump
// TODO remove "!this.state.is(DashAttackState)" and replace it with "this.state.canDashAttack()"
// TODO make whole game class that is restartable
// TODO add menu
// TODO switch dash directions when you switch direction right after dashing? Kinda like a dash direction switch buffer