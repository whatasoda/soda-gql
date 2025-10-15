import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  await app.listen(3000);

  console.log('🚀 Application is running on: http://localhost:3000');
  console.log('\nAvailable endpoints:');
  console.log('  GET / - Welcome message');
  console.log('  GET /users - Get all users');
  console.log('  GET /users/:id - Get user by ID');
}

bootstrap();
