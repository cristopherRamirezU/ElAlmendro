import { Injectable } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { Readable } from 'stream';

/**
 * Envoltorio del cliente S3 apuntando a MinIO (docker/docker-compose.yml).
 *
 * MinIO es compatible con la API de S3, asi que el mismo cliente sirve para
 * un S3 real el dia que el despliegue lo requiera: solo cambian las
 * variables de entorno (seccion 4.4 del documento de arquitectura).
 */
@Injectable()
export class AlmacenamientoService {
  private readonly cliente: S3Client;
  private readonly bucket: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET ?? 'timeflow-evidencias';
    this.cliente = new S3Client({
      endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
      region: process.env.S3_REGION ?? 'us-east-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY ?? 'timeflow',
        secretAccessKey: process.env.S3_SECRET_KEY ?? 'timeflow_dev',
      },
    });
  }

  async subir(clave: string, cuerpo: Buffer, tipoMime: string): Promise<void> {
    await this.cliente.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: clave,
        Body: cuerpo,
        ContentType: tipoMime,
      }),
    );
  }

  async eliminar(clave: string): Promise<void> {
    await this.cliente.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: clave }));
  }

  async descargar(clave: string): Promise<{ flujo: Readable; tipoMime?: string; tamanoBytes?: number }> {
    const resultado = await this.cliente.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: clave }),
    );
    return {
      flujo: resultado.Body as Readable,
      tipoMime: resultado.ContentType,
      tamanoBytes: resultado.ContentLength,
    };
  }
}
