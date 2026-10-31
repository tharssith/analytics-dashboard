"use client";

import { useEffect, useRef } from "react";

export function HomeCursorField() {
  const fieldRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const field = fieldRef.current;
    const grid = gridRef.current;
    if (!field) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    if (reduced || !finePointer) return;

    let raf = 0;
    let targetX = window.innerWidth * 0.52;
    let targetY = window.innerHeight * 0.22;
    let x = targetX;
    let y = targetY;
    let trailX = targetX;
    let trailY = targetY;

    const onMove = (event: PointerEvent) => {
      targetX = event.clientX;
      targetY = event.clientY;
    };

    const tick = () => {
      x += (targetX - x) * 0.16;
      y += (targetY - y) * 0.16;
      trailX += (targetX - trailX) * 0.06;
      trailY += (targetY - trailY) * 0.06;

      const speed = Math.min(Math.hypot(targetX - x, targetY - y) / 28, 1);
      const bloom = 170 + speed * 50;

      field.style.setProperty("--spot-x", `${x.toFixed(1)}px`);
      field.style.setProperty("--spot-y", `${y.toFixed(1)}px`);
      field.style.setProperty("--trail-x", `${trailX.toFixed(1)}px`);
      field.style.setProperty("--trail-y", `${trailY.toFixed(1)}px`);
      field.style.setProperty("--bloom", `${bloom.toFixed(0)}px`);

      if (grid) {
        const ox = (x / window.innerWidth - 0.5) * 18;
        const oy = (y / window.innerHeight - 0.5) * 14;
        grid.style.transform = `translate3d(${ox.toFixed(2)}px, ${oy.toFixed(2)}px, 0)`;
      }

      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={fieldRef}
      aria-hidden
      className="home-cursor-field pointer-events-none fixed inset-0 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#08111f,#0b1528_40%,#08111f)]" />
      <div className="home-cursor-spot absolute inset-0" />
      <div className="home-cursor-core absolute inset-0" />
      <div ref={gridRef} className="absolute -inset-8">
        <div className="home-cursor-grid absolute inset-0" />
        <div className="home-cursor-grid-hot absolute inset-0" />
      </div>
    </div>
  );
}
