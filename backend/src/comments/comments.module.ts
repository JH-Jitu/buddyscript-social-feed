import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { PostsModule } from '../posts/posts.module';
import { CommentLike } from './comment-like.entity';
import { Comment } from './comment.entity';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Comment, CommentLike]),
    AuthModule,
    PostsModule, // for the post-visibility check
  ],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
