/**
 * Self-test executavel do validador de CNPJ.
 * Uso: npx --yes tsx src/common/cnpj.selftest.ts
 */
import { formatCnpj, isValidCnpj, normalizeCnpj, validateCnpj } from './cnpj';

type Case = {
  name: string;
  value: string;
  expectOk: boolean;
  expectCode?: string;
  expectNormalized?: string;
};

const cases: Case[] = [
  {
    name: 'numerico valido sem mascara',
    value: '11222333000181',
    expectOk: true,
    expectNormalized: '11222333000181',
  },
  {
    name: 'numerico valido com mascara',
    value: '11.222.333/0001-81',
    expectOk: true,
    expectNormalized: '11222333000181',
  },
  {
    name: 'numerico invalido (DV errado)',
    value: '11222333000180',
    expectOk: false,
    expectCode: 'check_digits',
  },
  {
    name: 'todos digitos iguais',
    value: '00000000000000',
    expectOk: false,
    expectCode: 'repeated',
  },
  {
    name: 'alfanumerico valido (exemplo RF 12ABC34501DE35)',
    value: '12ABC34501DE35',
    expectOk: true,
    expectNormalized: '12ABC34501DE35',
  },
  {
    name: 'alfanumerico valido com mascara',
    value: '12.ABC.345/01DE-35',
    expectOk: true,
    expectNormalized: '12ABC34501DE35',
  },
  {
    name: 'alfanumerico com DV incorreto',
    value: '12ABC34501DE00',
    expectOk: false,
    expectCode: 'check_digits',
  },
  {
    name: 'letra nos digitos verificadores',
    value: '12ABC34501DE3A',
    expectOk: false,
    expectCode: 'charset',
  },
  {
    name: 'minusculas normalizam para maiusculas',
    value: '12.abc.345/01de-35',
    expectOk: true,
    expectNormalized: '12ABC34501DE35',
  },
];

let failed = 0;

for (const testCase of cases) {
  const result = validateCnpj(testCase.value);
  const okMatch = result.ok === testCase.expectOk;
  const codeMatch =
    !testCase.expectCode || (!result.ok && result.code === testCase.expectCode);
  const normalizedMatch =
    !testCase.expectNormalized ||
    (result.ok && result.normalized === testCase.expectNormalized);

  if (okMatch && codeMatch && normalizedMatch) {
    console.log(`PASS  ${testCase.name}`);
  } else {
    failed += 1;
    console.error(`FAIL  ${testCase.name}`, result);
  }
}

if (!isValidCnpj('11.222.333/0001-81')) {
  failed += 1;
  console.error('FAIL  isValidCnpj mascara');
}

if (normalizeCnpj('12.abc.345/01de-35') !== '12ABC34501DE35') {
  failed += 1;
  console.error('FAIL  normalizeCnpj');
}

if (formatCnpj('12ABC34501DE35') !== '12.ABC.345/01DE-35') {
  failed += 1;
  console.error('FAIL  formatCnpj alfanumerico');
}

if (failed > 0) {
  console.error(`\n${failed} caso(s) falharam`);
  process.exit(1);
}

console.log('\nTodos os casos de CNPJ passaram.');
