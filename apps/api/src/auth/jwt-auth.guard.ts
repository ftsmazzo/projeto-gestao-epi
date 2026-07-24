import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { JwtPayload } from './types/jwt-payload';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = JwtPayload>(
    err: unknown,
    user: TUser | false,
    _info?: unknown,
    _context?: ExecutionContext,
    _status?: unknown,
  ): TUser {
    if (err || !user) {
      throw err instanceof Error
        ? err
        : new UnauthorizedException('Sessao invalida');
    }
    const payload = user as unknown as JwtPayload;
    if (payload.audience && payload.audience !== 'consultoria') {
      throw new UnauthorizedException(
        'Token do portal do cliente nao autenticado na Consultoria.',
      );
    }
    return user;
  }
}

@Injectable()
export class ClientJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = JwtPayload>(
    err: unknown,
    user: TUser | false,
    _info?: unknown,
    _context?: ExecutionContext,
    _status?: unknown,
  ): TUser {
    if (err || !user) {
      throw err instanceof Error
        ? err
        : new UnauthorizedException('Sessao invalida');
    }
    const payload = user as unknown as JwtPayload;
    if (payload.audience !== 'client' || !payload.servedClientId) {
      throw new UnauthorizedException(
        'Token da Consultoria nao autenticado no portal do cliente.',
      );
    }
    return user;
  }
}
