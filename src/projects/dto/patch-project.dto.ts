import { IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';

export class PatchProjectDto {
  @IsString()
  @Transform(
    ({ value }) => (typeof value === 'string' ? value.trim() : value),
    { toClassOnly: true },
  )
  @MinLength(1)
  @MaxLength(100)
  @ValidateIf((_, value) => value !== undefined)
  name?: string;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @MaxLength(500)
  @IsString()
  description?: string | null;
}
