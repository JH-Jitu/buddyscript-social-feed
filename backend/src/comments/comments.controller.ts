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
  UseGuards,
} from '@nestjs/common';
import { CurrentUserId } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ListCommentsQueryDto } from './dto/list-comments-query.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get('posts/:postId/comments')
  list(
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUserId() userId: string,
    @Query() query: ListCommentsQueryDto,
  ) {
    return this.commentsService.listForPost(postId, userId, query);
  }

  @Post('posts/:postId/comments')
  create(
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.create(postId, userId, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('comments/:id/like')
  like(
    @Param('id', ParseUUIDPipe) commentId: string,
    @CurrentUserId() userId: string,
  ) {
    return this.commentsService.like(commentId, userId);
  }

  @Delete('comments/:id/like')
  unlike(
    @Param('id', ParseUUIDPipe) commentId: string,
    @CurrentUserId() userId: string,
  ) {
    return this.commentsService.unlike(commentId, userId);
  }

  @Get('comments/:id/likes')
  getLikers(
    @Param('id', ParseUUIDPipe) commentId: string,
    @CurrentUserId() userId: string,
  ) {
    return this.commentsService.getLikers(commentId, userId);
  }
}
