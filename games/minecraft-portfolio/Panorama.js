// Minecraft's spinning title screen background: 6 pictures on the inside of a cube,
// with the camera in the middle slowly turning around.
// It's its own full window WebGL canvas at the screen's real resolution, meant to sit behind the game's canvas.

const VERTEX_SHADER = `
attribute vec2 position;
varying vec2 screenPosition;
void main() {
    screenPosition = position;
    gl_Position = vec4(position, 0.0, 1.0);
}
`;

// For every pixel, work out which direction the camera is looking, then read the cube in that direction.
// x is right, y is up, z is forward (the middle of panorama_0).
const FRAGMENT_SHADER = `
precision mediump float;
uniform samplerCube panorama;
uniform vec2 viewSize; // How far the view reaches sideways and up at distance 1, from the field of view
uniform float yaw;     // Turning right, in radians
uniform float pitch;   // Looking down, in radians
varying vec2 screenPosition;
void main() {
    vec3 direction = vec3(screenPosition * viewSize, 1.0);

    float cosPitch = cos(pitch);
    float sinPitch = sin(pitch);
    direction = vec3(direction.x, direction.y * cosPitch - direction.z * sinPitch, direction.y * sinPitch + direction.z * cosPitch);

    float cosYaw = cos(yaw);
    float sinYaw = sin(yaw);
    direction = vec3(direction.x * cosYaw + direction.z * sinYaw, direction.y, direction.z * cosYaw - direction.x * sinYaw);

    gl_FragColor = textureCube(panorama, direction);
}
`;

function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error("Panorama shader failed to compile: " + gl.getShaderInfoLog(shader));
    }
    return shader;
}

class Panorama {
    // faces - the 6 images panorama_0 to panorama_5: front, right, back, left, top, bottom
    // Settings - fov (vertical field of view in degrees, default 85 like Minecraft),
    //            pitch (degrees looking down, default 10), degreesPerSecond (turning speed, default 2 like Minecraft)
    // Add this.element to the page before the game's canvas so it's behind it.
    // Throws if the browser doesn't support WebGL
    constructor(faces, settings) {
        settings = settings ?? {};
        this.fov = settings.fov ?? 85;
        this.degreesPerSecond = settings.degreesPerSecond ?? 2;

        this.element = document.createElement("canvas");
        this.element.style.position = "fixed";
        this.element.style.left = "0";
        this.element.style.top = "0";
        this.element.style.width = "100%";
        this.element.style.height = "100%";

        const gl = this.element.getContext("webgl");
        if (!gl) {
            throw new Error("WebGL is not supported");
        }
        this.gl = gl;

        const program = gl.createProgram();
        gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
        gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error("Panorama shader failed to link: " + gl.getProgramInfoLog(program));
        }
        gl.useProgram(program);

        // One rectangle covering the whole canvas
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const positionLocation = gl.getAttribLocation(program, "position");
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        gl.bindTexture(gl.TEXTURE_CUBE_MAP, gl.createTexture());
        this.setFaces(faces);

        this.viewSizeLocation = gl.getUniformLocation(program, "viewSize");
        this.yawLocation = gl.getUniformLocation(program, "yaw");
        gl.uniform1f(gl.getUniformLocation(program, "pitch"), (settings.pitch ?? 10) * Math.PI / 180);

        const onFrame = () => {
            this._render();
            requestAnimationFrame(onFrame);
        };
        requestAnimationFrame(onFrame);
    }

    // Swaps in a different panorama. faces are the 6 images panorama_0 to panorama_5, like in the constructor.
    setFaces(faces) {
        const gl = this.gl;

        // Minecraft's faces happen to line up exactly with WebGL's cube map layout when z is forward
        const targets = [
            gl.TEXTURE_CUBE_MAP_POSITIVE_Z, // panorama_0, front
            gl.TEXTURE_CUBE_MAP_POSITIVE_X, // panorama_1, right
            gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, // panorama_2, back
            gl.TEXTURE_CUBE_MAP_NEGATIVE_X, // panorama_3, left
            gl.TEXTURE_CUBE_MAP_POSITIVE_Y, // panorama_4, top
            gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, // panorama_5, bottom
        ];
        for (let i = 0; i < 6; i++) {
            gl.texImage2D(targets[i], 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, faces[i]);
        }
        gl.generateMipmap(gl.TEXTURE_CUBE_MAP); // Keeps the pictures from shimmering on small windows
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    // Matches the canvas to the window in real screen pixels, so it's never blurry or pixelated.
    // Checked every frame, which also catches zooming and moving to a monitor with different scaling.
    _resizeIfNeeded() {
        const devicePixelRatio = window.devicePixelRatio || 1;
        const width = Math.max(1, Math.round(this.element.clientWidth * devicePixelRatio));
        const height = Math.max(1, Math.round(this.element.clientHeight * devicePixelRatio));
        if (width === this.element.width && height === this.element.height) {
            return;
        }
        this.element.width = width;
        this.element.height = height;
        this.gl.viewport(0, 0, width, height);

        const halfHeight = Math.tan(this.fov / 2 * Math.PI / 180);
        this.gl.uniform2f(this.viewSizeLocation, halfHeight * width / height, halfHeight);
    }

    _render() {
        this._resizeIfNeeded();
        const yaw = performance.now() / 1000 * this.degreesPerSecond;
        this.gl.uniform1f(this.yawLocation, yaw * Math.PI / 180);
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    }
}

export default Panorama;
