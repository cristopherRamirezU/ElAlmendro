'use client';

import { useEffect, useRef } from 'react';

/**
 * Fondo B — Aurora Fluida + Grilla Técnica de Tiempo:
 * 3 velos orgánicos suaves en tonos de marca sobre #040814 más una micro-grilla
 * HiDPI en Canvas 2D con crucetas celestes reactivas al puntero.
 */
export default function FondoAuroraGrilla() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let vw = window.innerWidth;
    let vh = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let rafId = 0;

    const pointer = {
      x: vw * 0.5,
      y: vh * 0.32,
      tx: vw * 0.5,
      ty: vh * 0.32,
    };

    const alMover = (e: PointerEvent) => {
      pointer.tx = e.clientX;
      pointer.ty = e.clientY;
    };

    const redimensionar = () => {
      vw = window.innerWidth;
      vh = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(vw * dpr);
      canvas.height = Math.floor(vh * dpr);
      canvas.style.width = `${vw}px`;
      canvas.style.height = `${vh}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dibujarCuadro(performance.now() / 1000);
    };

    const dibujarCuadro = (tiempoSeg: number) => {
      ctx.clearRect(0, 0, vw, vh);
      pointer.x += (pointer.tx - pointer.x) * 0.08;
      pointer.y += (pointer.ty - pointer.y) * 0.08;

      const paso = 44;
      const desplazamiento = motionQuery.matches ? 0 : (tiempoSeg * 7) % paso;

      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(148, 163, 196, 0.055)';

      ctx.beginPath();
      for (let x = -paso + desplazamiento; x < vw + paso; x += paso) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, vh);
      }
      for (let y = 0; y < vh + paso; y += paso) {
        ctx.moveTo(0, y);
        ctx.lineTo(vw, y);
      }
      ctx.stroke();

      // Crucetas técnicas que se iluminan suavemente cerca del puntero
      const radioHalo = 200;
      for (let x = -paso + desplazamiento; x < vw + paso; x += paso) {
        for (let y = 0; y < vh + paso; y += paso) {
          const dist = Math.hypot(x - pointer.x, y - pointer.y);
          if (dist < radioHalo) {
            const alfa = (1 - dist / radioHalo) * 0.52;
            ctx.strokeStyle = `rgba(56, 189, 248, ${alfa.toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(x - 4, y);
            ctx.lineTo(x + 4, y);
            ctx.moveTo(x, y - 4);
            ctx.lineTo(x, y + 4);
            ctx.stroke();
          }
        }
      }
    };

    const detenerBucle = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };

    const animar = (ts: number) => {
      if (document.hidden || motionQuery.matches) {
        detenerBucle();
        return;
      }
      dibujarCuadro(ts / 1000);
      rafId = requestAnimationFrame(animar);
    };

    const reiniciar = () => {
      detenerBucle();
      dibujarCuadro(performance.now() / 1000);
      if (!motionQuery.matches && !document.hidden) {
        rafId = requestAnimationFrame(animar);
      }
    };

    const alVisibilidad = () => {
      if (document.hidden) detenerBucle();
      else reiniciar();
    };

    window.addEventListener('pointermove', alMover, { passive: true });
    window.addEventListener('resize', redimensionar);
    document.addEventListener('visibilitychange', alVisibilidad);
    motionQuery.addEventListener?.('change', reiniciar);

    redimensionar();
    reiniciar();

    return () => {
      detenerBucle();
      window.removeEventListener('pointermove', alMover);
      window.removeEventListener('resize', redimensionar);
      document.removeEventListener('visibilitychange', alVisibilidad);
      motionQuery.removeEventListener?.('change', reiniciar);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#040814]">
      {/* Velos orgánicos de aurora (clases reales de globals.css) */}
      <div
        className="tf-velo-a absolute -left-[10%] -top-[18%] h-[54vw] max-h-[760px] w-[54vw] max-w-[760px] rounded-full opacity-[0.28] blur-[96px]"
        style={{ background: 'radial-gradient(circle, rgba(56, 189, 248, 0.72), transparent 68%)' }}
      />
      <div
        className="tf-velo-b absolute -right-[10%] top-[6%] h-[48vw] max-h-[680px] w-[48vw] max-w-[680px] rounded-full opacity-[0.26] blur-[96px]"
        style={{ background: 'radial-gradient(circle, rgba(99, 102, 241, 0.65), transparent 68%)' }}
      />
      <div
        className="tf-velo-c absolute -bottom-[14%] left-[26%] h-[42vw] max-h-[580px] w-[42vw] max-w-[580px] rounded-full opacity-[0.20] blur-[96px]"
        style={{ background: 'radial-gradient(circle, rgba(52, 211, 153, 0.42), transparent 70%)' }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
