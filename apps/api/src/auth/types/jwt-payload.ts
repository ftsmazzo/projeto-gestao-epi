export type JwtAudience = 'consultoria' | 'client' | 'plataforma';

export type JwtPayload = {
  sub: string;
  email: string;
  /** Vazio no token da plataforma SaaS. */
  organizationId: string;
  /** Tokens antigos sem audience sao tratados como consultoria. */
  audience?: JwtAudience;
  /** Papel no tenant (consultoria), portal, ou PLATFORM_ADMIN. */
  membershipRole: string;
  servedClientId?: string;
  clientRole?: string;
};

export type ClientJwtPayload = JwtPayload & {
  audience: 'client';
  servedClientId: string;
  clientRole: string;
};
