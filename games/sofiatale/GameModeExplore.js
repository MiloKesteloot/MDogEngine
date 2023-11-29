import MDog from "/MDogMain.js";
import GameMode from "/games/sofiatale/GameMode.js";

const screen = {width: MDog.Draw.getScreenWidthInArtPixels(), height: MDog.Draw.getScreenHeightInArtPixels()};

(new MDog.Math.Vector()).add(1, 3);

const vec = (new MDog.Math.Vector())
vec.add((new MDog.Math.Vector()))

class GameModeExplore extends GameMode {
    constructor(playerStats) {
        super(playerStats);

        MDog.Draw.setBackgroundColor("#141414");

        this.grid = new MDog.UI.GridInteractable(
            227, 70,
            8, 8,
            31, 16,
            -31, 16);

        this.grass = [];
        this.flip = [];

        for (let i = 0; i < this.grid.width; i++) {
            this.grass.push([]);
            this.flip.push([]);
            for (let j = 0; j < this.grid.height; j++) {
                this.grass[i].push(Math.random()*5 < 1);
                this.flip[i].push(Math.random() < 0.5);
            }
        }

    }

    _main() {
        MDog.Draw.clear();

        for (let i = 0; i < this.grid.width; i++) {
            for (let j = 0; j < this.grid.height; j++) {
                const p = this.grid.getPoint(i, j);
                // let flip = false;
                // if (MDog.Input.Keyboard.isDown("e")) {
                //     flip = this.flip[i][j];
                // }
                let flip = this.flip[i][j];

                if (this.grass[i][j]) {
                    MDog.Draw.image("sofiatale/flower.png", p.getX(), p.getY() - 7, {flipX: flip});
                } else {
                    MDog.Draw.image("sofiatale/grass.png", p.getX(), p.getY(), {flipX: flip});
                }
            }
        }
    }
}

export default GameModeExplore;