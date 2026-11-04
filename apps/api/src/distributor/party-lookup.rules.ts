import type { LeadApiCompany } from './lead-api.client';

export type PartyLookupResult = {
  name: string;
  cnpj: string;
  email: string | null;
  phone: string | null;
  uf: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  zipCode: string | null;
  tradeName: string | null;
  situation: string | null;
  source: 'lead-api';
};

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

function joinStreet(
  tipo: string | null | undefined,
  logradouro: string | null | undefined,
): string | null {
  const parts = [clean(tipo), clean(logradouro)].filter(Boolean);
  return parts.length ? parts.join(' ') : null;
}

function formatPhone(
  ddd: string | null | undefined,
  phone: string | null | undefined,
): string | null {
  const d = clean(ddd)?.replace(/\D/g, '') ?? '';
  const p = clean(phone)?.replace(/\D/g, '') ?? '';
  if (!p) return null;
  if (!d) return p;
  return `(${d}) ${p}`;
}

export function mapLeadToPartyLookup(lead: LeadApiCompany): PartyLookupResult {
  const name =
    clean(lead.razao_social) ||
    clean(lead.nome_fantasia) ||
    `CNPJ ${lead.cnpj}`;
  return {
    name,
    cnpj: lead.cnpj.replace(/\D/g, ''),
    email: clean(lead.correio_eletronico)?.toLowerCase() ?? null,
    phone:
      formatPhone(lead.ddd1, lead.telefone1) ||
      formatPhone(lead.ddd2, lead.telefone2),
    uf: clean(lead.uf)?.toUpperCase() ?? null,
    street: joinStreet(lead.tipo_logradouro, lead.logradouro),
    number: clean(lead.numero),
    complement: clean(lead.complemento),
    district: clean(lead.bairro),
    city: clean(lead.municipio),
    zipCode: clean(lead.cep)?.replace(/\D/g, '') || null,
    tradeName: clean(lead.nome_fantasia),
    situation:
      clean(lead.situacao_cadastral_desc) || clean(lead.situacao_cadastral),
    source: 'lead-api',
  };
}
