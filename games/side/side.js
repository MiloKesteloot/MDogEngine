import MDog from "/MDogEngine/MDogMain.js"

MDog.Draw.setBackgroundColor("#0f0f17");

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
        this.hitbox = new Hitbox(
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

    getMiddleOffsetX() {
        return Math.floor(this.x1 + Math.floor(this.getWidth()/2));
    }
    getMiddleOffsetY() {
        return Math.floor(this.y1 + Math.floor(this.getHeight()/2));
    }

    getMiddleX() {
        return Math.floor(this.vector.getX()) + this.x1 + Math.floor(this.getWidth()/2);
    }

    getMiddleY() {
        return Math.floor(this.vector.getY()) + this.y1 + Math.floor(this.getHeight()/2);
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

        let goalX = -this.getX() + Math.floor(MDog.Draw.getScreenWidthInArtPixels()/2) - 27;

        let goalY = -this.getY() + Math.floor(MDog.Draw.getScreenHeightInArtPixels()/2) - 27;
        // let goalY = -Math.floor(this.follow.getY()) + Math.floor(MDog.Draw.getScreenHeightInArtPixels()/2) - 27;



        const hbtm = this.game.tilemaps.hitbox;

        goalX = Math.min(goalX, 0);
        goalX = Math.max(goalX, -(hbtm.width-32)*hbtm.tileSize);
        goalY = Math.min(goalY, 0);
        goalY = Math.max(goalY, -(hbtm.height-24)*hbtm.tileSize);

        MDog.Draw.translateX(goalX);
        MDog.Draw.translateY(goalY);
    }
}

class Player {
    constructor(game, x, y) {
        this.game = game;
        this.position = new Vector(x, y);
        this.lowestY = 1000;
        this.velocity = new Vector();
        this.camera = new Camera(this.game, this.position);
        this.particleSystem = new MDog.FX.ParticleSystem();
        this.startTime = 0;

        this.keys = {
            left: ["a", "ArrowLeft"],
            right: ["d", "ArrowRight"],
            up: ["w", "ArrowUp"],
            down: ["s", "ArrowDown"],
            jump: [" ", "c"], // , "w", "ArrowUp"
            dash: ["Shift", "x", "Enter"],
            toggleJump: ["\\"]
        };

        if (settings.upToJump) {
            for (let i = 0; i < this.keys.up.length; i++) {
                this.keys.jump.push(this.keys.up[i]);
            }
        }

        this.keyBuffers = {
            jump: {time: 0, limit: 10},
            dash: {time: 0, limit: 15},
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

        this.grapple = null;
        this.grappleRange = 0;

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

        if (MDog.Math.deltaTime() > 20) {
            console.log("Lag spike - " + MDog.Math.deltaTime());
        }

        if (this.keyDown(this.keys.toggleJump, false)) {
            if (!settings.upToJump) {
                for (let i = 0; i < this.keys.up.length; i++) {
                    this.keys.jump.push(this.keys.up[i]);
                }
                settings.upToJump = true;
                console.log("Up to jump enabled!");
            } else {
                for (let i = 0; i < this.keys.up.length; i++) {
                    this.keys.jump.splice(this.keys.jump.indexOf(this.keys.up[i]), 1);
                }
                settings.upToJump = false;
                console.log("Up to jump disabled!");
            }
        }

        if (this.position.getY() < this.lowestY) {
            this.lowestY = this.position.getY();
            // console.log(this.lowestY);
        }

        if (MDog.Input.Keyboard.isClicked("r")) {
            console.log("Restarted!")
            game = new Game();
            return;
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


        const downKeys = MDog.Input.Keyboard.downKeys;

        if (downKeys.includes("r")) {
            downKeys.splice(downKeys.indexOf("r"), 1);
        }

        if (downKeys.length > 0 && this.startTime === 0) {
            this.startTime = Date.now();
            console.log("Started!");
        }

        this.particleSystem.update();

        const outerRange = 20;
        for (let i = 0; i < this.particleSystem.particles.length; i++) {
            const particle = this.particleSystem.particles[i];
            if (particle.tags.includes("wind")) {
                if (particle.getX() < 0-outerRange) {
                    particle.position.setX(MDog.Draw.getScreenWidthInArtPixels() + outerRange);
                }
                if (particle.getX() > MDog.Draw.getScreenWidthInArtPixels()+outerRange) {
                    particle.position.setX(0-outerRange);
                }
                if (particle.getY() < 0-outerRange) {
                    particle.position.setY(MDog.Draw.getScreenHeightInArtPixels() + outerRange);
                }
                if (particle.getY() > MDog.Draw.getScreenHeightInArtPixels()+outerRange) {
                    particle.position.setY(0-outerRange);
                }
            }
        }

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

        if (this.keyDown(this.keys.jump, false)) {
            if (!this.onGround()) {
                for (let i = 0; i < this.game.grapples.length; i++) {
                    const grapple = this.game.grapples[i];
                    const px = this.hitbox.getMiddleX();
                    const py = this.hitbox.getMiddleY();
                    const dist = new Vector(px, py).distanceTo(grapple.position);
                    if (dist < grapple.range) {
                        this.grapple = grapple;
                        this.grappleRange = dist;
                    }
                }
            }
        }

        if (this.grapple === null) {
            this.$doGroundAirMovement();
        } else {
            this.$doGrappleMovement();
        }

        this.$doAnimations();
        this.$doParticles();

        this.camera.update();

        this.lastState = this.state;
    }

    updateMovement() {
        this.position.x += this.velocity.getX();// * MDog.Math.deltaTime()/6;
        this.fixWalls();

        this.position.y += this.velocity.getY();// * MDog.Math.deltaTime()/6;
        this.fixCeil();
        this.fixGround();
    }

    $doGrappleMovement() {

        const fallSpeed = this.maxAirFallSpeed;

        if (this.velocity.y < fallSpeed) {
            this.velocity.y += this.gravity;
            if (this.velocity.y > fallSpeed) {
                this.velocity.setY(fallSpeed);
            }
        }

        // this.updateMovement();
        this.position.x += this.velocity.getX();// * MDog.Math.deltaTime()/6;
        this.position.y += this.velocity.getY();// * MDog.Math.deltaTime()/6;

        if (!this.keyDown(this.keys.jump)) {
            // this.velocity.setX(0);
            // this.velocity.setY(0);
            // this.position.setX(this.grapple.position.getX());
            // this.position.setY(this.grapple.position.getY());
            this.grapple = null;
            return;
        }

        const playerVector = new Vector(this.hitbox.getMiddleX(), this.hitbox.getMiddleY());

        // if player is further than grapple range, bring him in
        const dist = playerVector.distanceTo(this.grapple.position);

        if (dist > this.grappleRange) {
            // playerVector.subtract(this.grapple.position);
            // playerVector.normalize();
            // playerVector.multiply(this.grappleRange);
            // playerVector.add(this.grapple.position);
            // this.position.setX(playerVector.getX() - this.hitbox.x1 + Math.floor(this.hitbox.getWidth()/2));
            // this.position.setY(playerVector.getY() - this.hitbox.y1 + Math.floor(this.hitbox.getHeight()/2));
            //
            // const grappleVector = this.grapple.position.clone();
            // grappleVector.subtract(playerVector);
            // const mag = this.velocity.length();
            //
            // const newVec = grappleVector.clone();
            //
            // newVec.normalize();
            // const saveX = newVec.getX();
            // newVec.setX(-newVec.getY());
            // newVec.setY(saveX);
            // newVec.multiply(mag);
            //
            // console.log(mag)
            //
            // this.velocity.setX(newVec.getX());
            // this.velocity.setY(newVec.getY());

            // redirect velocity
        } else {
            this.grappleRange = dist;
        }


        // if player is in grapple range, do nothing

        // update player position by his velocity

        // if player is further than grapple range, bring him in, redirect velocity
    }

    $doGroundAirMovement() {
        if (this.keyBuffers.dash.time > 0 &&
            this.hasAirDash &&
            this.state.canDashAttack()) {

            this.keyBuffers.dash.time = 0;
            this.hasAirDash = false;
            const direction = new Vector();
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

            this.velocity.setX(velocityX);
            this.velocity.setY(velocityY);

            let pv = direction.clone();
            pv.normalize();
            pv.multiply(this.velocity.length());
            // pv.multiply(3);

            const move = 0.5;

            // *3-1

            for (let i = 0; i < 50; i++) {
                let x = Math.floor((Math.random())*MDog.Draw.getScreenWidthInArtPixels());
                let y = Math.floor((Math.random())*MDog.Draw.getScreenHeightInArtPixels());
                this.particleSystem.addParticle(
                    new MDog.FX.LineParticle(
                        x,
                        y,
                        Math.floor(rnd(10, 70)),
                        "#ffffff" + Math.floor(rnd(3, 9)) + "0",
                        pv.getX() + rnd(-move, move),
                        pv.getY() + rnd(-move, move),
                        {
                            gx: 0,
                            gy: 0,
                            layer: 10,
                            length: Math.floor(rnd(10, 20)),
                            tags: ["wind"]
                        }
                    ));
            }

            for (let i = 0; i < 13; i++) {
                let x = Math.floor((Math.random())*MDog.Draw.getScreenWidthInArtPixels());
                let y = Math.floor((Math.random())*MDog.Draw.getScreenHeightInArtPixels());
                this.particleSystem.addParticle(
                    new MDog.FX.ChunkParticle(
                        x,
                        y,
                        Math.floor(rnd(10, 70)),
                        "#287013",
                        pv.getX(),
                        pv.getY(),
                        {
                            gx: 0,
                            gy: 0,
                            size: Math.floor(rnd(2, 5)),
                            layer: 10,
                            tags: ["wind"]
                        }
                    ));
            }
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

        this.updateMovement();
    }

    // test

    $doParticles() {
        // if (!this.onGround()) {
        //     const velCheck = this.velocity.clone();
        //     velCheck.y /= 1.7;
        //     velCheck.x *= 3;
        //     if (Math.random()*velCheck.length() > 1.3) {
        //         const move = this.velocity.clone();
        //         move.multiply(-0.5);
        //         const add = this.velocity.clone();
        //         add.normalize();
        //         add.multiply(5);
        //         for (let i = 0; i < 1; i++) {
        //             let x = Math.floor(rnd(this.hitbox.getX(1), this.hitbox.getX(2)) + add.getX());
        //             let y = Math.floor(rnd(this.hitbox.getY(1), this.hitbox.getY(2)) + add.getY());
        //             this.particleSystem.addParticle(
        //                 new MDog.FX.LineParticle(
        //                     x,
        //                     y,
        //                     Math.floor(rnd(5, 15) * velCheck.length()),
        //                     "#ffffff" + Math.floor(rnd(3, 9)) + "0", // "#287013", //
        //                     move.getX(),
        //                     move.getY(),
        //                     {
        //                         gx: 0,
        //                         gy: 0,
        //                         length: 10,
        //                         // size: Math.floor(rnd(1, 3)),
        //                     }
        //                 ));
        //         }
        //     }
        // }
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
                            this.hitbox.getLeftX() + Math.floor(Math.floor(rnd(0, this.hitbox.getWidth()))),
                            this.hitbox.getBottomY() + Math.floor(rnd(-2, 2)) + 2,
                            Math.floor(rnd(10, 30)),
                            color,
                            rnd(-1, 1) * 0.5 + (this.facingLeft ? 1 : -1) * 0.5,
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
                            this.hitbox.getLeftX() + Math.floor(Math.floor(rnd(0, this.hitbox.getWidth()))),
                            this.hitbox.getBottomY() + Math.floor(rnd(-2, 2)) + 2,
                            Math.floor(rnd(10, 30)),
                            color,
                            rnd(-1, 1) * 0.5 + (this.facingLeft ? 1 : -1) * 0.5,
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

    fixWalls() {
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
        const first = this.game.tilemaps.hitbox.screenToTile(x, y);
        return this.game.tilemaps.hitbox.get(first.x,first.y)
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
    constructor(player, frames, fileName, animationSpeed) {
        this.player = player;
        this.animation = new MDog.Draw.MultipleFileAnimation(fileName, frames, animationSpeed);
    }

    is(stateClass) {
        return this instanceof stateClass;
    }

    getFrame() {
        return this.animation.getFrame();
    }

    loadFrames() {
        MDog.Draw.preloadAnimation(this.animation);
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
        let xOffset = 0;
        if (this.player.facingLeft) {
            xOffset = -8;
        }
        MDog.Draw.animation(this.animation, this.player.getX() + xOffset + this.getXOffset(), this.player.getY(), {flipX: this.getFlipX()});
        this.postDrawUpdate();
    }

    getFlipX() {
        return this.player.facingLeft;
    }

    getXOffset() {
        return 0;
    }

    checkOverride(state) {
        return true;
    }
}

class TransitionState extends State {
    constructor(player, frames, fileName, animationSpeed, nextState) {
        super(player, frames, fileName, animationSpeed);
        this.nextState = nextState;
    }

    postDrawUpdate() {
        // TODO add "get local time" to animation system

        if (this.animation.getRawFrame() >= this.animation.frames) {
            this.player.hardSetState(this.nextState);
        }
    }
}

class RunningState extends State {
    constructor(player) {
        super(player, 8, "side/girl/Run/Warrior_Run_?.png", 12);
    }
}

class IdleState extends State {
    constructor(player) {
        super(player, 6, "side/girl/Idle/Warrior_Idle_?.png", 12);
    }
}

class JumpState extends State {
    constructor(player) {
        super(player, 3, "side/girl/Jump/Warrior_Jump_?.png", 12);
    }
}

class FallState extends State {
    constructor(player) {
        super(player, 3, "side/girl/Fall/Warrior_Fall_?.png", 12);
    }
}

class JumpToFallState extends TransitionState {
    constructor(player) {
        super(player, 2, "side/girl/UptoFall/Warrior_UptoFall_?.png", 12, FallState);
    }
}

class DashAttackState extends TransitionState {
    constructor(player) {
        super(player, 10, "side/girl/Dash_Attack/Warrior_Dash-Attack_?.png", 20, RunningState);
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
        super(player, 3, "side/girl/WallSlide/Warrior_WallSlide_?.png", 12);
    }

    getFlipX() {
        return !this.player.facingLeft;
    }

    getXOffset() {
        return this.player.facingLeft ? 10 : -14;
    }
}

new IdleState(null).loadFrames();
new RunningState(null).loadFrames();
new JumpState(null).loadFrames();
new FallState(null).loadFrames();
new JumpToFallState(null).loadFrames();
new WallSlideState(null).loadFrames();
new DashAttackState(null).loadFrames();
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
        this.player = new Player(this, 980, 370);
        this.coins = [];
        this.grapples = [
            // new Grapple(this, 550, 70),

        ];

        this.globalParticleSystem = new MDog.FX.ParticleSystem();
        this.screenSpaceParticleSystem = new MDog.FX.ParticleSystem();

        this.tilemaps = {
            // hitbox: new MDog.UI.TilemapInteractable(0, 0, MDog.AssetManager.get("Building"), 16, "side/city/Colors.png", 6),
            // hitbox: new MDog.UI.TilemapInteractable(0, 0, MDog.AssetManager.get("Tiles"), 16, "side/city/Tiles.png", 6),
            hitbox: new MDog.UI.TilemapInteractable(0, 0, MDog.AssetManager.get("Colors"), 16, "side/city/Colors.png", 4),
            back: [
                // new MDog.UI.TilemapInteractable(0, 0, MDog.AssetManager.get("Building1"), 16, "side/city/Buildings.png", 25),
                // new MDog.UI.TilemapInteractable(0, 0, MDog.AssetManager.get("Building2"), 16, "side/city/Buildings.png", 25),
                // new MDog.UI.TilemapInteractable(0, 0, MDog.AssetManager.get("Tiles"), 16, "side/city/Tiles.png", 6),
            ],
            front: [
                // new MDog.UI.TilemapInteractable(0, 0, MDog.AssetManager.get("Deco"), 16, "side/city/Props-01.png", 8)
            ]
        }

        const hbtm = this.tilemaps.hitbox;

        for (let x = 0; x < hbtm.width; x++) {
            for (let y = 0; y < hbtm.height; y++) {
                const index = hbtm.get(x, y);
                if (index === 1) {
                    hbtm.set(x, y, -1);
                    const pos = hbtm.tileToScreen(x, y);
                    this.coins.push(new Coin(this, pos.x, pos.y));
                }
                if (index === 3) {
                    hbtm.set(x, y, -1);
                    const pos = hbtm.tileToScreen(x, y);
                    this.player.position.setX(pos.x - this.player.hitbox.getMiddleOffsetX());
                    this.player.position.setY(pos.y - this.player.hitbox.getMiddleOffsetY());
                }
            }
        }

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

function main() {

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

MDog.AssetManager.loadFile("side/tilemaps/good/tiles_Building.csv", "Building1");
MDog.AssetManager.loadFile("side/tilemaps/good/tiles_BuildingTop.csv", "Building2");
MDog.AssetManager.loadFile("side/tilemaps/good/tiles_Tiles.csv", "Tiles");
MDog.AssetManager.loadFile("side/tilemaps/good/tiles_Deco.csv", "Deco");
MDog.AssetManager.loadFile("side/tilemaps/good/test2_Colors.csv", "Colors");



MDog.setActiveFunction(main);

// TODO SECTION ---

// TODO add setting where up is jump
// TODO make whole game class that is restartable
// TODO add menu
// TODO switch dash directions when you switch direction right after dashing? Kinda like a dash direction switch buffer
// TODO add diagonal down for wave dashing celeste stytyle
// TODO add frame pre-loading
// TODO electric fence?
// TODO fix grapple