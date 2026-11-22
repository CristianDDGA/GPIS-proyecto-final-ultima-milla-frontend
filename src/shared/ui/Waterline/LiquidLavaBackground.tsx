import { useEffect, useRef, type FC } from 'react';

const LAVA_VERTEX_SHADER = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const LAVA_FRAGMENT_SHADER = `
  precision highp float;

  uniform vec2  u_resolution;
  uniform float u_time;
  uniform vec2  u_mouse;
  uniform float u_parallax;

  const mat2 ROT = mat2(0.80, 0.60, -0.60, 0.80);

  float hash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float smoothNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float viscousFbm(vec2 p) {
    float v = 0.0;
    float a = 0.56;
    float n = 0.0;
    for (int i = 0; i < 3; i++) {
      v += a * smoothNoise(p);
      n += a;
      p = ROT * p * 1.72 + vec2(13.4, 21.7);
      a *= 0.44;
    }
    return v / n;
  }

  float lavaHeight(vec2 p, float t, vec2 mouseShift, out float veinMask, out float flowWave) {
    vec2 drift1 = vec2(t * 0.065, -t * 0.032);
    vec2 drift2 = vec2(-t * 0.044, t * 0.052);

    vec2 q = vec2(
      viscousFbm(p * 0.88 + drift1),
      viscousFbm(p * 0.88 + drift1 * 0.85 + vec2(4.7, 2.3))
    );

    vec2 r = vec2(
      viscousFbm(p * 1.05 + 1.55 * q + drift2 + vec2(1.9, 6.4) + mouseShift * 0.18),
      viscousFbm(p * 1.05 + 1.55 * q - drift2 * 0.9 + vec2(7.1, 3.2) - mouseShift * 0.14)
    );

    vec2 fluidP = p + 1.45 * r;

    float blobA = sin(fluidP.x * 2.15 + t * 0.24) * cos(fluidP.y * 1.85 - t * 0.19);
    float blobB = cos((fluidP.x * 1.35 - fluidP.y * 1.75) + t * 0.21);
    float lobes = 0.5 + 0.30 * blobA + 0.20 * blobB;

    float baseFluid = viscousFbm(fluidP * 0.95 + vec2(t * 0.03, t * 0.02));
    float mass = mix(baseFluid, lobes, 0.56);

    float fold = sin(mass * 6.28318 + r.x * 2.4 - t * 0.18);
    flowWave = 0.5 + 0.5 * fold;

    veinMask = smoothstep(0.42, 0.88, 1.0 - abs(fold));

    float pillow = smoothstep(0.29, 0.68, mass);
    return pillow * 0.82 + flowWave * 0.18;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    float minDim = min(u_resolution.x, u_resolution.y);
    vec2 centered = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / minDim;

    vec2 mouseShift = u_mouse * u_parallax;
    vec2 p = (centered - mouseShift * 0.10) * 1.55;
    float t = u_time;

    float veinMask;
    float flowWave;
    float hC = lavaHeight(p, t, mouseShift, veinMask, flowWave);

    float eps = 0.014;
    float tmp1, tmp2;
    float hR = lavaHeight(p + vec2(eps, 0.0), t, mouseShift, tmp1, tmp2);
    float hL = lavaHeight(p - vec2(eps, 0.0), t, mouseShift, tmp1, tmp2);
    float hU = lavaHeight(p + vec2(0.0, eps), t, mouseShift, tmp1, tmp2);
    float hD = lavaHeight(p - vec2(0.0, eps), t, mouseShift, tmp1, tmp2);

    vec3 N = normalize(vec3((hL - hR) * 4.4, (hD - hU) * 4.4, 1.0));
    vec3 V = vec3(0.0, 0.0, 1.0);
    vec3 L = normalize(vec3(-0.48 + mouseShift.x * 0.25, 0.62 + mouseShift.y * 0.25, 0.82));
    vec3 H = normalize(L + V);

    float diff = clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0);
    float satinSpec = pow(max(dot(N, H), 0.0), 28.0) * 0.16;
    float fresnel = pow(clamp(1.0 - N.z, 0.0, 1.0), 2.0);

    vec3 valleyCol = vec3(0.57, 0.65, 0.74);
    vec3 veinCol   = vec3(0.49, 0.60, 0.74);
    vec3 bodyCol   = vec3(0.72, 0.78, 0.85);
    vec3 crestCol  = vec3(0.84, 0.88, 0.93);

    vec3 col = mix(valleyCol, bodyCol, smoothstep(0.24, 0.68, hC));
    col = mix(col, veinCol, veinMask * 0.44 * (1.0 - hC * 0.40));
    col = mix(col, crestCol, smoothstep(0.50, 0.84, hC * 0.72 + diff * 0.32) * 0.72);

    col *= mix(0.89, 1.06, diff);
    col += vec3(0.88, 0.92, 0.97) * satinSpec;
    col = mix(col, vec3(0.64, 0.74, 0.86), fresnel * 0.26);

    vec2 lightPos = u_mouse * vec2(u_resolution.x / minDim, u_resolution.y / minDim) * 0.42;
    float pDist = length(centered - lightPos);
    float pointerLift = exp(-pDist * pDist * 2.2) * u_parallax;
    col = mix(col, crestCol, pointerLift * 0.14);

    vec2 vigUv = (uv - 0.5) * vec2(u_resolution.x / u_resolution.y * 0.65 + 0.35, 1.0);
    float vig = smoothstep(1.35, 0.18, dot(vigUv, vigUv));
    col *= mix(0.89, 1.0, vig);

    col = clamp(col, vec3(0.42, 0.49, 0.58), vec3(0.88, 0.91, 0.95));

    float dither = (hash21(gl_FragCoord.xy + fract(u_time) * 100.0) - 0.5) / 255.0;
    col += dither;

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`;

interface LavaUniforms {
  readonly resolution: WebGLUniformLocation | null;
  readonly time: WebGLUniformLocation | null;
  readonly mouse: WebGLUniformLocation | null;
  readonly parallax: WebGLUniformLocation | null;
}

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
 * flujo viscoso con pliegues orgánicos en relieve 3D, vetas cobalto suaves,
 * respuesta luminosa al puntero, pausa en pestaña oculta y respeto a prefers-reduced-motion.
 */
export const LiquidLavaBackground: FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduceMotion = motionQuery.matches;

    let gl: WebGLRenderingContext | null = null;
    let program: WebGLProgram | null = null;
    let positionBuffer: WebGLBuffer | null = null;
    let uniforms: LavaUniforms | null = null;
    let contextLost = false;
    let rafId = 0;
    let paused = document.visibilityState !== 'visible';
    let lastTime = performance.now();

    const state = {
      shaderTime: 14.0,
      speed: 0.92,
      pointerTargetX: 0,
      pointerTargetY: 0,
      pointerX: 0,
      pointerY: 0,
      parallax: reduceMotion ? 0.0 : 1.0,
    };

    const resizeCanvas = () => {
      if (!gl) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.floor(window.innerWidth * dpr));
      const height = Math.max(1, Math.floor(window.innerHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };

    const initWebGL = (): boolean => {
      try {
        gl = canvas.getContext('webgl', {
          alpha: false,
          antialias: false,
          depth: false,
          stencil: false,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: false,
        });
        if (!gl) return false;

        const vs = compileShader(gl, gl.VERTEX_SHADER, LAVA_VERTEX_SHADER);
        const fs = compileShader(gl, gl.FRAGMENT_SHADER, LAVA_FRAGMENT_SHADER);
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

        gl.useProgram(program);
        const vertices = new Float32Array([-1.0, -1.0, 3.0, -1.0, -1.0, 3.0]);
        positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        const posLoc = gl.getAttribLocation(program, 'a_position');
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        uniforms = {
          resolution: gl.getUniformLocation(program, 'u_resolution'),
          time: gl.getUniformLocation(program, 'u_time'),
          mouse: gl.getUniformLocation(program, 'u_mouse'),
          parallax: gl.getUniformLocation(program, 'u_parallax'),
        };

        resizeCanvas();
        return true;
      } catch {
        return false;
      }
    };

    const drawFrame = () => {
      if (!gl || contextLost || !uniforms || !program) return;
      gl.useProgram(program);
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      gl.uniform1f(uniforms.time, state.shaderTime);
      gl.uniform2f(uniforms.mouse, state.pointerX, state.pointerY);
      gl.uniform1f(uniforms.parallax, state.parallax);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const render = (now: number) => {
      if (paused || reduceMotion) {
        rafId = 0;
        return;
      }
      rafId = requestAnimationFrame(render);
      if (!gl || contextLost) return;

      const dt = Math.min(Math.max((now - lastTime) * 0.001, 0.0), 0.1);
      lastTime = now;

      state.shaderTime += dt * state.speed;
      const ease = 1.0 - Math.exp(-dt * 3.4);
      state.pointerX += (state.pointerTargetX - state.pointerX) * ease;
      state.pointerY += (state.pointerTargetY - state.pointerY) * ease;

      drawFrame();
    };

    const updatePointer = (clientX: number, clientY: number) => {
      if (reduceMotion) return;
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      state.pointerTargetX = (clientX / w) * 2.0 - 1.0;
      state.pointerTargetY = -((clientY / h) * 2.0 - 1.0);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      updatePointer(e.clientX, e.clientY);
    };
    const onPointerLeave = () => {
      state.pointerTargetX = 0;
      state.pointerTargetY = 0;
    };
    const onContextLost = (e: Event) => {
      e.preventDefault();
      contextLost = true;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };
    const onContextRestored = () => {
      contextLost = false;
      if (initWebGL()) {
        drawFrame();
        if (!paused && !reduceMotion && !rafId) {
          lastTime = performance.now();
          rafId = requestAnimationFrame(render);
        }
      }
    };
    const onVisibilityChange = () => {
      paused = document.visibilityState !== 'visible';
      if (paused && rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      } else if (!paused && !reduceMotion && !rafId) {
        lastTime = performance.now();
        rafId = requestAnimationFrame(render);
      }
    };
    const onMotionChange = (e: MediaQueryListEvent) => {
      reduceMotion = e.matches;
      state.parallax = reduceMotion ? 0.0 : 1.0;
      if (reduceMotion && rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
        drawFrame();
      } else if (!reduceMotion && !paused && !rafId) {
        lastTime = performance.now();
        rafId = requestAnimationFrame(render);
      }
    };
    const onResize = () => {
      resizeCanvas();
      if (reduceMotion) drawFrame();
    };

    if (initWebGL()) {
      drawFrame();
      if (!reduceMotion && !paused) {
        lastTime = performance.now();
        rafId = requestAnimationFrame(render);
      }
    }

    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave);
    document.addEventListener('visibilitychange', onVisibilityChange);
    motionQuery.addEventListener('change', onMotionChange);
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      motionQuery.removeEventListener('change', onMotionChange);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      if (gl && !gl.isContextLost()) {
        if (positionBuffer) gl.deleteBuffer(positionBuffer);
        if (program) gl.deleteProgram(program);
      }
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="wl-lava-canvas" />;
};
