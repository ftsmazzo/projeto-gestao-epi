import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ClientUserAccessStatus,
  ClientUserRole,
  MembershipRole,
  ServedClientStatus,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type { ClientJwtPayload, JwtPayload } from './types/jwt-payload';

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email ja cadastrado');
    }

    const baseSlug = slugify(dto.organizationName) || 'organizacao';
    const slug = await this.ensureUniqueSlug(baseSlug);
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const contractedLifeQuota = dto.contractedLifeQuota ?? 0;

    const result = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: dto.organizationName.trim(),
          slug,
          contractedLifeQuota,
        },
      });

      const user = await tx.user.create({
        data: {
          email,
          name: dto.name.trim(),
          passwordHash,
        },
      });

      const membership = await tx.membership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: MembershipRole.OWNER,
        },
      });

      return { organization, user, membership };
    });

    await this.audit.log({
      action: 'auth.register',
      organizationId: result.organization.id,
      userId: result.user.id,
      entityType: 'Organization',
      entityId: result.organization.id,
      metadata: {
        email: result.user.email,
        membershipRole: result.membership.role,
        contractedLifeQuota: result.organization.contractedLifeQuota,
      },
    });

    const accessToken = await this.signToken({
      sub: result.user.id,
      email: result.user.email,
      organizationId: result.organization.id,
      audience: 'consultoria',
      membershipRole: result.membership.role,
    });

    return {
      accessToken,
      user: this.toPublicUser(
        result.user,
        result.organization,
        result.membership.role,
      ),
    };
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          include: { organization: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciais invalidas');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Credenciais invalidas');
    }

    const membership = user.memberships[0];
    if (!membership) {
      throw new UnauthorizedException(
        'Usuario sem organizacao vinculada. Se voce e gestor de cliente, use o portal do cliente.',
      );
    }

    await this.audit.log({
      action: 'auth.login',
      organizationId: membership.organizationId,
      userId: user.id,
      entityType: 'User',
      entityId: user.id,
    });

    const accessToken = await this.signToken({
      sub: user.id,
      email: user.email,
      organizationId: membership.organizationId,
      audience: 'consultoria',
      membershipRole: membership.role,
    });

    return {
      accessToken,
      user: this.toPublicUser(
        user,
        membership.organization,
        membership.role,
      ),
    };
  }

  async me(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        memberships: {
          where: { organizationId: payload.organizationId },
          include: { organization: true },
          take: 1,
        },
      },
    });

    if (!user || user.memberships.length === 0) {
      throw new UnauthorizedException('Sessao invalida');
    }

    const membership = user.memberships[0];
    return this.toPublicUser(user, membership.organization, membership.role);
  }

  async clientLogin(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciais invalidas');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Credenciais invalidas');
    }

    const membership = await this.prisma.clientUserMembership.findFirst({
      where: {
        userId: user.id,
        isActive: true,
        role: {
          in: [ClientUserRole.CLIENT_MANAGER, ClientUserRole.STOCK_OPERATOR],
        },
        accessStatus: {
          in: [
            ClientUserAccessStatus.INVITED,
            ClientUserAccessStatus.ACTIVE,
            ClientUserAccessStatus.PREPARED,
          ],
        },
        servedClient: { status: ServedClientStatus.ACTIVE },
      },
      include: {
        servedClient: true,
        organization: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!membership) {
      // Fallback: match by email if userId not yet linked
      const byEmail = await this.prisma.clientUserMembership.findFirst({
        where: {
          email,
          isActive: true,
          role: {
            in: [ClientUserRole.CLIENT_MANAGER, ClientUserRole.STOCK_OPERATOR],
          },
          accessStatus: {
            in: [
              ClientUserAccessStatus.INVITED,
              ClientUserAccessStatus.ACTIVE,
              ClientUserAccessStatus.PREPARED,
            ],
          },
          servedClient: { status: ServedClientStatus.ACTIVE },
        },
        include: {
          servedClient: true,
          organization: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      });
      if (!byEmail) {
        throw new UnauthorizedException(
          'Nenhum acesso de cliente ativo para este usuario. Use o login da Consultoria se for membro da gestao.',
        );
      }
      return this.finalizeClientLogin(user, byEmail);
    }

    return this.finalizeClientLogin(user, membership);
  }

  async clientMe(payload: ClientJwtPayload) {
    const membership = await this.getActiveClientMembership(
      payload.sub,
      payload.servedClientId,
    );
    return this.toClientPortalUser(membership);
  }

  async clientChangePassword(
    payload: ClientJwtPayload,
    dto: ChangePasswordDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException('Sessao invalida');
    }

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) {
      throw new BadRequestException('Senha atual incorreta.');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'A nova senha deve ser diferente da senha atual.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    await this.prisma.clientUserMembership.updateMany({
      where: {
        userId: user.id,
        servedClientId: payload.servedClientId,
      },
      data: {
        mustChangePassword: false,
        accessStatus: ClientUserAccessStatus.ACTIVE,
      },
    });

    await this.audit.log({
      action: 'auth.client_password_changed',
      organizationId: payload.organizationId,
      userId: user.id,
      entityType: 'User',
      entityId: user.id,
      metadata: { servedClientId: payload.servedClientId },
    });

    const membership = await this.getActiveClientMembership(
      payload.sub,
      payload.servedClientId,
    );
    return this.toClientPortalUser(membership);
  }

  private async finalizeClientLogin(
    user: { id: string; email: string; name: string },
    membership: {
      id: string;
      organizationId: string;
      servedClientId: string;
      role: ClientUserRole;
      name: string;
      email: string;
      mustChangePassword: boolean;
      accessStatus: ClientUserAccessStatus;
      userId: string | null;
      servedClient: {
        id: string;
        legalName: string;
        tradeName: string | null;
        cnpj: string;
        status: ServedClientStatus;
      };
      organization: { id: string; name: string };
    },
  ) {
    const updated = await this.prisma.clientUserMembership.update({
      where: { id: membership.id },
      data: {
        userId: user.id,
        accessStatus: ClientUserAccessStatus.ACTIVE,
      },
      include: {
        servedClient: true,
        organization: { select: { id: true, name: true } },
      },
    });

    await this.audit.log({
      action: 'auth.client_login',
      organizationId: membership.organizationId,
      userId: user.id,
      entityType: 'ClientUserMembership',
      entityId: membership.id,
      metadata: {
        servedClientId: membership.servedClientId,
        role: membership.role,
      },
    });

    const accessToken = await this.signToken({
      sub: user.id,
      email: user.email,
      organizationId: membership.organizationId,
      audience: 'client',
      membershipRole: membership.role,
      servedClientId: membership.servedClientId,
      clientRole: membership.role,
    });

    return {
      accessToken,
      user: this.toClientPortalUser({
        ...updated,
        mustChangePassword: membership.mustChangePassword,
      }),
    };
  }

  private async getActiveClientMembership(
    userId: string,
    servedClientId: string,
  ) {
    const membership = await this.prisma.clientUserMembership.findFirst({
      where: {
        userId,
        servedClientId,
        isActive: true,
      },
      include: {
        servedClient: true,
        organization: { select: { id: true, name: true } },
        user: { select: { id: true, email: true, name: true } },
      },
    });
    if (!membership || !membership.user) {
      throw new UnauthorizedException('Sessao invalida');
    }
    if (membership.servedClient.status !== ServedClientStatus.ACTIVE) {
      throw new UnauthorizedException('Cliente inativo.');
    }
    return membership;
  }

  private toClientPortalUser(membership: {
    userId: string | null;
    email: string;
    name: string;
    role: ClientUserRole;
    mustChangePassword: boolean;
    accessStatus: ClientUserAccessStatus;
    organization: { id: string; name: string };
    servedClient: {
      id: string;
      legalName: string;
      tradeName: string | null;
      cnpj: string;
      status: ServedClientStatus;
    };
    user?: { id: string; email: string; name: string } | null;
  }) {
    const id = membership.user?.id ?? membership.userId;
    if (!id) {
      throw new UnauthorizedException('Sessao invalida');
    }
    return {
      id,
      email: membership.user?.email ?? membership.email,
      name: membership.user?.name ?? membership.name,
      role: membership.role,
      mustChangePassword: membership.mustChangePassword,
      accessStatus: membership.accessStatus,
      organization: membership.organization,
      servedClient: {
        id: membership.servedClient.id,
        legalName: membership.servedClient.legalName,
        tradeName: membership.servedClient.tradeName,
        cnpj: membership.servedClient.cnpj,
        status: membership.servedClient.status,
      },
    };
  }

  private async signToken(payload: JwtPayload) {
    return this.jwt.signAsync(payload);
  }

  private async ensureUniqueSlug(base: string) {
    let candidate = base;
    let suffix = 1;
    while (
      await this.prisma.organization.findUnique({ where: { slug: candidate } })
    ) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  }

  private toPublicUser(
    user: { id: string; email: string; name: string },
    organization: {
      id: string;
      name: string;
      slug: string;
      contractedLifeQuota: number;
    },
    membershipRole: MembershipRole,
  ) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      membershipRole,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        contractedLifeQuota: organization.contractedLifeQuota,
      },
    };
  }
}
