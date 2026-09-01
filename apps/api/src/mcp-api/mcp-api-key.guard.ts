import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export type McpApiContext = {
  organizationId: string;
  organizationName: string;
};

function safeEqual(a: string, b: string) {
  const da = createHash('sha256').update(a, 'utf8').digest();
  const db = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(da, db);
}

@Injectable()
export class McpApiKeyGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      mcp?: McpApiContext;
    }>();
    const configuredKey = this.config.get<string>('MCP_API_KEY')?.trim();
    if (!configuredKey) {
      throw new UnauthorizedException('Integracao MCP nao configurada.');
    }

    const auth = req.headers.authorization?.trim() ?? '';
    const token = auth.startsWith('Bearer ')
      ? auth.slice(7).trim()
      : req.headers['x-mcp-api-key']?.trim() ?? '';
    if (!token || !safeEqual(token, configuredKey)) {
      throw new UnauthorizedException('Chave MCP invalida.');
    }

    const orgId = this.config.get<string>('MCP_ORGANIZATION_ID')?.trim();
    const orgSlug = this.config.get<string>('MCP_ORGANIZATION_SLUG')?.trim();
    const orgName = this.config.get<string>('MCP_ORGANIZATION_NAME')?.trim();
    let organization = orgId
      ? await this.prisma.organization.findUnique({
          where: { id: orgId },
          select: { id: true, name: true },
        })
      : orgSlug
        ? await this.prisma.organization.findUnique({
            where: { slug: orgSlug },
            select: { id: true, name: true },
          })
        : null;

    if (!organization && orgName) {
      organization = await this.prisma.organization.findFirst({
        where: { name: { contains: orgName, mode: 'insensitive' } },
        select: { id: true, name: true },
        orderBy: { createdAt: 'asc' },
      });
    }

    if (!organization) {
      throw new UnauthorizedException(
        'Organizacao MCP nao encontrada. Configure MCP_ORGANIZATION_ID, MCP_ORGANIZATION_SLUG ou MCP_ORGANIZATION_NAME.',
      );
    }

    req.mcp = {
      organizationId: organization.id,
      organizationName: organization.name,
    };
    return true;
  }
}
