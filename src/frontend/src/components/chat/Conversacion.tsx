'use client';

import { useEffect, useRef, useState } from 'react';
import { ContactoChat, MensajeChat } from '@/lib/api';
import { diaRelativo, hora, iniciales } from '@/lib/formato';
import { colorConAlfa, useColorPrimario } from '@/lib/color';

const ROL_TEXTO: Record<string, string> = {
  ADMINISTRADOR: 'Administrador',
  SUPERVISOR: 'Supervisor',
  TRABAJADOR: 'Trabajador',
};

/** Cada cuanto, como maximo, se avisa a la contraparte que estamos tecleando. */
const INTERVALO_ESCRIBIENDO_MS = 1500;

/**
 * Columna derecha del chat: cabecera con la presencia de la contraparte,
 * historial en burbujas (las propias a la derecha) y caja de envio.
 * `contacto` en null significa canal general.
 */
export default function Conversacion({
  yoId,
  contacto,
  totalEnLinea,
  mensajes,
  hayMas,
  cargando,
  nombreEscribiendo,
  onEnviar,
  onCargarAnteriores,
  onEscribiendo,
  onVolver,
}: {
  yoId: string;
  contacto: ContactoChat | null;
  totalEnLinea: number;
  mensajes: MensajeChat[];
  hayMas: boolean;
  cargando: boolean;
  nombreEscribiendo: string | null;
  onEnviar: (cuerpo: string) => Promise<void>;
  onCargarAnteriores: () => void;
  onEscribiendo: () => void;
  onVolver: () => void;
}) {
  const colorPrimario = useColorPrimario();
  const [borrador, setBorrador] = useState('');
  const [enviando, setEnviando] = useState(false);
  const listaRef = useRef<HTMLDivElement>(null);
  const ultimoAvisoRef = useRef(0);
  const ultimoIdRef = useRef<string | null>(null);

  // Baja al final cuando llega un mensaje nuevo al pie de la lista; al
  // cargar mensajes antiguos por arriba se conserva la posicion.
  useEffect(() => {
    const ultimo = mensajes[mensajes.length - 1]?.id ?? null;
    if (ultimo !== ultimoIdRef.current) {
      ultimoIdRef.current = ultimo;
      listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight });
    }
  }, [mensajes]);

  async function enviar() {
    const cuerpo = borrador.trim();
    if (!cuerpo || enviando) return;
    setEnviando(true);
    setBorrador('');
    try {
      await onEnviar(cuerpo);
    } finally {
      setEnviando(false);
    }
  }

  function alEscribir(valor: string) {
    setBorrador(valor);
    const ahora = Date.now();
    if (valor && ahora - ultimoAvisoRef.current > INTERVALO_ESCRIBIENDO_MS) {
      ultimoAvisoRef.current = ahora;
      onEscribiendo();
    }
  }

  const esGeneral = contacto === null;

  return (
    <>
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <button
          onClick={onVolver}
          className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/5 md:hidden"
          title="Volver a la lista"
        >
          ‹
        </button>
        {esGeneral ? (
          <span
            style={{ backgroundColor: colorPrimario }}
            className="grid h-9 w-9 place-items-center rounded-full text-sm font-bold text-white"
          >
            #
          </span>
        ) : (
          <span className="relative">
            <span
              style={{ backgroundColor: colorConAlfa(colorPrimario, 0.15), color: colorPrimario }}
              className="grid h-9 w-9 place-items-center rounded-full text-xs font-bold"
            >
              {iniciales(contacto.nombreCompleto)}
            </span>
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-slate-900 ${
                contacto.enLinea ? 'bg-emerald-400' : 'bg-slate-600'
              }`}
            />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">
            {esGeneral ? 'Canal general' : contacto.nombreCompleto}
          </p>
          <p className="text-[11px] text-slate-400">
            {esGeneral ? (
              `${totalEnLinea} companero${totalEnLinea === 1 ? '' : 's'} en linea`
            ) : contacto.enLinea ? (
              <span className="text-emerald-300">En linea</span>
            ) : (
              'Desconectado · recibira el mensaje al volver'
            )}
            {!esGeneral && ` · ${ROL_TEXTO[contacto.rol] ?? contacto.rol}`}
          </p>
        </div>
      </div>

      <div ref={listaRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {hayMas && (
          <div className="mb-3 text-center">
            <button
              onClick={onCargarAnteriores}
              disabled={cargando}
              className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-slate-400 hover:bg-white/5 disabled:opacity-50"
            >
              {cargando ? 'Cargando…' : 'Ver mensajes anteriores'}
            </button>
          </div>
        )}

        {mensajes.length === 0 && !cargando && (
          <div className="grid h-full place-items-center text-center">
            <p className="max-w-xs text-xs text-slate-500">
              {esGeneral
                ? 'Aun no hay mensajes en el canal general. Escribe el primero.'
                : `Esta es tu conversacion privada con ${contacto.nombreCompleto}. Solo ustedes dos la ven.`}
            </p>
          </div>
        )}

        {mensajes.map((m, i) => {
          const anterior = mensajes[i - 1];
          const propio = m.emisorId === yoId;
          const cambiaDia = !anterior || diaRelativo(anterior.creadoEn) !== diaRelativo(m.creadoEn);
          const mismoAutor = anterior && anterior.emisorId === m.emisorId && !cambiaDia;
          return (
            <div key={m.id}>
              {cambiaDia && (
                <p className="my-3 text-center text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  {diaRelativo(m.creadoEn)}
                </p>
              )}
              <div className={`flex ${propio ? 'justify-end' : 'justify-start'} ${mismoAutor ? 'mt-0.5' : 'mt-2.5'}`}>
                <div className={`max-w-[75%] ${propio ? 'items-end' : 'items-start'} flex flex-col`}>
                  {esGeneral && !propio && !mismoAutor && (
                    <span
                      style={{ color: colorPrimario }}
                      className="mb-0.5 px-1 text-[10px] font-semibold"
                    >
                      {m.emisor.nombreCompleto}
                    </span>
                  )}
                  <div
                    style={propio ? { backgroundColor: colorPrimario } : undefined}
                    className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-snug ${
                      propio ? 'rounded-br-md text-white' : 'rounded-bl-md bg-white/10 text-slate-100'
                    }`}
                  >
                    {m.cuerpo}
                  </div>
                  <span className="mt-0.5 flex items-center gap-1 px-1 text-[10px] text-slate-500">
                    {hora(m.creadoEn)}
                    {propio && !esGeneral && (
                      <span
                        style={m.leidoEn ? { color: colorPrimario } : undefined}
                        title={m.leidoEn ? 'Leido' : 'Enviado'}
                      >
                        {m.leidoEn ? '✓✓' : '✓'}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {nombreEscribiendo && (
          <p className="mt-2 px-1 text-[11px] italic text-slate-400">
            {esGeneral ? `${nombreEscribiendo} esta escribiendo…` : 'Esta escribiendo…'}
          </p>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
        className="flex items-end gap-2 border-t border-white/10 p-3"
      >
        <textarea
          value={borrador}
          onChange={(e) => alEscribir(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              enviar();
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder={esGeneral ? 'Mensaje para todo el equipo…' : `Mensaje para ${contacto.nombreCompleto}…`}
          className="max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-500/50"
        />
        <button
          type="submit"
          disabled={!borrador.trim() || enviando}
          style={{ backgroundColor: colorPrimario }}
          className="h-10 rounded-xl px-4 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Enviar
        </button>
      </form>
    </>
  );
}
