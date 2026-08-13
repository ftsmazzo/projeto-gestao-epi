import assert from 'assert';
import { preferredCaepiQuery } from '@gestao-epi/shared';
import {
  caepiTextMatchesQuery,
  expandEquipmentSearchTerms,
  significantSearchWords,
} from './caepi-search.utils';

function run() {
  assert.strictEqual(preferredCaepiQuery('Botina de Seguranca'), 'botina');
  assert.strictEqual(preferredCaepiQuery('Luva de Raspa'), 'luva raspa');
  assert.strictEqual(preferredCaepiQuery('Avental de PVC'), 'avental pvc');
  assert.strictEqual(preferredCaepiQuery('Protetor Auricular Plug'), 'plug');
  assert.strictEqual(preferredCaepiQuery('Respirador PFF2'), 'pff2');
  assert.strictEqual(preferredCaepiQuery('Oculos de Seguranca'), 'oculos');
  assert.strictEqual(preferredCaepiQuery('Viseira Facial'), 'protetor facial');
  assert.strictEqual(preferredCaepiQuery('Cinto de Seguranca'), 'paraquedista');

  assert.deepStrictEqual(significantSearchWords('luva raspa'), ['luva', 'raspa']);
  assert.deepStrictEqual(significantSearchWords('LUVA DE RASPA'), [
    'luva',
    'raspa',
  ]);

  assert.ok(
    caepiTextMatchesQuery('LUVA DE RASPA DE COURO', 'luva raspa'),
    'frase com DE no meio tem que achar',
  );
  assert.ok(caepiTextMatchesQuery('AVENTAL DE PVC LAMINADO', 'avental pvc'));
  assert.ok(
    caepiTextMatchesQuery('CALCADO DE SEGURANCA BIQUEIRA', 'botina'),
    'botina → calcado',
  );
  assert.ok(
    caepiTextMatchesQuery('PROTETOR AUDITIVO TIPO INSERCAO', 'plug'),
    'plug → insercao',
  );
  assert.ok(
    !caepiTextMatchesQuery('PROTETOR AUDITIVO TIPO CONCHA', 'plug'),
    'plug nao pode puxar concha',
  );
  assert.ok(caepiTextMatchesQuery('PECA SEMIFACIAL FILTRANTE PFF2', 'pff2'));
  assert.ok(caepiTextMatchesQuery('PROTETOR FACIAL ACRILICO', 'viseira'));
  assert.ok(
    !caepiTextMatchesQuery('AVENTAL DE RASPA', 'luva raspa'),
    'luva raspa nao e avental',
  );

  const plugTerms = expandEquipmentSearchTerms('plug');
  assert.ok(plugTerms.includes('insercao'));
  assert.ok(!plugTerms.includes('auricular'));

  console.log('caepi-search.selftest ok');
}

run();
