import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePostLikes1752518000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE post_likes (
        post_id uuid NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (post_id, user_id)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX ix_post_likes_post_created
        ON post_likes (post_id, created_at DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE post_likes`);
  }
}
