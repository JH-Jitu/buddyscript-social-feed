import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePosts1752517000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE posts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        author_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        content text NOT NULL,
        image_url varchar(500),
        privacy varchar(10) NOT NULL DEFAULT 'PUBLIC',
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_posts_privacy CHECK (privacy IN ('PUBLIC', 'PRIVATE')),
        CONSTRAINT chk_posts_content_not_blank CHECK (char_length(btrim(content)) > 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX ix_posts_created_at_id ON posts (created_at DESC, id DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX ix_posts_author_id ON posts (author_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE posts`);
  }
}
