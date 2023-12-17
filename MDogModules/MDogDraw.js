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

        this.element.style.width = pixelSize * this.element.width + "px";
        this.element.style.height = pixelSize * this.element.height + "px";
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

        this.mainCanvas = new Canvas(this)
        this.mainCanvas.ctx.fillStyle = "#000000";
        this.mainCanvas.ctx.fillRect(0, 0, this.screenWidthInArtPixels, this.screenHeightInArtPixels);
        document.body.appendChild(this.mainCanvas.element);

        this.setBackgroundColor("#000000");

        this.canvi = {}

        this.imageCache = new Map();
        this.fonts = [];
        this.loadFont("undertale-hud", "assets/sofiatale/hud.ttf");
        this.loadFont("rainyhearts", "assets/sofiatale/rainyhearts.ttf");
        this.loadFont("mars", "/MDogEngine/assets/sofiatale/mars.ttf");
        this.loadFont("determination", "/MDogEngine/assets/sofiatale/determination.ttf");
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
    getScreenHeightInArtPixels() {
        return this.screenHeightInArtPixels;
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

    line(x1, y1, x2, y2, color, settings) {

        settings = settings ?? {};
        const layer = settings.layer ?? this.layer;

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
        return ctx.measureText(text).width;
    }

    // Perams: layer, textAlign (left, center, right), textBaseline (top, middle), size, font
    text(text, x, y, color, settings) {

        settings = settings ?? {};

        const layer = settings.layer ?? this.layer;
        const canvas = this._getCanvas(layer);

        const size = (settings.size ?? "5") + "px";
        const font = settings.font ?? "Arial";

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
        ctx.fillText(text, x, y);


        // for (let i = 0; i < 10; i++) {
        //     canvas.ctx.fillText(text, x, y + 10);
        // }
        //
        // canvas.ctx.fillText(text, x, y+ 20);

        //
        // console.log(canvas.ctx.measureText("lotsof").width);
    }

    // Perams: layer, scale, scaleX, scaleY, offsetX, offsetY, width, height, flipX, flipY
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

    // Function Line
    // Function Point
    // Whatever
}

export default Draw;