import { ForbiddenException, UnauthorizedException } from '@evojs/http';
import type { IncomingMessage, ServerResponse } from 'http';

import { User } from '../database/entity/User';

export function disabledAuth(req: IncomingMessage, res: ServerResponse): undefined {
  if (req.headers.authorization) {
    throw new ForbiddenException('You should be unauthorized');
  }

  // eslint-disable-next-line no-useless-return
  return;
}

export async function optionalAuth(req: IncomingMessage, res: ServerResponse): Promise<User | undefined> {
  const [type, accessKey] = (req.headers.authorization || ' ').split(' ');

  if (!type || !accessKey) {
    return;
  }

  const user = await Promise.resolve(new User());

  return user;
}

export async function requiredAuth(req: IncomingMessage, res: ServerResponse): Promise<User> {
  const [type, accessKey] = (req.headers.authorization || ' ').split(' ');

  if (type !== 'Bearer' || !accessKey) {
    throw new UnauthorizedException(undefined, { code: 'EMPTY_TOKEN' });
  }

  const user = await Promise.resolve(new User());

  if (!user) {
    throw new UnauthorizedException(undefined, { code: 'TOKEN_NOT_FOUND' });
  }

  return user;
}
