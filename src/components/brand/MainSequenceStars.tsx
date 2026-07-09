import { useEffect, useRef } from "react";

type StarTuple = [
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  size: number,
  alpha: number,
  glow: number,
];

interface NamedStar {
  name: string;
  x: number;
  y: number;
}

interface HrStarData {
  stars: StarTuple[];
  named?: NamedStar[];
}

interface MainSequenceStarsProps {
  dataUrl?: string;
  showLabels?: boolean;
  anchor?: "center" | "right";
}

// Live HR-diagram renderer copied from the public Main Sequence site.
export function MainSequenceStars({
  dataUrl = "/data/hr-stars.json",
  showLabels = true,
  anchor = "center",
}: MainSequenceStarsProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let stars: Array<{
      x: number;
      y: number;
      r: number;
      gr: number;
      b: number;
      sz: number;
      a: number;
      g: number;
      tp: number;
      ts: number;
    }> = [];
    let named: NamedStar[] = [];
    let raf = 0;
    let disposed = false;

    let W = 0;
    let H = 0;
    let dpr = 1;
    const pointer = { x: -1e5, y: -1e5, active: false };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(W * dpr));
      canvas.height = Math.max(1, Math.round(H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const project = (nx: number, ny: number) => {
      let plotW;
      let plotH;
      let ox;
      let oy;
      if (anchor === "right") {
        plotW = Math.min(W * 0.72, H * 1.22);
        plotH = Math.min(H * 0.94, plotW * 0.96);
        ox = W - plotW - W * 0.005;
        oy = (H - plotH) / 2;
      } else {
        plotW = Math.min(W * 0.86, H * 1.18);
        plotH = Math.min(H * 0.72, plotW * 0.82);
        ox = (W - plotW) / 2;
        oy = H * 0.01;
      }
      return [ox + nx * plotW, oy + (1 - ny) * plotH];
    };

    const draw = (time: number) => {
      ctx.clearRect(0, 0, W, H);
      const R = 95;
      for (let i = 0; i < stars.length; i += 1) {
        const s = stars[i];
        const [x, y] = project(s.x, s.y);
        const tw = 0.74 + 0.26 * Math.sin(time * 0.001 * s.ts + s.tp);
        const base = Math.min(1, s.a * 1.25 + 0.08);
        let a = base * tw;
        if (pointer.active) {
          const d = Math.hypot(x - pointer.x, y - pointer.y);
          if (d < R) a = Math.min(1, a + (1 - d / R) * 0.5);
        }
        const sz = Math.max(0.95, s.sz);
        if (s.g) {
          const g = ctx.createRadialGradient(x, y, 0, x, y, sz * 4.5);
          g.addColorStop(0, `rgba(${s.r},${s.gr},${s.b},${a * 0.85})`);
          g.addColorStop(1, `rgba(${s.r},${s.gr},${s.b},0)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, sz * 4.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = `rgba(${s.r},${s.gr},${s.b},${a})`;
        ctx.beginPath();
        ctx.arc(x, y, sz, 0, Math.PI * 2);
        ctx.fill();
      }

      if (showLabels && W >= 720) {
        ctx.save();
        ctx.font = "600 12px ui-sans-serif, system-ui, sans-serif";
        ctx.textBaseline = "middle";
        for (let i = 0; i < named.length; i += 1) {
          const n = named[i];
          const [x, y] = project(n.x, n.y);
          if (y > H * 0.7) continue;
          ctx.shadowBlur = 0;
          ctx.fillStyle = "rgba(233,238,246,0.75)";
          ctx.beginPath();
          ctx.arc(x, y, 1.9, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowColor = "rgba(2,4,9,0.95)";
          ctx.shadowBlur = 6;
          ctx.fillStyle = "rgba(236,240,248,0.92)";
          ctx.fillText(n.name, x + 8, y);
        }
        ctx.restore();
      }
    };

    const loop = (t: number) => {
      if (disposed) return;
      draw(t);
      raf = requestAnimationFrame(loop);
    };

    const reduceMotion =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active = true;
    };
    const onLeave = () => {
      pointer.active = false;
    };

    const ro = new ResizeObserver(() => {
      resize();
      if (reduceMotion) draw(0);
    });

    fetch(dataUrl)
      .then((r) => r.json() as Promise<HrStarData>)
      .then((data) => {
        if (disposed) return;
        stars = data.stars.map((s) => ({
          x: s[0],
          y: s[1],
          r: s[2],
          gr: s[3],
          b: s[4],
          sz: s[5],
          a: s[6],
          g: s[7],
          tp: Math.random() * Math.PI * 2,
          ts: 0.6 + Math.random() * 1.9,
        }));
        named = data.named || [];
        resize();
        ro.observe(canvas);
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseout", onLeave);
        if (reduceMotion) draw(0);
        else raf = requestAnimationFrame(loop);
      })
      .catch(() => {});

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseout", onLeave);
    };
  }, [dataUrl, showLabels, anchor]);

  return (
    <canvas
      ref={canvasRef}
      className="block h-full w-full"
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
