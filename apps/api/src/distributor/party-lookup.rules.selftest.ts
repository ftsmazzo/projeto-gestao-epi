import { mapLeadToPartyLookup } from './party-lookup.rules';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const mapped = mapLeadToPartyLookup({
  cnpj: '33000167000101',
  razao_social: 'PETROLEO BRASILEIRO S A PETROBRAS',
  nome_fantasia: 'PETROBRAS',
  tipo_logradouro: 'AVENIDA',
  logradouro: 'REPUBLICA DO CHILE',
  numero: '65',
  complemento: 'ANDAR 1',
  bairro: 'CENTRO',
  cep: '20031170',
  uf: 'rj',
  municipio: 'RIO DE JANEIRO',
  ddd1: '21',
  telefone1: '32244000',
  ddd2: null,
  telefone2: null,
  correio_eletronico: 'CONTATO@PETROBRAS.COM.BR',
  situacao_cadastral: '02',
  situacao_cadastral_desc: 'Ativa',
});

assert(mapped.name.startsWith('PETROLEO'), 'name');
assert(mapped.street === 'AVENIDA REPUBLICA DO CHILE', 'street');
assert(mapped.uf === 'RJ', 'uf');
assert(mapped.phone === '(21) 32244000', 'phone');
assert(mapped.email === 'contato@petrobras.com.br', 'email');
assert(mapped.zipCode === '20031170', 'cep');
assert(mapped.source === 'lead-api', 'source');

console.log('party-lookup.rules.selftest ok');
