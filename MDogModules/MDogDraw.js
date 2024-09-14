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

class Canvas {
    constructor(draw) {
        this.element = document.createElement("canvas");
        this.element.width = draw.screenWidthInArtPixels;
        this.element.height = draw.screenHeightInArtPixels;
        this._calculateSize(draw);

        this.element.style.imageRendering = "pixelated";

        this.ctx = this.element.getContext("2d");
        this.ctx.imageSmoothingEnabled = false;

        this.element.webkitF = "never";

        this.offset = new Vector();
    }

    _calculateSize(draw) {
        const pixelWidth = draw._getPixelWidth();
        const pixelHeight = draw._getPixelHeight();
        const pixelSize = Math.min(pixelWidth, pixelHeight);

        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('fullscreen') === "true") { // TODO this feels weird that I'm checking every time, should probably store it somewhere.
            const aspectOfScreen = document.body.offsetWidth / document.body.offsetHeight;
            const aspectOfGame = draw.screenWidthInArtPixels / draw.screenHeightInArtPixels;

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

        this.mainCanvas = new Canvas(this);
        const mainCanvas = this.mainCanvas;
        const draw = this;
        window.addEventListener('resize', function() {mainCanvas._calculateSize(draw);}); // TODO adding a listener like this feels super wrong, should probably fix somehow // TODO in the calculation I should probably be able to calculate it manually with calc() so I don't have to keep recalculating it in js.
        this.mainCanvas.ctx.fillStyle = "#000000";
        this.mainCanvas.ctx.fillRect(0, 0, this.screenWidthInArtPixels, this.screenHeightInArtPixels);
        document.body.appendChild(this.mainCanvas.element);

        this.setBackgroundColor("#000000");

        this.canvi = {}

        this.imageCache = new Map();
        this.fonts = [];
        this.loadFont("undertale-hud", "assets/sofiatale/hud.ttf");
        this.loadFont("rainyhearts", "assets/sofiatale/rainyhearts.ttf");
        this.loadFont("mars", "/MDogEngine/assets/fonts/mars.ttf");
        this.loadFont("determination", "/MDogEngine/assets/fonts/determination.ttf");
    }

    translate(x, y, settings) {
        this.translateX(x, settings);
        this.translateY(y, settings);
    }

    translateX(x, settings) {
        settings = settings ?? {};
        const layer = settings.layer ?? this.layer;
        const canvas = this._getCanvas(layer);

        canvas.ctx.translate(
            x - canvas.offset.getX(),
            0
        );

        canvas.offset.setX(x);
    }
    translateY(y, settings) {
        settings = settings ?? {};
        const layer = settings.layer ?? this.layer;
        const canvas = this._getCanvas(layer);

        canvas.ctx.translate(
            0,
            y - canvas.offset.getY()
        );

        canvas.offset.setY(y);
    }

    loadFont(fontName, fontURL) {
        let newStyle = document.createElement('style');
        newStyle.appendChild(document.createTextNode("\
        @font-face {\
          font-family: '" + fontName + "';\
          src: url('" + fontURL + "') format('truetype');\
        }\
      "));
        document.head.appendChild(newStyle);
        this.fonts.push(fontName);

        this.text("test", -100, -100, "#000000", {font: fontName});
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



    _getCanvas(layer) {
        let canvas = this.canvi["" + layer];

        if (canvas === undefined) {
            canvas = new Canvas(this);
            this.canvi["" + layer] = canvas;
        }

        return canvas;
    }

    _postOutUpdate() {
        this._drawLayers();
    }

    _drawLayers() {
        const layerArray = Object.entries(this.canvi).map(([layer, canvas]) => ({layer: parseInt(layer), canvas}));
        layerArray.sort((a, b) => a.layer - b.layer);

        for (let i = 0; i < layerArray.length; i++) {
            this.mainCanvas.ctx.drawImage(layerArray[i].canvas.element, 0, 0);
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

    // Set color of screen around canvas
    setBackgroundColor(color) {
        document.body.style.backgroundColor = color;
    }

    point(x, y, color, settings) {

        settings = settings ?? {};
        const layer = settings.layer ?? this.layer;

        const canvas = this._getCanvas(layer);
        canvas.ctx.fillStyle = color;
        canvas.ctx.fillRect(x, y, 1, 1)
    }

    // Settings - color, layer
    clear(settings) {
        settings = settings ?? {};
        const color = settings.color ?? "#000000";
        const layer = settings.layer ?? null;
        if (layer === null) {
            const localCanvi = Object.entries(this.canvi);
            for (let i = 0; i < localCanvi.length ; i++) {
                const canvasIndex = localCanvi[i];
                const canvas = canvasIndex[1];
                canvas.ctx.clearRect(-canvas.offset.getX(), -canvas.offset.getY(), this.screenWidthInArtPixels, this.screenHeightInArtPixels);
            }
            this.mainCanvas.ctx.fillStyle = color;
            this.mainCanvas.ctx.fillRect(0, 0, this.screenWidthInArtPixels, this.screenHeightInArtPixels);
            return;
        }
        const canvas = this._getCanvas(layer);

        canvas.ctx.fillStyle = color;
        canvas.ctx.fillRect(canvas.offset.getX(), canvas.offset.getY(), this.screenWidthInArtPixels, this.screenHeightInArtPixels);

        // TODO test running clear with a layer specified

        // this.rectangleFill(-canvas.offset.getX(), -canvas.offset.getY(), this.screenWidthInArtPixels, this.screenHeightInArtPixels, color, {layer: layer});
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

        const canvas = this._getCanvas(layer);
        canvas.ctx.fillStyle = color;

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
                canvas.ctx.fillRect(intersections[i], y, intersections[i + 1] - intersections[i], 1)
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

        const canvas = this._getCanvas(layer);
        canvas.ctx.fillStyle = color;

        if (width <= 2 || height <= 2) {
            canvas.ctx.fillRect(x, y, width, height);
            return;
        }

        canvas.ctx.fillRect(x, y, width, 1);
        canvas.ctx.fillRect(x, y+height-1, width, 1);

        canvas.ctx.fillRect(x, y+1, 1, height-2);
        canvas.ctx.fillRect(x+width-1, y+1, 1, height-2);
    }

    // Settings - layer
    circle(x, y, radius, color, settings) {
        settings = settings ?? {};
        const layer = settings.layer ?? this.layer;

        const canvas = this._getCanvas(layer);
        canvas.ctx.fillStyle = color;

        canvas.ctx.beginPath();
        canvas.ctx.arc(x, y, radius, 0, 2 * Math.PI);
        canvas.ctx.fill();
    }
    //
    // hexagon(x, y, radius, color, settings) {
    //     settings = settings ?? {};
    //     const layer = settings.layer ?? this.layer;
    //
    //     const canvas = this._getCanvas(layer);
    //     canvas.ctx.fillStyle = color;
    //
    //     canvas.ctx.beginPath();
    //     canvas.ctx.moveTo(x + radius, y);
    //     for (let i = 1; i < 6; i++) {
    //         canvas.ctx.lineTo(x + radius * Math.cos(i * 2 * Math.PI / 6), y + radius * Math.sin(i * 2 * Math.PI / 6));
    //     }
    //     canvas.ctx.fill();
    // }

    rectangleFill(x, y, width, height, color, settings) {
        settings = settings ?? {};
        const layer = settings.layer ?? this.layer;

        const canvas = this._getCanvas(layer);
        canvas.ctx.fillStyle = color;
        canvas.ctx.fillRect(x, y, width, height);
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
        const ctx = this.mainCanvas.ctx;
        ctx.font = size + " " + font;
        return ctx.measureText(text.split('\n')[0]).width; // TODO this search is a little sus
    }

    // Perams: layer, textAlign (left, center, right), textBaseline (top, middle), size, font, lineHeight
    text(text, x, y, color, settings) {

        settings = settings ?? {};

        const layer = settings.layer ?? this.layer;
        const canvas = this._getCanvas(layer);

        const font = settings.font ?? "Arial";

        const size = (settings.size ?? "5") + "px";
        const lineHeight = settings.lineHeight ?? 20;

        const ctx = canvas.ctx;

        ctx.font = size + " " + font;
        // ctx.letterSpacing = 100;
        ctx.fillStyle = color;
        const textAlign = settings.textAlign ?? 'left'
        ctx.textAlign = textAlign;
        ctx.textBaseline = settings.textBaseline ?? 'top';

        // let fullWidth = 0;
        // for (let i = 0; i < text.length; i++) {
        //     const width = Math.ceil(0) + (ctx.measureText(text[i]).width);
        //     ctx.fillText(text[i], x + fullWidth, y);
        //     fullWidth += width;
        // }

        const split = text.split('\n');

        for (let i = 0; i < split.length; i++) {
            const line = split[i];
            ctx.fillText(line, x, y + lineHeight*i);
        }

        // ctx.fillText(text, x, y);

        // for (let i = 0; i < 10; i++) {
        //     canvas.ctx.fillText(text, x, y + 10);
        // }
        //
        // canvas.ctx.fillText(text, x, y+ 20);

        //
        // console.log(canvas.ctx.measureText("lotsof").width);
    }

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
        const textAlign = settings.textAlign ?? "left";

        const alph = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!~-.,?[]/:*'\"><";

        const lines = text.split("\n");

        let yPos = 0;

        for (const line of lines) {
            let xPos = 0;
            if (textAlign === "center") {
                xPos -= Math.floor(line.length * fontWidth * size / 2);
            }
            if (textAlign === "right") {
                xPos -= line.length * fontWidth * size;
            }
            for (let i = 0; i < text.length; i++) {
                const char = text[i];

                const index = alph.indexOf(char);

                if (index !== -1) {
                    this.image(font, x + xPos, y + yPos, {width: fontWidth, offsetX: index * fontWidth, scale: size, tint: color});
                }

                xPos += fontWidth * size;
            }
            xPos = 0;
            yPos += fontHeight * size;
        }
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

    // Perams: layer, scale, scaleX, scaleY, offsetX, offsetY, width, height, flipX, flipY, tint
    image(fileName, x, y, settings) {

        const pathName = "assets/" + fileName;

        let image = this.imageCache.get(pathName);
        if (!image) {
            image = new Image();
            image.src = pathName;
            this.imageCache.set(pathName, image);
        }

        if (!image.complete) {
            return;
        }

        settings = settings ?? {};

        const scale = settings.scale ?? 1;
        const scaleX = settings.scaleX ?? scale;
        const scaleY = settings.scaleY ?? scale;

        const offsetX = settings.offsetX ?? 0;
        const offsetY = settings.offsetY ?? 0;

        const maxWidth = image.width - offsetX;
        const maxHeight = image.height - offsetY;

        const preferredWidth = settings.width ?? image.width;
        const preferredHeight = settings.height ?? image.height;

        const width = Math.min(preferredWidth, maxWidth);
        const height = Math.min(preferredHeight, maxHeight);

        const layer = settings.layer ?? this.layer;
        const canvas = this._getCanvas(layer);

        const flipX = settings.flipX ?? false;
        const flipY = settings.flipY ?? false;

        const tint = settings.tint ?? undefined;

        canvas.ctx.save();

        let xShift = 0;
        if (flipX) {
            canvas.ctx.scale(-1, 1);
            xShift = -x*2 - width;
        }
        let yShift = 0;
        if (flipY) {
            canvas.ctx.scale(1, -1);
            yShift = -y*2 - height;
        }

        if (tint === undefined) {
            canvas.ctx.drawImage(
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

            const tempCanvas = document.createElement('canvas');

            tempCanvas.width = width * scaleX;
            tempCanvas.height = height * scaleY;

            tempCanvas.style.imageRendering = "pixelated";
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.imageSmoothingEnabled = false;
            tempCanvas.webkitF = "never";

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

            // const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            // const data = imageData.data;
            //
            // // Apply tint color to each pixel
            // for (let i = 0; i < data.length; i += 4) {
            //     data[i] = data[i] * (1 - tint[3]) + tint[0] * tint[3];     // Red
            //     data[i + 1] = data[i + 1] * (1 - tint[3]) + tint[1] * tint[3]; // Green
            //     data[i + 2] = data[i + 2] * (1 - tint[3]) + tint[2] * tint[3]; // Blue
            // }
            //
            // tempCtx.putImageData(imageData, 0, 0);

            canvas.ctx.drawImage(
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

        canvas.ctx.restore();
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