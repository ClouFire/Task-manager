import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/user-create.dto';
import { User } from './users.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
    ) {}

    async register(dto: CreateUserDto) {
        const input = plainToInstance(CreateUserDto, dto);
        const errors = await validate(input);

        if (errors.length) {
            throw new BadRequestException('Invalid task data');
        }

        if (input?.email === undefined || input?.password === undefined || input.email.trim() === '' || input.password.trim() === '') {
            throw new BadRequestException('Wrong data provided');
        }

        try {
            const user = this.userRepository.create({
                email: input.email,
                passwordHash: input.password,
            });

            return await this.userRepository.save(user);
        } catch (error) {
            if (error instanceof QueryFailedError) {
                const dbError = error.driverError as {
                    code?: string,
                    constraint?: string,
                }

                if (
                    dbError.code === '23505'
                    && dbError.constraint === 'UQ_users_email'
                ) {
                    throw new ConflictException('Email is already used');
                }
            }

            throw error;
        }
    }
}
