import type { Metadata } from 'next';
import './globals.css';
import { ProveedorTesoro } from '@/lib/tesoro';
import VentanaBolsa from '@/components/tesoro/VentanaBolsa';

export const metadata: Metadata = {
  title: 'TimeFlow',
  description: 'Monitoreo y registro de actividad de trabajadores remotos',
};

/**
 * Filtra ruido de extensiones del navegador (MetaMask y similares intentan
 * conectarse a cada pestaña que se abre) para que no dispare el overlay de
 * errores de Next.js en desarrollo. La app no usa Web3: estos errores no
 * vienen nunca del bundle propio.
 */
const FILTRO_EXTENSIONES = `(function () {
  function esRuidoDeExtension(texto) {
    return /chrome-extension:|moz-extension:|MetaMask/i.test(texto || '');
  }
  window.addEventListener('error', function (e) {
    if (esRuidoDeExtension(e.message + ' ' + (e.filename || '') + ' ' + ((e.error && e.error.stack) || ''))) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  }, true);
  window.addEventListener('unhandledrejection', function (e) {
    var razon = e.reason;
    var texto = (razon && (razon.message || razon.stack)) || String(razon);
    if (esRuidoDeExtension(texto)) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  }, true);
})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: FILTRO_EXTENSIONES }} />
        {/* El tesoro envuelve toda la aplicacion desde la raiz: asi la ventana
            de la bolsa no se desmonta al navegar entre pantallas. */}
        <ProveedorTesoro>
          {children}
          <VentanaBolsa />
        </ProveedorTesoro>
      </body>
    </html>
  );
}
