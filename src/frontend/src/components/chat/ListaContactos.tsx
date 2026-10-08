'use client';

import { useMemo, useState } from 'react';
import { ContactoChat, ResumenMensaje } from '@/lib/api';
import { CANAL_GENERAL } from '@/lib/chat';
import { hora, iniciales } from '@/lib/formato';
import { colorConAlfa, useColorPrimario } from '@/lib/color';

const ROL_TEXTO: Record<string, string> = {
  ADMINISTRADOR: 'Administrador',
  SUPERVISOR: 'Supervisor',
  TRABAJADOR: 'Trabajador',
};

/**
 * Columna izquierda del chat: canal general arriba y luego la nomina dividida
 * en quienes estan en linea y quienes no. El punto verde es la presencia en
 * vivo que anuncia el gateway; la insignia roja son mensajes sin leer.
 */
export default function ListaContactos({
  contactos,
  ultimoGeneral,
  seleccion,
  totalEnLinea,
  onElegir,
}: {
  contactos: ContactoChat[];
  ultimoGeneral: ResumenMensaje | null;
  seleccion: string;
  totalEnLinea: number;
  onElegir: (id: string) => void;
}) {
  const colorPrimario = useColorPrimario();
  const [filtro, setFiltro] = useState('');

  const { enLinea, desconectados } = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    const visibles = q
      ? contactos.filter(
          (c) => c.nombreCompleto.toLowerCase().includes(q) || c.email.toLowerCase().includes(q),
        )
      : contactos;
    // Dentro de cada grupo, primero quien tiene mensajes pendientes.
    const ordenar = (lista: ContactoChat[]) =>
      [...lista].sort((a, b) => b.noLeidos - a.noLeidos || a.nombreCompleto.localeCompare(b.nombreCompleto));
    return {
      enLinea: ordenar(visibles.filter((c) => c.enLinea)),
      desconectados: ordenar(visibles.filter((c) => !c.enLinea)),
    };
  }, [contactos, filtro]);

  return (
    <>
      <div className="border-b border-white/10 p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-bold text-white">Conversaciones</h2>
          <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {totalEnLinea} en linea
          </span>
        </div>
        <input
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Buscar companero…"
          className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-white outline-none placeholder:text-slate-500 focus:border-sky-500/50"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {!filtro && (
          <button
            onClick={() => onElegir(CANAL_GENERAL)}
            style={seleccion === CANAL_GENERAL ? { backgroundColor: colorConAlfa(colorPrimario, 0.15) } : undefined}
            className={`mb-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
              seleccion === CANAL_GENERAL ? '' : 'hover:bg-white/5'
            }`}
          >
            <span
              style={{ backgroundColor: colorPrimario }}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
            >
              #
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span
                  style={seleccion === CANAL_GENERAL ? { color: colorPrimario } : undefined}
                  className={`truncate text-sm font-semibold ${seleccion === CANAL_GENERAL ? '' : 'text-white'}`}
                >
                  Canal general
                </span>
                {ultimoGeneral && (
                  <span className="shrink-0 text-[10px] text-slate-500">{hora(ultimoGeneral.creadoEn)}</span>
                )}
              </span>
              <span className="block truncate text-[11px] text-slate-400">
                {ultimoGeneral
                  ? `${ultimoGeneral.propio ? 'Tu: ' : ''}${ultimoGeneral.cuerpo}`
                  : 'Todo el equipo conversa aqui'}
              </span>
            </span>
          </button>
        )}

        <Grupo titulo="En linea" cantidad={enLinea.length} vacio="Nadie mas conectado por ahora.">
          {enLinea.map((c) => (
            <FilaContacto key={c.id} contacto={c} activo={seleccion === c.id} onElegir={onElegir} />
          ))}
        </Grupo>

        <Grupo titulo="Desconectados" cantidad={desconectados.length} vacio="Todo el equipo esta en linea.">
          {desconectados.map((c) => (
            <FilaContacto key={c.id} contacto={c} activo={seleccion === c.id} onElegir={onElegir} />
          ))}
        </Grupo>
      </div>
    </>
  );
}

function Grupo({
  titulo,
  cantidad,
  vacio,
  children,
}: {
  titulo: string;
  cantidad: number;
  vacio: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2">
      <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {titulo} · {cantidad}
      </p>
      {cantidad === 0 ? (
        <p className="px-3 py-2 text-[11px] text-slate-600">{vacio}</p>
      ) : (
        <div className="flex flex-col gap-0.5">{children}</div>
      )}
    </div>
  );
}

function FilaContacto({
  contacto: c,
  activo,
  onElegir,
}: {
  contacto: ContactoChat;
  activo: boolean;
  onElegir: (id: string) => void;
}) {
  const colorPrimario = useColorPrimario();
  return (
    <button
      onClick={() => onElegir(c.id)}
      style={activo ? { backgroundColor: colorConAlfa(colorPrimario, 0.15) } : undefined}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition ${
        activo ? '' : 'hover:bg-white/5'
      }`}
    >
      <span className="relative shrink-0">
        <span
          style={
            c.enLinea
              ? { backgroundColor: colorConAlfa(colorPrimario, 0.15), color: colorPrimario }
              : undefined
          }
          className={`grid h-9 w-9 place-items-center rounded-full text-xs font-bold ${
            c.enLinea ? '' : 'bg-white/5 text-slate-400'
          }`}
        >
          {iniciales(c.nombreCompleto)}
        </span>
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-slate-900 ${
            c.enLinea ? 'bg-emerald-400' : 'bg-slate-600'
          }`}
          title={c.enLinea ? 'En linea' : 'Desconectado'}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span
            style={activo && c.noLeidos === 0 ? { color: colorPrimario } : undefined}
            className={`truncate text-sm ${c.noLeidos > 0 ? 'font-bold text-white' : activo ? 'font-semibold' : 'font-medium text-slate-200'}`}
          >
            {c.nombreCompleto}
          </span>
          {c.ultimoMensaje && (
            <span className="shrink-0 text-[10px] text-slate-500">{hora(c.ultimoMensaje.creadoEn)}</span>
          )}
        </span>
        <span className="flex items-center justify-between gap-2">
          <span className={`truncate text-[11px] ${c.noLeidos > 0 ? 'text-slate-200' : 'text-slate-500'}`}>
            {c.ultimoMensaje
              ? `${c.ultimoMensaje.propio ? 'Tu: ' : ''}${c.ultimoMensaje.cuerpo}`
              : (ROL_TEXTO[c.rol] ?? c.rol)}
          </span>
          {c.noLeidos > 0 && (
            <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
              {c.noLeidos > 99 ? '99+' : c.noLeidos}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}
