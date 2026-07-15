import { Transform } from 'class-transformer';
import { IsIn, IsString, Length } from 'class-validator';
import { POST_PRIVACIES } from '../post.entity';
import type { PostPrivacy } from '../post.entity';

export class CreatePostDto {
  @IsString()
  @Transform(({ value }): unknown =>
    typeof value === 'string' ? value.trim() : value,
  )
  @Length(1, 5000)
  content: string;

  @IsIn(POST_PRIVACIES)
  privacy: PostPrivacy = 'PUBLIC';
}
