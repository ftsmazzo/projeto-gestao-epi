export type JwtAudience = 'consultoria' | 'client';

export type JwtPayload = {
  sub: string;
  email: string;
  organizationId: string;
  /** Tokens antigos sem audience sao tratados como consultoria. */
  audience?: JwtAudience;
  /** Papel no tenant (consultoria) ou espelho do clientRole no portal. */
  membershipRole: string;
  servedClientId?: string;
  clientRole?: string;
};

export type ClientJwtPayload = JwtPayload & {
  audience: 'client';
  servedClientId: string;
  clientRole: string;
};
