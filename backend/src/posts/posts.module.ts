import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ImageStorageService } from './image-storage.service';
import { PostLike } from './post-like.entity';
import { Post } from './post.entity';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  imports: [TypeOrmModule.forFeature([Post, PostLike]), AuthModule],
  controllers: [PostsController],
  providers: [PostsService, ImageStorageService],
  exports: [TypeOrmModule, PostsService],
})
export class PostsModule {}
