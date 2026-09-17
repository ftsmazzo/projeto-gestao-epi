import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from './types/jwt-payload';

@Injectable()
export class ActivePlatformAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload }>();
    const userId = request.user?.sub;
    if (!userId) throw new ForbiddenException('Administrador nao identificado.');
    const user = await this.prisma.user.findFirst({
      where: { id: userId, isPlatformAdmin: true },
      select: { id: true },
    });
    if (!user) {
      throw new ForbiddenException(
        'Acesso administrativo da plataforma foi revogado.',
      );
    }
    return true;
  }
}
