import MDog from "/MDogEngine/MDogModules/MDogMain.js"

// wall = 0
// pellet = 1
// empty = 2
// packman = 3
// power = 4

const __ = 0;
const HH = 1;
const BK = 2;
const _W = 3;
const PM = 4;

const mapWidth = 28;
const mapHeight = 31;

const map = [
    HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH,
    HH, __, __, __, __, __, __, __, __, __, __, __, __, HH, HH, __, __, __, __, __, __, __, __, __, __, __, __, HH,
    HH, __, HH, HH, HH, HH, __, HH, HH, HH, HH, HH, __, HH, HH, __, HH, HH, HH, HH, HH, __, HH, HH, HH, HH, __, HH,
    HH, _W, HH, HH, HH, HH, __, HH, HH, HH, HH, HH, __, HH, HH, __, HH, HH, HH, HH, HH, __, HH, HH, HH, HH, _W, HH,
    HH, __, HH, HH, HH, HH, __, HH, HH, HH, HH, HH, __, HH, HH, __, HH, HH, HH, HH, HH, __, HH, HH, HH, HH, __, HH,
    HH, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, HH,
    HH, __, HH, HH, HH, HH, __, HH, HH, __, HH, HH, HH, HH, HH, HH, HH, HH, __, HH, HH, __, HH, HH, HH, HH, __, HH,
    HH, __, HH, HH, HH, HH, __, HH, HH, __, HH, HH, HH, HH, HH, HH, HH, HH, __, HH, HH, __, HH, HH, HH, HH, __, HH,
    HH, __, __, __, __, __, __, HH, HH, __, __, __, __, HH, HH, __, __, __, __, HH, HH, __, __, __, __, __, __, HH,
    HH, HH, HH, HH, HH, HH, __, HH, HH, HH, HH, HH, __, HH, HH, __, HH, HH, HH, HH, HH, __, HH, HH, HH, HH, HH, HH,
    HH, HH, HH, HH, HH, HH, __, HH, HH, HH, HH, HH, __, HH, HH, __, HH, HH, HH, HH, HH, __, HH, HH, HH, HH, HH, HH,
    HH, HH, HH, HH, HH, HH, __, HH, HH, __, __, __, __, __, __, __, __, __, __, HH, HH, __, HH, HH, HH, HH, HH, HH,
    HH, HH, HH, HH, HH, HH, __, HH, HH, __, HH, HH, HH, HH, HH, HH, HH, HH, __, HH, HH, __, HH, HH, HH, HH, HH, HH,
    HH, HH, HH, HH, HH, HH, __, HH, HH, __, HH, HH, HH, HH, HH, HH, HH, HH, __, HH, HH, __, HH, HH, HH, HH, HH, HH,
    __, __, __, __, __, __, __, __, __, __, HH, HH, HH, HH, HH, HH, HH, HH, __, __, __, __, __, __, __, __, __, __,
    HH, HH, HH, HH, HH, HH, __, HH, HH, __, HH, HH, HH, HH, HH, HH, HH, HH, __, HH, HH, __, HH, HH, HH, HH, HH, HH,
    HH, HH, HH, HH, HH, HH, __, HH, HH, __, HH, HH, HH, HH, HH, HH, HH, HH, __, HH, HH, __, HH, HH, HH, HH, HH, HH,
    HH, HH, HH, HH, HH, HH, __, HH, HH, __, __, __, __, __, __, __, __, __, __, HH, HH, __, HH, HH, HH, HH, HH, HH,
    HH, HH, HH, HH, HH, HH, __, HH, HH, __, HH, HH, HH, HH, HH, HH, HH, HH, __, HH, HH, __, HH, HH, HH, HH, HH, HH,
    HH, HH, HH, HH, HH, HH, __, HH, HH, __, HH, HH, HH, HH, HH, HH, HH, HH, __, HH, HH, __, HH, HH, HH, HH, HH, HH,
    HH, __, __, __, __, __, __, __, __, __, __, __, __, HH, HH, __, __, __, __, __, __, __, __, __, __, __, __, HH,
    HH, __, HH, HH, HH, HH, __, HH, HH, HH, HH, HH, __, HH, HH, __, HH, HH, HH, HH, HH, __, HH, HH, HH, HH, __, HH,
    HH, __, HH, HH, HH, HH, __, HH, HH, HH, HH, HH, __, HH, HH, __, HH, HH, HH, HH, HH, __, HH, HH, HH, HH, __, HH,
    HH, _W, __, __, HH, HH, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, HH, HH, __, __, _W, HH,
    HH, HH, HH, __, HH, HH, __, HH, HH, __, HH, HH, HH, HH, HH, HH, HH, HH, __, HH, HH, __, HH, HH, __, HH, HH, HH, // packman here
    HH, HH, HH, __, HH, HH, __, HH, HH, __, HH, HH, HH, HH, HH, HH, HH, HH, __, HH, HH, __, HH, HH, __, HH, HH, HH,
    HH, __, __, __, __, __, __, HH, HH, __, __, __, __, HH, HH, __, __, __, __, HH, HH, __, __, __, __, __, __, HH,
    HH, __, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, __, HH, HH, __, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, __, HH,
    HH, __, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, __, HH, HH, __, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, __, HH,
    HH, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, HH,
    HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH,
]

function update() {
    MDog.Draw.clear({color: "black"});
    const size = 8;
    for (let i = 0; i < mapWidth; i++) {
        for (let j = 0; j < mapHeight; j++) {
            const icon = map[i + j*mapWidth];
            switch (icon) {
                case 1:
                    MDog.Draw.rectangle(i*size, j*size, size, size, "#ff0000");
            }
        }
    }
    MDog.Draw.image("snack-man/map.png", 0, 0);
}

MDog.Draw.translateX(16*6+8);
MDog.Draw.translateY(16+8);
MDog.Draw.setBackgroundColor("#222222");
MDog.setActiveFunction(update);




// let str = "";
//
// for (let j = 0; j < 21; j++) {
//     for (let i = 0; i < 19; i++) {
//         switch (map[i+j*19]) {
//             case __:
//                 str += "•"
//                 break;
//             case HH:
//                 str += "■";
//                 break;
//             case BK:
//                 str += " ";
//                 break;
//             case _W:
//                 str += "o";
//                 break;
//             case PM:
//                 str += ">";
//                 break;
//         }
//     }
//     if (j !== 20) {
//         str += "\n";
//     }
// }