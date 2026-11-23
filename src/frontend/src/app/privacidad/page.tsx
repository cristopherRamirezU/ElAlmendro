import type { Metadata } from 'next';
import Link from 'next/link';
import PaginaLegal, { type SeccionLegal } from '@/components/sitio/PaginaLegal';
import { DATOS_LEGALES as D } from '@/lib/sitio';

export const metadata: Metadata = {
  title: 'Política de privacidad · TimeFlow',
  description: 'Qué datos personales trata TimeFlow, para qué, con quién se comparten y cómo ejercer tus derechos.',
};

const correo = <a href={`mailto:${D.correo}`}>{D.correo}</a>;

const SECCIONES: SeccionLegal[] = [
  {
    id: 'responsable',
    titulo: 'Quién trata tus datos',
    contenido: (
      <>
        <p>
          {D.servicio} es un servicio de <strong>{D.razonSocial}</strong>, RUT {D.rut}, con domicilio en {D.domicilio}.
          Esta política explica cómo tratamos los datos personales conforme a la ley chilena de protección de datos
          personales (Ley N° 19.628 y sus modificaciones, incluida la Ley N° 21.719).
        </p>
        <p>Tratamos datos en dos calidades distintas:</p>
        <ul>
          <li>
            <strong>Como responsables</strong>, de los datos de quienes visitan el sitio y de quien registra una empresa
            (su cuenta de administrador).
          </li>
          <li>
            <strong>Como encargados</strong>, de los datos que cada empresa cliente carga sobre su equipo (registros de
            jornada, tareas, mensajes, etc.). En ese caso la responsable es la <strong>empresa</strong>, que decide para
            qué los usa; nosotros los tratamos solo por su cuenta y según sus instrucciones.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'datos',
    titulo: 'Qué datos tratamos',
    contenido: (
      <ul>
        <li>
          <strong>Cuenta:</strong> nombre, correo, rol, zona horaria, foto de perfil (si la subes) y la contraseña, que
          guardamos solo cifrada de forma irreversible; nadie puede leerla, ni siquiera nosotros.
        </li>
        <li>
          <strong>Empresa:</strong> nombre, RUT (opcional), plan y preferencias de apariencia.
        </li>
        <li>
          <strong>Registros de trabajo:</strong> inicio y término de cada jornada, sesiones cronometradas con sus pausas,
          las tareas y proyectos en que se trabajó, y el tiempo calculado a partir de esos registros.
        </li>
        <li>
          <strong>Contenido:</strong> textos de tareas y comentarios, comentarios de voz, archivos adjuntos y mensajes del
          chat interno.
        </li>
        <li>
          <strong>Datos técnicos y de seguridad:</strong> dirección IP en inicios de sesión y en el registro de empresas,
          intentos de acceso fallidos y un registro de auditoría de las acciones relevantes (quién hizo qué y cuándo).
        </li>
      </ul>
    ),
  },
  {
    id: 'finalidades',
    titulo: 'Para qué los usamos',
    contenido: (
      <>
        <ul>
          <li>Prestar el servicio: crear y administrar cuentas, mostrar el mapa de tareas, calendarios y reportes.</li>
          <li>Proteger el servicio: detectar accesos indebidos, frenar el abuso y mantener la auditoría.</li>
          <li>Atender consultas de soporte y avisarte de cambios importantes del servicio.</li>
          <li>Cumplir obligaciones legales y requerimientos de autoridades competentes.</li>
        </ul>
        <p>
          La base de estos tratamientos es la ejecución del contrato con la empresa cliente, nuestro interés legítimo en
          mantener el servicio seguro y el cumplimiento de obligaciones legales.{' '}
          <strong>No vendemos datos, no mostramos publicidad y no los usamos para crear perfiles comerciales.</strong>
        </p>
      </>
    ),
  },
  {
    id: 'dispositivo',
    titulo: 'Micrófono, fotos y ubicación',
    contenido: (
      <ul>
        <li>
          El <strong>micrófono</strong> se usa solo cuando pulsas &quot;Grabar comentario de voz&quot;, y el navegador te
          pide permiso la primera vez. No grabamos nada en segundo plano.
        </li>
        <li>
          Las <strong>fotos de perfil</strong> se recortan y reducen en tu propio dispositivo antes de subirlas; en ese
          proceso se eliminan los datos ocultos del archivo original, como la ubicación donde se tomó.
        </li>
        <li>
          {D.servicio}{' '}<strong>no usa tu ubicación</strong> ni la cámara.
        </li>
      </ul>
    ),
  },
  {
    id: 'equipo',
    titulo: 'Quién ve la información dentro de tu empresa',
    contenido: (
      <>
        <p>
          Cada empresa es un espacio aislado: nadie de otra empresa puede ver sus datos. Dentro de la empresa, lo que ve
          cada persona depende de su rol:
        </p>
        <ul>
          <li>Administradores y supervisores ven los registros de trabajo y reportes de su equipo.</li>
          <li>Los trabajadores ven sus propios registros y las tareas y proyectos en que participan.</li>
          <li>Los mensajes privados del chat solo los ven, en la app, las dos personas de la conversación.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'navegador',
    titulo: 'Cookies y almacenamiento en el navegador',
    contenido: (
      <>
        <p>
          Usamos una única cookie, <strong>de sesión</strong>, necesaria para mantenerte conectado. Es inaccesible para
          los scripts de la página, lo que impide que un código malicioso la robe.
        </p>
        <p>
          Además guardamos en tu navegador preferencias de pantalla (por ejemplo, el fondo elegido o si la barra lateral
          está oculta) y una copia temporal de tu sesión para que la app cargue más rápido.{' '}
          <strong>No usamos cookies de terceros, de publicidad ni de analítica.</strong>
        </p>
      </>
    ),
  },
  {
    id: 'compartir',
    titulo: 'Con quién los compartimos',
    contenido: (
      <>
        <p>Solo compartimos datos cuando es necesario para prestar el servicio o cuando la ley lo exige:</p>
        <ul>
          <li>
            Con nuestro <strong>proveedor de infraestructura</strong> (servidores y almacenamiento de archivos), que los
            guarda por cuenta nuestra y bajo obligaciones de confidencialidad y seguridad.
          </li>
          <li>Con autoridades, tribunales u organismos públicos, cuando un requerimiento legal válido lo exija.</li>
        </ul>
        <p>
          Si los servidores están fuera de Chile, la transferencia se hace con las garantías que exige la ley para que tus
          datos mantengan un nivel de protección adecuado.
        </p>
      </>
    ),
  },
  {
    id: 'seguridad',
    titulo: 'Cómo los protegemos',
    contenido: (
      <ul>
        <li>Toda la comunicación viaja cifrada (HTTPS).</li>
        <li>Las contraseñas se guardan con un algoritmo de cifrado irreversible (Argon2).</li>
        <li>Límites de intentos para frenar a quien intente adivinar contraseñas.</li>
        <li>Separación estricta de los datos de cada empresa, también a nivel de base de datos.</li>
        <li>Respaldos periódicos y registro de auditoría de las acciones relevantes.</li>
      </ul>
    ),
  },
  {
    id: 'conservacion',
    titulo: 'Cuánto tiempo los guardamos',
    contenido: (
      <p>
        Mientras la cuenta de la empresa esté activa. Si la empresa cierra su cuenta, eliminamos o anonimizamos sus datos
        dentro de 90 días, salvo los que debamos conservar por obligación legal o para defendernos ante reclamos, y los
        que permanezcan en respaldos hasta que estos se renueven. Los registros de auditoría y de seguridad se conservan
        el tiempo necesario para cumplir su fin.
      </p>
    ),
  },
  {
    id: 'derechos',
    titulo: 'Tus derechos',
    contenido: (
      <>
        <p>
          Tienes derecho a acceder a tus datos, rectificarlos, suprimirlos, oponerte a su tratamiento, pedir su
          portabilidad y solicitar el bloqueo temporal, en los términos que establece la ley.
        </p>
        <ul>
          <li>
            Si eres <strong>trabajador o usuario de una empresa cliente</strong>, dirige tu solicitud primero a tu
            empresa, que es la responsable de esos datos. Si nos escribes a nosotros, se la haremos llegar y la
            ayudaremos a responder.
          </li>
          <li>
            Si eres <strong>quien registró la empresa</strong> o visitante del sitio, escríbenos directamente a {correo}.
          </li>
        </ul>
        <p>
          Responderemos dentro de los plazos legales. Si no quedas conforme, puedes reclamar ante la Agencia de
          Protección de Datos Personales.
        </p>
      </>
    ),
  },
  {
    id: 'menores',
    titulo: 'Menores de edad',
    contenido: (
      <p>
        {D.servicio} es una herramienta de trabajo para empresas y no está dirigida a menores de 18 años. Si una empresa
        registra a un menor de edad (por ejemplo, un estudiante en práctica), debe contar con las autorizaciones que la
        ley exige.
      </p>
    ),
  },
  {
    id: 'cambios',
    titulo: 'Cambios a esta política',
    contenido: (
      <p>
        Si cambiamos esta política de forma relevante, lo avisaremos en la app o por correo al administrador de la
        empresa antes de que el cambio rija. La fecha de la versión vigente está al inicio de esta página. Consulta
        también nuestros <Link href="/terminos">términos de uso</Link>.
      </p>
    ),
  },
  {
    id: 'contacto',
    titulo: 'Contacto',
    contenido: <p>Para cualquier consulta sobre privacidad o para ejercer tus derechos, escríbenos a {correo}.</p>,
  },
];

export default function Privacidad() {
  return (
    <PaginaLegal
      titulo="Política de privacidad"
      resumen={`En corto: usamos los datos solo para prestar ${D.servicio} y mantenerlo seguro. No vendemos datos ni mostramos publicidad. Los datos del equipo pertenecen a cada empresa, que es la responsable de ellos; el micrófono solo se usa cuando pulsas grabar.`}
      secciones={SECCIONES}
    />
  );
}
