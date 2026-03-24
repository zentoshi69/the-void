import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  app.enableCors({ origin: frontendUrl, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  const port = parseInt(process.env.PORT || '4000', 10);
  await app.listen(port);
  logger.log(`VOID backend listening on :${port}`);
  logger.log(`CORS origin: ${frontendUrl}`);
}

bootstrap();
