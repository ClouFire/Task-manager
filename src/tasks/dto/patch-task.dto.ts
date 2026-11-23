import {
  IsString,
  IsOptional,
  MaxLength,
  MinLength,
  IsEnum,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { TaskStatus } from '../task-status.enum';
import { Task } from '../task.entity';

export class PatchTaskDto {
  @Transform(
    ({ value }) => (typeof value === 'string' ? value.trim() : value),
    { toClassOnly: true },
  )
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  @ValidateIf((_, value) => value !== undefined)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @Transform(
    ({ value }) => (typeof value === 'string' ? value.toLowerCase() : value),
    { toClassOnly: true },
  )
  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(TaskStatus)
  status?: TaskStatus;
}
