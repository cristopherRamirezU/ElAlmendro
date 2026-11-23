'use client';

import { colorConAlfa } from '@/lib/color';
import { useTemaFondo } from '@/lib/tema';

/**
 * Fondo ambiental sutil y arquitectonico para toda la app (sin estrellas ni
 * constelaciones): velos sedosos en deriva lenta tenidos suavemente con el
 * color de marca de la organizacion, respetando temas oscuros y claros.
 */
export default function FondoAmbiental({ colorPrimario }: { colorPrimario: string }) {
  const tema = useTemaFondo();
  const esClaro = tema === 'claro-nube';

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none">
      {/* Velo superior izquierdo: tinte suave de marca */}
      <div
        className="tf-velo-a absolute -left-[12%] -top-[18%] h-[36rem] w-[36rem] rounded-full blur-[110px]"
        style={{
          background: `radial-gradient(circle, ${colorConAlfa(colorPrimario, esClaro ? 0.16 : 0.14)}, transparent 70%)`,
        }}
      />

      {/* Velo derecho: acento cian/indigo tenue */}
      <div
        className="tf-velo-b absolute -right-[10%] top-[8%] h-[32rem] w-[32rem] rounded-full blur-[120px]"
        style={{
          background: esClaro
            ? 'radial-gradient(circle, rgba(56, 189, 248, 0.18), transparent 70%)'
            : 'radial-gradient(circle, rgba(56, 189, 248, 0.11), transparent 70%)',
        }}
      />

      {/* Velo inferior central: profundidad serena */}
      <div
        className="tf-velo-c absolute -bottom-[22%] left-[28%] h-[30rem] w-[38rem] rounded-full blur-[120px]"
        style={{
          background: esClaro
            ? 'radial-gradient(circle, rgba(99, 102, 241, 0.12), transparent 70%)'
            : 'radial-gradient(circle, rgba(139, 92, 246, 0.09), transparent 70%)',
        }}
      />

      {/* Trama arquitectonica minima */}
      <div
        className="absolute inset-0"
        style={{
          opacity: esClaro ? 0.35 : 0.22,
          backgroundImage: esClaro
            ? 'radial-gradient(rgba(15, 23, 42, 0.07) 1px, transparent 1px)'
            : 'radial-gradient(rgba(148, 163, 184, 0.12) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 35%, #000 30%, transparent 100%)',
          maskImage: 'radial-gradient(ellipse 80% 70% at 50% 35%, #000 30%, transparent 100%)',
        }}
      />
    </div>
  );
}
