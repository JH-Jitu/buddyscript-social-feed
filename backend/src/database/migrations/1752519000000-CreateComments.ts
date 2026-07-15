import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateComments1752519000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE comments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id uuid NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
        author_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        parent_comment_id uuid REFERENCES comments (id) ON DELETE CASCADE,
        content text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_comments_content_not_blank CHECK (char_length(btrim(content)) > 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX ix_comments_post_toplevel
        ON comments (post_id, created_at)
        WHERE parent_comment_id IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX ix_comments_parent
        ON comments (parent_comment_id, created_at)
        WHERE parent_comment_id IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE comment_likes (
        comment_id uuid NOT NULL REFERENCES comments (id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (comment_id, user_id)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX ix_comment_likes_comment_created
        ON comment_likes (comment_id, created_at DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE comment_likes`);
    await queryRunner.query(`DROP TABLE comments`);
  }
}
