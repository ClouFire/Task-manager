import { Controller, Post, Body, UseInterceptors, ClassSerializerInterceptor } from '@nestjs/common';
import { CreateUserDto } from './dto/user-create.dto';
import { UsersService } from './users.service';

@Controller('/auth')
export class UsersAuthController {
    constructor(
        private readonly usersService: UsersService,
    ) {}

    @UseInterceptors(ClassSerializerInterceptor)
    @Post('/register')
    async register(@Body() createUserDto: CreateUserDto) {
        return await this.usersService.register(createUserDto);
    }

}