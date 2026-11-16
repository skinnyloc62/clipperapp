"use client";

import { useEffect, useRef } from "react";

/* ─────────────────────────────────────────────────────────────
   SpaceBackdrop — one fixed canvas behind the entire app.

   Real geometry, not a looping GIF: every solid is built from
   3D vertices, rotated on X/Y, perspective-projected, then
   stroked each frame.
     · starfield with depth + twinkle
     · two rotating wireframe solids (icosahedron, octahedron)
     · satellites whose panels swivel in perspective
     · alien craft drifting on curved paths
     · a fire comet with a particle trail

   Design constraints honoured:
     · decorative only — aria-hidden, pointer-events none
     · dim enough that text contrast never suffers
     · prefers-reduced-motion => one static frame, no animation
     · rendering pauses while the tab is hidden
   ───────────────────────────────────────────────────────────── */

type V3 = { x: number; y: number; z: number };
type Star = { x: number; y: number; r: number; a: number; tw: number; ph: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number };

const GOLD = (1 + Math.sqrt(5)) / 2;

function unit(v: V3[]): V3[] {
  return v.map((p) => {
    const m = Math.hypot(p.x, p.y, p.z) || 1;
    return { x: p.x / m, y: p.y / m, z: p.z / m };
  });
}

function edgesOf(verts: V3[], maxDist: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < verts.length; i++) {
    for (let j = i + 1; j < verts.length; j++) {
      const a = verts[i];
      const b = verts[j];
      if (Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) <= maxDist) out.push([i, j]);
    }
  }
  return out;
}

const ICO = unit([
  { x: -1, y: GOLD, z: 0 }, { x: 1, y: GOLD, z: 0 },
  { x: -1, y: -GOLD, z: 0 }, { x: 1, y: -GOLD, z: 0 },
  { x: 0, y: -1, z: GOLD }, { x: 0, y: 1, z: GOLD },
  { x: 0, y: -1, z: -GOLD }, { x: 0, y: 1, z: -GOLD },
  { x: GOLD, y: 0, z: -1 }, { x: GOLD, y: 0, z: 1 },
  { x: -GOLD, y: 0, z: -1 }, { x: -GOLD, y: 0, z: 1 },
]);
const ICO_E = edgesOf(ICO, 1.11);

const OCT = unit([
  { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 },
  { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 },
]);
const OCT_E = edgesOf(OCT, 1.45);

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export default function SpaceBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const el = canvas;
    const c2d = ctx;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = window.innerWidth;
    let H = window.innerHeight;
    let stars: Star[] = [];
    const particles: Particle[] = [];
    let raf = 0;
    let last = 0;
    let t = 0;
    const comet = { on: false, x: 0, y: 0, vx: 0, vy: 0, wait: 900, age: 0 };

    function buildStars() {
      const count = Math.round(Math.min(240, Math.max(80, (W * H) / 7800)));
      stars = Array.from({ length: count }, () => {
        const near = Math.random() > 0.88;
        return {
          x: Math.random(),
          y: Math.random(),
          r: near ? rand(1.05, 1.7) : rand(0.3, 0.85),
          a: near ? rand(0.55, 0.95) : rand(0.24, 0.72),
          tw: rand(0.35, 1.7),
          ph: rand(0, Math.PI * 2),
        };
      });
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      el.width = Math.max(1, Math.floor(W * dpr));
      el.height = Math.max(1, Math.floor(H * dpr));
      el.style.width = W + "px";
      el.style.height = H + "px";
      c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildStars();
      if (reduce) frame(0, true);
    }

    // Rotate on Y then X, then perspective-project. Returns screen space.
    function project(p: V3, cx: number, cy: number, rad: number, ax: number, ay: number) {
      const cy1 = Math.cos(ay);
      const sy1 = Math.sin(ay);
      const cx1 = Math.cos(ax);
      const sx1 = Math.sin(ax);
      const x = p.x * cy1 + p.z * sy1;
      const z1 = -p.x * sy1 + p.z * cy1;
      const y = p.y * cx1 - z1 * sx1;
      const z2 = p.y * sx1 + z1 * cx1;
      const d = rad * 3.2;
      const k = d / Math.max(d - z2 * rad, rad * 0.4);
      return { x: cx + x * rad * k, y: cy + y * rad * k, nz: z2, k };
    }

    function drawSolid(
      verts: V3[],
      edges: [number, number][],
      cx: number,
      cy: number,
      rad: number,
      ax: number,
      ay: number,
      stroke: string,
      lw: number,
    ) {
      const pts = verts.map((v) => project(v, cx, cy, rad, ax, ay));
      c2d.lineWidth = lw;
      c2d.lineCap = "round";
      for (const [i, j] of edges) {
        const a = pts[i];
        const b = pts[j];
        // Front-facing edges read brighter — cheap depth cue.
        const depth = (a.nz + b.nz) / 2;
        c2d.globalAlpha = 0.55 + depth * 0.45;
        c2d.strokeStyle = stroke;
        c2d.beginPath();
        c2d.moveTo(a.x, a.y);
        c2d.lineTo(b.x, b.y);
        c2d.stroke();
      }
      c2d.globalAlpha = 1;
      for (const p of pts) {
        if (p.nz < -0.15) continue;
        c2d.fillStyle = stroke;
        c2d.beginPath();
        c2d.arc(p.x, p.y, 1.1, 0, Math.PI * 2);
        c2d.fill();
      }
    }

    function drawStars(now: number) {
      for (const s of stars) {
        const tw = 0.62 + 0.38 * Math.sin(now * 0.0011 * s.tw + s.ph);
        const x = s.x * W;
        const y = s.y * H;
        if (s.r > 1.0) {
          const g = c2d.createRadialGradient(x, y, 0, x, y, s.r * 5.5);
          g.addColorStop(0, "rgba(176,198,255,0.42)");
          g.addColorStop(1, "rgba(110,140,255,0)");
          c2d.globalAlpha = s.a * tw;
          c2d.fillStyle = g;
          c2d.beginPath();
          c2d.arc(x, y, s.r * 5.5, 0, Math.PI * 2);
          c2d.fill();
          c2d.globalAlpha = s.a * tw * 0.95;
          c2d.fillStyle = "#eaf0ff";
          c2d.beginPath();
          c2d.arc(x, y, s.r * 0.72, 0, Math.PI * 2);
          c2d.fill();
        } else {
          c2d.globalAlpha = s.a * tw;
          c2d.fillStyle = "#dfe6ff";
          c2d.fillRect(x, y, s.r, s.r);
        }
      }
      c2d.globalAlpha = 1;
    }

    function spawnComet() {
      const dir = Math.random() > 0.45 ? 1 : -1;
      const ang = rand(0.3, 0.58);
      const speed = rand(430, 640);
      comet.on = true;
      comet.age = 0;
      comet.x = dir === 1 ? rand(-0.12, 0.42) * W : rand(0.58, 1.12) * W;
      comet.y = rand(-0.08, 0.4) * H;
      comet.vx = Math.cos(ang) * speed * dir;
      comet.vy = Math.sin(ang) * speed;
    }

    function emit(x: number, y: number, vx: number, vy: number) {
      if (particles.length > 190) return;
      particles.push({
        x: x + rand(-2.2, 2.2),
        y: y + rand(-2.2, 2.2),
        vx: vx * rand(0.04, 0.16) + rand(-38, 38),
        vy: vy * rand(0.04, 0.16) + rand(-38, 38),
        life: rand(0.45, 1.05),
        max: 1.05,
        r: rand(1.2, 3.4),
      });
    }

    function drawComet(dt: number) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.985;
        p.vy *= 0.985;
        const lr = Math.max(p.life / p.max, 0);
        c2d.globalAlpha = 0.55 * lr;
        c2d.fillStyle =
          "rgb(255," + Math.round(70 + 165 * lr) + "," + Math.round(20 + 90 * lr) + ")";
        c2d.beginPath();
        c2d.arc(p.x, p.y, p.r * (0.35 + lr), 0, Math.PI * 2);
        c2d.fill();
      }

      if (!comet.on) {
        comet.wait -= dt * 1000;
        if (comet.wait <= 0) {
          spawnComet();
          comet.wait = rand(5200, 11000);
        }
        c2d.globalAlpha = 1;
        return;
      }

      comet.age += dt;
      comet.x += comet.vx * dt;
      comet.y += comet.vy * dt;
      for (let i = 0; i < 3; i++) emit(comet.x, comet.y, -comet.vx * 0.9, -comet.vy * 0.9);

      const head = c2d.createRadialGradient(comet.x, comet.y, 0, comet.x, comet.y, 26);
      head.addColorStop(0, "rgba(255,252,235,0.95)");
      head.addColorStop(0.28, "rgba(255,168,70,0.62)");
      head.addColorStop(1, "rgba(225,6,0,0)");
      c2d.globalAlpha = 1;
      c2d.fillStyle = head;
      c2d.beginPath();
      c2d.arc(comet.x, comet.y, 26, 0, Math.PI * 2);
      c2d.fill();
      c2d.fillStyle = "rgba(255,255,248,0.98)";
      c2d.beginPath();
      c2d.arc(comet.x, comet.y, 2.1, 0, Math.PI * 2);
      c2d.fill();

      if (comet.age > 3.2 || comet.x < -220 || comet.x > W + 220 || comet.y > H + 220) {
        comet.on = false;
      }
      c2d.globalAlpha = 1;
    }

    function drawSat(cx: number, cy: number, s: number, spin: number, bob: number, blink: number) {
      c2d.save();
      c2d.translate(cx, cy + bob);
      c2d.globalAlpha = 0.52;
      const panW = s * 1.5;
      const panH = s * 0.52;
      const gap = s * 0.58;
      const cs = Math.cos(spin);
      const sn = Math.sin(spin);

      for (const side of [-1, 1]) {
        const corners: [number, number][] = [
          [side * gap, -panH / 2],
          [side * (gap + panW), -panH / 2],
          [side * (gap + panW), panH / 2],
          [side * gap, panH / 2],
        ];
        const pts = corners.map(([x, y]) => {
          const rx = x * cs;
          const rz = -x * sn;
          const k = 1600 / (1600 + rz);
          return { x: rx * k, y: y * k };
        });
        c2d.beginPath();
        c2d.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < 4; i++) c2d.lineTo(pts[i].x, pts[i].y);
        c2d.closePath();
        c2d.fillStyle = "rgba(84,118,188,0.12)";
        c2d.fill();
        c2d.strokeStyle = "rgba(128,166,235,0.5)";
        c2d.lineWidth = 0.7;
        c2d.stroke();
        for (let g = 1; g < 3; g++) {
          const f = g / 3;
          const ax = pts[0].x + (pts[1].x - pts[0].x) * f;
          const ay = pts[0].y + (pts[1].y - pts[0].y) * f;
          const bx = pts[3].x + (pts[2].x - pts[3].x) * f;
          const by = pts[3].y + (pts[2].y - pts[3].y) * f;
          c2d.beginPath();
          c2d.moveTo(ax, ay);
          c2d.lineTo(bx, by);
          c2d.strokeStyle = "rgba(128,166,235,0.22)";
          c2d.stroke();
        }
      }

      const bw = s * 0.78;
      const bh = s * 1.0;
      const body = c2d.createLinearGradient(-bw / 2, 0, bw / 2, 0);
      body.addColorStop(0, "rgba(196,210,236,0.55)");
      body.addColorStop(0.55, "rgba(104,118,146,0.6)");
      body.addColorStop(1, "rgba(30,36,50,0.7)");
      c2d.fillStyle = body;
      c2d.fillRect(-bw / 2, -bh / 2, bw, bh);
      c2d.strokeStyle = "rgba(150,180,236,0.5)";
      c2d.lineWidth = 0.7;
      c2d.strokeRect(-bw / 2, -bh / 2, bw, bh);

      c2d.beginPath();
      c2d.moveTo(0, -bh / 2);
      c2d.lineTo(0, -bh / 2 - s * 0.62);
      c2d.strokeStyle = "rgba(150,180,236,0.4)";
      c2d.stroke();

      const pulse = 0.35 + 0.65 * Math.max(0, Math.sin(blink * 1.6));
      c2d.globalAlpha = 0.52 * pulse;
      c2d.fillStyle = "rgba(255,86,70,0.95)";
      c2d.beginPath();
      c2d.arc(0, -bh / 2 - s * 0.64, 1.4, 0, Math.PI * 2);
      c2d.fill();
      c2d.restore();
    }

    function drawShip(x: number, y: number, s: number, tilt: number, dir: number, rgb: string, blink: number) {
      c2d.save();
      c2d.translate(x, y);
      c2d.rotate(tilt);
      c2d.scale(dir, 1);
      c2d.globalAlpha = 0.6;

      const glow = c2d.createRadialGradient(-s * 1.15, 0, 0, -s * 1.15, 0, s * 2);
      glow.addColorStop(0, "rgba(" + rgb + ",0.26)");
      glow.addColorStop(1, "rgba(" + rgb + ",0)");
      c2d.fillStyle = glow;
      c2d.beginPath();
      c2d.arc(-s * 1.15, 0, s * 2, 0, Math.PI * 2);
      c2d.fill();

      c2d.beginPath();
      c2d.ellipse(0, 0, s * 1.18, s * 0.3, 0, 0, Math.PI * 2);
      c2d.fillStyle = "rgba(12,16,26,0.92)";
      c2d.fill();
      c2d.strokeStyle = "rgba(" + rgb + ",0.55)";
      c2d.lineWidth = 0.8;
      c2d.stroke();

      c2d.beginPath();
      c2d.ellipse(0, -s * 0.14, s * 0.42, s * 0.34, 0, Math.PI, Math.PI * 2);
      c2d.fillStyle = "rgba(" + rgb + ",0.16)";
      c2d.fill();
      c2d.stroke();

      for (let i = -1; i <= 1; i++) {
        const a = 0.35 + 0.5 * Math.max(0, Math.sin(blink + i * 1.4));
        c2d.globalAlpha = 0.35 + 0.55 * a;
        c2d.fillStyle = "rgba(" + rgb + ",0.95)";
        c2d.beginPath();
        c2d.arc(i * s * 0.54, s * 0.11, 1.15, 0, Math.PI * 2);
        c2d.fill();
      }
      c2d.restore();
    }

    function drawGlobe(cx: number, cy: number, r: number, ax: number, ay: number) {
      c2d.lineWidth = 0.7;
      c2d.strokeStyle = "rgba(128,158,222,0.34)";
      for (let i = 1; i <= 4; i++) {
        const phi = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = Math.cos(phi);
        const yy = Math.sin(phi);
        c2d.beginPath();
        for (let k = 0; k <= 48; k++) {
          const th = (k / 48) * Math.PI * 2;
          const p = project({ x: Math.cos(th) * rr, y: yy, z: Math.sin(th) * rr }, cx, cy, r, ax, ay);
          if (k === 0) c2d.moveTo(p.x, p.y);
          else c2d.lineTo(p.x, p.y);
        }
        c2d.stroke();
      }
      for (let m = 0; m < 6; m++) {
        const th = (m / 6) * Math.PI;
        c2d.beginPath();
        for (let k = 0; k <= 48; k++) {
          const ph = -Math.PI / 2 + (k / 48) * Math.PI * 2;
          const p = project(
            { x: Math.cos(ph) * Math.cos(th), y: Math.sin(ph), z: Math.cos(ph) * Math.sin(th) },
            cx, cy, r, ax, ay,
          );
          if (k === 0) c2d.moveTo(p.x, p.y);
          else c2d.lineTo(p.x, p.y);
        }
        c2d.stroke();
      }
    }

    function frame(now: number, still = false) {
      const dt = still ? 0 : Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!still) t += dt;
      const time = still ? 6.4 : t;
      c2d.clearRect(0, 0, W, H);
      c2d.globalAlpha = 1;
      drawStars(still ? 980 : now);

      const hull = Math.min(W, H);
      const wide = W >= 720;
      drawGlobe(
        W * (wide ? 0.88 : 1.0),
        H * (wide ? 0.8 : 0.94),
        hull * (wide ? 0.3 : 0.36),
        0.42,
        time * 0.035,
      );
      drawSolid(
        ICO, ICO_E,
        W * (wide ? 0.795 : 0.87), H * (wide ? 0.45 : 0.1),
        hull * (wide ? 0.2 : 0.115),
        time * 0.15, time * 0.21,
        "rgba(150,182,255,0.92)", 0.95,
      );
      drawSolid(
        OCT, OCT_E,
        W * (wide ? 0.14 : 0.1), H * (wide ? 0.76 : 0.93),
        hull * (wide ? 0.1 : 0.062),
        time * 0.2, -time * 0.17,
        "rgba(255,126,110,0.8)", 0.85,
      );

      const a1 = time * 0.075;
      drawSat(
        W * 0.86 + Math.cos(a1) * W * 0.085,
        H * 0.2 + Math.sin(a1) * H * 0.085,
        wide ? 17 : 12, time * 0.4, Math.sin(time * 0.55) * 2.4, time,
      );
      if (wide) {
        const a2 = -time * 0.055 + 2.3;
        drawSat(
          W * 0.17 + Math.cos(a2) * W * 0.1,
          H * 0.66 + Math.sin(a2) * H * 0.06,
          12, -time * 0.3, Math.cos(time * 0.45) * 2, time + 1.4,
        );
      }

      const ships: [number, number, number, number, string, number][] = [
        [0.17, 24, 0.7, 15, "110,205,255", 1],
        [0.34, 15, 2.2, 11, "156,146,255", 1],
        [0.51, 31, 4.1, 13, "96,232,200", -1],
      ];
      for (const [fy, sp, ph, s, rgb, dir] of ships) {
        const travel = time * sp + ph * 260;
        const span = W + 300;
        const x = dir > 0 ? (travel % span) - 150 : W + 150 - (travel % span);
        const y = H * fy + Math.sin(time * 0.5 + ph) * H * 0.028;
        drawShip(x, y, s, Math.sin(time * 0.4 + ph) * 0.14, dir, rgb, time + ph);
      }

      drawComet(dt);
      c2d.globalAlpha = 1;
    }

    function loop(now: number) {
      frame(now);
      raf = requestAnimationFrame(loop);
    }

    function onVisibility() {
      if (document.hidden) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf && !reduce) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    }

    resize();
    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    if (reduce) {
      comet.on = true;
      comet.x = W * 0.3;
      comet.y = H * 0.24;
      frame(0, true);
    } else {
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(58% 42% at 88% 2%, rgba(190,26,12,0.20), transparent 70%)," +
            "radial-gradient(52% 40% at 6% 34%, rgba(58,80,180,0.17), transparent 72%)," +
            "radial-gradient(46% 36% at 74% 92%, rgba(26,120,132,0.10), transparent 72%)," +
            "linear-gradient(180deg, #07070b 0%, #06060a 55%, #050508 100%)",
        }}
      />
      {/* Dimmed on phones: the content column is narrow enough there that
          wireframe edges cut straight through body copy. */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full opacity-[0.62] sm:opacity-100"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(118% 82% at 50% 24%, rgba(5,5,9,0) 0%, rgba(5,5,9,0.26) 58%, rgba(5,5,9,0.66) 100%)",
        }}
      />
    </div>
  );
}
