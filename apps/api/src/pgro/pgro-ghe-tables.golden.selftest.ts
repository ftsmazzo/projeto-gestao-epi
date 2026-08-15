/**
 * Golden tests: motor tabular nos 6 DOCX reais de files/PGROs.
 * Critério: 100% dos GHE headers viram bloco com setor+função válidos.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { extractDocxDocument } from './pgro-text-extract';
import {
  countCharacterizationHeaders,
  gheTableBlocksToExtracted,
  parseGheTableBlocks,
} from './pgro-ghe-tables';
import { parsePgroText, reminePgroCoverageForJobs } from './pgro-parser';

const PGROS_DIR = path.resolve(__dirname, '../../../../files/PGROs');

const FAKE_SECTOR_RE =
  /ventilado|climatizado|interno\s+e\s+externo|trabalham\s+em\s+ambiente/i;

type GoldenCase = {
  file: string;
  minHeaders: number;
  checks?: (ctx: {
    text: string;
    stats: ReturnType<typeof gheTableBlocksToExtracted>['stats'];
    extracted: ReturnType<typeof gheTableBlocksToExtracted>;
  }) => void;
};

const CASES: GoldenCase[] = [
  {
    file: 'PGRO-ETILICA.docx',
    minHeaders: 5,
    checks: ({ extracted }) => {
      const gerente = extracted.functions.find(
        (f) =>
          /GERENTE INDUSTRIAL/i.test(f.name) &&
          /ADM\s*\/\s*PRODU/i.test(f.sectorName ?? ''),
      );
      assert.ok(gerente, 'ETILICA: GERENTE INDUSTRIAL em ADM / PRODUÇÃO');
      const ruido = extracted.risks.find((r) => /ru[ií]do/i.test(r.name));
      assert.ok(ruido, 'ETILICA: risco Ruido');
      assert.ok(
        ruido!.functionNames.some((n) => /GERENTE INDUSTRIAL/i.test(n)),
        'ETILICA: Ruido ligado ao Gerente Industrial',
      );
      const plug = extracted.epiNeeds.find((e) =>
        /protetor auricular/i.test(e.suggestedName),
      );
      assert.ok(plug, 'ETILICA: EPI Protetor Auricular');
      assert.ok(
        plug!.functionNames.some((n) => /GERENTE INDUSTRIAL/i.test(n)),
        'ETILICA: Protetor ligado ao Gerente Industrial',
      );
    },
  },
  { file: 'PGRO - MASTREALLE.docx', minHeaders: 55 },
  { file: 'PGRO-POLIMENTAL.docx', minHeaders: 60 },
  { file: 'PGRO-BERMAR.docx', minHeaders: 20 },
  { file: 'PGRO-TRISTAO.docx', minHeaders: 20 },
  { file: 'PGRO-ZR.docx', minHeaders: 6 },
];

async function main() {
  assert.ok(
    fs.existsSync(PGROS_DIR),
    `Pasta de golden DOCX nao encontrada: ${PGROS_DIR}`,
  );

  for (const testCase of CASES) {
    const fullPath = path.join(PGROS_DIR, testCase.file);
    assert.ok(fs.existsSync(fullPath), `Arquivo ausente: ${testCase.file}`);

    const buf = fs.readFileSync(fullPath);
    const { text } = await extractDocxDocument(buf);
    const headerCount = countCharacterizationHeaders(text);
    assert.ok(
      headerCount >= testCase.minHeaders,
      `${testCase.file}: esperava >= ${testCase.minHeaders} GHE headers, veio ${headerCount}`,
    );

    const blocks = parseGheTableBlocks(text);
    const extracted = gheTableBlocksToExtracted(blocks);
    const { stats } = extracted;

    assert.equal(
      stats.ghesWithFunctions,
      stats.gheHeaderCount,
      `${testCase.file}: ghesWithFunctions (${stats.ghesWithFunctions}) != gheHeaderCount (${stats.gheHeaderCount})`,
    );
    assert.equal(
      stats.gheHeaderCount,
      headerCount,
      `${testCase.file}: blocks (${stats.gheHeaderCount}) != unique headers (${headerCount})`,
    );
    assert.ok(stats.coverageOk, `${testCase.file}: coverageOk deve ser true`);
    assert.ok(
      stats.functionCount > 0 &&
        stats.functionsWithSector / stats.functionCount >= 0.95,
      `${testCase.file}: funcoes com setor < 95%`,
    );

    const fake = extracted.sectors.filter((s) => FAKE_SECTOR_RE.test(s.name));
    assert.equal(
      fake.length,
      0,
      `${testCase.file}: setores falsos (ambiente): ${fake.map((s) => s.name).join(', ')}`,
    );

    const parsed = parsePgroText(text);
    assert.ok(
      parsed.coverage?.coverageOk,
      `${testCase.file}: parsePgroText deve usar motor tabular com coverageOk`,
    );
    assert.equal(parsed.structureWeak, false, `${testCase.file}: structureWeak`);

    if (stats.riskRowCount > 0) {
      assert.ok(
        extracted.risks.some((r) => r.functionNames.length > 0),
        `${testCase.file}: riscos devem ligar a funcoes do GHE`,
      );
    }

    testCase.checks?.({ text, stats, extracted });
    console.log(
      `OK ${testCase.file}: ${stats.ghesWithFunctions}/${stats.gheHeaderCount} GHE, ${stats.functionCount} fn, ${stats.riskRowCount} riscos, ${stats.epiItemCount} EPIs`,
    );
  }

  const etilicaPath = path.join(PGROS_DIR, 'PGRO-ETILICA.docx');
  const { text } = await extractDocxDocument(fs.readFileSync(etilicaPath));
  const remine = reminePgroCoverageForJobs(text, [
    {
      sectorName: 'ADM / PRODUÇÃO',
      functionName: 'GERENTE INDUSTRIAL',
    },
  ]);
  assert.equal(remine.length, 1);
  assert.ok(
    remine[0].matchedGheNames.length > 0,
    'remine: deve achar GHE do gerente',
  );
  assert.ok(
    remine[0].risks.some((r) => /ru[ií]do/i.test(r.name)),
    'remine tabular: Ruido para GERENTE INDUSTRIAL',
  );
  assert.ok(
    remine[0].epiNeeds.some((e) =>
      /protetor auricular/i.test(e.suggestedName),
    ),
    'remine tabular: Protetor Auricular para GERENTE INDUSTRIAL',
  );
  console.log('OK remine tabular ETILICA');
  console.log('pgro-ghe-tables.golden.selftest: all passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
