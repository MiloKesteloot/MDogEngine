import MDog from "../../MDogModules/MDogMain.js"

function update() {
    MDog.Draw.clear({color: "blue"});

    MDog.Draw.point(10, 10, "red");
}

MDog.setActiveFunction(update);
