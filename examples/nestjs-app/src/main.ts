import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  console.log('=== NestJS App with soda-gql ===\n');
  console.log('✅ Application started successfully');
  console.log('✅ soda-gql operations are registered and ready to use');

  await app.listen(3000);
  console.log('\n🚀 Server running on http://localhost:3000');
}

bootstrap();
