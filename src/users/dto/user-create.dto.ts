import { IsString, MaxLength, IsEmail, IsStrongPassword } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateUserDto {
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value), {toClassOnly: true})
    @IsString()
    @IsEmail()
    @MaxLength(254)
    email: string;

    @IsStrongPassword({
        minLength: 10,
        minUppercase: 1,
        minLowercase: 1,
        minSymbols: 1,
        minNumbers: 1,
    })
    @MaxLength(128)
    password: string;
}