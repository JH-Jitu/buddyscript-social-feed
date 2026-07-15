import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUserId } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreatePostDto } from './dto/create-post.dto';
import { FeedQueryDto } from './dto/feed-query.dto';
import { PostsService } from './posts.service';
import { imageUploadOptions } from './upload.config';

@UseGuards(JwtAuthGuard)
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  getFeed(@CurrentUserId() userId: string, @Query() query: FeedQueryDto) {
    return this.postsService.getFeed(userId, query);
  }

  @Post()
  @UseInterceptors(FileInterceptor('image', imageUploadOptions))
  create(
    @CurrentUserId() userId: string,
    @Body() dto: CreatePostDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.postsService.create(userId, dto, file);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/like')
  like(
    @Param('id', ParseUUIDPipe) postId: string,
    @CurrentUserId() userId: string,
  ) {
    return this.postsService.like(postId, userId);
  }

  @Delete(':id/like')
  unlike(
    @Param('id', ParseUUIDPipe) postId: string,
    @CurrentUserId() userId: string,
  ) {
    return this.postsService.unlike(postId, userId);
  }

  @Get(':id/likes')
  getLikers(
    @Param('id', ParseUUIDPipe) postId: string,
    @CurrentUserId() userId: string,
  ) {
    return this.postsService.getLikers(postId, userId);
  }
}
