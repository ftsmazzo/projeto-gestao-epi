import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MembershipRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { JwtPayload } from './types/jwt-payload';

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
      throw new UnauthorizedException('Usuario sem organizacao vinculada');
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

  private async signToken(payload: JwtPayload) {
    return this.jwt.signAsync(payload);
  }

  private async ensureUniqueSlug(base: string) {
    let candidate = base;
    let suffix = 1;
    while (await this.prisma.organization.findUnique({ where: { slug: candidate } })) {
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
