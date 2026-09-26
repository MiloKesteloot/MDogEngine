// Minecraft's spinning title screen background: 6 pictures on the inside of a cube,
// with the camera in the middle slowly turning around.
// Rendered with WebGL into a canvas at the game's resolution, then drawn like any other image.

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
    // Settings - fov (vertical field of view in degrees, default 85 like Minecraft), pitch (degrees looking down, default 10)
    // Throws if the browser doesn't support WebGL
    constructor(width, height, faces, settings) {
        settings = settings ?? {};
        const fov = settings.fov ?? 85;
        this.pitch = (settings.pitch ?? 10) * Math.PI / 180;

        this.glCanvas = document.createElement("canvas");
        this.glCanvas.width = width;
        this.glCanvas.height = height;
        const gl = this.glCanvas.getContext("webgl");
        if (!gl) {
            throw new Error("WebGL is not supported");
        }
        this.gl = gl;

        // The finished frame gets copied here, because copying out of a WebGL canvas is slow and the engine draws the background every tick
        this.image = document.createElement("canvas");
        this.image.width = width;
        this.image.height = height;
        this.imageCtx = this.image.getContext("2d");

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

        // Minecraft's faces happen to line up exactly with WebGL's cube map layout when z is forward
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
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
        gl.generateMipmap(gl.TEXTURE_CUBE_MAP); // The pictures are bigger than the screen, so this keeps them from shimmering
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        const halfHeight = Math.tan(fov / 2 * Math.PI / 180);
        gl.uniform2f(gl.getUniformLocation(program, "viewSize"), halfHeight * width / height, halfHeight);
        this.yawLocation = gl.getUniformLocation(program, "yaw");
        gl.uniform1f(gl.getUniformLocation(program, "pitch"), this.pitch);

        gl.viewport(0, 0, width, height);

        // The engine ticks many times per frame, but the panorama only needs rendering once per frame
        this.newFrame = true;
        const onFrame = () => {
            this.newFrame = true;
            requestAnimationFrame(onFrame);
        };
        requestAnimationFrame(onFrame);
    }

    // Updates this.image, at most once per animation frame. yawDegrees is how far the camera has turned right.
    render(yawDegrees) {
        if (!this.newFrame) {
            return;
        }
        this.newFrame = false;

        const gl = this.gl;
        gl.uniform1f(this.yawLocation, yawDegrees * Math.PI / 180);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        this.imageCtx.drawImage(this.glCanvas, 0, 0);
    }
}

export default Panorama;
