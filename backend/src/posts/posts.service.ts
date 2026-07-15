import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { decodeCursor, encodeCursor } from '../common/cursor';
import { CreatePostDto } from './dto/create-post.dto';
import { FeedQueryDto } from './dto/feed-query.dto';
import { Post } from './post.entity';

import { NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import { PostLike } from './post-like.entity';

export interface FeedAuthor {
  id: string;
  firstName: string;
  lastName: string;
}

export interface FeedPost {
  id: string;
  content: string;
  imageUrl: string | null;
  privacy: string;
  createdAt: Date;
  author: FeedAuthor;
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
}

export interface FeedPage {
  items: FeedPost[];
  nextCursor: string | null;
}

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post) private readonly posts: Repository<Post>,
    @InjectRepository(PostLike)
    private readonly postLikes: Repository<PostLike>,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    authorId: string,
    dto: CreatePostDto,
    file?: Express.Multer.File,
  ): Promise<FeedPost> {
    const saved = await this.posts.save(
      this.posts.create({
        authorId,
        content: dto.content,
        privacy: dto.privacy,
        imageUrl: file ? `/uploads/${file.filename}` : null,
      }),
    );
    const post = await this.feedBaseQuery()
      .where('post.id = :id', { id: saved.id })
      .getOne();
    return {
      ...this.toFeedPost(post!),
      likeCount: 0,
      likedByMe: false,
      commentCount: 0,
    };
  }

  async getFeed(viewerId: string, query: FeedQueryDto): Promise<FeedPage> {
    const qb = this.feedBaseQuery()
      .where('(post.privacy = :pub OR post.authorId = :viewerId)', {
        pub: 'PUBLIC',
        viewerId,
      })
      .orderBy('post.createdAt', 'DESC')
      .addOrderBy('post.id', 'DESC')
      .take(query.limit + 1);
    if (query.cursor) {
      const cursor = decodeCursor(query.cursor);
      if (cursor) {
        qb.andWhere('(post.createdAt, post.id) < (:cAt, :cId)', {
          cAt: cursor.createdAt,
          cId: cursor.id,
        });
      }
    }
    const rows = await qb.getMany();
    const hasMore = rows.length > query.limit;
    const pageRows = hasMore ? rows.slice(0, query.limit) : rows;
    const last = pageRows.at(-1);

    const postIds = pageRows.map((row) => row.id);
    const [likeState, commentCounts] = await Promise.all([
      this.getLikeState(postIds, viewerId),
      this.getCommentCounts(postIds),
    ]);

    return {
      items: pageRows.map((row) => ({
        ...this.toFeedPost(row),
        likeCount: likeState.counts.get(row.id) ?? 0,
        likedByMe: likeState.likedByMe.has(row.id),
        commentCount: commentCounts.get(row.id) ?? 0,
      })),
      nextCursor:
        hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  async like(postId: string, userId: string): Promise<{ likeCount: number }> {
    await this.assertCanViewPost(postId, userId);
    await this.postLikes
      .createQueryBuilder()
      .insert()
      .values({ postId, userId })
      .orIgnore() // INSERT ... ON CONFLICT DO NOTHING
      .execute();
    return { likeCount: await this.postLikes.countBy({ postId }) };
  }

  async unlike(postId: string, userId: string): Promise<{ likeCount: number }> {
    await this.assertCanViewPost(postId, userId);
    await this.postLikes.delete({ postId, userId });
    return { likeCount: await this.postLikes.countBy({ postId }) };
  }

  async getLikers(postId: string, viewerId: string): Promise<FeedAuthor[]> {
    await this.assertCanViewPost(postId, viewerId);
    const likes = await this.postLikes.find({
      where: { postId },
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

  async assertCanViewPost(postId: string, viewerId: string): Promise<Post> {
    const post = await this.posts.findOne({ where: { id: postId } });
    if (!post || (post.privacy === 'PRIVATE' && post.authorId !== viewerId)) {
      throw new NotFoundException('Post not found');
    }
    return post;
  }

  //   Batch like data for a page of posts: 2 indexed queries, no N+1.
  private async getLikeState(postIds: string[], viewerId: string) {
    const counts = new Map<string, number>();
    const likedByMe = new Set<string>();
    if (postIds.length === 0) return { counts, likedByMe };
    const rawCounts: Array<{ post_id: string; count: string }> =
      await this.postLikes
        .createQueryBuilder('pl')
        .select('pl.post_id', 'post_id')
        .addSelect('COUNT(*)', 'count')
        .where('pl.post_id IN (:...postIds)', { postIds })
        .groupBy('pl.post_id')
        .getRawMany();
    for (const row of rawCounts) counts.set(row.post_id, Number(row.count));
    const mine = await this.postLikes.findBy({
      postId: In(postIds),
      userId: viewerId,
    });
    for (const like of mine) likedByMe.add(like.postId);
    return { counts, likedByMe };
  }

  private async getCommentCounts(
    postIds: string[],
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (postIds.length === 0) return counts;
    const rows: Array<{ post_id: string; count: string }> =
      await this.dataSource.query(
        `SELECT post_id, COUNT(*) AS count
           FROM comments
          WHERE post_id = ANY($1)
          GROUP BY post_id`,
        [[...postIds]],
      );
    for (const row of rows) counts.set(row.post_id, Number(row.count));
    return counts;
  }

  private feedBaseQuery(): SelectQueryBuilder<Post> {
    return this.posts
      .createQueryBuilder('post')
      .innerJoinAndSelect('post.author', 'author');
  }

  private toFeedPost(
    post: Post,
  ): Omit<FeedPost, 'likeCount' | 'likedByMe' | 'commentCount'> {
    return {
      id: post.id,
      content: post.content,
      imageUrl: post.imageUrl,
      privacy: post.privacy,
      createdAt: post.createdAt,
      author: {
        id: post.author.id,
        firstName: post.author.firstName,
        lastName: post.author.lastName,
      },
    };
  }
}
