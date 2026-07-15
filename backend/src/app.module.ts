import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { existsSync } from 'fs';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import { CommentsModule } from './comments/comments.module';
import { PostsModule } from './posts/posts.module';
import { UPLOADS_DIR } from './posts/upload.config';
import { UsersModule } from './users/users.module';

const FRONTEND_DIST = join(__dirname, '..', '..', 'frontend', 'dist');

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('POSTGRES_HOST', 'localhost'),
        port: config.get<number>('POSTGRES_PORT', 5433),
        username: config.get<string>('POSTGRES_USER', 'buddyscript'),
        password: config.get<string>('POSTGRES_PASSWORD', 'buddyscript'),
        database: config.get<string>('POSTGRES_DB', 'buddyscript'),
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),

    ServeStaticModule.forRoot({
      rootPath: UPLOADS_DIR,
      serveRoot: '/uploads',
      serveStaticOptions: { index: false, fallthrough: false },
    }),
    ...(existsSync(FRONTEND_DIST)
      ? [
          ServeStaticModule.forRoot({
            rootPath: FRONTEND_DIST,
            exclude: ['/api/{*splat}', '/uploads/{*splat}'],
          }),
        ]
      : []),
    UsersModule,
    AuthModule,
    PostsModule,
    CommentsModule,
  ],

  // controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
