import MDog from "/MDogEngine/MDogModules/MDogMain.js"

const Vector = MDog.Math.Vector;

const board = new MDog.UI.RectangleGridInteractable(
    0, 0, 10, 20);// TODO bro grid is all fucked up.
// We have width and width and that just makes no sense.
// Too tired to fix.
// Good luck tomorrow man. TODO Love you <3

board.setX(Math.floor((MDog.Draw.getScreenWidthInArtPixels() - (board.width * board.xv.x))/2));
board.setY(Math.floor((MDog.Draw.getScreenHeightInArtPixels() - (board.height * board.yv.y))/2));

function gameTick() {

    for (let i = 0; i < board.width; i++) {
        for (let j = 0; j < board.height; j++) {
            const p = board.getPoint(i, j);

            const color = (i+j)%2 === 0 ? "#137e00" : "#019601";

            MDog.Draw.rectangleFill(p.getX(), p.getY(), board.xv.x, board.yv.y, color);

            // if ()
        }
    }

    // MDog.Draw.interactable(board);
}

MDog.Draw.setBackgroundColor("#222");

MDog.setActiveFunction(gameTick);