import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @Transform(({ value }): unknown =>
    typeof value === 'string' ? value.trim() : value,
  )
  @Length(1, 2000)
  content: string;

  @IsOptional()
  @IsUUID()
  parentCommentId?: string;
}
