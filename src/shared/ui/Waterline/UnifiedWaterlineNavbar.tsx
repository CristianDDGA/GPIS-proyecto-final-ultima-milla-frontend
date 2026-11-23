import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
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

const PAD = 16;

const WATER_VERT = `attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`;
const WATER_FRAG = `precision highp float;
uniform vec2 uRes;uniform float uDpr;uniform float uTime;uniform vec4 uPill;uniform float uRadius;
uniform vec4 uBlob[6];uniform float uSy[6];uniform vec4 uRip[6];uniform vec3 uMouse;uniform float uDark;uniform float uAmb;
float sdRB(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
float sdCap(vec2 p,vec4 B,float sy){p-=B.xy;p.y/=sy;p.x=max(abs(p.x)-B.z,0.);return(length(p)-B.w)*min(1.,sy);}
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
float dropD(vec2 p){float d=1e4;for(int i=0;i<6;i++){if(uBlob[i].w>.5){d=smin(d,sdCap(p,uBlob[i],uSy[i]),13.);}}return d;}
float pillD(vec2 p){vec2 h=uPill.zw*.5;float rad=min(uRadius,min(h.x,h.y));return sdRB(p-uPill.xy-h,h,rad);}
float lens(float d,float w){float t=clamp(-d/w,0.,1.);return sqrt(1.-(1.-t)*(1.-t));}
float waves(vec2 p){float w=0.;
 for(int i=0;i<6;i++){vec4 R=uRip[i];if(R.w>0.){float x=length(p-R.xy)-R.z*240.;w+=R.w*exp(-R.z*1.7)*sin(x*.3)*exp(-x*x/700.);}}
 vec2 m=p-uMouse.xy;w+=uMouse.z*3.8*exp(-dot(m,m)/1200.);
 w+=uAmb*(sin(p.x*.04+uTime*1.15)*.42+sin(p.x*.11-uTime*.82+p.y*.2)*.24);return w;}
float H(vec2 p){float dp=pillD(p);return lens(dp,min(uPill.w*.36,24.))*2.4+lens(dropD(p),11.)*7.5+waves(p)*smoothstep(0.,7.,-dp);}
float caus(vec2 p,float t){vec2 q=p;float c=0.;for(int i=0;i<3;i++){q+=vec2(sin(q.y*1.1+t),cos(q.x*1.3-t*.7))*.6;c+=1./(1.+16.*abs(sin(q.x)*sin(q.y)));}return c/3.;}
void main(){
 vec2 p=vec2(gl_FragCoord.x,uRes.y*uDpr-gl_FragCoord.y)/uDpr;
 float dp=pillD(p);float dd=dropD(p);
 float h0=H(p);vec3 n=normalize(vec3(h0-H(p+vec2(1.,0.)),h0-H(p+vec2(0.,1.)),1.));
 vec3 V=vec3(0.,0.,1.);
 float spec=pow(max(dot(reflect(-normalize(vec3(-.45,-.8,.85)),n),V),0.),70.);
 float spec2=pow(max(dot(reflect(-normalize(vec3(.6,.75,.7)),n),V),0.),22.)*.3;
 float fres=clamp((1.-n.z)*4.,0.,1.);
 vec3 irid=.5+.5*cos(6.2831*(vec3(0.,.33,.67)+fres*.85+p.x*.0024+uTime*.035));
 float pm=smoothstep(1.,-1.,dp);float dm=smoothstep(1.,-1.,dd)*smoothstep(1.,-2.,dp);
 float sh=smoothstep(9.,-9.,dropD(p-vec2(0.,5.)))*(1.-dm)*pm*(.13+.07*uDark);
 vec3 c=vec3(.04,.24,.62)*sh;float a=sh;
 float pa=clamp(pm*(fres*.48+spec*.9+spec2),0.,1.);
 c=mix(vec3(1.),irid,.48*fres)*pa+c*(1.-pa);a=pa+a*(1.-pa);
 float th=lens(dd,11.);
 float cs=caus((p+n.xy*th*18.)*.085,uTime*.9);
 vec3 tint=mix(vec3(.80,.94,1.),vec3(.55,.82,1.),uDark);
 float rim=dm*(1.-smoothstep(0.,8.,-dd));
 float cres=dm*smoothstep(.12,.55,dot(n.xy,normalize(vec2(.55,.85))))*smoothstep(0.,3.,-dd);
 float body=.5+.5*clamp(-n.y*3.,-1.,1.);
 float da=dm*(.30+.16*body)*(1.-.35*uDark);vec3 dc=mix(tint,vec3(1.),body*.68);
 float la=rim*.26;vec3 lc=mix(vec3(.06,.42,.92),vec3(.1,.55,.95),uDark);dc=lc*la+dc*da*(1.-la);da=la+da*(1.-la);
 la=clamp(cres*.74+smoothstep(.6,1.,cs)*.30*th*dm,0.,1.);dc=vec3(1.)*la+dc*(1.-la);da=la+da*(1.-la);
 la=clamp(dm*(spec*1.25+spec2*.5),0.,1.);dc=vec3(1.)*la+dc*(1.-la);da=la+da*(1.-la);
 la=dm*smoothstep(-2.,0.,dd)*.44;dc=mix(vec3(1.),irid,.35)*la+dc*(1.-la);da=la+da*(1.-la);
 c=dc+c*(1.-da);a=da+a*(1.-da);
 gl_FragColor=vec4(c,a);
}`;

interface WaterGLContext {
  readonly gl: WebGLRenderingContext;
  readonly program: WebGLProgram;
  readonly buffer: WebGLBuffer | null;
  readonly u: {
    readonly uRes: WebGLUniformLocation | null;
    readonly uDpr: WebGLUniformLocation | null;
    readonly uTime: WebGLUniformLocation | null;
    readonly uPill: WebGLUniformLocation | null;
    readonly uRadius: WebGLUniformLocation | null;
    readonly uBlob: WebGLUniformLocation | null;
    readonly uSy: WebGLUniformLocation | null;
    readonly uRip: WebGLUniformLocation | null;
    readonly uMouse: WebGLUniformLocation | null;
    readonly uDark: WebGLUniformLocation | null;
    readonly uAmb: WebGLUniformLocation | null;
  };
}

interface SatDrop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  k: number;
}

interface RippleWave {
  x: number;
  y: number;
  age: number;
  amp: number;
}

interface WaterState {
  a: { x: number; v: number };
  b: { x: number; v: number };
  sy: { s: number; v: number };
  lead: 0 | 1;
  lagFrom: number;
  sats: SatDrop[];
  rips: RippleWave[];
  t: { x: number; cy: number; q: number; r: number };
  q: number;
  mouse: { x: number; y: number; s: number; on: boolean };
  moving: boolean;
  split: boolean;
  ready: boolean;
  w: number;
  h: number;
  radius: number;
  visible: boolean;
  reduce: boolean;
  raf: number;
  last: number;
  time: number;
  glc: WaterGLContext | null;
}

function makeWaterState(): WaterState {
  return {
    a: { x: 0, v: 0 },
    b: { x: 0, v: 0 },
    sy: { s: 1, v: 0 },
    lead: 0,
    lagFrom: 0,
    sats: [],
    rips: [],
    t: { x: 0, cy: 0, q: 0, r: 20 },
    q: 0,
    mouse: { x: 0, y: 0, s: 0, on: false },
    moving: false,
    split: false,
    ready: false,
    w: 0,
    h: 0,
    radius: 999,
    visible: true,
    reduce: false,
    raf: 0,
    last: 0,
    time: 0,
    glc: null,
  };
}

function initWaterGL(canvas: HTMLCanvasElement): WaterGLContext | null {
  const gl = canvas.getContext('webgl', {
    premultipliedAlpha: true,
    alpha: true,
    antialias: false,
  });
  if (!gl) return null;

  const compile = (type: number, src: string): WebGLShader | null => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const vs = compile(gl.VERTEX_SHADER, WATER_VERT);
  const fs = compile(gl.FRAGMENT_SHADER, WATER_FRAG);
  if (!vs || !fs) {
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    return null;
  }

  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }

  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, 'a');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  return {
    gl,
    program,
    buffer,
    u: {
      uRes: gl.getUniformLocation(program, 'uRes'),
      uDpr: gl.getUniformLocation(program, 'uDpr'),
      uTime: gl.getUniformLocation(program, 'uTime'),
      uPill: gl.getUniformLocation(program, 'uPill'),
      uRadius: gl.getUniformLocation(program, 'uRadius'),
      uBlob: gl.getUniformLocation(program, 'uBlob'),
      uSy: gl.getUniformLocation(program, 'uSy'),
      uRip: gl.getUniformLocation(program, 'uRip'),
      uMouse: gl.getUniformLocation(program, 'uMouse'),
      uDark: gl.getUniformLocation(program, 'uDark'),
      uAmb: gl.getUniformLocation(program, 'uAmb'),
    },
  };
}

function supportsBackdropRefraction(): boolean {
  if (typeof window === 'undefined' || typeof CSS === 'undefined') return false;
  const ua = navigator.userAgent;
  return (
    /Chrome\/|Chromium\/|Edg\//.test(ua) &&
    !/Firefox\//.test(ua) &&
    Boolean(CSS.supports?.('backdrop-filter', 'url(#a)'))
  );
}

/**
 * UnifiedWaterlineNavbar:
 * Cápsula única de cristal líquido WebGL1 extendida a toda la barra superior
 * (Logotipo + Módulos con gota deslizante, metaballs, gotas satélite, cáusticas
 * y ondas de choque + Cápsula de perfil/rol/clave/salir), con navegación WCAG.
 */
export function UnifiedWaterlineNavbar<T extends string = string>({
  items,
  activeId,
  onSelect,
  ariaLabel = 'Navegación principal Millast',
  leadingSlot,
  trailingSlot,
}: UnifiedWaterlineNavbarProps<T>) {
  const navRef = useRef<HTMLElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dropRef = useRef<HTMLSpanElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const iconRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const st = useRef<WaterState>(makeWaterState());
  const dropSplashTimerRef = useRef<number | null>(null);

  const active = Math.max(
    0,
    items.findIndex((item) => item.id === activeId),
  );

  const [glState, setGlState] = useState<'on' | 'off'>('on');
  const [refract, setRefract] = useState(false);
  const [fx, setFx] = useState<{ i: number; n: number }>({ i: -1, n: 0 });

  const draw = useCallback(() => {
    const s = st.current;
    const T = s.t;
    const sep = Math.abs(s.a.x - s.b.x);
    const thin = Math.min(sep / (2 * (s.q + T.r) || 1), 1);
    const r = T.r * (1 - 0.3 * thin);

    if (s.glc && !s.glc.gl.isContextLost()) {
      const { gl: g, u } = s.glc;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      g.viewport(0, 0, g.drawingBufferWidth, g.drawingBufferHeight);
      g.uniform2f(u.uRes, s.w + PAD * 2, s.h + PAD * 2);
      g.uniform1f(u.uDpr, dpr);
      g.uniform1f(u.uTime, s.time);
      g.uniform4f(u.uPill, PAD, PAD, s.w, s.h);
      g.uniform1f(u.uRadius, s.radius);

      const blobs = new Float32Array(24);
      const sy = new Float32Array(6).fill(1);
      const head = s.lead === 0 ? s.a : s.b;
      const tail = s.lead === 0 ? s.b : s.a;
      blobs.set(
        [
          head.x,
          T.cy,
          s.q * (1 - 0.25 * thin),
          T.r * (1 - 0.12 * thin),
          tail.x,
          T.cy,
          s.q * (1 - 0.8 * thin),
          T.r * (1 - 0.5 * thin),
        ],
        0,
      );
      sy[0] = sy[1] = s.sy.s;
      s.sats.slice(0, 4).forEach((d, i) => blobs.set([d.x, d.y, 0, d.r], 8 + i * 4));
      g.uniform4fv(u.uBlob, blobs);
      g.uniform1fv(u.uSy, sy);

      const rips = new Float32Array(24);
      s.rips.slice(-6).forEach((p, i) => rips.set([p.x, p.y, p.age, p.amp], i * 4));
      g.uniform4fv(u.uRip, rips);
      g.uniform3f(u.uMouse, s.mouse.x, s.mouse.y, s.mouse.s);
      g.uniform1f(u.uDark, 0.0);
      g.uniform1f(u.uAmb, s.reduce ? 0 : 1);
      g.clearColor(0, 0, 0, 0);
      g.clear(g.COLOR_BUFFER_BIT);
      g.drawArrays(g.TRIANGLES, 0, 3);
    } else if (dropRef.current) {
      const left = Math.min(s.a.x, s.b.x) - s.q - r - PAD;
      const top = T.cy - T.r - PAD;
      const width = sep + 2 * (s.q + r);
      const height = T.r * 2;
      dropRef.current.style.width = `${width}px`;
      dropRef.current.style.height = `${height}px`;
      dropRef.current.style.transform = `translate3d(${left}px, ${top}px, 0) scaleY(${s.sy.s})`;
    }
  }, []);

  const step = useCallback((dt: number, now: number) => {
    const s = st.current;
    const T = s.t;
    s.time += dt;
    s.q += (T.q - s.q) * Math.min(1, dt * 12);
    const bodies = [s.a, s.b] as const;
    let still = true;

    if (s.reduce) {
      s.a.x = s.b.x = T.x;
      s.a.v = s.b.v = 0;
      s.sy.s = 1;
      s.sats = [];
    } else {
      bodies.forEach((B, i) => {
        const isLead = i === s.lead;
        const k = isLead ? 210 : 72;
        const c = isLead ? 25 : 13;
        const f = !isLead && now < s.lagFrom ? 0.08 : 1;
        B.v += (k * (T.x - B.x) - c * B.v) * dt * f;
        B.x += B.v * dt;
        const lo = PAD + 6 + s.q + T.r - 3;
        const hi = PAD + s.w - 6 - s.q - T.r + 3;
        if (B.x < lo || B.x > hi) {
          s.sy.v -= Math.min(Math.abs(B.v), 900) * 0.0016;
          B.x = Math.max(lo, Math.min(hi, B.x));
          B.v *= -0.25;
        }
        if (Math.abs(T.x - B.x) > 0.3 || Math.abs(B.v) > 3) still = false;
      });

      const L = bodies[s.lead];
      const syT = 1 - 0.2 * Math.min(Math.abs(L.v) / 1500, 1);
      s.sy.v += (280 * (syT - s.sy.s) - 9 * s.sy.v) * dt;
      s.sy.s += s.sy.v * dt;
      if (Math.abs(s.sy.s - 1) > 0.002 || Math.abs(s.sy.v) > 0.02) still = false;

      const sep = Math.abs(s.a.x - s.b.x);
      const r = T.r * (1 - 0.3 * Math.min(sep / (2 * (T.q + T.r) || 1), 1));
      if (!s.split && s.moving && sep - 2 * T.q - 2 * r > -6) {
        s.split = true;
        const lo = s.lead === 0 ? s.b : s.a;
        const hi = s.lead === 0 ? s.a : s.b;
        [0.3, 0.5, 0.72].forEach((t, j) => {
          s.sats.push({
            x: lo.x + (hi.x - lo.x) * t + (Math.random() - 0.5) * 6,
            y: T.cy + (Math.random() - 0.5) * 10,
            vx: (lo.v + hi.v) * 0.45,
            vy: (Math.random() - 0.5) * 60,
            r: 5 + Math.random() * 3 - j * 0.5,
            k: 70 + Math.random() * 90,
          });
        });
      }

      s.sats = s.sats.filter((d) => {
        d.vx += (d.k * (T.x - d.x) - 9 * d.vx) * dt;
        d.vy += (90 * (T.cy - d.y) - 7 * d.vy) * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.x = Math.max(PAD + 8 + d.r, Math.min(PAD + s.w - 8 - d.r, d.x));
        d.y = Math.max(T.cy - T.r + d.r, Math.min(T.cy + T.r - d.r, d.y));
        if (Math.abs(T.x - d.x) < T.q + T.r * 0.5) d.r -= dt * 26;
        return d.r > 0.6;
      });
      if (s.sats.length) still = false;
    }

    if (s.moving && still) {
      s.moving = false;
      if (s.split || !s.reduce) {
        s.rips.push({ x: T.x, y: T.cy, age: 0, amp: s.split ? 1.2 : 0.7 });
      }
    }

    s.rips.forEach((p) => {
      p.age += dt;
    });
    s.rips = s.rips.filter((p) => p.age < 2.4);

    const target = s.mouse.on ? 1 : 0;
    s.mouse.s += (target - s.mouse.s) * Math.min(1, dt * 7);
  }, []);

  const loop = useCallback(() => {
    const s = st.current;
    if (s.raf) return;
    s.last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - s.last) / 1000, 1 / 30);
      s.last = now;
      step(dt, now);
      draw();
      const busy = s.moving || s.rips.length > 0 || s.sats.length > 0 || s.mouse.s > 0.01;
      if (s.visible && (!s.reduce || busy)) {
        s.raf = requestAnimationFrame(tick);
      } else {
        s.raf = 0;
      }
    };
    s.raf = requestAnimationFrame(tick);
  }, [draw, step]);

  const measure = useCallback(
    (snap = false) => {
      const nav = navRef.current;
      const el = itemRefs.current[active];
      if (!nav || !el) return;
      const navRect = nav.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      if (navRect.width < 10 || elRect.width < 4) return;

      const s = st.current;
      s.w = navRect.width;
      s.h = navRect.height;
      const computedRadius = Number.parseFloat(window.getComputedStyle(nav).borderTopLeftRadius);
      s.radius = Number.isFinite(computedRadius) && computedRadius > 0 ? computedRadius : s.h / 2;

      const T = s.t;
      T.r = elRect.height / 2;
      T.q = Math.max(0, elRect.width / 2 - T.r);
      T.cy = PAD + (elRect.top - navRect.top) + elRect.height / 2;
      const nx = PAD + (elRect.left - navRect.left) + elRect.width / 2;

      if (!s.ready || snap) {
        s.a.x = s.b.x = nx;
        s.a.v = s.b.v = 0;
        s.q = T.q;
        s.ready = true;
      } else if (Math.abs(nx - T.x) > 0.5) {
        s.lead = Math.abs(nx - s.a.x) <= Math.abs(nx - s.b.x) ? 0 : 1;
        s.lagFrom = performance.now() + 70;
        s.moving = true;
        s.split = false;
      }
      T.x = nx;

      const cv = canvasRef.current;
      if (cv) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const W = s.w + PAD * 2;
        const Hh = s.h + PAD * 2;
        const pw = Math.round(W * dpr);
        const ph = Math.round(Hh * dpr);
        if (cv.width !== pw || cv.height !== ph) {
          cv.width = pw;
          cv.height = ph;
          cv.style.width = `${W}px`;
          cv.style.height = `${Hh}px`;
        }
      }
      loop();
    },
    [active, loop],
  );

  // Inicialización persistente del contexto WebGL (NUNCA se destruye al cambiar de pestaña)
  useEffect(() => {
    setRefract(supportsBackdropRefraction());
    const s = st.current;
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    s.reduce = motionQuery.matches;

    const cv = canvasRef.current;
    s.glc = cv ? initWaterGL(cv) : null;
    if (!s.glc) setGlState('off');

    const onContextLost = (e: Event) => {
      e.preventDefault();
      s.glc = null;
      setGlState('off');
    };
    cv?.addEventListener('webglcontextlost', onContextLost);

    const io = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      s.visible = entry.isIntersecting;
      if (s.visible) loop();
    });
    if (navRef.current) io.observe(navRef.current);

    const onVis = () => {
      s.visible = document.visibilityState === 'visible';
      if (s.visible) loop();
    };
    const onMotion = (e: MediaQueryListEvent) => {
      s.reduce = e.matches;
      loop();
    };

    document.addEventListener('visibilitychange', onVis);
    motionQuery.addEventListener('change', onMotion);

    return () => {
      cv?.removeEventListener('webglcontextlost', onContextLost);
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      motionQuery.removeEventListener('change', onMotion);
      if (dropSplashTimerRef.current !== null) {
        window.clearTimeout(dropSplashTimerRef.current);
      }
      if (s.raf) {
        cancelAnimationFrame(s.raf);
        s.raf = 0;
      }
      if (s.glc && !s.glc.gl.isContextLost()) {
        if (s.glc.buffer) s.glc.gl.deleteBuffer(s.glc.buffer);
        s.glc.gl.deleteProgram(s.glc.program);
      }
      s.glc = null;
    };
  }, [loop]);

  const activeRef = useRef(active);
  activeRef.current = active;

  // Transición suave de la gota cuando cambia la pestaña activa
  useLayoutEffect(() => {
    const track = trackRef.current;
    const activeButton = itemRefs.current[active];
    if (track && activeButton && track.scrollWidth > track.clientWidth + 2) {
      const targetLeft =
        activeButton.offsetLeft - track.clientWidth / 2 + activeButton.offsetWidth / 2;
      track.scrollTo({
        left: Math.max(0, targetLeft),
        behavior: st.current.ready ? 'smooth' : 'auto',
      });
    }
    measure(false);
  }, [measure, active, items.length]);

  const measureRef = useRef(measure);
  measureRef.current = measure;

  // Re-medición exacta al redimensionar, cargar fuentes o hacer scroll en el carril móvil
  useEffect(() => {
    let lastW = -1;
    let lastH = -1;
    const ro = new ResizeObserver(() => {
      const w = navRef.current?.offsetWidth ?? 0;
      const h = navRef.current?.offsetHeight ?? 0;
      if (w !== lastW || h !== lastH) {
        lastW = w;
        lastH = h;
        const track = trackRef.current;
        const activeButton = itemRefs.current[activeRef.current];
        if (track && activeButton && track.scrollWidth > track.clientWidth + 2) {
          const targetLeft =
            activeButton.offsetLeft - track.clientWidth / 2 + activeButton.offsetWidth / 2;
          track.scrollLeft = Math.max(0, targetLeft);
        }
        st.current.ready = false;
        measureRef.current(true);
      }
    });
    if (navRef.current) ro.observe(navRef.current);

    let cancelled = false;
    if (document.fonts?.ready !== undefined) {
      void document.fonts.ready.then(() => {
        if (!cancelled) {
          st.current.ready = false;
          measureRef.current(true);
        }
      });
    }

    const track = trackRef.current;
    const onTrackScroll = () => measureRef.current(true);
    track?.addEventListener('scroll', onTrackScroll, { passive: true });

    return () => {
      cancelled = true;
      ro.disconnect();
      track?.removeEventListener('scroll', onTrackScroll);
    };
  }, []);

  const localCoords = (clientX: number, clientY: number) => {
    const r = navRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: clientX - r.left + PAD, y: clientY - r.top + PAD };
  };

  const ripple = (x: number, y: number, amp: number) => {
    const s = st.current;
    if (s.reduce) return;
    s.rips.push({ x, y, age: 0, amp });
    loop();
  };

  const iconCenter = (i: number) => {
    const el = iconRefs.current[i];
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return localCoords(b.left + b.width / 2, b.top + b.height / 2);
  };

  const selectIndex = (i: number) => {
    const item = items[i];
    if (!item) return;
    setFx((prev) => ({ i, n: prev.n + 1 }));
    const c = iconCenter(i);
    if (c && item.anim === 'drop') {
      if (dropSplashTimerRef.current !== null) {
        window.clearTimeout(dropSplashTimerRef.current);
      }
      dropSplashTimerRef.current = window.setTimeout(() => {
        ripple(c.x, st.current.t.cy, 1.4);
      }, 430);
    }
    if (c && item.anim === 'plane') {
      ripple(c.x, c.y, 0.6);
    }
    if (i !== active) {
      onSelect(item.id);
    }
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
      selectIndex(nextIndex);
      itemRefs.current[nextIndex]?.focus();
    }
  };

  const handlePointerMove = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse') return;
    const p = localCoords(e.clientX, e.clientY);
    const s = st.current;
    s.mouse.x = p.x;
    s.mouse.y = p.y;
    s.mouse.on = true;
    loop();
  };

  const isDenseNav = items.length >= 5;

  return (
    <div className={`wl-header-bar ${isDenseNav ? 'wl-header-bar--dense' : 'wl-header-bar--compact'}`}>
      <nav
        ref={navRef}
        className="nimbus-nav"
        data-tone="light"
        data-gl={glState}
        data-refract={refract ? 'on' : 'off'}
        aria-label={ariaLabel}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => {
          st.current.mouse.on = false;
          loop();
        }}
        onPointerDown={(e) => {
          const p = localCoords(e.clientX, e.clientY);
          ripple(p.x, p.y, 0.85);
        }}
      >
        <svg width="0" height="0" className="wl-refract-svg-defs" aria-hidden="true">
          <filter
            id="nimbus-refract"
            x="0"
            y="0"
            width="100%"
            height="100%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.005 0.018"
              numOctaves="2"
              seed="7"
              result="noise"
            />
            <feGaussianBlur in="noise" stdDeviation="2" result="soft" />
            <feDisplacementMap
              in="SourceGraphic"
              in2="soft"
              scale="28"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </svg>

        {/* Fondo vítreo + WebGL Waterline extendido a toda la barra */}
        <span className="nimbus-glass" aria-hidden="true" />
        <canvas className="nimbus-water" ref={canvasRef} role="presentation" />
        <span className="nimbus-drop" ref={dropRef} aria-hidden="true" />

        {/* Zona izquierda: Logotipo Millast dentro del navbar */}
        {leadingSlot && <div className="wl-header-leading">{leadingSlot}</div>}

        {/* Zona central: Módulos de navegación con gota deslizante */}
        <div
          ref={trackRef}
          className="wl-nav-track"
          role="tablist"
          aria-label={ariaLabel}
        >
          {items.map((item, i) => {
            const isSelected = i === active;
            const playing = fx.i === i;
            return (
              <button
                key={item.id}
                id={`tab-${item.id}`}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-current={isSelected ? 'page' : undefined}
                aria-controls={`panel-${item.id}`}
                tabIndex={isSelected ? 0 : -1}
                aria-label={item.label}
                title={item.label}
                className="nimbus-item"
                onClick={() => selectIndex(i)}
                onKeyDown={(event) => handleKeyDown(event, i)}
              >
                <span
                  className="nv-ico"
                  key={playing ? fx.n : 0}
                  data-fx={playing ? item.anim : undefined}
                  ref={(el) => {
                    iconRefs.current[i] = el;
                  }}
                >
                  {item.icon}
                </span>
                <span className="nimbus-label">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Zona derecha: Perfil, rol y acciones dentro del mismo navbar */}
        {trailingSlot && (
          <div className="wl-header-trailing-wrap">
            <span className="wl-header-divider wl-header-divider--right" aria-hidden="true" />
            {trailingSlot}
          </div>
        )}
      </nav>
    </div>
  );
}
