import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ClientUserAccessStatus,
  ClientUserRole,
  MembershipRole,
  OrganizationStatus,
  ServedClientStatus,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { CommunicationsService } from '../communications/communications.service';
import { PrismaService } from '../prisma/prisma.service';
import { expireTrialForClient } from '../subscriptions/trial-expire';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { ForgotPasswordDto } from './dto/forgot-password.dto';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type { ClientJwtPayload, JwtPayload } from './types/jwt-payload';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly communications: CommunicationsService,
  ) {}

  async register(_dto: RegisterDto) {
    throw new ForbiddenException(
      'O cadastro de consultoria e feito pela ProntEPI no Painel SaaS.',
    );
  }

  private parsePlatformAdminEmails() {
    return (process.env.PLATFORM_ADMIN_EMAILS ?? '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }

  private assertOrganizationActive(status: OrganizationStatus) {
    if (status === OrganizationStatus.SUSPENDED) {
      throw new UnauthorizedException(
        'Esta consultoria esta suspensa. Fale com a ProntEPI.',
      );
    }
  }

  async platformLogin(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Credenciais invalidas');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Credenciais invalidas');
    }

    const allowlisted = this.parsePlatformAdminEmails().includes(email);
    if (!user.isPlatformAdmin && !allowlisted) {
      throw new UnauthorizedException(
        'Este usuario nao tem acesso ao Painel SaaS da ProntEPI.',
      );
    }

    if (!user.isPlatformAdmin && allowlisted) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { isPlatformAdmin: true },
      });
    }

    await this.audit.log({
      action: 'auth.platform_login',
      userId: user.id,
      entityType: 'User',
      entityId: user.id,
      metadata: { email: user.email },
    });

    const accessToken = await this.signToken({
      sub: user.id,
      email: user.email,
      organizationId: '',
      audience: 'plataforma',
      membershipRole: 'PLATFORM_ADMIN',
    });

    return {
      accessToken,
      user: this.toPlatformUser(user),
    };
  }

  async platformMe(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || !user.isPlatformAdmin) {
      throw new UnauthorizedException('Sessao invalida');
    }
    return this.toPlatformUser(user);
  }

  private toPlatformUser(user: { id: string; email: string; name: string }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isPlatformAdmin: true as const,
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

    this.assertOrganizationActive(membership.organization.status);

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

  async changePassword(payload: JwtPayload, dto: ChangePasswordDto) {
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
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
    });

    await this.audit.log({
      action: 'auth.password_changed',
      organizationId: payload.organizationId,
      userId: user.id,
      entityType: 'User',
      entityId: user.id,
    });

    const membership = user.memberships[0];
    this.assertOrganizationActive(membership.organization.status);
    return this.toPublicUser(
      updated,
      membership.organization,
      membership.role,
    );
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
    this.assertOrganizationActive(membership.organization.status);
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
        organization: { select: { id: true, name: true, status: true } },
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
          organization: { select: { id: true, name: true, status: true } },
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
      organization: { id: string; name: string; status: OrganizationStatus };
    },
  ) {
    this.assertOrganizationActive(membership.organization.status);
    const updated = await this.prisma.clientUserMembership.update({
      where: { id: membership.id },
      data: {
        userId: user.id,
        accessStatus: ClientUserAccessStatus.ACTIVE,
      },
      include: {
        servedClient: true,
        organization: { select: { id: true, name: true, status: true } },
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
        organization: { select: { id: true, name: true, status: true } },
        user: { select: { id: true, email: true, name: true } },
      },
    });
    if (!membership || !membership.user) {
      throw new UnauthorizedException('Sessao invalida');
    }
    this.assertOrganizationActive(membership.organization.status);
    const trialExpired = await expireTrialForClient(
      this.prisma,
      servedClientId,
    );
    if (trialExpired) {
      throw new UnauthorizedException(
        'Periodo de teste encerrado. A consultoria precisa ativar a assinatura.',
      );
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
    organization: { id: string; name: string; status?: OrganizationStatus };
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

  /**
   * Reset publico de senha (piloto).
   * Sempre responde ok; se a conta existir, gera senha temporaria e tenta enviar.
   * Se comunicacoes estiverem off, devolve a senha temporaria na resposta.
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    const generic = {
      ok: true as const,
      message:
        'Se o e-mail existir, geramos uma senha temporaria. Verifique o e-mail/WhatsApp ou a senha exibida abaixo.',
      audience: dto.audience,
      temporaryPassword: null as string | null,
      accessUrl: null as string | null,
      deliveryEnabled: this.communications.isEnabled(),
    };

    if (dto.audience === 'portal') {
      return this.forgotPortalPassword(email, generic);
    }
    return this.forgotConsultoriaPassword(email, generic);
  }

  private async forgotPortalPassword(
    email: string,
    generic: {
      ok: true;
      message: string;
      audience: 'portal' | 'consultoria';
      temporaryPassword: string | null;
      accessUrl: string | null;
      deliveryEnabled: boolean;
    },
  ) {
    const membership = await this.prisma.clientUserMembership.findFirst({
      where: {
        email,
        isActive: true,
        role: { in: [ClientUserRole.CLIENT_MANAGER, ClientUserRole.STOCK_OPERATOR] },
        servedClient: { status: ServedClientStatus.ACTIVE },
      },
      orderBy: { updatedAt: 'desc' },
    });
    if (!membership) {
      return generic;
    }

    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    const linkedUser = membership.userId
      ? await this.prisma.user.findUnique({ where: { id: membership.userId } })
      : null;

    const ensuredUser =
      linkedUser ??
      (await this.prisma.user.upsert({
        where: { email },
        update: {
          name: membership.name,
          passwordHash,
        },
        create: {
          email,
          name: membership.name,
          passwordHash,
        },
      }));

    if (linkedUser) {
      await this.prisma.user.update({
        where: { id: linkedUser.id },
        data: { passwordHash },
      });
    }

    await this.prisma.clientUserMembership.update({
      where: { id: membership.id },
      data: {
        userId: ensuredUser.id,
        accessStatus: ClientUserAccessStatus.INVITED,
        mustChangePassword: true,
        temporaryPasswordCreatedAt: new Date(),
      },
    });

    const accessUrl = this.resolvePortalAccessUrl();
    const delivery = await this.communications.enqueueClientAccessInvite({
      organizationId: membership.organizationId,
      recipientName: membership.name,
      recipientEmail: membership.email,
      recipientPhone: membership.phone,
      temporaryPassword,
      accessUrl,
      membershipId: membership.id,
    });

    await this.audit.log({
      action: 'auth.forgot_password_portal',
      organizationId: membership.organizationId,
      userId: ensuredUser.id,
      entityType: 'ClientUserMembership',
      entityId: membership.id,
      metadata: { email, deliveryEnabled: delivery.enabled },
    });

    return {
      ...generic,
      temporaryPassword: delivery.enabled ? null : temporaryPassword,
      accessUrl,
      deliveryEnabled: delivery.enabled,
      channels: {
        email: delivery.email,
        whatsapp: delivery.whatsapp,
      },
    };
  }

  private async forgotConsultoriaPassword(
    email: string,
    generic: {
      ok: true;
      message: string;
      audience: 'portal' | 'consultoria';
      temporaryPassword: string | null;
      accessUrl: string | null;
      deliveryEnabled: boolean;
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          take: 1,
          orderBy: { createdAt: 'asc' },
          include: { organization: { select: { id: true, name: true } } },
        },
      },
    });
    if (!user || user.memberships.length === 0) {
      return generic;
    }

    const membership = user.memberships[0];
    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: true },
    });

    const accessUrl = this.resolveConsultoriaAccessUrl();
    const delivery = await this.communications.enqueueConsultoriaAccessInvite({
      organizationId: membership.organizationId,
      recipientName: user.name,
      recipientEmail: user.email,
      recipientPhone: null,
      temporaryPassword,
      accessUrl,
      membershipId: membership.id,
      roleLabel:
        membership.role === 'OWNER'
          ? 'Administrador geral'
          : membership.role === 'ADMIN'
            ? 'Administrador'
            : 'Membro',
    });

    await this.audit.log({
      action: 'auth.forgot_password_consultoria',
      organizationId: membership.organizationId,
      userId: user.id,
      entityType: 'User',
      entityId: user.id,
      metadata: {
        email,
        deliveryEnabled: delivery.enabled,
        emailStatus: delivery.email,
      },
    });

    return {
      ...generic,
      temporaryPassword: delivery.enabled ? null : temporaryPassword,
      accessUrl,
      deliveryEnabled: delivery.enabled,
      channels: {
        email: delivery.email,
        whatsapp: delivery.whatsapp,
      },
    };
  }

  private generateTemporaryPassword(): string {
    const alphabet =
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';
    const bytes = randomBytes(14);
    let out = '';
    for (let i = 0; i < 14; i += 1) {
      out += alphabet[bytes[i] % alphabet.length];
    }
    return out;
  }

  private resolvePortalAccessUrl(): string {
    const fromEnv =
      process.env.CLIENT_PORTAL_URL?.trim() ||
      process.env.WEB_APP_URL?.trim() ||
      process.env.CORS_ORIGIN?.split(',')[0]?.trim();
    const base = (fromEnv || 'http://localhost:3000').replace(/\/$/, '');
    if (base.endsWith('/portal/login') || base.endsWith('/portal')) {
      return base.includes('/login') ? base : `${base}/login`;
    }
    return `${base}/portal/login`;
  }

  private resolveConsultoriaAccessUrl(): string {
    const fromEnv =
      process.env.WEB_APP_URL?.trim() ||
      process.env.CORS_ORIGIN?.split(',')[0]?.trim();
    const base = (fromEnv || 'http://localhost:3000').replace(/\/$/, '');
    return `${base}/login`;
  }

  private toPublicUser(
    user: {
      id: string;
      email: string;
      name: string;
      mustChangePassword?: boolean;
    },
    organization: {
      id: string;
      name: string;
      slug: string;
      contractedLifeQuota: number;
      status: OrganizationStatus;
      logoPath?: string | null;
    },
    membershipRole: MembershipRole,
  ) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      membershipRole,
      mustChangePassword: Boolean(user.mustChangePassword),
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        contractedLifeQuota: organization.contractedLifeQuota,
        status: organization.status,
        hasLogo: Boolean(organization.logoPath),
      },
    };
  }
}
