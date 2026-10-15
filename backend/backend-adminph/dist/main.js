"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const fs_1 = require("fs");
const path_1 = require("path");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const swagger_1 = require("@nestjs/swagger");
const helmet_1 = require("helmet");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const config = app.get(config_1.ConfigService);
    app.setGlobalPrefix('api');
    app.set('trust proxy', true);
    app.useBodyParser('json', { limit: '15mb' });
    app.useBodyParser('urlencoded', { limit: '15mb', extended: true });
    app.use((0, helmet_1.default)({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true
    }));
    const envOrigins = String(config.get('CORS_ORIGINS') || '')
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
    const swagger = new swagger_1.DocumentBuilder()
        .setTitle('AdminPH API')
        .setDescription('Backend real de AdminPH')
        .setVersion('0.1')
        .addBearerAuth()
        .build();
    swagger_1.SwaggerModule.setup('api/docs', app, swagger_1.SwaggerModule.createDocument(app, swagger));
    const frontendDir = (0, path_1.resolve)(String(config.get('FRONTEND_DIR') || (0, path_1.join)(process.cwd(), '..', '..', 'frontend', 'AdminPH')));
    if ((0, fs_1.existsSync)((0, path_1.join)(frontendDir, 'index.html'))) {
        app.useStaticAssets(frontendDir, { index: 'index.html', etag: true, maxAge: 0 });
        console.log(`Frontend servido desde: ${frontendDir}`);
    }
    else {
        console.warn(`(Aviso) No se encontró el frontend en ${frontendDir}. Defina FRONTEND_DIR en .env si quiere servirlo desde el backend.`);
    }
    await app.listen(Number(config.get('PORT') || 3000));
}
bootstrap();
//# sourceMappingURL=main.js.map