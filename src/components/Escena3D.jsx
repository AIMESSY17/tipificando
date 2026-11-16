"use client";
import { useEffect, useRef } from "react";
import { medidas, anchoPed } from "@/lib/medir";
import { input, escuchar } from "@/lib/inclinacion";
import { prepararFoto } from "@/lib/profundidad";

// =====================================================================
//  UN SOLO WebGL para todo el escenario (three.js):
//  - pedestal real (travertino con bisel o cabezal de torno de alfarero);
//  - sombras reales en la mesa y la pared (la mesa y la pared de verdad son el DOM de atrás);
//  - LA PIEZA: un plano parado sobre el pedestal con un shader 2.5D (parallax por profundidad
//    cilíndrica + brillo de esmalte + sombreado). Ese mismo plano proyecta la sombra.
//  - cambio de pieza = giro de torno: pedestal y pieza giran 180°; de canto (90°) se cambia la foto.
//  Además escribe --apoyo y --horizonte en el contenedor para que mesa, palabra y textos encajen.
//
//  Control desde afuera (prop `control`, un ref): progreso(p, destino) con p entre -1 y 1
//  (el gesto en vivo) y confirmar(destino, signo) cuando el giro se completa.
// =====================================================================

const ALTO = 1.1;      // altura del pedestal (unidades 3D)
const PARED_Z = -3;    // la pared está 3 unidades detrás
const MX = 0.16, MY = 0.14; // margen del halo de luz alrededor de la pieza

function canvasTex(T, w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function rnd(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

// Travertino: vetas horizontales suaves + poros chiquitos y alargados
function texTravertino(T) {
  const r = rnd(7);
  return canvasTex(T, 2048, 1024, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#eee5d6");
    g.addColorStop(1, "#e6dccb");
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    for (let i = 0; i < 120; i++) {
      const y = r() * h, hh = 1 + r() * 10;
      x.fillStyle = `rgba(${170 + r() * 50},${150 + r() * 45},${120 + r() * 35},${0.04 + r() * 0.08})`;
      x.beginPath();
      x.moveTo(0, y);
      for (let px = 0; px <= w; px += 64) x.lineTo(px, y + Math.sin(px * 0.004 + i) * 4 + (r() - 0.5) * 2);
      x.lineTo(w, y + hh);
      x.lineTo(0, y + hh);
      x.fill();
    }
    for (let i = 0; i < 700; i++) {
      const px = r() * w, py = r() * h, rw = 1 + r() * 6, rh = 0.4 + r() * 1.2;
      x.fillStyle = `rgba(${130 + r() * 40},${110 + r() * 35},${85 + r() * 25},${0.18 + r() * 0.25})`;
      x.beginPath();
      x.ellipse(px, py, rw, rh, 0, 0, Math.PI * 2);
      x.fill();
    }
  });
}

// Cabezal del torno: metal con anillos y manchas de barro
function texTorno(T) {
  const r = rnd(11);
  return canvasTex(T, 1024, 1024, (x, w) => {
    const c = w / 2;
    const g = x.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0, "#c9ced3");
    g.addColorStop(1, "#9aa1a8");
    x.fillStyle = g;
    x.fillRect(0, 0, w, w);
    for (let i = 0; i < 160; i++) {
      x.strokeStyle = `rgba(255,255,255,${r() * 0.12})`;
      x.lineWidth = 0.6 + r() * 1.4;
      x.beginPath();
      x.arc(c, c, r() * c, 0, Math.PI * 2);
      x.stroke();
    }
    for (let i = 0; i < 26; i++) {
      x.strokeStyle = `rgba(${120 + r() * 40},${70 + r() * 25},${45 + r() * 20},${0.25 + r() * 0.4})`;
      x.lineWidth = 3 + r() * 22;
      const rad = c * (0.25 + r() * 0.72), a0 = r() * Math.PI * 2;
      x.beginPath();
      x.arc(c, c, rad, a0, a0 + 0.4 + r() * 2.2);
      x.stroke();
    }
    x.fillStyle = "#6f7378";
    x.beginPath();
    x.arc(c, c, 14, 0, Math.PI * 2);
    x.fill();
  });
}

function armarPedestal(T, tipo) {
  const g = new T.Group();
  if (tipo === "torno") {
    // bandeja (splash pan) + columna + cabezal metálico
    const pan = new T.LatheGeometry(
      [[0, 0.02], [1.2, 0.02], [1.27, 0.07], [1.29, 0.42], [1.24, 0.44], [1.19, 0.16], [0.3, 0.14], [0, 0.14]].map(([a, b]) => new T.Vector2(a, b)),
      96
    );
    const plastico = new T.MeshStandardMaterial({ color: "#57514c", roughness: 0.5, metalness: 0.05 });
    const mPan = new T.Mesh(pan, plastico);
    const col = new T.Mesh(new T.CylinderGeometry(0.2, 0.24, ALTO - 0.12, 32), plastico);
    col.position.y = (ALTO - 0.12) / 2;
    const tex = texTorno(T);
    const metalLado = new T.MeshStandardMaterial({ color: "#9ea5ab", metalness: 0.85, roughness: 0.3 });
    const metalTapa = new T.MeshStandardMaterial({ map: tex, metalness: 0.7, roughness: 0.38 });
    const cab = new T.Mesh(new T.CylinderGeometry(1, 0.97, 0.12, 96), [metalLado, metalTapa, metalLado]);
    cab.position.y = ALTO - 0.06;
    for (const m of [mPan, col, cab]) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
    g.userData.velocidad = 0.9;
    g.userData.radioMax = 1.29;
  } else {
    // travertino con bisel suave
    const pts = [[0, 0], [0.985, 0], [1, 0.015], [1, ALTO - 0.05], [0.99, ALTO - 0.012], [0.955, ALTO], [0, ALTO]].map(([a, b]) => new T.Vector2(a, b));
    const geo = new T.LatheGeometry(pts, 128);
    const tex = texTravertino(T);
    tex.wrapS = T.RepeatWrapping;
    const mat = new T.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 0.35, roughness: 0.78, metalness: 0 });
    const m = new T.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    g.userData.velocidad = 0.12;
    g.userData.radioMax = 1;
  }
  return g;
}

// ---------- Shaders de la pieza ----------
const VS = `varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// Mismo efecto 2.5D que antes: parallax por profundidad + brillo de esmalte + sombreado.
// `lado` = -1 cuando el plano está espejado (después de medio giro) para que la luz y el parallax no se inviertan.
// `glow` = boost cálido pulsante en las zonas muy brillantes (las luces del pino).
const FS_PIEZA = `varying vec2 vUv;
uniform sampler2D img; uniform sampler2D dep;
uniform vec2 tilt; uniform float px; uniform float fuerza; uniform float glow; uniform float lado;
void main(){
  float d = texture2D(dep, vUv).r;
  vec2 off = vec2(tilt.x * lado, tilt.y) * (d - 0.3) * vec2(0.032, -0.014) * fuerza;
  vec2 u = clamp(vUv - off, 0.0, 1.0);
  vec4 c = texture2D(img, u);
  if (c.a < 0.004) discard;
  float dl = texture2D(dep, u - vec2(px, 0.0)).r;
  float dr = texture2D(dep, u + vec2(px, 0.0)).r;
  vec3 n = normalize(vec3((dl - dr) * 7.0 * lado, 0.0, 0.55));
  vec3 L = normalize(vec3(-0.35 + tilt.x * 0.9, 0.2, 0.9));
  float spec = pow(max(dot(n, L), 0.0), 30.0) * 0.30;
  float shade = mix(0.86, 1.04, max(dot(n, normalize(vec3(-0.4 + tilt.x * 0.5, 0.0, 1.0))), 0.0));
  vec3 col = c.rgb * shade + spec;
  float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
  col += vec3(1.0, 0.62, 0.26) * smoothstep(0.6, 0.95, lum) * glow * 0.6;
  gl_FragColor = vec4(col, c.a);
}`;

// Halo cálido alrededor de la silueta (reemplaza al drop-shadow animado del CSS):
// la silueta borrosa sale de los mipmaps del mapa de profundidad.
const FS_HALO = `varying vec2 vUv;
uniform sampler2D dep; uniform float glow;
void main(){
  vec2 u = vec2((vUv.x - ${MX.toFixed(3)}) / ${(1 - 2 * MX).toFixed(3)}, vUv.y / ${(1 - MY).toFixed(3)});
  vec2 q = clamp(u, 0.0, 1.0);
  float s = textureLod(dep, q, 3.0).r * 0.5 + textureLod(dep, q, 4.6).r * 0.5;
  s *= exp(-length(u - q) * 9.0);
  float a = smoothstep(0.0, 0.45, s) * glow;
  gl_FragColor = vec4(1.0, 0.68, 0.32, a * 0.8);
}`;

export default function Escena3D(props) {
  const ref = useRef(null);
  const pr = useRef(props);
  pr.current = props;
  const motor = useRef(null);

  useEffect(() => {
    let vivo = true;
    let cleanup = () => {};
    (async () => {
      let T;
      try {
        T = await import("three");
      } catch {
        return pr.current.onFalla?.();
      }
      const canvas = ref.current;
      if (!vivo || !canvas) return;
      let renderer;
      try {
        renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
      } catch {
        return pr.current.onFalla?.();
      }

      const tactil = window.matchMedia("(pointer: coarse)").matches;
      const mqReducido = window.matchMedia("(prefers-reduced-motion: reduce)");
      const cal = { bajo: false, prMax: tactil ? 1.5 : 2 };

      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = T.PCFShadowMap;
      renderer.shadowMap.autoUpdate = false; // la sombra se recalcula solo cuando algo cambia
      renderer.shadowMap.needsUpdate = true;
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;

      const scene = new T.Scene();
      const cam = new T.PerspectiveCamera(32, 1, 0.1, 100);
      cam.position.set(0, 4.6, 21);
      cam.lookAt(0, 1.8, 0);

      const hemi = new T.HemisphereLight("#fff6ea", "#e6ded2", 1.25);
      scene.add(hemi);
      const sol = new T.DirectionalLight("#fff1dc", 2.6);
      sol.position.set(-7, 9, 7);
      sol.castShadow = true;
      sol.shadow.mapSize.set(2048, 2048);
      Object.assign(sol.shadow.camera, { left: -6, right: 6, top: 6, bottom: -3, near: 1, far: 30 });
      sol.shadow.bias = -0.0004;
      sol.shadow.normalBias = 0.02;
      sol.shadow.radius = 5;
      scene.add(sol);
      // Luz cálida del pino (siempre está en la escena, con intensidad 0 si la pieza no brilla: así no se recompilan shaders)
      const punto = new T.PointLight("#ffae55", 0, 7, 2);
      scene.add(punto);

      // Superficies que solo reciben sombra
      const piso = new T.Mesh(new T.PlaneGeometry(60, 60), new T.ShadowMaterial({ opacity: 0.26 }));
      piso.rotation.x = -Math.PI / 2;
      piso.receiveShadow = true;
      scene.add(piso);
      const fondo = new T.Mesh(new T.PlaneGeometry(60, 30), new T.ShadowMaterial({ opacity: 0.16 }));
      fondo.position.set(0, 15, PARED_Z);
      fondo.receiveShadow = true;
      scene.add(fondo);

      // El torno: gira entero (pedestal + pieza) en cada cambio de pieza
      const torno = new T.Group();
      scene.add(torno);
      const peds = {};
      let ped = null, tipoPed = null;
      const ponerPed = (t) => {
        if (tipoPed === t) return;
        if (ped) torno.remove(ped);
        ped = peds[t] || (peds[t] = armarPedestal(T, t));
        torno.add(ped);
        tipoPed = t;
        st.sombraSucia = true;
      };

      // ---------- La pieza ----------
      const vacio = new T.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
      vacio.needsUpdate = true;
      const vacioDep = new T.DataTexture(new Uint8Array([0]), 1, 1, T.RedFormat, T.UnsignedByteType);
      vacioDep.unpackAlignment = 1;
      vacioDep.needsUpdate = true;
      const uni = {
        img: { value: vacio }, dep: { value: vacioDep }, tilt: { value: new T.Vector2() },
        px: { value: 0.005 }, fuerza: { value: 1 }, glow: { value: 0 }, lado: { value: 1 },
      };
      const geo = new T.PlaneGeometry(1, 1);
      geo.translate(0, 0.5, 0);
      const pieza = new T.Mesh(geo, new T.ShaderMaterial({
        uniforms: uni, vertexShader: VS, fragmentShader: FS_PIEZA,
        transparent: true, depthWrite: false, side: T.DoubleSide, toneMapped: false,
      }));
      pieza.renderOrder = 10;
      pieza.castShadow = true; // la sombra real de la pieza, recortada por su transparencia
      const matSombra = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking, alphaTest: 0.5, map: vacio, side: T.DoubleSide });
      pieza.customDepthMaterial = matSombra;

      const uniHalo = { dep: uni.dep, glow: { value: 0 } };
      const geoHalo = new T.PlaneGeometry(1 / (1 - 2 * MX), 1 / (1 - MY));
      geoHalo.translate(0, 0.5 / (1 - MY), 0);
      const halo = new T.Mesh(geoHalo, new T.ShaderMaterial({
        uniforms: uniHalo, vertexShader: VS, fragmentShader: FS_HALO,
        transparent: true, depthWrite: false, side: T.DoubleSide, toneMapped: false,
      }));
      halo.renderOrder = 9;
      halo.visible = false;

      const grupo = new T.Group();
      grupo.add(halo, pieza);
      grupo.visible = false;
      torno.add(grupo);

      const st = {
        p: 0, dest: -1, actual: pr.current.actual ?? 0, base: 0, tMov: 0, spin: 0,
        escala: 1, escalaObj: 1, escalaIni: false, ppuX: 1, ppuY: 1, W: 0, H: 0,
        last: 0, ema: 16.7, muestras: 0, modo: 0, clave: "", glow: false, sombraSucia: true,
        pausado: !!pr.current.pausado, oculto: document.hidden, tiltX: 0, tiltY: 0, raf: 0, mostrado: null,
      };

      // ---------- Texturas en memoria (por URL): la actual, la siguiente y la anterior ----------
      const cache = new Map();
      const liberar = (e) => {
        e.tex?.image?.close?.();
        e.tex?.dispose();
        e.dep?.dispose();
      };
      // Subir a la GPU: ya mismo si la pieza se necesita ahora; si es una vecina, cuando el navegador está libre
      // (siempre antes de que entre en pantalla: si el gesto llega antes, se sube en ese momento).
      const idle = window.requestIdleCallback || ((f) => setTimeout(f, 60));
      const subir = (e) => {
        if (e.listo || !e.tex) return;
        renderer.initTexture(e.tex);
        renderer.initTexture(e.dep);
        e.listo = true;
        pedirCuadro();
      };
      const cargar = (pz) => {
        if (!pz?.src) return null;
        let e = cache.get(pz.src);
        if (e) return e;
        e = { listo: false, error: false };
        cache.set(pz.src, e);
        (async () => {
          // decodificada fuera del hilo principal (worker) o con img.decode()
          const foto = await prepararFoto(pz.src, pz.grande);
          const pd = await foto.prof;
          if (!vivo || cache.get(pz.src) !== e) return foto.bmp.close?.();
          const tex = new T.Texture(foto.bmp);
          tex.flipY = foto.flipY;
          tex.colorSpace = T.NoColorSpace;
          tex.premultiplyAlpha = false;
          tex.minFilter = T.LinearMipmapLinearFilter;
          tex.magFilter = T.LinearFilter;
          tex.anisotropy = 4;
          tex.needsUpdate = true;
          const dep = new T.DataTexture(pd.data, pd.w, pd.h, T.RedFormat, T.UnsignedByteType);
          dep.unpackAlignment = 1;
          dep.minFilter = T.LinearMipmapLinearFilter;
          dep.magFilter = T.LinearFilter;
          dep.generateMipmaps = true;
          dep.needsUpdate = true;
          Object.assign(e, { tex, dep, px: 1.5 / pd.w, ratio: foto.ratio || 1 });
          if (pz.src === st.quiere) subir(e);
          else idle(() => vivo && cache.get(pz.src) === e && subir(e), { timeout: 700 });
        })().catch((err) => {
          console.warn("Escena3D:", err);
          e.error = true;
        });
        return e;
      };
      const precargar = () => {
        const piezas = pr.current.piezas || [];
        const n = piezas.length;
        if (!n) return;
        const a = Math.min(st.actual, n - 1);
        const idx = new Set([a, (a + 1) % n, (a - 1 + n) % n]);
        if (st.dest >= 0 && st.dest < n) idx.add(st.dest);
        for (const i of idx) cargar(piezas[i]);
        if (cache.size > 5) {
          const cerca = new Set([...idx, (a + 2) % n, (a - 2 + n) % n].map((i) => piezas[i]?.src));
          for (const [src, e] of cache) {
            if (cerca.has(src) || src === st.mostrado || !e.listo) continue;
            liberar(e);
            cache.delete(src);
          }
        }
      };

      // ---------- Medidas: tamaño del canvas, píxeles por unidad a la altura del pedestal ----------
      const v3 = new T.Vector3();
      const medir = () => {
        const W = canvas.clientWidth, H = canvas.clientHeight;
        if (!W || !H) return;
        st.W = W;
        st.H = H;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cal.bajo ? 1.25 : cal.prMax));
        renderer.setSize(W, H, false);
        cam.aspect = W / H;
        cam.updateProjectionMatrix();
        cam.updateMatrixWorld();
        const px = (x, y, z) => ((v3.set(x, y, z).project(cam).x + 1) / 2) * W;
        const py = (x, y, z) => ((1 - v3.set(x, y, z).project(cam).y) / 2) * H;
        st.ppuX = px(1, ALTO, 0) - px(0, ALTO, 0);
        st.ppuY = py(0, ALTO, 0) - py(0, ALTO + 1, 0);
        const parent = canvas.closest(".tienda, .adm-escena") || canvas.parentElement;
        parent?.style.setProperty("--apoyo", py(0, ALTO, 0).toFixed(1) + "px");
        parent?.style.setProperty("--horizonte", py(0, 0, PARED_Z).toFixed(1) + "px");
        st.clave = "";
        st.sombraSucia = true;
        st.tMov = performance.now();
        pedirCuadro();
      };

      const bajarCalidad = () => {
        if (cal.bajo) return;
        cal.bajo = true;
        sol.shadow.mapSize.set(1024, 1024);
        sol.shadow.map?.dispose();
        sol.shadow.map = null;
        medir();
      };

      // ---------- Qué pieza se ve y cómo (se revisa en cada cuadro; solo trabaja si algo cambió) ----------
      const revisar = () => {
        const { piezas = [], vista, pedMin = 120, actual = 0 } = pr.current;
        const n = piezas.length;
        if (st.p === 0 && actual !== st.actual && actual < n) {
          st.actual = actual;
          precargar();
        }
        const lejos = Math.abs(st.p) >= 0.5 && st.dest >= 0 && st.dest < n;
        const i = lejos ? st.dest : Math.min(st.actual, Math.max(0, n - 1));
        const pz = piezas[i];
        // del otro lado del giro el plano está espejado: se compensa con escala negativa
        const sgn = Math.cos(st.base + (lejos ? Math.sign(st.p) * Math.PI : 0)) >= 0 ? 1 : -1;
        const e = pz?.src ? cargar(pz) : null;
        st.quiere = pz?.src || null;
        if (e && !e.listo && e.tex) subir(e); // se necesita ahora: no se espera al momento libre
        const VW = vista?.w || st.W, VH = vista?.h || st.H;
        const clave = [pz?.src, e?.listo, e?.error, sgn, pz?.ratio, pz?.cx, pz?.tipo, pz?.mesa, pz?.glow, VW, VH, st.ppuX, pedMin].join("|");
        if (clave === st.clave) return;
        // la foto nueva todavía no llegó: se queda la anterior un ratito
        if (pz?.src && !e.listo && !e.error && st.mostrado) return;
        st.clave = clave;
        ponerPed(pz?.tipo || "travertino");
        hemi.groundColor.set(pz?.mesa || "#e6ded2");
        st.glow = !!pz?.glow;
        const ok = pz?.src && e?.listo;
        const cx = ok ? (pz.cx ?? 0.5) : 0.5;
        const d = medidas(ok ? pz.ratio || e.ratio : 1, cx, VW, VH);
        const anchoPx = anchoPed(d.width, cx, pedMin);
        const tope = (st.W * 0.42) / ((ped.userData.radioMax || 1) * st.ppuX);
        st.escalaObj = Math.max(0.3, Math.min(anchoPx / 2 / st.ppuX, tope));
        if (!st.escalaIni) {
          st.escala = st.escalaObj;
          st.escalaIni = true;
        }
        st.sombraSucia = true;
        if (!ok) {
          grupo.visible = false;
          st.mostrado = null;
          return;
        }
        const wU = d.width / st.ppuX, hU = d.height / st.ppuY;
        grupo.scale.set(wU * sgn, hU, 1);
        grupo.position.set((d.shift / st.ppuX) * sgn, ALTO, 0);
        uni.img.value = e.tex;
        uni.dep.value = e.dep;
        uni.px.value = e.px;
        uni.lado.value = sgn;
        matSombra.map = e.tex;
        halo.visible = st.glow;
        punto.position.set(0, ALTO + hU * 0.45, 0.8);
        grupo.visible = true;
        st.mostrado = pz.src;
      };

      // ---------- Bucle: 60 fps con gesto o giro, 30 en reposo, nada si está pausado ----------
      const t0 = performance.now();
      const pedirCuadro = () => {
        if (!st.raf && !st.pausado && !st.oculto && vivo) st.raf = requestAnimationFrame(cuadro);
      };
      const cuadro = (now) => {
        st.raf = 0;
        if (st.pausado || st.oculto || !vivo) return;
        st.raf = requestAnimationFrame(cuadro);
        const activo = st.p !== 0 || now - st.tMov < 500 || now - input.t < 1000 || Math.abs(st.escalaObj - st.escala) > 0.002;
        const fps = cal.bajo || !activo ? 30 : 60;
        if (fps !== st.modo) {
          st.modo = fps;
          st.muestras = 0;
          st.ema = 1000 / fps;
        }
        if (now - st.last < 1000 / fps - 3) return;
        const dt = st.last ? Math.min(100, now - st.last) : 16.7;
        st.last = now;
        // calidad adaptativa: si con 60 fps el cuadro promedio pasa ~20 ms, se baja la calidad
        if (fps === 60) {
          st.ema += (dt - st.ema) * 0.08;
          if (++st.muestras > 40 && st.ema > 20) bajarCalidad();
        }

        revisar();
        const red = pr.current.reducido || mqReducido.matches;
        const s = (now - t0) / 1000;

        // inclinación: mouse / giroscopio / vaivén
        const quieto = now - input.t > 2500;
        const tx = red ? 0 : quieto ? Math.sin(s * 0.55) * 0.9 : input.x;
        const ty = red ? 0 : quieto ? Math.sin(s * 0.33) * 0.25 : input.y;
        const k = 1 - Math.pow(0.94, dt / 16.67);
        st.tiltX += (tx - st.tiltX) * k;
        st.tiltY += (ty - st.tiltY) * k;
        // durante el giro se exagera el parallax para que se sienta el volumen
        const giro = Math.sin(Math.min(1, Math.abs(st.p)) * Math.PI);
        uni.tilt.value.set(st.tiltX + giro * Math.sign(st.p) * 1.2, st.tiltY);
        uni.fuerza.value = 1 + giro * 0.9;

        torno.rotation.y = st.base + st.p * Math.PI;
        if (!red) st.spin += (dt / 1000) * (ped?.userData.velocidad || 0.12);
        st.escala += (st.escalaObj - st.escala) * (1 - Math.pow(0.88, dt / 25));
        if (ped) {
          ped.rotation.y = st.spin;
          ped.scale.set(st.escala, 1, st.escala);
        }
        const creciendo = Math.abs(st.escalaObj - st.escala) > 0.0015;

        // brillo del pino: halo + boost en el shader + luz cálida, todo pulsando
        const pulso = st.glow ? 0.5 + 0.5 * Math.sin(s * 2.42) : 0;
        uniHalo.glow.value = st.glow ? 0.55 + 0.4 * pulso : 0;
        uni.glow.value = st.glow ? 0.35 + 0.45 * pulso : 0;
        punto.intensity = st.glow ? 1.2 + 1.6 * pulso : 0;

        // la sombra solo se recalcula si cambió la pieza, durante el giro o si cambió el tamaño
        // (el pedestal es de revolución: su giro lento no cambia la sombra)
        if (st.sombraSucia || st.p !== 0 || creciendo) {
          renderer.shadowMap.needsUpdate = true;
          st.sombraSucia = false;
        }
        renderer.render(scene, cam);
      };

      // ---------- API para el gesto ----------
      const api = {
        progreso(p, dest) {
          st.p = Math.max(-1, Math.min(1, p || 0));
          if (dest !== st.dest) {
            st.dest = dest;
            precargar();
          }
          st.tMov = performance.now();
          pedirCuadro();
        },
        confirmar(dest, signo) {
          st.base = (st.base + (signo < 0 ? -1 : 1) * Math.PI) % (Math.PI * 2);
          st.actual = dest;
          st.p = 0;
          st.dest = -1;
          st.tMov = performance.now();
          precargar();
          pedirCuadro();
        },
      };

      const visibilidad = () => {
        st.oculto = document.hidden;
        if (!st.oculto) {
          st.last = 0;
          pedirCuadro();
        }
      };
      const perdido = (ev) => {
        ev.preventDefault();
        pr.current.onFalla?.();
      };
      document.addEventListener("visibilitychange", visibilidad);
      canvas.addEventListener("webglcontextlost", perdido);

      motor.current = {
        pausar(v) {
          st.pausado = v;
          if (v) {
            cancelAnimationFrame(st.raf);
            st.raf = 0;
          } else {
            st.last = 0;
            pedirCuadro();
          }
        },
        precargar,
      };
      if (pr.current.control) pr.current.control.current = api;

      escuchar();
      medir();
      const ro = new ResizeObserver(medir);
      ro.observe(canvas);
      precargar();
      pedirCuadro();
      // si alguna pieza usa el otro pedestal, se arma cuando el navegador está libre (no en medio de un giro)
      idle(() => {
        if (!vivo) return;
        for (const t of new Set((pr.current.piezas || []).map((x) => x.tipo || "travertino"))) if (!peds[t]) peds[t] = armarPedestal(T, t);
      }, { timeout: 4000 });

      cleanup = () => {
        cancelAnimationFrame(st.raf);
        ro.disconnect();
        document.removeEventListener("visibilitychange", visibilidad);
        canvas.removeEventListener("webglcontextlost", perdido);
        for (const e of cache.values()) liberar(e);
        cache.clear();
        if (pr.current.control?.current === api) pr.current.control.current = null;
        renderer.dispose();
        renderer.forceContextLoss?.();
      };
    })();
    return () => {
      vivo = false;
      cleanup();
      motor.current = null;
    };
  }, []);

  useEffect(() => { motor.current?.pausar(!!props.pausado); }, [props.pausado]);
  useEffect(() => { motor.current?.precargar(); }, [props.piezas, props.actual]);

  return (
    <div className="escena3d" aria-hidden>
      <canvas ref={ref} />
    </div>
  );
}
