import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port', 3000);
  const apiPrefix = configService.get<string>('apiPrefix', 'api/v1');
  const nodeEnv = configService.get<string>('nodeEnv', 'development');

  // Set global prefix for all API routes (e.g. /api/v1)
  app.setGlobalPrefix(apiPrefix);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global exception filter for unified error responses
  app.useGlobalFilters(new HttpExceptionFilter());

  // Enable CORS
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Enable shutdown hooks for clean process termination (e.g. Prisma disconnect)
  app.enableShutdownHooks();

  // Swagger OpenAPI documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Isonga Connect (Isonga C) API')
    .setDescription(
      'Location-based civic announcement platform for Rwanda communities. Enables authorized local administrators to publish verified community announcements across SMS, Mobile Push, and In-App feeds.',
    )
    .setVersion('1.0.0')
    .addTag('Health', 'Application and database health checks')
    .addTag('Auth', 'Authentication and phone verification (Phase 3)')
    .addTag('Areas', 'Rwanda administrative hierarchy management (Phase 2)')
    .addTag('Residents', 'Resident profiles and notification preferences (Phase 4)')
    .addTag('Announcements', 'Announcement publishing and drafts (Phase 5)')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter your JWT bearer token',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Isonga Connect API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(port);
  logger.log(`=======================================================`);
  logger.log(`🚀 Isonga Connect (Isonga C) API is running!`);
  logger.log(`📍 Environment: ${nodeEnv}`);
  logger.log(`🌐 Base URL: http://localhost:${port}/${apiPrefix}`);
  logger.log(`🩺 Health check: http://localhost:${port}/${apiPrefix}/health`);
  logger.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
  logger.log(`=======================================================`);
}

bootstrap();
