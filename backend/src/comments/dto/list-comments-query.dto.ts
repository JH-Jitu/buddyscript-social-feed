import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListCommentsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 5;

  // "View previous comments": pass the number already shown to fetch the
  // next older window. Comment volume per post is small enough that
  // offset here is fine; the feed itself uses keyset pagination.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;
}
