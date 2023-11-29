import Module from "/MDogModule.js";
import Maths from "/MDogMaths.js";
import UI from "/MDogUI.js";
// import MDog from "./MDogMain";

const Vector = (new Maths()).Vector;

class Draw extends Module {
    constructor(screenWidthInArtPixels, screenHeightInArtPixels) {
        super();

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
        this.loadFont("undertale-hud", "/assets/sofiatale/hud.ttf");
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

    _postUpdate() {
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

    // circle(x, y, radius, color, settings) {
    //     settings = settings ?? {};
    //     const layer = settings.layer ?? this.layer;
    //
    //     const canvas = this._getCanvas(layer);
    //     canvas.ctx.fillStyle = color;
    //
    //     canvas.ctx.beginPath();
    //     canvas.ctx.arc(x, y, radius, 0, 2 * Math.PI);
    //     canvas.ctx.fill();
    // }
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
            this.point(x1, y1, color);

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

    // Perams: layer, testAlign (left, center, right), textBaseLine (middle), size, font
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
        ctx.textAlign = settings.textAlign ?? 'left';
        ctx.textBaseline = settings.textBaseline ?? 'middle';

        let fullWidth = 0;
        for (let i = 0; i < text.length; i++) {
            const width = Math.ceil(ctx.measureText(text[i]).width);
            ctx.fillText(text[i], x + fullWidth, y);
            fullWidth += width;
        }

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

class Animation {
    constructor(fileName, frames, animationSpeed) {
        this.fileName = fileName;
        this.frames = frames;
        this.animationSpeed = animationSpeed;
        this.time = 0;
    }

    getFrame() {
        const localTime = Math.floor(this.time / (167 / this.animationSpeed));
        const localFrame = localTime % this.frames;
        return localFrame;
    }

    // loadFrames() {
    //     for (let i = 0; i < this.frames; i++) {
    //         const image = this.fileName.replace("?", (i + 1));
    //         MDog.Draw.image(image, -100, -100);
    //     }
    // }

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
        const localFrame = this.getFrame();
        const image = this.fileName.replace("?", (localFrame + 1));
        Draw.image(image, x, y, {flipX: flipX, flipY: flipY});
        if (update) {
            this.time += 1;
        }
    }
}

class SpriteSheetAnimation extends Animation {
    _draw() {
        console.log("Fix drawing for spritesheet!");
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



export default Draw;