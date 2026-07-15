import * as bcrypt from 'bcryptjs';
import { CommentLike } from '../../comments/comment-like.entity';
import { Comment } from '../../comments/comment.entity';
import { PostLike } from '../../posts/post-like.entity';
import { Post } from '../../posts/post.entity';
import { User } from '../../users/user.entity';
import dataSource from '../data-source';

const PASSWORD = 'Password1';

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

async function seed() {
  const ds = await dataSource.initialize();

  try {
    const users = ds.getRepository(User);
    const posts = ds.getRepository(Post);
    const postLikes = ds.getRepository(PostLike);
    const comments = ds.getRepository(Comment);
    const commentLikes = ds.getRepository(CommentLike);

    if ((await users.count()) > 0) {
      console.log('Database already contains users — skipping seed.');
      return;
    }

    const passwordHash = await bcrypt.hash(PASSWORD, 10);

    const [sarah, rafiq, nadia] = await users.save([
      users.create({
        firstName: 'Sarah',
        lastName: 'Ahmed',
        email: 'sarah@demo.com',
        passwordHash,
      }),
      users.create({
        firstName: 'Rafiq',
        lastName: 'Islam',
        email: 'rafiq@demo.com',
        passwordHash,
      }),
      users.create({
        firstName: 'Nadia',
        lastName: 'Khan',
        email: 'nadia@demo.com',
        passwordHash,
      }),
    ]);

    // The 4th post (Sarah's private draft) is not referenced afterwards.
    const [trip, darkMode, book, , deploy] = await posts.save([
      posts.create({
        authorId: nadia.id,
        content:
          'Just wrapped up a weekend trip to Sylhet. The tea gardens are unreal this time of year.',
        privacy: 'PUBLIC',
        createdAt: hoursAgo(48),
      }),
      posts.create({
        authorId: rafiq.id,
        content:
          'Hot take: dark mode is just developers cosplaying as hackers.',
        privacy: 'PUBLIC',
        createdAt: hoursAgo(26),
      }),
      posts.create({
        authorId: sarah.id,
        content:
          'Started reading Designing Data-Intensive Applications again. Third attempt, wish me luck.',
        privacy: 'PUBLIC',
        createdAt: hoursAgo(20),
      }),
      posts.create({
        authorId: sarah.id,
        content:
          'Draft ideas for the next sprint retro. Keeping this one private until it is ready.',
        privacy: 'PRIVATE',
        createdAt: hoursAgo(6),
      }),
      posts.create({
        authorId: rafiq.id,
        content:
          'Deployed my first NestJS + React app today. The monorepo setup finally clicked.',
        privacy: 'PUBLIC',
        createdAt: hoursAgo(3),
      }),
    ]);

    await postLikes.save([
      postLikes.create({ postId: trip.id, userId: sarah.id }),
      postLikes.create({ postId: trip.id, userId: rafiq.id }),
      postLikes.create({ postId: darkMode.id, userId: nadia.id }),
      postLikes.create({ postId: book.id, userId: rafiq.id }),
      postLikes.create({ postId: deploy.id, userId: sarah.id }),
      postLikes.create({ postId: deploy.id, userId: nadia.id }),
    ]);

    const congrats = await comments.save(
      comments.create({
        postId: deploy.id,
        authorId: sarah.id,
        content: 'Congrats! Is the code public yet?',
        createdAt: hoursAgo(2.5),
      }),
    );
    await comments.save([
      comments.create({
        postId: deploy.id,
        authorId: rafiq.id,
        parentCommentId: congrats.id,
        content: 'Pushing it this weekend, will share the link.',
        createdAt: hoursAgo(2),
      }),
      comments.create({
        postId: deploy.id,
        authorId: nadia.id,
        parentCommentId: congrats.id,
        content: 'Same question, would love to read the setup.',
        createdAt: hoursAgo(1.5),
      }),
    ]);

    const envy = await comments.save(
      comments.create({
        postId: trip.id,
        authorId: sarah.id,
        content: 'The photos you sent were stunning. Adding Sylhet to my list.',
        createdAt: hoursAgo(40),
      }),
    );
    await comments.save(
      comments.create({
        postId: darkMode.id,
        authorId: nadia.id,
        content: 'Says the person with a terminal green-on-black theme.',
        createdAt: hoursAgo(24),
      }),
    );

    await commentLikes.save([
      commentLikes.create({ commentId: congrats.id, userId: rafiq.id }),
      commentLikes.create({ commentId: congrats.id, userId: nadia.id }),
      commentLikes.create({ commentId: envy.id, userId: nadia.id }),
    ]);

    console.log('Seed complete.');
    console.log('Demo accounts (password for all: %s):', PASSWORD);
    console.log('  sarah@demo.com  (has one private post)');
    console.log('  rafiq@demo.com');
    console.log('  nadia@demo.com');
  } finally {
    await ds.destroy();
  }
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exitCode = 1;
});
