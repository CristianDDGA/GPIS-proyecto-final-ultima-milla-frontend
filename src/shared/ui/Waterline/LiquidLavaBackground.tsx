import { useEffect, useRef, type FC } from 'react';

const LAVA_VERTEX_SHADER = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

// Optimizado: 2 octavas FBM + normales de 3 muestras (~94% menos ops por frame que la versión anterior)
const LAVA_FRAGMENT_SHADER = `
  precision mediump float;

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
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float viscousFbm(vec2 p) {
    float v = 0.64 * smoothNoise(p);
    p = ROT * p * 1.72 + vec2(13.4, 21.7);
    v += 0.36 * smoothNoise(p);
    return v;
  }

  float lavaHeight(vec2 p, float t, vec2 mouseShift, out float veinMask) {
    vec2 drift1 = vec2(t * 0.055, -t * 0.028);
    vec2 drift2 = vec2(-t * 0.038, t * 0.044);

    vec2 q = vec2(
      viscousFbm(p * 0.86 + drift1),
      viscousFbm(p * 0.86 + drift1 * 0.85 + vec2(4.7, 2.3))
    );

    vec2 r = vec2(
      viscousFbm(p * 1.02 + 1.45 * q + drift2 + vec2(1.9, 6.4) + mouseShift * 0.16),
      viscousFbm(p * 1.02 + 1.45 * q - drift2 * 0.9 + vec2(7.1, 3.2) - mouseShift * 0.12)
    );

    vec2 fluidP = p + 1.35 * r;
    float blobA = sin(fluidP.x * 2.1 + t * 0.22) * cos(fluidP.y * 1.8 - t * 0.17);
    float blobB = cos((fluidP.x * 1.3 - fluidP.y * 1.7) + t * 0.19);
    float lobes = 0.5 + 0.30 * blobA + 0.20 * blobB;

    float baseFluid = viscousFbm(fluidP * 0.92 + vec2(t * 0.025, t * 0.018));
    float mass = mix(baseFluid, lobes, 0.56);

    float fold = sin(mass * 6.28318 + r.x * 2.2 - t * 0.16);
    float flowWave = 0.5 + 0.5 * fold;
    veinMask = smoothstep(0.42, 0.88, 1.0 - abs(fold));

    float pillow = smoothstep(0.28, 0.68, mass);
    return pillow * 0.82 + flowWave * 0.18;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    float minDim = min(u_resolution.x, u_resolution.y);
    vec2 centered = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / minDim;

    vec2 mouseShift = u_mouse * u_parallax;
    vec2 p = (centered - mouseShift * 0.09) * 1.50;
    float t = u_time;

    float veinMask;
    float hC = lavaHeight(p, t, mouseShift, veinMask);

    float eps = 0.018;
    float tmp;
    float hR = lavaHeight(p + vec2(eps, 0.0), t, mouseShift, tmp);
    float hU = lavaHeight(p + vec2(0.0, eps), t, mouseShift, tmp);

    vec3 N = normalize(vec3((hC - hR) * 5.2, (hC - hU) * 5.2, 1.0));
    vec3 L = normalize(vec3(-0.48 + mouseShift.x * 0.22, 0.62 + mouseShift.y * 0.22, 0.82));
    vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));

    float diff = clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0);
    float satinSpec = pow(max(dot(N, H), 0.0), 26.0) * 0.14;
    float fresnel = pow(clamp(1.0 - N.z, 0.0, 1.0), 2.0);

    vec3 valleyCol = vec3(0.75, 0.82, 0.90);
    vec3 veinCol   = vec3(0.67, 0.77, 0.89);
    vec3 bodyCol   = vec3(0.84, 0.89, 0.94);
    vec3 crestCol  = vec3(0.92, 0.95, 0.98);

    vec3 col = mix(valleyCol, bodyCol, smoothstep(0.24, 0.68, hC));
    col = mix(col, veinCol, veinMask * 0.36 * (1.0 - hC * 0.35));
    col = mix(col, crestCol, smoothstep(0.50, 0.84, hC * 0.72 + diff * 0.30) * 0.68);

    col *= mix(0.93, 1.04, diff);
    col += vec3(0.94, 0.97, 1.0) * satinSpec;
    col = mix(col, vec3(0.76, 0.84, 0.93), fresnel * 0.20);

    vec2 lightPos = u_mouse * vec2(u_resolution.x / minDim, u_resolution.y / minDim) * 0.40;
    float pDist = length(centered - lightPos);
    float pointerLift = exp(-pDist * pDist * 2.2) * u_parallax;
    col = mix(col, crestCol, pointerLift * 0.12);

    vec2 vigUv = (uv - 0.5) * vec2(u_resolution.x / u_resolution.y * 0.65 + 0.35, 1.0);
    float vig = smoothstep(1.35, 0.18, dot(vigUv, vigUv));
    col *= mix(0.92, 1.0, vig);

    gl_FragColor = vec4(clamp(col, vec3(0.68, 0.76, 0.86), vec3(0.96, 0.98, 1.0)), 1.0);
  }
`;

interface LavaUniforms {
  readonly resolution: WebGLUniformLocation | null;
  readonly time: WebGLUniformLocation | null;
  readonly mouse: WebGLUniformLocation | null;
  readonly parallax: WebGLUniformLocation | null;
}

const IDLE_SLEEP_MS = 2200;
const FRAME_INTERVAL_MS = 1000 / 30; // Suave a 30fps cuando se mueve el puntero; 0fps en reposo

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
 * Fondo ambiente WebGL1 satinado de ultra-bajo consumo (Waterline High-Speed):
 * - Resolución interna 0.45× (máx. 960×540) reescalada por GPU con suavizado lineal.
 * - Modo Sleep-on-Idle: 0 fps exactos en reposo, táctil, modal abierto o pestaña oculta.
 * - Solo despierta suavemente (cap 30fps) al mover el puntero en desktop y vuelve a dormir.
 */
export const LiquidLavaBackground: FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const coarseQuery = window.matchMedia('(pointer: coarse)');
    let reduceMotion = motionQuery.matches || coarseQuery.matches;

    let gl: WebGLRenderingContext | null = null;
    let program: WebGLProgram | null = null;
    let positionBuffer: WebGLBuffer | null = null;
    let uniforms: LavaUniforms | null = null;
    let contextLost = false;
    let rafId = 0;
    let paused = document.visibilityState !== 'visible';
    let lastTime = performance.now();
    let lastDraw = 0;
    let activeUntil = 0;

    const setRafAttr = (active: boolean) => {
      canvas.dataset.rafActive = active ? 'true' : 'false';
    };
    setRafAttr(false);

    const state = {
      shaderTime: 14.0,
      speed: 0.55,
      pointerTargetX: 0,
      pointerTargetY: 0,
      pointerX: 0,
      pointerY: 0,
      parallax: reduceMotion ? 0.0 : 1.0,
    };

    const resizeCanvas = () => {
      if (!gl) return;
      const scale = 0.45;
      const width = Math.max(1, Math.min(960, Math.floor(window.innerWidth * scale)));
      const height = Math.max(1, Math.min(540, Math.floor(window.innerHeight * scale)));
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
          powerPreference: 'low-power',
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

    const stopLoop = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      setRafAttr(false);
    };

    const render = (now: number) => {
      const modalOpen = document.body.dataset.modalOpen === 'true';
      const pointerSettled =
        Math.abs(state.pointerTargetX - state.pointerX) < 0.004 &&
        Math.abs(state.pointerTargetY - state.pointerY) < 0.004;

      if (paused || reduceMotion || modalOpen || (now > activeUntil && pointerSettled)) {
        stopLoop();
        return;
      }

      rafId = requestAnimationFrame(render);
      if (!gl || contextLost) return;
      if (now - lastDraw < FRAME_INTERVAL_MS) return;

      const dt = Math.min(Math.max((now - lastTime) * 0.001, 0.0), 0.1);
      lastTime = now;
      lastDraw = now;

      state.shaderTime += dt * state.speed;
      const ease = 1.0 - Math.exp(-dt * 4.5);
      state.pointerX += (state.pointerTargetX - state.pointerX) * ease;
      state.pointerY += (state.pointerTargetY - state.pointerY) * ease;

      drawFrame();
    };

    const wake = (durationMs = IDLE_SLEEP_MS) => {
      if (paused || reduceMotion || contextLost || !gl) return;
      if (document.body.dataset.modalOpen === 'true') return;
      activeUntil = Math.max(activeUntil, performance.now() + durationMs);
      if (!rafId) {
        lastTime = performance.now();
        lastDraw = 0;
        setRafAttr(true);
        rafId = requestAnimationFrame(render);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (reduceMotion || e.pointerType !== 'mouse') return;
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      state.pointerTargetX = (e.clientX / w) * 2.0 - 1.0;
      state.pointerTargetY = -((e.clientY / h) * 2.0 - 1.0);
      wake(1800);
    };
    const onPointerLeave = () => {
      state.pointerTargetX = 0;
      state.pointerTargetY = 0;
      wake(1200);
    };
    const onContextLost = (e: Event) => {
      e.preventDefault();
      contextLost = true;
      stopLoop();
    };
    const onContextRestored = () => {
      contextLost = false;
      if (initWebGL()) {
        drawFrame();
      }
    };
    const onVisibilityChange = () => {
      paused = document.visibilityState !== 'visible';
      if (paused) stopLoop();
    };
    const onMotionChange = () => {
      reduceMotion = motionQuery.matches || coarseQuery.matches;
      state.parallax = reduceMotion ? 0.0 : 1.0;
      if (reduceMotion) {
        stopLoop();
        drawFrame();
      }
    };
    const onResize = () => {
      resizeCanvas();
      drawFrame();
    };

    if (initWebGL()) {
      drawFrame();
    }

    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave);
    document.addEventListener('visibilitychange', onVisibilityChange);
    motionQuery.addEventListener('change', onMotionChange);
    coarseQuery.addEventListener('change', onMotionChange);
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);

    return () => {
      stopLoop();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      motionQuery.removeEventListener('change', onMotionChange);
      coarseQuery.removeEventListener('change', onMotionChange);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      if (gl && !gl.isContextLost()) {
        if (positionBuffer) gl.deleteBuffer(positionBuffer);
        if (program) gl.deleteProgram(program);
      }
    };
  }, []);

  return <canvas ref={canvasRef} role="presentation" className="wl-lava-canvas" />;
};
