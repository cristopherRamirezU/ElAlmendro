import Link from 'next/link';
import { fuenteTitulo } from '@/lib/fuentes';

/** Isotipo de TimeFlow: cuatro nodos unidos, como el mapa de tareas. */
export function Isotipo({ tamano = 34 }: { tamano?: number }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 64 64" aria-hidden="true">
      <path
        d="M22 18 L36 34 M36 34 L48 24 M36 34 L22 46"
        stroke="#5aa9ff"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="20" cy="16" r="9" fill="#34d399" />
      <circle cx="49" cy="22" r="8" fill="#fbbf24" />
      <circle cx="36" cy="35" r="11" fill="#38bdf8" />
      <circle cx="21" cy="47" r="8" fill="#a78bfa" />
      <circle cx="21" cy="47" r="4" fill="#ddd6fe" />
    </svg>
  );
}

/** Nombre de la marca con "Flow" en celeste. */
export function NombreMarca({ className = '' }: { className?: string }) {
  return (
    <span className={`${fuenteTitulo.className} font-bold tracking-[-0.01em] ${className}`}>
      Time<span className="text-[#38bdf8]">Flow</span>
    </span>
  );
}

/** Logo completo que vuelve al inicio del sitio. */
export default function MarcaTimeFlow() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-[#f1f5ff] no-underline" aria-label="TimeFlow, inicio">
      <Isotipo />
      <NombreMarca className="text-[21px]" />
    </Link>
  );
}
