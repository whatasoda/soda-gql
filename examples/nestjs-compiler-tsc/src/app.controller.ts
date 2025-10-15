import { Controller, Get, Param } from '@nestjs/common';
import { UserService } from './services/user.service';

@Controller()
export class AppController {
  constructor(private readonly userService: UserService) {}

  @Get('users/:id')
  async getUser(@Param('id') id: string) {
    return this.userService.getUser(id);
  }

  @Get('users')
  async getUsers() {
    return this.userService.getUsers();
  }

  @Get()
  getHello() {
    return {
      message: 'NestJS with soda-gql TypeScript Compiler Plugin',
      endpoints: {
        user: '/users/:id',
        users: '/users',
      },
    };
  }
}
