/**
 * Gera fixture XLSX CAEPI de amostra (aba tgg_export_caepi).
 * Uso: npx tsx src/caepi/fixtures/generate-caepi-sample-xlsx.ts
 */
import { writeFileSync } from 'fs';
import { join } from 'path';
import ExcelJS from 'exceljs';

async function main() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('tgg_export_caepi');

  sheet.addRow([
    'NR Registro CA',
    'DATA DE VALIDADE',
    'SITUACAO',
    'NR DO PROCESSO',
    'CNPJ',
    'RAZAO SOCIAL',
    'NATUREZA',
    'EQUIPAMENTO',
    'DESCRICAO EQUIPAMENTO',
    'MARCA CA',
    'REFERENCIA',
    'COR',
    'APROVADO PARA LAUDO',
    'RESTRICAO LAUDO',
    'OBSERVACAO ANALISE LAUDO',
    'CNPJ LABORATORIO',
    'RAZAO SOCIAL LABORATORIO',
    'NR LAUDO',
    'NORMA',
  ]);

  sheet.addRow([
    '012345',
    '31/12/2027',
    'VÁLIDO',
    'PROC-XLSX-001',
    '01222333000181',
    'Fabricante XLSX Alpha',
    'EPI',
    'Protetor auricular',
    'Plug de espuma',
    'AlphaX',
    'PA-X1',
    'Verde',
    'Ruido continuo',
    'Nao usar com otite',
    'Obs XLSX A',
    '99888777000166',
    'Lab Som Ltda',
    'L-X100',
    'ABNT NBR 16076',
  ]);

  sheet.addRow([
    '012345',
    new Date(Date.UTC(2027, 11, 31)),
    'VÁLIDO',
    'PROC-XLSX-001',
    '01222333000181',
    'Fabricante XLSX Alpha',
    'EPI',
    'Protetor auricular',
    'Plug de espuma',
    'AlphaX',
    'PA-X1',
    'Verde',
    'Ruido continuo',
    'Nao usar com otite',
    'Obs XLSX A',
    '99888777000166',
    'Lab Som Ltda',
    'L-X101',
    'ANSI S3.19',
  ]);

  sheet.addRow([
    '055501',
    '01/01/2020',
    'VENCIDO',
    'PROC-XLSX-002',
    '22333444000192',
    'Fabricante XLSX Beta',
    'EPI',
    'Oculos',
    'Lente incolor',
    'BetaX',
    'OC-X',
    'Incolor',
    'Impactos',
    '',
    'Obs XLSX B',
    '88777666000155',
    'Lab Optico',
    'L-X200',
    'ANSI Z87.1',
  ]);

  // Forca CA/CNPJ como texto na 1a coluna onde necessario
  sheet.getColumn(1).numFmt = '@';
  sheet.getColumn(5).numFmt = '@';
  sheet.getColumn(16).numFmt = '@';

  const out = join(__dirname, 'caepi-sample.xlsx');
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  writeFileSync(out, buffer);
  console.log(`Wrote ${out} (${buffer.length} bytes)`);
}

void main();
