import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

export type WaterlineIconAnim = 'drop' | 'pop' | 'plane' | 'wave' | 'glow' | 'spin';

export interface WaterlineNavItem<T extends string = string> {
  readonly id: T;
  readonly label: string;
  readonly anim: WaterlineIconAnim;
  readonly icon: ReactNode;
}

export interface UnifiedWaterlineNavbarProps<T extends string = string> {
  readonly items: readonly WaterlineNavItem<T>[];
  readonly activeId: T;
  readonly onSelect: (id: T) => void;
  readonly ariaLabel?: string;
  readonly leadingSlot?: ReactNode;
  readonly trailingSlot?: ReactNode;
}

const WATER_VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const WATER_FRAG = `
precision highp float;
varying vec2 v_uv;

uniform vec2  u_res;
uniform float u_time;
uniform vec4  u_lead;
uniform vec4  u_trail;
uniform float u_k;
uniform float u_stretch;
uniform vec4  u_rip;
uniform vec2  u_hover;
uniform vec4  u_sat0;
uniform vec4  u_sat1;
uniform float u_vel;
uniform float u_theme;

float sdRBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + vec2(r);
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / max(k, 0.0001), 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float waterSDF(vec2 p) {
  float dir = clamp(u_vel * 0.0014, -0.35, 0.35);
  vec2 lSize = vec2(u_lead.z  * (1.0 + u_stretch * 0.24),  u_lead.w  * (1.0 - u_stretch * 0.13));
  vec2 tSize = vec2(u_trail.z * (1.0 + u_stretch * 0.12),  u_trail.w * (1.0 - u_stretch * 0.18));
  float dL = sdRBox(p - u_lead.xy,  lSize, lSize.y);
  float dT = sdRBox(p - u_trail.xy, tSize, tSize.y);
  float d = smin(dL, dT, u_k);

  if (u_sat0.w > 0.01) {
    float ds0 = length(p - u_sat0.xy) - u_sat0.z;
    d = smin(d, ds0, 7.0 * u_sat0.w + 2.0);
  }
  if (u_sat1.w > 0.01) {
    float ds1 = length(p - u_sat1.xy) - u_sat1.z;
    d = smin(d, ds1, 6.0 * u_sat1.w + 2.0);
  }

  float wave = sin(p.x * 0.065 - u_time * 5.2 + dir * 4.0) * (0.28 + abs(u_vel) * 0.0011)
             + cos(p.y * 0.09  + u_time * 3.8) * 0.20;
  d += wave;

  if (u_rip.w > 0.005) {
    float rd = length(p - u_rip.xy);
    float ring = sin((rd - u_rip.z) * 0.34) * exp(-abs(rd - u_rip.z) * 0.075);
    d += ring * u_rip.w * 2.8;
  }

  if (u_hover.y > 0.01) {
    float hx = abs(p.x - u_hover.x);
    d += sin(hx * 0.12 - u_time * 6.0) * exp(-hx * 0.022) * u_hover.y * 1.1;
  }
  return d;
}

vec2 waterGrad(vec2 p) {
  float e = 1.1;
  return vec2(
    waterSDF(p + vec2(e, 0.0)) - waterSDF(p - vec2(e, 0.0)),
    waterSDF(p + vec2(0.0, e)) - waterSDF(p - vec2(0.0, e))
  ) / (2.0 * e);
}

void main() {
  vec2 p = vec2(v_uv.x, 1.0 - v_uv.y) * u_res;
  float d = waterSDF(p);
  float mask = 1.0 - smoothstep(-0.7, 0.9, d);

  float halo = exp(-max(d, 0.0) * 0.14) * 0.22;
  vec3 haloCol = mix(vec3(0.08, 0.41, 0.95), vec3(0.45, 0.72, 1.0), u_theme);

  if (mask < 0.003 && halo < 0.004) {
    gl_FragColor = vec4(0.0);
    return;
  }

  vec2 g = waterGrad(p);
  float gLen = max(length(g), 0.0001);
  vec2 n2 = g / gLen;

  float depth = clamp(-d / max(u_lead.w, 12.0), 0.0, 1.0);
  float dome = sqrt(max(0.02, 1.0 - pow(1.0 - depth, 2.2)));
  float slope = (1.0 - dome) * 1.45;
  vec3 N = normalize(vec3(n2 * slope, dome));

  vec3 L1 = normalize(vec3(-0.34, -0.78, 0.72));
  vec3 L2 = normalize(vec3( 0.48,  0.65, 0.60));
  vec3 V  = vec3(0.0, 0.0, 1.0);
  vec3 H1 = normalize(L1 + V);
  vec3 H2 = normalize(L2 + V);

  float spec1 = pow(max(dot(N, H1), 0.0), 68.0);
  float spec2 = pow(max(dot(N, H2), 0.0), 26.0);
  float fres  = pow(1.0 - max(N.z, 0.0), 2.5);
  float rim   = smoothstep(5.5, 0.0, abs(d)) * smoothstep(1.0, -0.4, d);

  vec2 uvR = p + n2 * (1.0 - depth) * 7.0;
  vec2 uvB = p - n2 * (1.0 - depth) * 7.0;
  float causticR = 0.5 + 0.5 * sin(uvR.x * 0.09 + u_time * 1.9 + sin(uvR.y * 0.14 - u_time * 1.3));
  float causticG = 0.5 + 0.5 * sin(p.x   * 0.09 + u_time * 1.9 + sin(p.y   * 0.14 - u_time * 1.3));
  float causticB = 0.5 + 0.5 * sin(uvB.x * 0.09 + u_time * 1.9 + sin(uvB.y * 0.14 - u_time * 1.3));
  vec3 caustics = vec3(causticR, causticG, causticB);
  caustics = pow(caustics, vec3(3.0)) * (0.32 + abs(u_vel) * 0.0005);

  float iridPhase = fres * 5.0 + n2.x * 1.4 - n2.y * 0.9 + u_time * 0.5;
  vec3 irid = 0.5 + 0.5 * cos(iridPhase + vec3(0.0, 2.094, 4.188));
  irid = mix(vec3(1.0), irid, 0.72);

  float topBand = smoothstep(0.18, -0.82, n2.y) * smoothstep(0.0, 0.55, 1.0 - depth) * 0.85;
  float botGlow = smoothstep(-0.1, 0.88, n2.y) * fres * 0.65;

  float ripSpark = 0.0;
  if (u_rip.w > 0.005) {
    float rd = length(p - u_rip.xy);
    ripSpark = exp(-pow((rd - u_rip.z) * 0.14, 2.0)) * u_rip.w;
  }

  vec3 bodyLight = mix(vec3(0.86, 0.93, 1.00), vec3(0.99, 1.00, 1.00), depth * 0.75 + 0.18);
  vec3 bodyDark  = mix(vec3(0.28, 0.58, 0.98), vec3(0.62, 0.84, 1.00), depth * 0.6 + 0.2);
  vec3 body = mix(bodyLight, bodyDark, u_theme);

  vec3 col = body;
  col += caustics * mix(vec3(0.32, 0.66, 1.0), vec3(0.65, 0.88, 1.0), u_theme) * (0.28 + 0.35 * (1.0 - depth));
  col += irid * fres * (0.48 + 0.25 * u_theme);
  col += vec3(1.0) * (spec1 * 1.25 + topBand * 0.62);
  col += mix(vec3(0.42, 0.74, 1.0), vec3(0.58, 0.86, 1.0), u_theme) * (spec2 * 0.58 + botGlow * 0.72);
  col += vec3(1.0) * rim * (0.62 + 0.25 * max(-n2.y, 0.0));
  col += vec3(0.76, 0.91, 1.0) * ripSpark * 0.78;

  float baseAlpha = mix(0.64, 0.36, u_theme);
  float alpha = mask * clamp(baseAlpha + fres * 0.36 + rim * 0.32 + spec1 * 0.30 + ripSpark * 0.22, 0.0, 0.96);

  vec3 outCol = mix(haloCol, col, mask);
  float outA = max(alpha, halo * (1.0 - mask));
  gl_FragColor = vec4(outCol * outA, outA);
}
`;

interface BoxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface RippleState {
  x: number;
  y: number;
  r: number;
  a: number;
}

interface SatState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
}

interface WaterEngineState {
  boxes: BoxRect[];
  ready: boolean;
  leadX: number;
  leadY: number;
  leadW: number;
  leadH: number;
  leadVx: number;
  leadVw: number;
  trailX: number;
  trailY: number;
  trailW: number;
  trailH: number;
  trailVx: number;
  trailVw: number;
  target: BoxRect;
  ripple: RippleState;
  hoverX: number;
  hoverA: number;
  hoverTargetA: number;
  sats: [SatState, SatState];
}

function makeSat(): SatState {
  return { x: 0, y: 0, vx: 0, vy: 0, r: 0, a: 0 };
}

function compileWaterShader(
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

function detectChromiumBackdropSvg(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /Chrome|Chromium|Edg/.test(ua) && !/Firefox/.test(ua);
}

/**
 * Cabecera Waterline Liquid Glass unificada para los 3 roles.
 * Combina logo Millast, navegación con gota física WebGL1 + fallback CSS,
 * navegación por teclado WCAG (`tablist`/`tab` + flechas/Home/End) y cápsula de sesión.
 */
export function UnifiedWaterlineNavbar<T extends string = string>({
  items,
  activeId,
  onSelect,
  ariaLabel = 'Navegación principal',
  leadingSlot,
  trailingSlot,
}: UnifiedWaterlineNavbarProps<T>) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const btnRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIdx = Math.max(
    0,
    items.findIndex((item) => item.id === activeId),
  );

  const [fallbackMode, setFallbackMode] = useState(false);
  const [fallbackBox, setFallbackBox] = useState<BoxRect | null>(null);
  const [animatingIdx, setAnimatingIdx] = useState<number | null>(null);
  const useChromiumRefract = useMemo(detectChromiumBackdropSvg, []);

  const stateRef = useRef<WaterEngineState>({
    boxes: [],
    ready: false,
    leadX: 0,
    leadY: 0,
    leadW: 0,
    leadH: 0,
    leadVx: 0,
    leadVw: 0,
    trailX: 0,
    trailY: 0,
    trailW: 0,
    trailH: 0,
    trailVx: 0,
    trailVw: 0,
    target: { x: 0, y: 0, w: 0, h: 0 },
    ripple: { x: 0, y: 0, r: 0, a: 0 },
    hoverX: 0,
    hoverA: 0,
    hoverTargetA: 0,
    sats: [makeSat(), makeSat()],
  });

  const measure = useCallback(
    (snap = false) => {
      const track = trackRef.current;
      if (!track) return;
      const trackRect = track.getBoundingClientRect();
      const boxes: BoxRect[] = items.map((_, index) => {
        const button = btnRefs.current[index];
        if (!button) return { x: 0, y: 0, w: 0, h: 0 };
        const rect = button.getBoundingClientRect();
        return {
          x: rect.left - trackRect.left + track.scrollLeft + rect.width / 2,
          y: rect.top - trackRect.top + rect.height / 2,
          w: rect.width / 2,
          h: rect.height / 2,
        };
      });

      const engine = stateRef.current;
      engine.boxes = boxes;
      const current = boxes[activeIdx];
      if (!current || current.w <= 0) return;

      engine.target = { ...current };
      if (!engine.ready || snap) {
        engine.leadX = current.x;
        engine.leadY = current.y;
        engine.leadW = current.w;
        engine.leadH = current.h;
        engine.trailX = current.x;
        engine.trailY = current.y;
        engine.trailW = current.w;
        engine.trailH = current.h;
        engine.leadVx = 0;
        engine.leadVw = 0;
        engine.trailVx = 0;
        engine.trailVw = 0;
        engine.ready = true;
      }
      setFallbackBox(current);
    },
    [activeIdx, items],
  );

  useEffect(() => {
    const raf = requestAnimationFrame(() => measure(true));
    const track = trackRef.current;
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => measure(true)) : null;
    if (ro && track) {
      ro.observe(track);
      btnRefs.current.forEach((btn) => {
        if (btn) ro.observe(btn);
      });
    }

    let cancelled = false;
    if (document.fonts && document.fonts.ready) {
      void document.fonts.ready.then(() => {
        if (!cancelled) measure(true);
      });
    }

    const onResize = () => measure(true);
    window.addEventListener('resize', onResize, { passive: true });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [measure]);

  useEffect(() => {
    const engine = stateRef.current;
    const target = engine.boxes[activeIdx];
    if (!target || target.w <= 0) {
      measure(true);
      return;
    }

    const dist = Math.abs(target.x - engine.leadX);
    const dir = Math.sign(target.x - engine.leadX) || 1;
    engine.target = { ...target };
    setFallbackBox(target);

    if (dist > 60) {
      engine.sats[0] = {
        x: engine.leadX + dir * 16,
        y: target.y + (Math.random() - 0.5) * 4,
        vx: dir * (130 + Math.min(dist, 240) * 0.42),
        vy: (Math.random() - 0.5) * 32,
        r: Math.min(8.5, 4.5 + dist * 0.015),
        a: 1.0,
      };
      if (dist > 130) {
        engine.sats[1] = {
          x: engine.leadX + dir * 32,
          y: target.y + (Math.random() - 0.5) * 6,
          vx: dir * (190 + Math.min(dist, 280) * 0.48),
          vy: (Math.random() - 0.5) * 44,
          r: Math.min(6.2, 3.5 + dist * 0.011),
          a: 0.92,
        };
      }
    }

    // Asegura que la pestaña activa sea visible cuando el carril móvil tiene scroll horizontal
    const activeButton = btnRefs.current[activeIdx];
    if (activeButton && typeof activeButton.scrollIntoView === 'function') {
      activeButton.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [activeIdx, measure]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const track = trackRef.current;
    if (!canvas || !track) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = motionQuery.matches;

    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
    });
    if (!gl) {
      setFallbackMode(true);
      return;
    }

    const vs = compileWaterShader(gl, gl.VERTEX_SHADER, WATER_VERT);
    const fs = compileWaterShader(gl, gl.FRAGMENT_SHADER, WATER_FRAG);
    if (!vs || !fs) {
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
      setFallbackMode(true);
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      setFallbackMode(true);
      return;
    }

    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      setFallbackMode(true);
      return;
    }

    const buffer = gl.createBuffer();
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

    const loc = {
      res: gl.getUniformLocation(program, 'u_res'),
      time: gl.getUniformLocation(program, 'u_time'),
      lead: gl.getUniformLocation(program, 'u_lead'),
      trail: gl.getUniformLocation(program, 'u_trail'),
      k: gl.getUniformLocation(program, 'u_k'),
      stretch: gl.getUniformLocation(program, 'u_stretch'),
      rip: gl.getUniformLocation(program, 'u_rip'),
      hover: gl.getUniformLocation(program, 'u_hover'),
      sat0: gl.getUniformLocation(program, 'u_sat0'),
      sat1: gl.getUniformLocation(program, 'u_sat1'),
      vel: gl.getUniformLocation(program, 'u_vel'),
      theme: gl.getUniformLocation(program, 'u_theme'),
    };

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    let rafId = 0;
    let lastT = performance.now();
    const startT = lastT;
    let paused = document.hidden;
    let disposed = false;

    const syncSize = (): { w: number; h: number } => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(track.scrollWidth || track.clientWidth));
      const h = Math.max(1, Math.round(track.clientHeight));
      const pw = Math.round(w * dpr);
      const ph = Math.round(h * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      gl.viewport(0, 0, pw, ph);
      return { w, h };
    };

    const tick = (now: number) => {
      if (disposed || paused) {
        rafId = 0;
        return;
      }

      const dt = Math.min(0.032, Math.max(0.004, (now - lastT) / 1000));
      lastT = now;
      const elapsed = (now - startT) / 1000;
      const { w, h } = syncSize();
      const engine = stateRef.current;

      if (engine.ready) {
        if (reducedMotion) {
          engine.leadX = engine.target.x;
          engine.leadY = engine.target.y;
          engine.leadW = engine.target.w;
          engine.leadH = engine.target.h;
          engine.trailX = engine.target.x;
          engine.trailY = engine.target.y;
          engine.trailW = engine.target.w;
          engine.trailH = engine.target.h;
          engine.leadVx = 0;
          engine.trailVx = 0;
          engine.ripple.a = 0;
          engine.sats[0].a = 0;
          engine.sats[1].a = 0;
        } else {
          const leadStiff = 210;
          const leadDamp = 21.5;
          engine.leadVx += ((engine.target.x - engine.leadX) * leadStiff - engine.leadVx * leadDamp) * dt;
          engine.leadX += engine.leadVx * dt;
          engine.leadVw += ((engine.target.w - engine.leadW) * leadStiff - engine.leadVw * leadDamp) * dt;
          engine.leadW += engine.leadVw * dt;
          engine.leadY += (engine.target.y - engine.leadY) * Math.min(1, dt * 18);
          engine.leadH += (engine.target.h - engine.leadH) * Math.min(1, dt * 18);

          const trailStiff = 128;
          const trailDamp = 16.5;
          engine.trailVx += ((engine.leadX - engine.trailX) * trailStiff - engine.trailVx * trailDamp) * dt;
          engine.trailX += engine.trailVx * dt;
          engine.trailVw += ((engine.leadW - engine.trailW) * trailStiff - engine.trailVw * trailDamp) * dt;
          engine.trailW += engine.trailVw * dt;
          engine.trailY += (engine.leadY - engine.trailY) * Math.min(1, dt * 14);
          engine.trailH += (engine.leadH - engine.trailH) * Math.min(1, dt * 14);

          if (engine.ripple.a > 0.005) {
            engine.ripple.r += dt * 175;
            engine.ripple.a *= Math.exp(-dt * 4.4);
          } else {
            engine.ripple.a = 0;
          }

          engine.hoverA += (engine.hoverTargetA - engine.hoverA) * Math.min(1, dt * 12);

          for (const sat of engine.sats) {
            if (sat.a > 0.01) {
              sat.vx += (engine.target.x - sat.x) * 14.0 * dt;
              sat.vy += (engine.target.y - sat.y) * 18.0 * dt;
              sat.vx *= Math.exp(-dt * 4.2);
              sat.vy *= Math.exp(-dt * 5.0);
              sat.x += sat.vx * dt;
              sat.y += sat.vy * dt;
              sat.a *= Math.exp(-dt * 3.4);
              sat.r *= Math.exp(-dt * 1.1);
            } else {
              sat.a = 0;
            }
          }
        }

        const sep = Math.abs(engine.leadX - engine.trailX);
        const speed = Math.abs(engine.leadVx);
        const stretch = Math.min(1.0, sep / 70.0 + speed / 1500.0);
        const mergeK = 14.0 + Math.min(24.0, sep * 0.42);

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(program);
        gl.uniform2f(loc.res, w, h);
        gl.uniform1f(loc.time, reducedMotion ? 0 : elapsed);
        gl.uniform4f(loc.lead, engine.leadX, engine.leadY, Math.max(8, engine.leadW - 1), Math.max(8, engine.leadH - 1));
        gl.uniform4f(loc.trail, engine.trailX, engine.trailY, Math.max(8, engine.trailW - 2), Math.max(8, engine.trailH - 2));
        gl.uniform1f(loc.k, mergeK);
        gl.uniform1f(loc.stretch, stretch);
        gl.uniform4f(loc.rip, engine.ripple.x, engine.ripple.y, engine.ripple.r, engine.ripple.a);
        gl.uniform2f(loc.hover, engine.hoverX, engine.hoverA);
        gl.uniform4f(loc.sat0, engine.sats[0].x, engine.sats[0].y, engine.sats[0].r, engine.sats[0].a);
        gl.uniform4f(loc.sat1, engine.sats[1].x, engine.sats[1].y, engine.sats[1].r, engine.sats[1].a);
        gl.uniform1f(loc.vel, engine.leadVx);
        gl.uniform1f(loc.theme, 0.0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }

      if (!reducedMotion) {
        rafId = requestAnimationFrame(tick);
      } else {
        rafId = 0;
      }
    };

    const kick = () => {
      if (!disposed && !paused && !rafId) {
        lastT = performance.now();
        rafId = requestAnimationFrame(tick);
      }
    };

    kick();

    const onVisibility = () => {
      paused = document.hidden;
      if (paused && rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      } else if (!paused) {
        kick();
      }
    };

    const onMotionChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
      kick();
    };

    document.addEventListener('visibilitychange', onVisibility);
    motionQuery.addEventListener('change', onMotionChange);

    return () => {
      disposed = true;
      if (rafId) cancelAnimationFrame(rafId);
      document.removeEventListener('visibilitychange', onVisibility);
      motionQuery.removeEventListener('change', onMotionChange);
      if (!gl.isContextLost()) {
        if (buffer) gl.deleteBuffer(buffer);
        gl.deleteProgram(program);
      }
    };
  }, [activeIdx, items.length]);

  const handleSelect = (item: WaterlineNavItem<T>, index: number, clientX?: number, clientY?: number) => {
    const track = trackRef.current;
    if (track && clientX !== undefined && clientY !== undefined) {
      const rect = track.getBoundingClientRect();
      stateRef.current.ripple = {
        x: clientX - rect.left + track.scrollLeft,
        y: clientY - rect.top,
        r: 4,
        a: 1.0,
      };
    } else if (stateRef.current.boxes[index]) {
      const box = stateRef.current.boxes[index];
      stateRef.current.ripple = { x: box.x, y: box.y, r: 4, a: 0.9 };
    }

    onSelect(item.id);
    setAnimatingIdx(index);
    window.setTimeout(() => {
      setAnimatingIdx((current) => (current === index ? null : current));
    }, 620);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (items.length <= 1) return;
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % items.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + items.length) % items.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = items.length - 1;

    if (nextIndex !== null) {
      event.preventDefault();
      const nextItem = items[nextIndex];
      if (nextItem) {
        handleSelect(nextItem, nextIndex);
        btnRefs.current[nextIndex]?.focus();
      }
    }
  };

  const isDenseNav = items.length >= 5;

  return (
    <>
      {useChromiumRefract && (
        <svg className="wl-refract-svg-defs" aria-hidden="true">
          <defs>
            <filter id="wl-nimbus-refract" x="-15%" y="-15%" width="130%" height="130%" colorInterpolationFilters="sRGB">
              <feTurbulence type="fractalNoise" baseFrequency="0.014 0.032" numOctaves="2" seed="7" result="noise" />
              <feGaussianBlur in="noise" stdDeviation="2.5" result="smooth" />
              <feDisplacementMap in="SourceGraphic" in2="smooth" scale="14" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
        </svg>
      )}

      <div className={`wl-header-bar ${isDenseNav ? 'wl-header-bar--dense' : 'wl-header-bar--compact'}`}>
        <div className="wl-unified-shell">
          <div
            className="wl-refract-layer"
            aria-hidden="true"
            style={
              useChromiumRefract
                ? {
                    backdropFilter: 'url(#wl-nimbus-refract) blur(14px) saturate(1.42) brightness(1.03)',
                    WebkitBackdropFilter: 'blur(18px) saturate(1.42)',
                  }
                : undefined
            }
          />
          <div className="wl-shell-sheen" aria-hidden="true" />

          {leadingSlot && <div className="wl-header-leading">{leadingSlot}</div>}

          <div
            ref={trackRef}
            className="wl-nav-track"
            role="tablist"
            aria-label={ariaLabel}
            onPointerMove={(event) => {
              if (event.pointerType === 'touch') return;
              const rect = event.currentTarget.getBoundingClientRect();
              stateRef.current.hoverX = event.clientX - rect.left + event.currentTarget.scrollLeft;
              stateRef.current.hoverTargetA = 1;
            }}
            onPointerLeave={() => {
              stateRef.current.hoverTargetA = 0;
            }}
          >
            {!fallbackMode ? (
              <canvas ref={canvasRef} className="wl-water-canvas" aria-hidden="true" />
            ) : (
              fallbackBox && (
                <div
                  className="wl-fallback-drop"
                  aria-hidden="true"
                  style={{
                    transform: `translate3d(${fallbackBox.x - fallbackBox.w}px, ${fallbackBox.y - fallbackBox.h}px, 0)`,
                    width: `${fallbackBox.w * 2}px`,
                    height: `${fallbackBox.h * 2}px`,
                  }}
                />
              )
            )}

            {items.map((item, index) => {
              const isActive = index === activeIdx;
              const isAnim = animatingIdx === index;
              return (
                <button
                  key={item.id}
                  id={`tab-${item.id}`}
                  ref={(el) => {
                    btnRefs.current[index] = el;
                  }}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`panel-${item.id}`}
                  tabIndex={isActive ? 0 : -1}
                  title={item.label}
                  className={`wl-nav-item ${isActive ? 'wl-nav-item--active' : ''}`}
                  onClick={(event) => handleSelect(item, index, event.clientX, event.clientY)}
                  onKeyDown={(event) => handleKeyDown(event, index)}
                >
                  <span
                    className={`wl-nav-icon ${isAnim ? `wl-anim-${item.anim}` : ''}`}
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>
                  <span className="wl-nav-label">{item.label}</span>
                </button>
              );
            })}
          </div>

          {trailingSlot && <div className="wl-header-trailing">{trailingSlot}</div>}
        </div>
      </div>
    </>
  );
}
