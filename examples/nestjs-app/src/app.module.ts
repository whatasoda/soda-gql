import { Module } from '@nestjs/common';
import { UserService } from './services/user.service';

@Module({
  imports: [],
  controllers: [],
  providers: [UserService],
})
export class AppModule {}
