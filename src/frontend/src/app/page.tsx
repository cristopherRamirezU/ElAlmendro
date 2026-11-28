import type { Metadata } from 'next';
import LandingTimeFlow from '@/components/sitio/landing/LandingTimeFlow';
import AvisoPoliticasSitio from '@/components/sitio/AvisoPoliticasSitio';

export const metadata: Metadata = {
  title: 'TimeFlow · El tiempo de tu equipo, en un mapa',
  description:
    'TimeFlow organiza cada proyecto como un mapa de tareas, registra la jornada y las sesiones de trabajo de cada persona y muestra quién trabajó en qué, cuándo y cuánto. Plan Básico gratis.',
};

/** Página pública de TimeFlow: puente hacia el acceso de clientes y el registro. */
export default function Inicio() {
  return (
    <>
      <LandingTimeFlow />
      {/* Al entrar a la pagina se piden aceptar los terminos y la privacidad. */}
      <AvisoPoliticasSitio />
    </>
  );
}
