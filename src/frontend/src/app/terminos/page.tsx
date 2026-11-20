import type { Metadata } from 'next';
import Link from 'next/link';
import PaginaLegal, { type SeccionLegal } from '@/components/sitio/PaginaLegal';
import { DATOS_LEGALES as D } from '@/lib/sitio';

export const metadata: Metadata = {
  title: 'Términos de uso · TimeFlow',
  description: 'Condiciones para usar TimeFlow, el servicio de registro de jornadas, tareas y tiempo de trabajo.',
};

const correo = <a href={`mailto:${D.correo}`}>{D.correo}</a>;

const SECCIONES: SeccionLegal[] = [
  {
    id: 'aceptacion',
    titulo: 'Quiénes somos y aceptación',
    contenido: (
      <>
        <p>
          {D.servicio} es un servicio prestado por <strong>{D.razonSocial}</strong>, RUT {D.rut}, con domicilio en{' '}
          {D.domicilio} (en adelante, &quot;{D.servicio}&quot;, &quot;nosotros&quot;), disponible en {D.sitio}.
        </p>
        <p>
          Al crear una cuenta o usar el servicio aceptas estos términos y nuestra{' '}
          <Link href="/privacidad">política de privacidad</Link>. Si creas la cuenta en nombre de una empresa, declaras
          que tienes facultades para obligarla, y estos términos rigen entre {D.servicio} y esa empresa (el
          &quot;Cliente&quot;).
        </p>
      </>
    ),
  },
  {
    id: 'servicio',
    titulo: 'El servicio',
    contenido: (
      <>
        <p>
          {D.servicio} permite a una empresa organizar sus proyectos como un mapa de tareas, que cada persona registre
          su jornada y cronometre sus sesiones de trabajo, y revisar esa información en calendarios y reportes. Incluye
          además chat interno, comentarios de voz, adjuntos y fotos de perfil.
        </p>
        <p>
          Podemos mejorar, cambiar o retirar funciones. Si un cambio quita algo importante de tu plan, te avisaremos con
          anticipación razonable.
        </p>
      </>
    ),
  },
  {
    id: 'cuentas',
    titulo: 'Cuentas, roles y acceso',
    contenido: (
      <>
        <p>
          Quien registra la empresa queda como su <strong>Administrador</strong> y puede crear cuentas para
          supervisores y trabajadores (los &quot;Usuarios&quot;). El Cliente es responsable de quién tiene cuenta, del
          rol que le asigna y de dar de baja a quien deja la empresa.
        </p>
        <ul>
          <li>Cada cuenta es personal: no se comparte ni se cede.</li>
          <li>Debes mantener tu contraseña en reserva y avisarnos si sospechas que alguien más la conoce.</li>
          <li>La información de registro debe ser verdadera y estar al día.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'plan',
    titulo: 'Plan Básico y otros planes',
    contenido: (
      <>
        <p>
          El <strong>plan Básico es gratuito</strong> e incluye hasta 10 personas y 5 proyectos por empresa. No pedimos
          tarjeta para usarlo.
        </p>
        <p>
          Los planes Pro y Empresa, con más capacidad, se contratan aparte y se rigen por estos términos y por las
          condiciones particulares (precio, límites, forma de pago) que se acuerden por escrito. Podemos cambiar los
          límites del plan Básico avisando con al menos 30 días de anticipación.
        </p>
      </>
    ),
  },
  {
    id: 'uso',
    titulo: 'Uso aceptable',
    contenido: (
      <>
        <p>Al usar {D.servicio} te comprometes a no:</p>
        <ul>
          <li>Usarlo para fines ilegales o para registrar información de personas sin la base legal que corresponda.</li>
          <li>Subir contenido ilícito, ofensivo, que infrinja derechos de terceros o que contenga código malicioso.</li>
          <li>Intentar acceder a datos de otras empresas, a cuentas ajenas o a partes del sistema no habilitadas.</li>
          <li>Probar contraseñas, sobrecargar el servicio o automatizar el registro de empresas.</li>
          <li>Copiar, revender o explotar el servicio sin nuestra autorización escrita.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'datos-cliente',
    titulo: 'Tus datos y tus trabajadores',
    contenido: (
      <>
        <p>
          La información que el Cliente y sus Usuarios cargan (proyectos, tareas, registros de tiempo, mensajes,
          audios, archivos) <strong>es del Cliente</strong>. Nos das solo el permiso necesario para guardarla, mostrarla y
          procesarla con el fin de prestarte el servicio.
        </p>
        <p>
          Respecto de los datos de sus trabajadores, el Cliente actúa como <strong>responsable</strong> y{' '}
          {D.servicio} como <strong>encargado</strong> que los trata por su cuenta. Por eso el Cliente debe:
        </p>
        <ul>
          <li>
            Informar a sus trabajadores que usa {D.servicio} para registrar jornadas y tiempo de trabajo, qué datos se
            registran y para qué, conforme a la legislación laboral y de protección de datos aplicable.
          </li>
          <li>Usar la información solo para fines legítimos relacionados con la relación de trabajo o de servicios.</li>
          <li>Atender las solicitudes de sus trabajadores sobre sus datos; nosotros le ayudaremos a hacerlo.</li>
        </ul>
        <p>
          {D.servicio} es una herramienta de registro y organización: no reemplaza el registro de asistencia exigido por
          la ley laboral ni determina por sí solo remuneraciones u horas extraordinarias. Esas decisiones son del Cliente.
        </p>
      </>
    ),
  },
  {
    id: 'disponibilidad',
    titulo: 'Disponibilidad, respaldos y soporte',
    contenido: (
      <>
        <p>
          Hacemos lo razonable para que el servicio esté disponible y para respaldar la información periódicamente, pero
          no garantizamos que funcione sin interrupciones ni errores. Puede haber mantenciones, que procuraremos hacer en
          horarios de baja actividad.
        </p>
        <p>El soporte del plan Básico se presta por correo a {correo}, en días hábiles.</p>
      </>
    ),
  },
  {
    id: 'propiedad',
    titulo: 'Propiedad intelectual',
    contenido: (
      <p>
        El software, el diseño, la marca {D.servicio} y su logo nos pertenecen. Estos términos no te transfieren ningún
        derecho sobre ellos, salvo el de usar el servicio mientras tu cuenta esté vigente.
      </p>
    ),
  },
  {
    id: 'termino',
    titulo: 'Suspensión y término',
    contenido: (
      <>
        <p>
          Puedes dejar de usar {D.servicio} cuando quieras y pedirnos cerrar la cuenta de tu empresa escribiendo a{' '}
          {correo}. Antes de cerrarla puedes exportar tus reportes desde la app.
        </p>
        <p>
          Podemos suspender o cerrar una cuenta que infrinja estos términos o ponga en riesgo la seguridad del servicio o
          de otros clientes; salvo urgencia, te avisaremos antes para que puedas corregirlo.
        </p>
        <p>
          Cerrada la cuenta, eliminamos o anonimizamos los datos de la empresa dentro de 90 días, salvo los que debamos
          conservar por obligación legal o los que permanezcan en respaldos hasta que estos se renueven.
        </p>
      </>
    ),
  },
  {
    id: 'responsabilidad',
    titulo: 'Responsabilidad',
    contenido: (
      <>
        <p>
          El plan Básico se entrega gratuitamente y &quot;tal como está&quot;. En la medida que la ley lo permita,{' '}
          {D.servicio} no responde por daños indirectos, lucro cesante ni pérdida de información causados por un uso
          indebido de la plataforma, por fallas de servicios de terceros (internet, proveedores de infraestructura) o por
          fuerza mayor.
        </p>
        <p>
          Nada de lo anterior limita los derechos que la ley te reconozca de forma irrenunciable, ni nuestra
          responsabilidad por dolo o culpa grave.
        </p>
      </>
    ),
  },
  {
    id: 'cambios',
    titulo: 'Cambios a estos términos',
    contenido: (
      <p>
        Podemos actualizar estos términos. Si el cambio es relevante, lo avisaremos en la app o por correo al
        Administrador con al menos 15 días de anticipación. Seguir usando el servicio después de esa fecha significa que
        aceptas la nueva versión.
      </p>
    ),
  },
  {
    id: 'ley',
    titulo: 'Ley aplicable',
    contenido: (
      <p>
        Estos términos se rigen por las leyes de la República de Chile. Cualquier controversia se someterá a los
        tribunales ordinarios de justicia competentes, sin perjuicio de los derechos que la ley otorgue a los
        consumidores.
      </p>
    ),
  },
  {
    id: 'contacto',
    titulo: 'Contacto',
    contenido: (
      <p>
        Para cualquier consulta sobre estos términos escríbenos a {correo}.
      </p>
    ),
  },
];

export default function Terminos() {
  return (
    <PaginaLegal
      titulo="Términos de uso"
      resumen={`En corto: el plan Básico es gratis (hasta 10 personas y 5 proyectos); la información que cargas es de tu empresa; tu empresa debe informar a sus trabajadores que usa ${D.servicio}; y puedes irte cuando quieras.`}
      secciones={SECCIONES}
    />
  );
}
