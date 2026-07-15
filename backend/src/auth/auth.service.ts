import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
export interface AuthenticatedUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
  ) {}
  async register(
    dto: RegisterDto,
  ): Promise<{ user: AuthenticatedUser; token: string }> {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.users.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.users.save(
      this.users.create({
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        email,
        passwordHash,
      }),
    );
    return { user: this.toPublicUser(user), token: this.signToken(user.id) };
  }

  async login(
    dto: LoginDto,
  ): Promise<{ user: AuthenticatedUser; token: string }> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return { user: this.toPublicUser(user), token: this.signToken(user.id) };
  }

  async getById(id: string): Promise<AuthenticatedUser> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new UnauthorizedException();
    return this.toPublicUser(user);
  }
  private signToken(userId: string): string {
    return this.jwt.sign({ sub: userId });
  }

  private toPublicUser(user: User): AuthenticatedUser {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    };
  }
}
