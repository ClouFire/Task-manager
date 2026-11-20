import {
    IsString,
    IsOptional,
    Matches,
    MaxLength,
    MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateProjectDto {
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value), {toClassOnly: true})
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    @Matches(/\S/, {message: 'Project name must not be blank'})
    name: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string | null;
}