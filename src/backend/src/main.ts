import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { esProduccion, secretoJwt } from './common/seguridad/sesion';

async function bootstrap() {
  const registro = new Logger('Arranque');
  revisarSecretoJwt(registro);

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Caddy (en el mismo servidor) es el unico que habla con la API y agrega
  // X-Forwarded-For. Confiar solo en el proxy local hace que req.ip sea la IP
  // real del visitante (para el limite de intentos y la auditoria) sin que
  // alguien de afuera pueda inventarse una IP con esa cabecera.
  app.set('trust proxy', 'loopback');
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.enableCors({
    origin: process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000',
    credentials: true,
  });

  // Contrato OpenAPI generado desde los decoradores (seccion 6 del documento).
  // En produccion no se publica: es el mapa completo de la API. Se puede
  // habilitar a proposito con SWAGGER=si.
  if (!esProduccion() || process.env.SWAGGER === 'si') {
    const config = new DocumentBuilder()
      .setTitle('TimeFlow API')
      .setDescription('Capa de negocio: jornadas, actividades, sesiones y reportes.')
      .setVersion('0.1.0')
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
  }

  const puerto = Number(process.env.API_PORT ?? 4000);
  await app.listen(puerto);
  registro.log(`API escuchando en http://localhost:${puerto}/api`);
}

/**
 * Sin secreto la API no puede firmar sesiones: mejor no arrancar que fallar
 * en cada inicio de sesion. Un secreto corto solo se advierte, para no botar
 * produccion; debe reemplazarse por uno de 32 caracteres o mas
 * (openssl rand -hex 32) y reiniciar.
 */
function revisarSecretoJwt(registro: Logger) {
  const secreto = secretoJwt();
  if (secreto.length < 32 || /^CAMBIAR/i.test(secreto)) {
    registro.warn(
      'JWT_ACCESS_SECRET es corto o es el de ejemplo: cambialo por uno de 32+ caracteres (openssl rand -hex 32).',
    );
  }
}

void bootstrap();
