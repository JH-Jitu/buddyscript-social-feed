import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import type { FeedAuthor } from '../posts/posts.service';
import { PostsService } from '../posts/posts.service';
import { CommentLike } from './comment-like.entity';
import { Comment } from './comment.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ListCommentsQueryDto } from './dto/list-comments-query.dto';

export interface CommentView {
  id: string;
  postId: string;
  parentCommentId: string | null;
  content: string;
  createdAt: Date;
  author: FeedAuthor;
  likeCount: number;
  likedByMe: boolean;
  replies: CommentView[];
}

export interface CommentPage {
  items: CommentView[];
  totalTopLevel: number;
  hasMore: boolean;
}

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly comments: Repository<Comment>,
    @InjectRepository(CommentLike)
    private readonly commentLikes: Repository<CommentLike>,
    private readonly postsService: PostsService,
  ) {}

  async create(
    postId: string,
    authorId: string,
    dto: CreateCommentDto,
  ): Promise<CommentView> {
    await this.postsService.assertCanViewPost(postId, authorId);

    if (dto.parentCommentId) {
      const parent = await this.comments.findOne({
        where: { id: dto.parentCommentId },
      });
      if (!parent || parent.postId !== postId) {
        throw new NotFoundException('Comment not found');
      }
      if (parent.parentCommentId) {
        throw new BadRequestException('Replies cannot be nested deeper');
      }
    }

    const saved = await this.comments.save(
      this.comments.create({
        postId,
        authorId,
        parentCommentId: dto.parentCommentId ?? null,
        content: dto.content,
      }),
    );

    const withAuthor = await this.comments.findOneOrFail({
      where: { id: saved.id },
      relations: { author: true },
    });

    return this.toView(withAuthor, new Map(), new Set(), []);
  }

  /**
   * Returns the latest `limit` top-level comments (displayed oldest→newest,
   * like the design's comment thread) with all replies and like state.
   * `offset` skips the newest N already shown ("view previous comments").
   */
  async listForPost(
    postId: string,
    viewerId: string,
    query: ListCommentsQueryDto,
  ): Promise<CommentPage> {
    await this.postsService.assertCanViewPost(postId, viewerId);

    const [topLevel, totalTopLevel] = await this.comments.findAndCount({
      where: { postId, parentCommentId: IsNull() },
      relations: { author: true },
      order: { createdAt: 'DESC' },
      skip: query.offset,
      take: query.limit,
    });

    const replies = await this.comments.find({
      where: { parentCommentId: In(topLevel.map((c) => c.id)) },
      relations: { author: true },
      order: { createdAt: 'ASC' },
    });

    const allIds = [...topLevel, ...replies].map((c) => c.id);
    const { counts, likedByMe } = await this.getLikeState(allIds, viewerId);

    const repliesByParent = new Map<string, Comment[]>();
    for (const reply of replies) {
      const list = repliesByParent.get(reply.parentCommentId!) ?? [];
      list.push(reply);
      repliesByParent.set(reply.parentCommentId!, list);
    }

    const items = topLevel.reverse().map((comment) =>
      this.toView(
        comment,
        counts,
        likedByMe,
        (repliesByParent.get(comment.id) ?? []).map((reply) =>
          this.toView(reply, counts, likedByMe, []),
        ),
      ),
    );

    return {
      items,
      totalTopLevel,
      hasMore: query.offset + topLevel.length < totalTopLevel,
    };
  }

  async like(
    commentId: string,
    userId: string,
  ): Promise<{ likeCount: number }> {
    await this.assertCanViewComment(commentId, userId);
    await this.commentLikes
      .createQueryBuilder()
      .insert()
      .values({ commentId, userId })
      .orIgnore()
      .execute();
    return { likeCount: await this.commentLikes.countBy({ commentId }) };
  }

  async unlike(
    commentId: string,
    userId: string,
  ): Promise<{ likeCount: number }> {
    await this.assertCanViewComment(commentId, userId);
    await this.commentLikes.delete({ commentId, userId });
    return { likeCount: await this.commentLikes.countBy({ commentId }) };
  }

  async getLikers(commentId: string, viewerId: string): Promise<FeedAuthor[]> {
    await this.assertCanViewComment(commentId, viewerId);

    const likes = await this.commentLikes.find({
      where: { commentId },
      relations: { user: true },
      order: { createdAt: 'DESC' },
      take: 100,
    });

    return likes.map((like) => ({
      id: like.user.id,
      firstName: like.user.firstName,
      lastName: like.user.lastName,
    }));
  }

  private async assertCanViewComment(
    commentId: string,
    viewerId: string,
  ): Promise<Comment> {
    const comment = await this.comments.findOne({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Comment not found');
    await this.postsService.assertCanViewPost(comment.postId, viewerId);
    return comment;
  }

  private async getLikeState(commentIds: string[], viewerId: string) {
    const counts = new Map<string, number>();
    const likedByMe = new Set<string>();
    if (commentIds.length === 0) return { counts, likedByMe };

    const rawCounts: Array<{ comment_id: string; count: string }> =
      await this.commentLikes
        .createQueryBuilder('cl')
        .select('cl.comment_id', 'comment_id')
        .addSelect('COUNT(*)', 'count')
        .where('cl.comment_id IN (:...commentIds)', { commentIds })
        .groupBy('cl.comment_id')
        .getRawMany();
    for (const row of rawCounts) counts.set(row.comment_id, Number(row.count));

    const mine = await this.commentLikes.findBy({
      commentId: In(commentIds),
      userId: viewerId,
    });
    for (const like of mine) likedByMe.add(like.commentId);

    return { counts, likedByMe };
  }

  private toView(
    comment: Comment,
    counts: Map<string, number>,
    likedByMe: Set<string>,
    replies: CommentView[],
  ): CommentView {
    return {
      id: comment.id,
      postId: comment.postId,
      parentCommentId: comment.parentCommentId,
      content: comment.content,
      createdAt: comment.createdAt,
      author: {
        id: comment.author.id,
        firstName: comment.author.firstName,
        lastName: comment.author.lastName,
      },
      likeCount: counts.get(comment.id) ?? 0,
      likedByMe: likedByMe.has(comment.id),
      replies,
    };
  }
}
