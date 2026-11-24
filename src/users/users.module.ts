import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersAuthController } from './user-auth.controller';

@Module({
  controllers: [UsersController, UsersAuthController],
  providers: [UsersService]
})
export class UsersModule {}
