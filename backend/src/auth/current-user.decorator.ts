import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestWithUser } from './jwt-auth.guard';

export const CurrentUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    return request.userId;
  },
);
