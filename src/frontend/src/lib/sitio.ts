/**
 * Datos del titular del servicio que aparecen en la pagina web, los terminos
 * y la politica de privacidad. Completar aqui: se usan en todas partes.
 */
export const DATOS_LEGALES = {
  /** Nombre comercial del servicio. */
  servicio: 'TimeFlow',
  /** Razon social de quien presta el servicio. */
  razonSocial: 'El Almendro Inversiones',
  rut: '76.407.543-9',
  domicilio: 'Siete Poniente 700, Buin, Chile',
  /** Correo para contacto comercial, soporte y solicitudes de privacidad. */
  correo: 'a.cordero@elalmendro.cl',
  sitio: 'https://timeflows.site',
  /** Fecha desde la que rigen los textos legales vigentes. */
  vigencia: '20 de noviembre de 2026',
  /**
   * Version de los terminos y la politica: debe ser igual a VERSION_POLITICAS
   * del backend (common/politicas.ts). Al subirla, el aviso de la pagina web
   * se vuelve a mostrar a todos.
   */
  versionPoliticas: '2026-11-20',
};
