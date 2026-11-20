/** Lo que incluye el plan Basico (plan GRATIS: 10 usuarios, 5 proyectos). */
export const INCLUYE_PLAN_BASICO = [
  'Hasta 10 personas en tu empresa',
  'Hasta 5 proyectos activos',
  'Mapa de tareas, jornada y cronómetro',
  'Calendario y reportes exportables',
  'Chat del equipo y comentarios de voz',
  'Roles, permisos y zona horaria por persona',
];

/** Lista del plan, cada punto con su visto. */
export default function ListaPlan({ items = INCLUYE_PLAN_BASICO, compacta = false }: { items?: string[]; compacta?: boolean }) {
  return (
    <ul className={`m-0 flex list-none flex-col p-0 ${compacta ? 'gap-2.5' : 'gap-3'}`}>
      {items.map((i) => (
        <li key={i} className={`flex items-start gap-2.5 text-[#d6deef] ${compacta ? 'text-sm' : 'text-[15px]'}`}>
          <svg
            width={compacta ? 16 : 18}
            height={compacta ? 16 : 18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#34d399"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="mt-0.5 flex-none"
          >
            <path d="M5 12l5 5L20 7" />
          </svg>
          {i}
        </li>
      ))}
    </ul>
  );
}
