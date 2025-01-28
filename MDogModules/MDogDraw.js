import Module from "./MDogModule.js";
import Maths from "./MDogMaths.js";

const Vector = (new Maths()).Vector;

class Animation {
    constructor(fileName, frames, animationSpeed, settings) {
        settings = settings ?? {};

        this.fileName = fileName;

        if (Array.isArray(frames)) {
            let largestFrame = 0;
            for (let i = 0; i < frames.length; i++) {
                if (frames[i] > largestFrame) {
                    largestFrame = frames[i];
                }
            }
            this.frames = largestFrame;
            this.order = frames;
        } else {
            this.frames = frames;
            this.order = [];
            for (let i = 0; i < this.frames; i++) {
                this.order.push(i);
            }
        }

        this.animationSpeed = animationSpeed;

        // TODO do the order stuff in both animation classes
        this.time = 0;
    }

    getFrame() {
        return this.order[this.getRawFrame() % this.order.length];
    }

    getRawFrame() {
        return Math.floor(this.time / (167 / this.animationSpeed)); // TODO wtf is 167?
    }

    reset() {
        this.time = 0;
    }

    _loadFrames(Draw) {}

    _draw(Draw, x, y, settings) {
        console.log("The default animation doesn't have a draw function!");
    }
}

class MultipleFileAnimation extends Animation {
    _draw(Draw, x, y, settings) {
        settings = settings ?? {};
        const update = settings.update ?? true;
        const flipX = settings.flipX ?? false;
        const flipY = settings.flipY ?? false;

        const scale = settings.scale ?? 1;
        Draw.image(this.getImage(), x, y, {flipX: flipX, flipY: flipY, scale: scale});
        if (update) {
            this.time += 1;
        }
    }

    getImage(frame) {
        frame = frame !== undefined ? this.order[frame] : this.getFrame();
        return this.fileName.replace("?", (frame + 1));
    }

    _loadFrames(Draw) {
        for (let i = 0; i < this.frames; i++) {
            Draw.image(this.getImage(i), -1000, -1000);
        }
    }
}

class SpriteSheetAnimation extends Animation {

    constructor(fileName, frames, animationSpeed, spriteWidth, settings) {
        super(fileName, frames, animationSpeed, settings);

        this.spriteWidth = spriteWidth;
    }

    _draw(Draw, x, y, settings) {
        settings = settings ?? {};
        const update = settings.update ?? true;
        const flipX = settings.flipX ?? false;
        const flipY = settings.flipY ?? false;
        const scale = settings.scale ?? 1;
        Draw.image(this.fileName, x, y,
            {
                flipX: flipX, flipY: flipY,
                width: this.spriteWidth,
                offsetX: this.spriteWidth * (this.getFrame()),
                scale: scale
            }
        );
        if (update) {
            this.time += 1;
        }
    }

    _loadFrames(Draw) {
        Draw.image(this.fileName, -1000, -1000);
    }
}

class DrawingBoard {
    // Settings - [width, height] IMPORANT. If width or height are set, the DrawingBoard will not generate it's real size. TODO make it so that it only generates it's real size for the first one anyway.
    constructor(draw, settings) {

        settings = settings ?? {};
        const width = settings.width ?? draw.screenWidthInArtPixels;
        const height = settings.height ?? draw.screenHeightInArtPixels;

        this.element = document.createElement("canvas");
        this.element.width = width;
        this.element.height = height;

        if (settings.width === undefined && settings.height === undefined) {
            this._calculateSize(draw);
        }

        this.element.style.imageRendering = "pixelated";

        this.ctx = this.element.getContext("2d");
        this.ctx.imageSmoothingEnabled = false;

        this.element.webkitF = "never";

        this.offset = new Vector();
    }

    _calculateSize(Draw) {
        const pixelWidth = Draw._getPixelWidth();
        const pixelHeight = Draw._getPixelHeight();
        const pixelSize = Math.min(pixelWidth, pixelHeight);

        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('fullscreen') === "true") { // TODO this feels weird that I'm checking every time, should probably store it somewhere.
            const aspectOfScreen = document.body.offsetWidth / document.body.offsetHeight;
            const aspectOfGame = Draw.screenWidthInArtPixels / Draw.screenHeightInArtPixels;

            if (aspectOfScreen > aspectOfGame) {
                this.element.style.height = document.body.offsetHeight + "px";
                this.element.style.width = (document.body.offsetHeight * aspectOfGame) + "px";
            } else {
                this.element.style.width = document.body.offsetWidth + "px";
                this.element.style.height = (document.body.offsetWidth / aspectOfGame) + "px";
            }
        } else {
            this.element.style.width = pixelSize * this.element.width + "px";
            this.element.style.height = pixelSize * this.element.height + "px";
        }
    }
}

class Draw extends Module {
    constructor(screenWidthInArtPixels, screenHeightInArtPixels) {
        super();

        this.MultipleFileAnimation = MultipleFileAnimation;
        this.SpriteSheetAnimation = SpriteSheetAnimation;

        this.layer = 0;

        this.screenWidthInArtPixels = screenWidthInArtPixels;
        this.screenHeightInArtPixels = screenHeightInArtPixels;

        this.mainDrawingBoard = new DrawingBoard(this);
        const mainDrawingBoard = this.mainDrawingBoard;
        const draw = this;
        window.addEventListener('resize', function() {mainDrawingBoard._calculateSize(draw);}); // TODO adding a listener like this feels super wrong, should probably fix somehow // TODO in the calculation I should probably be able to calculate it manually with calc() so I don't have to keep recalculating it in js.
        this.mainDrawingBoard.ctx.fillStyle = "#000000";
        this.mainDrawingBoard.ctx.fillRect(0, 0, this.screenWidthInArtPixels, this.screenHeightInArtPixels);
        document.body.appendChild(this.mainDrawingBoard.element);

        this.setBackgroundColor("#000000");

        this.drawingBoards = {}

        this.imageCache = new Map();
    }

    translate(x, y, settings) {
        this.translateX(x, settings);
        this.translateY(y, settings);
    }
    translateX(x, settings) {
        settings = settings ?? {};
        const layer = settings.layer ?? this.layer;
        const drawingBoard = this._getDrawingBoard(layer);

        drawingBoard.ctx.translate(
            x - drawingBoard.offset.getX(),
            0
        );

        drawingBoard.offset.setX(x);
    }
    translateY(y, settings) {
        settings = settings ?? {};
        const layer = settings.layer ?? this.layer;
        const drawingBoard = this._getDrawingBoard(layer);

        drawingBoard.ctx.translate(
            0,
            y - drawingBoard.offset.getY()
        );

        drawingBoard.offset.setY(y);
    }

    _getPixelWidth() {
        return this._getPixelDimension(window.innerWidth, this.screenWidthInArtPixels);
    }
    _getPixelHeight() {
        return this._getPixelDimension(window.innerHeight, this.screenHeightInArtPixels);
    }

    _getPixelDimension(innerDimension, artDimensionInPixels) {
        let pixelDimension = Math.floor(innerDimension/artDimensionInPixels);
        if (pixelDimension <= 0) {
            pixelDimension = 1;
        }
        return pixelDimension
    }

    _getDrawingBoard(layer) {
        let drawingBoard = this.drawingBoards["" + layer];

        if (drawingBoard === undefined) {
            drawingBoard = new DrawingBoard(this);
            this.drawingBoards["" + layer] = drawingBoard;
        }

        return drawingBoard;
    }

    _postOutUpdate() {
        this._drawLayers();
    }

    _drawLayers() {
        const layerArray = Object.entries(this.drawingBoards).map(([layer, drawingBoard]) => ({layer: parseInt(layer), drawingBoard}));
        layerArray.sort((a, b) => a.layer - b.layer);

        for (let i = 0; i < layerArray.length; i++) {
            this.mainDrawingBoard.ctx.drawImage(layerArray[i].drawingBoard.element, 0, 0);
        }
    }

    setActiveLayer(layer) {
        this.layer = layer;
    }

    getScreenWidthInArtPixels() {
        return this.screenWidthInArtPixels;
    }
    getHalfScreenWidthInArtPixels() {
        return Math.floor(this.screenWidthInArtPixels/2);
    }
    getScreenHeightInArtPixels() {
        return this.screenHeightInArtPixels;
    }
    getHalfScreenHeightInArtPixels() {
        return Math.floor(this.screenHeightInArtPixels/2);
    }

    // Set color of screen around game
    setBackgroundColor(color) {
        document.body.style.backgroundColor = color;
    }

    // Settings - layer
    point(x, y, color, settings) {

        settings = settings ?? {};
        const layer = settings.layer ?? this.layer;

        const drawingBoard = this._getDrawingBoard(layer);
        drawingBoard.ctx.fillStyle = color;
        drawingBoard.ctx.fillRect(x, y, 1, 1)
    }

    // Settings - color, layer
    clear(settings) {
        settings = settings ?? {};
        const color = settings.color ?? "#000000";
        const layer = settings.layer ?? null;
        if (layer === null) {
            const localDrawingBoards = Object.entries(this.drawingBoards);
            for (let i = 0; i < localDrawingBoards.length ; i++) {
                const drawingBoardIndex = localDrawingBoards[i];
                const drawingBoard = drawingBoardIndex[1];
                drawingBoard.ctx.clearRect(-drawingBoard.offset.getX(), -drawingBoard.offset.getY(), this.screenWidthInArtPixels, this.screenHeightInArtPixels);
            }
            this.mainDrawingBoard.ctx.fillStyle = color;
            this.mainDrawingBoard.ctx.fillRect(0, 0, this.screenWidthInArtPixels, this.screenHeightInArtPixels);
            return;
        }
        const drawingBoard = this._getDrawingBoard(layer);

        drawingBoard.ctx.fillStyle = color;
        drawingBoard.ctx.fillRect(drawingBoard.offset.getX(), drawingBoard.offset.getY(), this.screenWidthInArtPixels, this.screenHeightInArtPixels);

        // TODO test running clear with a layer specified

        // this.rectangleFill(-drawingBoard.offset.getX(), -drawingBoard.offset.getY(), this.screenWidthInArtPixels, this.screenHeightInArtPixels, color, {layer: layer});
    }

    findIntersections(points, y) { // TODO what is this function?
        let xValues = [];
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const x1 = points[i].x;
            const y1 = points[i].y;
            const x2 = points[j].x;
            const y2 = points[j].y;

            if (y1 > y !== y2 > y) {
                const xVal = x2 + (y - y2) * (x1 - x2) / (y1 - y2);
                xValues.push(Math.ceil(xVal));
            }
        }
        return xValues.sort((a, b) => a - b);
    }

    polygonFill(points, color, settings) {

        settings = settings ?? {};
        const layer = settings.layer ?? this.layer;

        const drawingBoard = this._getDrawingBoard(layer);
        drawingBoard.ctx.fillStyle = color;

        // Find the min and max Y values
        let minY = points[0].y;
        let maxY = points[0].y;
        for (let i = 1; i < points.length; i++) {
            minY = Math.min(minY, points[i].y);
            maxY = Math.max(maxY, points[i].y);
        }

        // Scanline from minY to maxY
        for (let y = minY; y <= maxY; y++) {
            const intersections = this.findIntersections(points, y);
            for (let i = 0; i < intersections.length; i += 2) {
                drawingBoard.ctx.fillRect(intersections[i], y, intersections[i + 1] - intersections[i], 1)
            }
        }

        this.polygon(points, color, settings);
    }

    polygon(points, color, settings) {
        settings = settings ?? {};

        for (let i = 0; i < points.length; i++) {
            this.line(points[i].x, points[i].y, points[(i+1)%points.length].x, points[(i+1)%points.length].y, color, {layer: settings.layer});
            if (points.length === 2) {
                break;
            }
        }
    }

    rectangle(x, y, width, height, color, settings) {
        settings = settings ?? {};
        const layer = settings.layer ?? this.layer;

        const drawingBoard = this._getDrawingBoard(layer);
        drawingBoard.ctx.fillStyle = color;

        if (width <= 2 || height <= 2) {
            drawingBoard.ctx.fillRect(x, y, width, height);
            return;
        }

        drawingBoard.ctx.fillRect(x, y, width, 1);
        drawingBoard.ctx.fillRect(x, y+height-1, width, 1);

        drawingBoard.ctx.fillRect(x, y+1, 1, height-2);
        drawingBoard.ctx.fillRect(x+width-1, y+1, 1, height-2);
    }

    // Settings - layer
    circle(x, y, radius, color, settings) {
        settings = settings ?? {};
        const layer = settings.layer ?? this.layer;

        const drawingBoard = this._getDrawingBoard(layer);
        drawingBoard.ctx.fillStyle = color;

        drawingBoard.ctx.beginPath();
        drawingBoard.ctx.arc(x, y, radius, 0, 2 * Math.PI);
        drawingBoard.ctx.fill();
    }
    //
    // hexagon(x, y, radius, color, settings) {
    //     settings = settings ?? {};
    //     const layer = settings.layer ?? this.layer;
    //
    //     const drawingBoard = this._getDrawingBoard(layer);
    //     drawingBoard.ctx.fillStyle = color;
    //
    //     drawingBoard.ctx.beginPath();
    //     drawingBoard.ctx.moveTo(x + radius, y);
    //     for (let i = 1; i < 6; i++) {
    //         drawingBoard.ctx.lineTo(x + radius * Math.cos(i * 2 * Math.PI / 6), y + radius * Math.sin(i * 2 * Math.PI / 6));
    //     }
    //     drawingBoard.ctx.fill();
    // }

    rectangleFill(x, y, width, height, color, settings) {
        settings = settings ?? {};
        const layer = settings.layer ?? this.layer;

        const drawingBoard = this._getDrawingBoard(layer);
        drawingBoard.ctx.fillStyle = color;
        drawingBoard.ctx.fillRect(x, y, width, height);
    }

    // Settings - layer, scale
    line(x1, y1, x2, y2, color, settings) {

        settings = settings ?? {};
        const layer = settings.layer ?? this.layer;
        const scale = settings.scale ?? 1;

        x1 = Math.floor(x1);
        y1 = Math.floor(y1);
        x2 = Math.floor(x2);
        y2 = Math.floor(y2);

        let dx = Math.abs(x2 - x1);
        let dy = Math.abs(y2 - y1);
        let sx = (x1 < x2) ? 1 : -1;
        let sy = (y1 < y2) ? 1 : -1;
        let err = dx - dy;

        while(true) {
            this.point(x1, y1, color, {layer: layer});

            if ((x1 === x2) && (y1 === y2)) break;
            let e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy; x1 += sx;
            }
            if (e2 < dx) {
                err += dx; y1 += sy;
            }
        }
    }

    measureText(text, settings) {
        settings = settings ?? {};
        const size = (settings.size ?? "5") + "px";
        const font = settings.font ?? "Arial";
        const ctx = this.mainDrawingBoard.ctx;
        ctx.font = size + " " + font;
        return ctx.measureText(text.split('\n')[0]).width; // TODO this search is a little sus
    }

    // Settings: layer, alignX (left, center, right), alignY (top, center, bottom), size, font, lineHeight, letterSpacing
    // Return - bool, if the draw was successful
    textImage(text, x, y, color, font, settings) {

        let fontWidth = undefined;
        let fontHeight = undefined;

        if (font === "fonts/marsfont.png") {
            fontWidth = 5;
            fontHeight = 5;
        }

        if (font === "fonts/determinationfont.png") {
            fontWidth = 8;
            fontHeight = 13;
        }

        settings = settings ?? {};

        const size = settings.size ?? 1;
        const alignX = settings.alignX ?? "left";
        const alignY = settings.alignY ?? "top";
        const lineHeight = settings.lineHeight ?? 1;
        const letterSpacing = settings.letterSpacing ?? 1;

        const pathName = "generated/" + text + color + font;

        let textCanvas = this.imageCache.get(pathName);

        const lines = text.split("\n");
        const longestStringLength = lines.reduce((max, str) => Math.max(max, str.length), 0);
        const width = longestStringLength * (fontWidth + letterSpacing - 1) - letterSpacing;
        const height = lines.length * (fontHeight + lineHeight) - lineHeight;

        if (!textCanvas) {
            const alph = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!~-.,?[]/:*'\"><_";

            const tempDrawingBoard = new DrawingBoard(this,
                {
                    width: width,
                    height: height
                });

            let yPos = 0;

            for (const line of lines) {
                let xPos = 0;
                if (alignX === "center") {
                    xPos += Math.floor((longestStringLength - line.length) * (fontWidth + letterSpacing - 1) / 2);
                }
                if (alignX === "right") {
                    xPos += (longestStringLength - line.length) * (fontWidth + letterSpacing - 1);
                }
                for (let i = 0; i < line.length; i++) {
                    const char = line[i];

                    const index = alph.indexOf(char);

                    if (index !== -1) {
                        const success = this.image(font, xPos, yPos, {width: fontWidth, offsetX: index * fontWidth, tint: color, drawingBoard: tempDrawingBoard});
                        if (!success) return false;
                    }

                    // TODO do tint as one final pass // I'm worried it won't be faster and I'm not even sure how to check

                    xPos += fontWidth + letterSpacing - 1;
                }
                xPos = 0;
                yPos += fontHeight + lineHeight;
            }
            textCanvas = tempDrawingBoard.element;
            this.imageCache.set(pathName, textCanvas);
        }

        let xShift = 0;
        if (alignX === "center") {
            xShift += Math.floor(width/2) * size;
        }
        if (alignX === "right") {
            xShift += (width - 1) * size;
        }
        let yShift = 0;
        if (alignY === "center") {
            yShift += Math.floor(height/2) * size;
        }
        if (alignY === "bottom") {
            yShift += (height - 1) * size;
        }

        this._rawImage(textCanvas, x - xShift, y - yShift, width, height, {layer: settings.layer, scale: size});

        return true;
    }

    // TODO move this to the right place
    _hexToRgbArray(hex) {
        // Remove the # if it's included
        hex = hex.replace('#', '');

        // Convert the hex string to separate R, G, B components
        let r = parseInt(hex.substring(0, 2), 16);
        let g = parseInt(hex.substring(2, 4), 16);
        let b = parseInt(hex.substring(4, 6), 16);

        // Return the RGB values as an array
        return [r, g, b];
    }

    _doesImageExist(fileName) {
        const pathName = "assets/" + fileName;
        let image = this.imageCache.get(pathName);
        return image !== undefined;
    }

    _getImageByPath(pathName) {
        let image = this.imageCache.get(pathName);
        if (!image) {
            image = new Image();
            image.src = pathName;
            this.imageCache.set(pathName, image);
        }
        return image;
    }

    _getImageByName(fileName) {
        return this._getImageByPath("assets/" + fileName)
    }

    // Perams: layer, scale, scaleX, scaleY, offsetX, offsetY, width, height, flipX, flipY, tint, (private) drawingBoard
    // Returns: bool - if the draw was successful or not.
    image(fileName, x, y, settings) {
        let image = this._getImageByName(fileName);
        if (!image.complete) {
            return false;
        }
        settings = settings ?? {};
        const offsetX = settings.offsetX ?? 0;
        const offsetY = settings.offsetY ?? 0;
        const maxWidth = image.width - offsetX;
        const maxHeight = image.height - offsetY;
        const preferredWidth = settings.width ?? image.width;
        const preferredHeight = settings.height ?? image.height;
        const width = Math.min(preferredWidth, maxWidth);
        const height = Math.min(preferredHeight, maxHeight);
        settings.height = undefined;
        settings.width = undefined;
        this._rawImage(image, x, y, width, height, settings);
        return true;
    }

    // Perams: layer, scale, scaleX, scaleY, offsetX, offsetY, flipX, flipY, tint, drawingBoard
    _rawImage(image, x, y, width, height, settings) {
        settings = settings ?? {};

        const offsetX = settings.offsetX ?? 0;
        const offsetY = settings.offsetY ?? 0;

        const scale = settings.scale ?? 1;
        const scaleX = settings.scaleX ?? scale;
        const scaleY = settings.scaleY ?? scale;

        const flipX = settings.flipX ?? false;
        const flipY = settings.flipY ?? false;

        const tint = settings.tint ?? undefined;

        const layer = settings.layer ?? this.layer;
        const drawingBoard = settings.drawingBoard ?? this._getDrawingBoard(layer);

        drawingBoard.ctx.save();

        let xShift = 0;
        if (flipX) {
            drawingBoard.ctx.scale(-1, 1);
            xShift = -x*2 - width;
        }
        let yShift = 0;
        if (flipY) {
            drawingBoard.ctx.scale(1, -1);
            yShift = -y*2 - height;
        }

        if (tint === undefined) {
            drawingBoard.ctx.drawImage(
                image,
                offsetX,
                offsetY,
                width,
                height,
                x + xShift,
                y + yShift,
                width * scaleX,
                height * scaleY);
        } else {

            // Image tinting code from ChatGPT

            const tempDrawingBoard = new DrawingBoard(this, {width: width * scaleX, height: height * scaleY});
            const tempCanvas = tempDrawingBoard.element;
            const tempCtx = tempDrawingBoard.ctx;

            tempCtx.drawImage(
                image,
                offsetX,
                offsetY,
                width,
                height,
                0,
                0,
                width * scaleX,
                height * scaleY
            );

            tempCtx.globalCompositeOperation = "source-in";

            tempCtx.fillStyle = tint;
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

            drawingBoard.ctx.drawImage(
                tempCanvas,
                0,
                0,
                tempCanvas.width,
                tempCanvas.height,
                x + xShift,
                y + yShift,
                width * scaleX,
                height * scaleY
            );
        }

        drawingBoard.ctx.restore();
    }

    animation(animation, x, y, settings) {
        animation._draw(this, x, y, settings);
    }

    preloadAnimation(animation) {
        animation._loadFrames(this);
    }

    interactable(interactable) {
        interactable._draw(this);
    }

    particleSystem(particleSystem) {
        particleSystem._draw(this);
    }

    threeDeeScene(threeDeeScene) {
        threeDeeScene._draw(this);
    }

}

export default Draw;