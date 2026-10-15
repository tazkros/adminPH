import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module';

async function bootstrap() {

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');

  // Detrás de Cloudflare Tunnel / proxy: usar la IP y el protocolo reales.
  app.set('trust proxy', true);

  // La copia de seguridad del estado puede pesar varios MB.
  app.useBodyParser('json', { limit: '15mb' });
  app.useBodyParser('urlencoded', { limit: '15mb', extended: true });

  // El frontend usa scripts inline y librerías de CDN (xlsx, qrcodejs): se relaja la política CSP por defecto.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );


  // ==============================
  // CORS FRONTEND ADMIN PH
  // ==============================
  const envOrigins = String(
    config.get('CORS_ORIGINS') || ''
  )
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);


  const corsOrigins = envOrigins.length
    ? envOrigins
    : [
        'http://localhost:5500',
        'http://127.0.0.1:5500',
        'http://192.168.40.34:5500'
      ];


  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: [
      'GET',
      'HEAD',
      'PUT',
      'PATCH',
      'POST',
      'DELETE',
      'OPTIONS'
    ],
    allowedHeaders: [
      'Content-Type',
      'Authorization'
    ]
  });


  const swagger = new DocumentBuilder()
    .setTitle('AdminPH API')
    .setDescription('Backend real de AdminPH')
    .setVersion('0.1')
    .addBearerAuth()
    .build();


  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, swagger)
  );


  // PATCH V3: el mismo servidor entrega la página (un solo enlace y un solo puerto).
  const frontendDir = resolve(String(config.get('FRONTEND_DIR') || join(process.cwd(), '..', '..', 'frontend', 'AdminPH')));
  if (existsSync(join(frontendDir, 'index.html'))) {
    app.useStaticAssets(frontendDir, { index: 'index.html', etag: true, maxAge: 0 });
    console.log(`Frontend servido desde: ${frontendDir}`);
  } else {
    console.warn(`(Aviso) No se encontró el frontend en ${frontendDir}. Defina FRONTEND_DIR en .env si quiere servirlo desde el backend.`);
  }

  await app.listen(
    Number(config.get('PORT') || 3000)
  );

}

bootstrap();