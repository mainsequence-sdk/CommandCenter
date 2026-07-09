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

interface StarData {
  stars: StarTuple[];
}

interface StarMarkProps {
  size?: number;
  count?: number;
  dataUrl?: string;
}

// Miniature, live version of the Main Sequence star band: the same real stars
// as the public-site hero, drawn small and cheap.
export function StarMark({
  size = 44,
  count = 0,
  dataUrl = "/data/hr-main-sequence.json",
}: StarMarkProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const pad = size * 0.06;
    const plot = size - pad * 2;

    let stars: Array<{
      x: number;
      y: number;
      r: number;
      g: number;
      b: number;
      a: number;
      rad: number;
      tp: number;
      ts: number;
    }> = [];
    let raf = 0;
    let visible = true;
    let disposed = false;
    const reduceMotion =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const draw = (time: number) => {
      ctx.clearRect(0, 0, size, size);
      for (let i = 0; i < stars.length; i += 1) {
        const s = stars[i];
        const x = pad + s.x * plot;
        const y = pad + (1 - s.y) * plot;
        const tw = 0.7 + 0.3 * Math.sin(time * 0.001 * s.ts + s.tp);
        const a = Math.min(1, (s.a * 1.2 + 0.14) * tw * 0.68);
        ctx.fillStyle = `rgba(${s.r},${s.g},${s.b},${a})`;
        ctx.beginPath();
        ctx.arc(x, y, s.rad, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = (t: number) => {
      if (disposed || !visible) {
        raf = 0;
        return;
      }
      draw(t);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (!raf && !reduceMotion && !disposed) raf = requestAnimationFrame(loop);
    };

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting;
        if (visible) start();
      },
      { rootMargin: "80px" },
    );

    fetch(dataUrl)
      .then((r) => r.json() as Promise<StarData>)
      .then((data) => {
        if (disposed) return;
        const all = data.stars;
        const stride = count && count < all.length ? Math.max(1, Math.floor(all.length / count)) : 1;
        const dotR = Math.max(0.4, size / 100);
        for (let i = 0; i < all.length; i += stride) {
          const s = all[i];
          stars.push({
            x: s[0],
            y: s[1],
            r: s[2],
            g: s[3],
            b: s[4],
            a: s[6],
            rad: dotR,
            tp: Math.random() * Math.PI * 2,
            ts: 0.6 + Math.random() * 1.9,
          });
        }
        io.observe(canvas);
        if (reduceMotion) draw(0);
        else start();
      })
      .catch(() => {});

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [size, count, dataUrl]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ width: `${size}px`, height: `${size}px`, display: "block" }}
    />
  );
}
