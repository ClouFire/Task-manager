import {
    IsString,
    IsOptional,
    MaxLength,
    MinLength,
    IsUUID,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class createTaskDto {
    @IsUUID()
    projectId: string;

    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value), {toClassOnly: true})
    @IsString()
    @MinLength(1)
    @MaxLength(150)
    title: string

    @IsOptional()
    @IsString()
    @MaxLength(2000)
    description: string | null;
}