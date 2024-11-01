import Module from "./MDogModule.js";

class AssetManager extends Module {
    constructor() {
        super();
        this.assets = {};
        this.awaiting = 0;
    }

    get(fileName) {
        return this.assets[fileName];
    }

    loadFile(filePath, fileName) {
        this.awaiting += 1;
        fetch("assets/" + filePath)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to fetch ${filePath}`);
                }
                return response.text();
            })
            .then(data => {
                this.assets[fileName] = data;
                this.awaiting -= 1;
            })
            .catch(error => console.error(error));
    }

    doneLoading() {
        return this.awaiting === 0;
    }
}

export default AssetManager;

// 7:25