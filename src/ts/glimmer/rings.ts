import { AccentTheme } from "./theme";

type Vec2 = [number, number];

/** the look of the rings, from crush's "red rings" */
const LOOK = {
  attenuation: 10,
  lineThickness: 2,
  baseRadius: 0.35,
  radiusStep: 0.1,
  scaleRate: 0.1,
  opacity: 1,
  noiseAmount: 0.1,
  ringGap: 1.5,
  fadeIn: 0.7,
  fadeOut: 0.5,
  ringCount: 6,
  mouseInfluence: 0.2,
  hoverScale: 1.2,
  parallax: 0.05,
  speed: 1,
};

/** how fast the rings catch up with the pointer each frame, and how fast a click's flash fades */
const FOLLOW = 0.08;
const BURST_DECAY = 0.95;

const VERTEX = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT = `
precision highp float;

uniform float uTime, uAttenuation, uLineThickness;
uniform float uBaseRadius, uRadiusStep, uScaleRate;
uniform float uOpacity, uNoiseAmount, uRingGap;
uniform float uFadeIn, uFadeOut;
uniform float uMouseInfluence, uHoverScale, uParallax, uBurst;
uniform vec2 uResolution, uMouse;
uniform vec3 uColor, uColorTwo;
uniform int uRingCount;

const float HP = 1.5707963;
const float CYCLE = 3.45;

float fade(float t) {
  return t < uFadeIn ? smoothstep(0.0, uFadeIn, t) : 1.0 - smoothstep(uFadeOut, CYCLE - 0.2, t);
}

float ring(vec2 p, float ri, float cut, float t0, float px) {
  float t = mod(uTime + t0, CYCLE);
  float r = ri + t / CYCLE * uScaleRate;
  float d = abs(length(p) - r);
  float a = atan(abs(p.y), abs(p.x)) / HP;
  float th = max(1.0 - a, 0.5) * px * uLineThickness;
  float h = (1.0 - smoothstep(th, th * 1.5, d)) + 1.0;
  d += pow(cut * a, 3.0) * r;
  return h * exp(-uAttenuation * d) * fade(t);
}

void main() {
  float px = 1.0 / min(uResolution.x, uResolution.y);
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution.xy) * px;
  p -= uMouse * uMouseInfluence;
  float sc = uHoverScale + uBurst * 0.3;
  p /= sc;
  vec3 c = vec3(0.0);
  float rcf = max(float(uRingCount) - 1.0, 1.0);
  for (int i = 0; i < 10; i++) {
    if (i >= uRingCount) break;
    float fi = float(i);
    vec2 pr = p - fi * uParallax * uMouse;
    vec3 rc = mix(uColor, uColorTwo, fi / rcf);
    c = mix(c, rc, vec3(ring(pr, uBaseRadius + fi * uRadiusStep, pow(uRingGap, fi), i == 0 ? 0.0 : 2.95 * fi, px)));
  }
  c *= 1.0 + uBurst * 2.0;
  float n = fract(sin(dot(gl_FragCoord.xy + uTime * 100.0, vec2(12.9898, 78.233))) * 43758.5453);
  c += (n - 0.5) * uNoiseAmount;
  gl_FragColor = vec4(c, max(c.r, max(c.g, c.b)) * uOpacity);
}
`;

/**
 * Glowing rings that ripple out from the middle of the window, lean toward the pointer and
 * flash when you click. A raw WebGL port of crush's "red rings" (originally drawn with three.js,
 * which is far bigger than this whole effect). The canvas never takes pointer events.
 */
export class RingsEffect {
  private readonly gl: WebGLRenderingContext;
  private readonly uniforms: Record<string, WebGLUniformLocation | null> = {};
  private frame = 0;
  private mouse: Vec2 = [0, 0];
  private smooth: Vec2 = [0, 0];
  private burst = 0;

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    gl: WebGLRenderingContext,
    program: WebGLProgram,
  ) {
    this.gl = gl;
    for (const name of [
      "uTime",
      "uAttenuation",
      "uLineThickness",
      "uBaseRadius",
      "uRadiusStep",
      "uScaleRate",
      "uOpacity",
      "uNoiseAmount",
      "uRingGap",
      "uFadeIn",
      "uFadeOut",
      "uMouseInfluence",
      "uHoverScale",
      "uParallax",
      "uBurst",
      "uResolution",
      "uMouse",
      "uColor",
      "uColorTwo",
      "uRingCount",
    ])
      this.uniforms[name] = gl.getUniformLocation(program, name);

    gl.uniform1f(this.uniforms.uAttenuation, LOOK.attenuation);
    gl.uniform1f(this.uniforms.uLineThickness, LOOK.lineThickness);
    gl.uniform1f(this.uniforms.uBaseRadius, LOOK.baseRadius);
    gl.uniform1f(this.uniforms.uRadiusStep, LOOK.radiusStep);
    gl.uniform1f(this.uniforms.uScaleRate, LOOK.scaleRate);
    gl.uniform1f(this.uniforms.uOpacity, LOOK.opacity);
    gl.uniform1f(this.uniforms.uNoiseAmount, LOOK.noiseAmount);
    gl.uniform1f(this.uniforms.uRingGap, LOOK.ringGap);
    gl.uniform1f(this.uniforms.uFadeIn, LOOK.fadeIn);
    gl.uniform1f(this.uniforms.uFadeOut, LOOK.fadeOut);
    gl.uniform1f(this.uniforms.uMouseInfluence, LOOK.mouseInfluence);
    gl.uniform1f(this.uniforms.uHoverScale, LOOK.hoverScale);
    gl.uniform1f(this.uniforms.uParallax, LOOK.parallax);
    gl.uniform1i(this.uniforms.uRingCount, LOOK.ringCount);
  }

  /** the effect drawing on `canvas`, or null when WebGL isn't available */
  static create(canvas: HTMLCanvasElement): RingsEffect | null {
    // the colour the shader writes is already multiplied by its alpha, which is what a canvas expects
    const gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: true,
    }) as WebGLRenderingContext | null;
    if (!gl) return null;

    const program = RingsEffect.program(gl);
    if (!program) return null;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    ); // one triangle that covers the screen
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.clearColor(0, 0, 0, 0);

    return new RingsEffect(canvas, gl, program);
  }

  /** one animation step: the pointer position eases toward where it is, and a click's flash fades */
  static step(
    mouse: Vec2,
    smooth: Vec2,
    burst: number,
  ): { smooth: Vec2; burst: number } {
    const nextBurst = burst * BURST_DECAY;
    return {
      smooth: [
        smooth[0] + (mouse[0] - smooth[0]) * FOLLOW,
        smooth[1] + (mouse[1] - smooth[1]) * FOLLOW,
      ],
      burst: nextBurst < 0.001 ? 0 : nextBurst,
    };
  }

  /** the pointer position as the shader wants it: -0.5 to 0.5 across the window, up is positive */
  static pointer(x: number, y: number, width: number, height: number): Vec2 {
    return [x / width - 0.5, 0.5 - y / height];
  }

  /** colours for the rings, as "#rrggbb": the first ring has the first colour, the last ring the second */
  setColors(first: string, second: string) {
    this.gl.uniform3f(this.uniforms.uColor, ...RingsEffect.rgb(first));
    this.gl.uniform3f(this.uniforms.uColorTwo, ...RingsEffect.rgb(second));
  }

  start() {
    this.resize();
    window.addEventListener("resize", this.resize);
    window.addEventListener("mousemove", this.onMove, { passive: true });
    window.addEventListener("click", this.onClick, { passive: true });
    this.frame = requestAnimationFrame(this.draw);
  }

  stop() {
    cancelAnimationFrame(this.frame);
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("mousemove", this.onMove);
    window.removeEventListener("click", this.onClick);
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }

  private readonly resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(window.innerWidth * dpr));
    const h = Math.max(1, Math.round(window.innerHeight * dpr));
    this.canvas.width = w;
    this.canvas.height = h;
    this.gl.viewport(0, 0, w, h);
    this.gl.uniform2f(this.uniforms.uResolution, w, h);
  };

  private readonly onMove = (e: MouseEvent) => {
    this.mouse = RingsEffect.pointer(
      e.clientX,
      e.clientY,
      window.innerWidth,
      window.innerHeight,
    );
  };

  private readonly onClick = () => {
    this.burst = 1;
  };

  private readonly draw = (time: number) => {
    this.frame = requestAnimationFrame(this.draw);

    const next = RingsEffect.step(this.mouse, this.smooth, this.burst);
    this.smooth = next.smooth;
    this.burst = next.burst;

    this.gl.uniform1f(this.uniforms.uTime, time * 0.001 * LOOK.speed);
    this.gl.uniform2f(this.uniforms.uMouse, this.smooth[0], this.smooth[1]);
    this.gl.uniform1f(this.uniforms.uBurst, this.burst);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);
  };

  /** "#rrggbb" as 0 to 1 red, green and blue */
  private static rgb(hex: string): [number, number, number] {
    const [r, g, b] = AccentTheme.parse(
      AccentTheme.normalize(hex) ?? "#ffffff",
    );
    return [r / 255, g / 255, b / 255];
  }

  private static program(gl: WebGLRenderingContext): WebGLProgram | null {
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
    };

    const vertex = compile(gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT);
    if (!vertex || !fragment) return null;

    const program = gl.createProgram()!;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
  }
}
