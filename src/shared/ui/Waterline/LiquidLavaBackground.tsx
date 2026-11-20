import { useEffect, useRef, type FC } from 'react';

const LAVA_VERT = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const LAVA_FRAG = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_parallax;

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float lavaField(vec2 p, float t) {
  float d = 10.0;
  d = smin(d, length(p - vec2(-0.82 + 0.34 * sin(t * 0.21 + 0.4),  0.42 + 0.22 * cos(t * 0.17 + 1.1))) - 0.56, 0.48);
  d = smin(d, length(p - vec2( 0.78 + 0.36 * cos(t * 0.18 + 2.2),  0.34 + 0.26 * sin(t * 0.23 + 0.7))) - 0.62, 0.52);
  d = smin(d, length(p - vec2( 0.12 + 0.48 * sin(t * 0.16 + 3.5), -0.46 + 0.24 * cos(t * 0.20 + 2.1))) - 0.58, 0.50);
  d = smin(d, length(p - vec2(-0.48 + 0.42 * cos(t * 0.24 + 4.8), -0.28 + 0.30 * sin(t * 0.19 + 4.1))) - 0.48, 0.46);
  d = smin(d, length(p - vec2( 0.52 + 0.30 * sin(t * 0.27 + 1.8), -0.32 + 0.28 * cos(t * 0.22 + 5.2))) - 0.46, 0.44);
  d = smin(d, length(p - vec2(-0.10 + 0.38 * cos(t * 0.15 + 5.7),  0.22 + 0.28 * sin(t * 0.25 + 2.9))) - 0.52, 0.48);
  d = smin(d, length(p - vec2( 0.94 + 0.24 * sin(t * 0.20 + 0.9), -0.58 + 0.20 * cos(t * 0.16 + 3.8))) - 0.44, 0.44);
  d = smin(d, length(p - vec2(-0.96 + 0.26 * cos(t * 0.19 + 2.7), -0.52 + 0.22 * sin(t * 0.21 + 1.4))) - 0.45, 0.44);
  return d;
}

float heightAt(vec2 p, float t) {
  float d = lavaField(p, t);
  float wave = 0.032 * sin(p.x * 2.4 + t * 0.32) * cos(p.y * 2.1 - t * 0.26);
  float lobe = smoothstep(0.58, -0.52, d);
  return clamp(lobe + wave, 0.0, 1.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float aspect = u_res.x / max(u_res.y, 1.0);
  vec2 p = (uv - 0.5) * vec2(aspect * 1.45, 1.45);
  p += (u_parallax - 0.5) * vec2(0.08, -0.06);

  float t = u_time * 0.52;
  float h = heightAt(p, t);

  float eps = 0.030;
  float hx = heightAt(p + vec2(eps, 0.0), t) - heightAt(p - vec2(eps, 0.0), t);
  float hy = heightAt(p + vec2(0.0, eps), t) - heightAt(p - vec2(0.0, eps), t);
  vec3 N = normalize(vec3(-hx * 1.55, -hy * 1.55, 1.0));

  vec3 L1 = normalize(vec3(-0.42, 0.62, 0.92));
  vec3 L2 = normalize(vec3(0.55, -0.45, 0.78));
  float diff1 = clamp(dot(N, L1), 0.0, 1.0);
  float diff2 = clamp(dot(N, L2), 0.0, 1.0);
  float fres = pow(1.0 - max(N.z, 0.0), 2.4);

  vec3 valleyCol = vec3(0.61, 0.69, 0.79);
  vec3 veinCol   = vec3(0.71, 0.77, 0.85);
  vec3 bodyCol   = vec3(0.79, 0.83, 0.89);
  vec3 crestCol  = vec3(0.87, 0.89, 0.93);

  vec3 col = mix(valleyCol, veinCol, smoothstep(0.08, 0.44, h));
  col = mix(col, bodyCol, smoothstep(0.36, 0.76, h));
  col = mix(col, crestCol, smoothstep(0.68, 0.98, h) * (0.55 + 0.45 * diff1));

  col += vec3(0.05, 0.06, 0.08) * (diff1 - 0.5) * 0.48;
  col += vec3(0.03, 0.04, 0.06) * diff2 * 0.25;
  col += vec3(0.06, 0.08, 0.11) * fres * 0.42;

  float flow = 0.5 + 0.5 * sin(p.x * 1.5 - p.y * 1.2 + t * 0.42 + h * 2.4);
  col = mix(col, col + vec3(0.025, 0.032, 0.042), flow * 0.30);

  vec2 vp = uv - 0.5;
  float vig = 1.0 - dot(vp, vp) * 0.16;
  col *= vig;

  col = clamp(col, vec3(0.42), vec3(0.88));
  gl_FragColor = vec4(col, 1.0);
}
`;

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/**
 * Fondo ambiente WebGL1 satinado (Waterline Liquid Glass):
 * lóbulos líquidos en pizarra claro / hielo / perla con paralaje sutil,
 * pausa automática en pestaña oculta y respeto estricto a prefers-reduced-motion.
 */
export const LiquidLavaBackground: FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = motionQuery.matches;

    let gl: WebGLRenderingContext | null = null;
    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    let uRes: WebGLUniformLocation | null = null;
    let uTime: WebGLUniformLocation | null = null;
    let uParallax: WebGLUniformLocation | null = null;

    let rafId = 0;
    let disposed = false;
    let paused = document.hidden;
    const t0 = performance.now();
    let px = 0.5;
    let py = 0.5;
    let tx = 0.5;
    let ty = 0.5;

    const initWebGL = (): boolean => {
      gl = canvas.getContext('webgl', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: 'low-power',
      });
      if (!gl) return false;

      const vs = compileShader(gl, gl.VERTEX_SHADER, LAVA_VERT);
      const fs = compileShader(gl, gl.FRAGMENT_SHADER, LAVA_FRAG);
      if (!vs || !fs) {
        if (vs) gl.deleteShader(vs);
        if (fs) gl.deleteShader(fs);
        return false;
      }

      program = gl.createProgram();
      if (!program) {
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        return false;
      }

      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        gl.deleteProgram(program);
        program = null;
        return false;
      }

      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
        gl.STATIC_DRAW,
      );

      gl.useProgram(program);
      const aPos = gl.getAttribLocation(program, 'a_pos');
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      uRes = gl.getUniformLocation(program, 'u_res');
      uTime = gl.getUniformLocation(program, 'u_time');
      uParallax = gl.getUniformLocation(program, 'u_parallax');
      return true;
    };

    const resize = () => {
      if (!gl) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(1, Math.floor(window.innerWidth * dpr));
      const h = Math.max(1, Math.floor(window.innerHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const drawFrame = (elapsedSeconds: number) => {
      if (!gl || !program || gl.isContextLost()) return;
      gl.useProgram(program);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, elapsedSeconds);
      gl.uniform2f(uParallax, px, py);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const loop = (now: number) => {
      if (disposed || paused || reducedMotion) {
        rafId = 0;
        return;
      }
      px += (tx - px) * 0.04;
      py += (ty - py) * 0.04;
      drawFrame((now - t0) / 1000);
      rafId = requestAnimationFrame(loop);
    };

    const startOrPaint = () => {
      if (disposed || !gl || !program) return;
      if (reducedMotion) {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = 0;
        }
        px = 0.5;
        py = 0.5;
        drawFrame(2.4);
      } else if (!paused && !rafId) {
        rafId = requestAnimationFrame(loop);
      }
    };

    if (!initWebGL()) return;
    resize();
    startOrPaint();

    const onPointerMove = (event: PointerEvent) => {
      if (reducedMotion || event.pointerType === 'touch') return;
      tx = event.clientX / Math.max(1, window.innerWidth);
      ty = event.clientY / Math.max(1, window.innerHeight);
    };

    const onVisibility = () => {
      paused = document.hidden;
      if (paused && rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      } else if (!paused) {
        startOrPaint();
      }
    };

    const onMotionChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
      startOrPaint();
    };

    const onContextLost = (event: Event) => {
      event.preventDefault();
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };

    const onContextRestored = () => {
      if (initWebGL()) {
        resize();
        startOrPaint();
      }
    };

    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    motionQuery.addEventListener('change', onMotionChange);
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);

    return () => {
      disposed = true;
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('visibilitychange', onVisibility);
      motionQuery.removeEventListener('change', onMotionChange);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      if (gl && !gl.isContextLost()) {
        if (buffer) gl.deleteBuffer(buffer);
        if (program) gl.deleteProgram(program);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="wl-lava-canvas"
    />
  );
};
