import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export const POST_PRIVACIES = ['PUBLIC', 'PRIVATE'] as const;
export type PostPrivacy = (typeof POST_PRIVACIES)[number];

@Entity('posts')
@Index('ix_posts_created_at_id', ['createdAt', 'id'])
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('ix_posts_author_id')
  @Column({ name: 'author_id', type: 'uuid' })
  authorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author: User;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'image_url', type: 'varchar', length: 500, nullable: true })
  imageUrl: string | null;

  @Column({ type: 'varchar', length: 10, default: 'PUBLIC' })
  privacy: PostPrivacy;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
