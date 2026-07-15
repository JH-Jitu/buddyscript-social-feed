import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';

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
    UsersModule,
    AuthModule,
  ],

  // controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
