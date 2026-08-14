import { Injectable } from '@nestjs/common';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import PDFDocument from 'pdfkit';
import {
  DEFAULT_INTEGRATION_OBJECTIVE,
  DEFAULT_OS_OBSERVATIONS,
  enrichOsPayload,
  formatCnpj,
  formatDayBr,
  riskCategoryLabel,
  uniqueRisks,
  uniqueStrings,
  type OsLiveJob,
  type SstDocumentPayload,
} from './sst-document-content';
import { groupOsRisksByCategory } from '../client-structure/risk-context';

export type SstPdfBuildOptions = {
  signedAt?: string | null;
  evidenceAbsolutePath?: string | null;
  liveJob?: OsLiveJob | null;
  consultoriaLogoPath?: string | null;
  companyLogoPath?: string | null;
};

type TableCell = {
  text: string;
  width: number;
  header?: boolean;
  align?: 'left' | 'center';
  blank?: boolean;
  fill?: string;
  textColor?: string;
};

const RISK_TYPE_FILL: Record<string, string> = {
  FISICO: '#86efac',
  QUIMICO: '#fdba74',
  BIOLOGICO: '#c4b5fd',
  ERGONOMICO: '#fde047',
  MECANICO: '#d4d4d8',
  ACIDENTE: '#93c5fd',
  PSICOSSOCIAL: '#f9a8d4',
  OUTROS: '#e2e8f0',
};

function joinUnique(values: Array<string | null | undefined>): string {
  return uniqueStrings(
    values.filter((value): value is string => Boolean(value?.trim())),
  ).join(', ');
}

const BR_TZ = 'America/Sao_Paulo';

function formatDateTimeBr(value: string | Date) {
  try {
    return new Date(value).toLocaleString('pt-BR', { timeZone: BR_TZ });
  } catch {
    return String(value);
  }
}

function bufferFromPdf(
  build: (doc: PDFKit.PDFDocument) => void | Promise<void>,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 36, bottom: 44, left: 36, right: 36 },
      bufferPages: true,
      info: { Title: 'ProntEPI — Documento SST', Author: 'ProntEPI' },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    Promise.resolve(build(doc))
      .then(() => {
        const range = doc.bufferedPageRange();
        for (let i = 0; i < range.count; i += 1) {
          doc.switchToPage(range.start + i);
          const previousBottom = doc.page.margins.bottom;
          doc.page.margins.bottom = 0;
          const m = 18;
          doc.save();
          doc
            .rect(m, m, doc.page.width - 2 * m, doc.page.height - 2 * m)
            .lineWidth(1.5)
            .strokeColor('#0f766e')
            .stroke();
          doc.restore();
          doc
            .font('Helvetica')
            .fontSize(7)
            .fillColor('#64748b')
            .text(
              `ProntEPI  ·  pagina ${i + 1} de ${range.count}`,
              36,
              doc.page.height - 30,
              {
                width: doc.page.width - 72,
                align: 'center',
                lineBreak: false,
                height: 10,
              },
            );
          doc.page.margins.bottom = previousBottom;
        }
        doc.end();
      })
      .catch(reject);
  });
}

function pageInnerWidth(doc: PDFKit.PDFDocument) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function ensureSpace(doc: PDFKit.PDFDocument, needed = 56) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom - 12) {
    doc.addPage();
  }
}

function extractEmbeddedRaster(svg: string): Buffer | null {
  const match =
    /data:image\/(?:png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=\s]+)/i.exec(svg);
  if (!match?.[1]) return null;
  try {
    const buffer = Buffer.from(match[1].replace(/\s+/g, ''), 'base64');
    return buffer.length > 32 ? buffer : null;
  } catch {
    return null;
  }
}

function loadSvgToPdf():
  | ((
      document: PDFKit.PDFDocument,
      svg: string,
      left: number,
      top: number,
      opts?: { width?: number; height?: number; preserveAspectRatio?: string },
    ) => void)
  | null {
  try {
    // CJS: svg-to-pdfkit exporta a funcao direto.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const loaded = require('svg-to-pdfkit') as
      | ((
          document: PDFKit.PDFDocument,
          svg: string,
          left: number,
          top: number,
          opts?: object,
        ) => void)
      | { default?: (document: PDFKit.PDFDocument, svg: string, left: number, top: number, opts?: object) => void };
    const fn = typeof loaded === 'function' ? loaded : loaded.default;
    return typeof fn === 'function' ? fn : null;
  } catch {
    return null;
  }
}

async function drawLogo(
  doc: PDFKit.PDFDocument,
  filePath: string | null | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (!filePath || !existsSync(filePath)) return;
  try {
    if (/\.svg$/i.test(filePath)) {
      const svg = await readFile(filePath, 'utf8');
      const embedded = extractEmbeddedRaster(svg);
      if (embedded) {
        doc.image(embedded, x, y, {
          fit: [w, h],
          align: 'center',
          valign: 'center',
        });
        return;
      }
      const svgToPdf = loadSvgToPdf();
      if (!svgToPdf) return;
      svgToPdf(doc, svg, x, y, {
        width: w,
        height: h,
        preserveAspectRatio: 'xMidYMid meet',
      });
      return;
    }
    const img = await readFile(filePath);
    doc.image(img, x, y, { fit: [w, h], align: 'center', valign: 'center' });
  } catch {
    // logo opcional
  }
}

async function titleBlock(
  doc: PDFKit.PDFDocument,
  title: string,
  subtitle: string,
  options: SstPdfBuildOptions,
) {
  const x = doc.page.margins.left;
  const w = pageInnerWidth(doc);
  const y = doc.y;
  const logoW = 70;
  const logoH = 40;
  const pad = 8;
  const titleX = x + logoW + 14;
  const titleW = Math.max(140, w - (logoW + 14) * 2);

  doc.font('Helvetica-Bold').fontSize(10);
  const titleH = doc.heightOfString(title, { width: titleW, align: 'center' });
  doc.font('Helvetica').fontSize(7.5);
  const subH = doc.heightOfString(subtitle, { width: titleW, align: 'center' });
  const textBlockH = titleH + 6 + subH;
  const h = Math.max(logoH + pad * 2, textBlockH + pad * 2);

  doc.rect(x, y, w, h).strokeColor('#0f766e').lineWidth(1.1).stroke();
  await drawLogo(
    doc,
    options.consultoriaLogoPath,
    x + pad,
    y + (h - logoH) / 2,
    logoW,
    logoH,
  );
  await drawLogo(
    doc,
    options.companyLogoPath,
    x + w - logoW - pad,
    y + (h - logoH) / 2,
    logoW,
    logoH,
  );
  const textTop = y + Math.max(pad, (h - textBlockH) / 2);
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor('#0f172a')
    .text(title, titleX, textTop, { width: titleW, align: 'center' });
  doc
    .font('Helvetica')
    .fontSize(7.5)
    .fillColor('#334155')
    .text(subtitle, titleX, textTop + titleH + 6, {
      width: titleW,
      align: 'center',
    });
  doc.fillColor('#0f172a');
  doc.y = y + h + 8;
}

function section(doc: PDFKit.PDFDocument, title: string) {
  ensureSpace(doc, 22);
  doc.moveDown(0.25);
  const x = doc.page.margins.left;
  const w = pageInnerWidth(doc);
  const y = doc.y;
  doc.rect(x, y, w, 16).fill('#ecfdf5');
  doc
    .fillColor('#0f766e')
    .font('Helvetica-Bold')
    .fontSize(8)
    .text(title, x + 6, y + 4, { width: w - 12 });
  doc.fillColor('#0f172a');
  doc.y = y + 20;
}

function fieldBox(
  doc: PDFKit.PDFDocument,
  rows: Array<Array<{ label: string; value: string; width: number }>>,
) {
  const x0 = doc.page.margins.left;
  for (const row of rows) {
    const heights = row.map((cell) => {
      doc.font('Helvetica').fontSize(8);
      return Math.max(
        22,
        doc.heightOfString(cell.value || '—', { width: cell.width - 10 }) + 14,
      );
    });
    const h = Math.max(...heights);
    ensureSpace(doc, h + 2);
    let x = x0;
    const y = doc.y;
    for (const cell of row) {
      doc
        .rect(x, y, cell.width, h)
        .strokeColor('#94a3b8')
        .lineWidth(0.5)
        .stroke();
      doc
        .font('Helvetica-Bold')
        .fontSize(6.5)
        .fillColor('#64748b')
        .text(cell.label, x + 4, y + 3, { width: cell.width - 8 });
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#0f172a')
        .text(cell.value || '—', x + 4, y + 12, { width: cell.width - 8 });
      x += cell.width;
    }
    doc.y = y + h;
  }
}

function bodyText(doc: PDFKit.PDFDocument, text: string) {
  ensureSpace(doc, 28);
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#1e293b')
    .text(text || 'Nao informada.', {
      align: 'justify',
      lineGap: 1.5,
    });
}

function numberedList(doc: PDFKit.PDFDocument, items: string[]) {
  items.forEach((item, index) => {
    ensureSpace(doc, 16);
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#1e293b')
      .text(`${index + 1}.  ${item}`, { paragraphGap: 2, lineGap: 1 });
  });
}

function twoColumnChecks(doc: PDFKit.PDFDocument, items: string[]) {
  const gap = 8;
  const colW = (pageInnerWidth(doc) - gap) / 2;
  const x0 = doc.page.margins.left;
  for (let i = 0; i < items.length; i += 2) {
    const left = items[i];
    const right = items[i + 1];
    doc.font('Helvetica').fontSize(7.5);
    const h = Math.max(
      14,
      doc.heightOfString(`[X]  ${left}`, { width: colW }) + 2,
      right
        ? doc.heightOfString(`[X]  ${right}`, { width: colW }) + 2
        : 0,
    );
    ensureSpace(doc, h + 2);
    const y = doc.y;
    doc
      .fillColor('#1e293b')
      .text(`[X]  ${left}`, x0, y, { width: colW });
    if (right) {
      doc.text(`[X]  ${right}`, x0 + colW + gap, y, { width: colW });
    }
    doc.y = y + h;
  }
}

function itemCard(doc: PDFKit.PDFDocument, title: string, items: string[]) {
  const x = doc.page.margins.left;
  const w = pageInnerWidth(doc);
  const gap = 10;
  const colW = (w - 16 - gap) / 2;
  const rows: Array<[string, string | null]> = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push([items[i], items[i + 1] ?? null]);
  }
  doc.font('Helvetica').fontSize(8);
  const bodyH = rows.reduce((sum, [left, right]) => {
    const h = Math.max(
      14,
      doc.heightOfString(`>  ${left}`, { width: colW }) + 4,
      right ? doc.heightOfString(`>  ${right}`, { width: colW }) + 4 : 0,
    );
    return sum + h;
  }, 8);
  const totalH = 20 + Math.max(bodyH, 22);
  ensureSpace(doc, totalH + 8);
  const y = doc.y;
  doc.rect(x, y, w, totalH).strokeColor('#0f766e').lineWidth(1).stroke();
  doc.rect(x, y, w, 18).fill('#0f766e');
  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(8)
    .text(title, x + 8, y + 5, { width: w - 16 });
  let rowY = y + 22;
  for (const [left, right] of rows) {
    doc.font('Helvetica').fontSize(8).fillColor('#0f172a');
    const h = Math.max(
      14,
      doc.heightOfString(`>  ${left}`, { width: colW }) + 2,
      right ? doc.heightOfString(`>  ${right}`, { width: colW }) + 2 : 0,
    );
    doc.text(`>  ${left}`, x + 8, rowY, { width: colW });
    if (right) {
      doc.text(`>  ${right}`, x + 8 + colW + gap, rowY, { width: colW });
    }
    rowY += h;
  }
  doc.y = y + totalH + 8;
}

function cellLabel(cell: TableCell) {
  if (cell.blank) return '';
  return cell.text.trim() ? cell.text : '—';
}

function drawTableRow(doc: PDFKit.PDFDocument, cells: TableCell[]) {
  const x0 = doc.page.margins.left;
  const heights = cells.map((cell) => {
    doc.font(cell.header ? 'Helvetica-Bold' : 'Helvetica').fontSize(6.5);
    return Math.max(
      cell.header ? 20 : 22,
      doc.heightOfString(cellLabel(cell) || ' ', { width: cell.width - 6 }) + 6,
    );
  });
  const h = Math.max(...heights);
  ensureSpace(doc, h + 2);
  let x = x0;
  const y = doc.y;
  for (const cell of cells) {
    if (cell.header) {
      doc.rect(x, y, cell.width, h).fillAndStroke('#0f766e', '#0f766e');
    } else if (cell.fill) {
      doc.rect(x, y, cell.width, h).fillAndStroke(cell.fill, '#334155');
    } else {
      doc
        .rect(x, y, cell.width, h)
        .strokeColor('#334155')
        .lineWidth(0.5)
        .stroke();
    }
    const align = cell.align ?? 'center';
    doc
      .font(cell.header || cell.fill ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(6.5);
    const label = cellLabel(cell);
    const textH = doc.heightOfString(label || ' ', {
      width: cell.width - 6,
      align,
    });
    const textY = y + Math.max(2, (h - textH) / 2);
    doc
      .fillColor(cell.textColor ?? (cell.header ? '#ffffff' : '#0f172a'))
      .text(label, x + 3, textY, {
        width: cell.width - 6,
        align,
      });
    x += cell.width;
  }
  doc.fillColor('#0f172a');
  doc.y = y + h;
}

async function drawFaceEvidence(
  doc: PDFKit.PDFDocument,
  payload: SstDocumentPayload,
  options: SstPdfBuildOptions,
) {
  const boxH = 86;
  const x = doc.page.margins.left;
  const w = pageInnerWidth(doc);
  ensureSpace(doc, 22 + boxH + 24);
  const titleY = doc.y;
  doc.rect(x, titleY, w, 16).fill('#ecfdf5');
  doc
    .fillColor('#0f766e')
    .font('Helvetica-Bold')
    .fontSize(8)
    .text('CIENCIA / ASSINATURA DO TRABALHADOR', x + 6, titleY + 4, {
      width: w - 12,
    });
  const y = titleY + 16;
  doc.rect(x, y, w, boxH).strokeColor('#94a3b8').lineWidth(0.6).stroke();
  doc.rect(x, y, 86, boxH).strokeColor('#94a3b8').lineWidth(0.6).stroke();

  const photoPath = options.evidenceAbsolutePath;
  if (photoPath && existsSync(photoPath)) {
    try {
      const img = await readFile(photoPath);
      doc.image(img, x + 6, y + 6, { fit: [74, 74] });
    } catch {
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor('#64748b')
        .text('Foto indisponivel', x + 8, y + 36, { width: 70, align: 'center' });
    }
  } else {
    doc
      .font('Helvetica-Oblique')
      .fontSize(7)
      .fillColor('#b45309')
      .text(
        options.signedAt
          ? 'Foto nao encontrada'
          : 'Aguardando ciencia facial',
        x + 8,
        y + 36,
        { width: 70, align: 'center' },
      );
  }

  const textX = x + 94;
  const textW = w - 102;
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#0f172a')
    .text(payload.worker.name, textX, y + 8, { width: textW });
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#334155')
    .text(`CPF: ${payload.worker.cpfMasked}`, textX, y + 22, { width: textW });
  if (payload.worker.jobFunctionName) {
    doc.text(`Funcao: ${payload.worker.jobFunctionName}`, textX, y + 34, {
      width: textW,
    });
  }
  if (options.signedAt) {
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#047857')
      .text(
        `Ciencia confirmada por biometria facial em ${formatDateTimeBr(options.signedAt)}.`,
        textX,
        y + 50,
        { width: textW },
      );
  } else {
    doc
      .font('Helvetica-Oblique')
      .fontSize(8)
      .fillColor('#b45309')
      .text('Aguardando ciencia facial do trabalhador.', textX, y + 50, {
        width: textW,
      });
  }
  doc.y = y + boxH + 6;
}

function writeGeneratedNote(doc: PDFKit.PDFDocument, generatedAt: string) {
  const note = `Documento gerado pelo ProntEPI em ${formatDateTimeBr(generatedAt)}.`;
  if (doc.y + 12 > doc.page.height - doc.page.margins.bottom) return;
  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor('#64748b')
    .text(note, {
      lineBreak: false,
      height: 10,
    });
}

@Injectable()
export class SstDocumentPdfService {
  build(
    payload: SstDocumentPayload,
    options: SstPdfBuildOptions = {},
  ): Promise<Buffer> {
    return bufferFromPdf(async (doc) => {
      const data = enrichOsPayload(payload, options.liveJob);
      if (data.type === 'ORDEM_SERVICO') {
        await this.renderOs(doc, data, options);
      } else {
        await this.renderIntegration(doc, data, options);
      }
    });
  }

  private async renderOs(
    doc: PDFKit.PDFDocument,
    payload: SstDocumentPayload,
    options: SstPdfBuildOptions,
  ) {
    const w = pageInnerWidth(doc);
    await titleBlock(
      doc,
      'ORDEM DE SERVICO DE SEGURANCA',
      'NORMA REGULAMENTADORA — NR-01, item 1.4.1',
      options,
    );

    fieldBox(doc, [
      [
        { label: 'EMPRESA', value: payload.company.legalName, width: w * 0.68 },
        {
          label: 'CNPJ',
          value: formatCnpj(payload.company.cnpj),
          width: w * 0.32,
        },
      ],
      [
        { label: 'NOME', value: payload.worker.name, width: w * 0.62 },
        {
          label: 'DATA DA ADMISSAO',
          value: formatDayBr(payload.worker.admissionDate),
          width: w * 0.38,
        },
      ],
      [
        {
          label: 'FUNCAO',
          value: payload.worker.jobFunctionName ?? '—',
          width: w * 0.5,
        },
        {
          label: 'SETOR',
          value: payload.worker.sectorName ?? '—',
          width: w * 0.5,
        },
      ],
      [
        {
          label: 'DESCRICAO DO AMBIENTE',
          value: payload.os?.environment || 'Nao informado.',
          width: w,
        },
      ],
    ]);

    section(doc, '1. DESCRICAO DA FUNCAO');
    bodyText(doc, payload.os?.functionDescription || 'Nao informada.');

    section(doc, '2. AGENTES ASSOCIADOS AS ATIVIDADES');
    const col = {
      tipo: w * 0.13,
      agente: w * 0.25,
      fonte: w * 0.28,
      qual: w * 0.1,
      quant: w * 0.1,
      expo: w * 0.14,
    };
    drawTableRow(doc, [
      { text: 'TIPO DE RISCO', width: col.tipo, header: true, align: 'center' },
      { text: 'AGENTE AGRESSOR', width: col.agente, header: true, align: 'center' },
      { text: 'FONTE GERADORA', width: col.fonte, header: true, align: 'center' },
      { text: 'QUALITATIVA', width: col.qual, header: true, align: 'center' },
      { text: 'QUANTITATIVA', width: col.quant, header: true, align: 'center' },
      { text: 'TIPO DE EXPOSICAO', width: col.expo, header: true, align: 'center' },
    ]);
    const risks = uniqueRisks(payload.os?.risks ?? []);
    if (risks.length === 0) {
      bodyText(doc, 'Nenhum risco vinculado a esta funcao no PGR.');
    } else {
      for (const group of groupOsRisksByCategory(risks)) {
        const agents = joinUnique(group.agents.map((risk) => risk.agent));
        const fontes = joinUnique(
          group.agents.map((risk) => risk.source || null),
        );
        const quantitatives = joinUnique(
          group.agents.map((risk) => {
            const match = risk.evaluation?.match(
              /(\d{1,3}(?:[.,]\d{1,2})?\s*dB\s*\(?A\)?)/i,
            );
            return match?.[1] ?? null;
          }),
        );
        const exposure =
          joinUnique(group.agents.map((risk) => risk.exposure)) ||
          'Habitual e intermitente';
        drawTableRow(doc, [
          {
            text: riskCategoryLabel(group.category).toUpperCase(),
            width: col.tipo,
            align: 'center',
            fill: RISK_TYPE_FILL[group.category] ?? RISK_TYPE_FILL.OUTROS,
          },
          { text: agents, width: col.agente },
          { text: fontes, width: col.fonte },
          { text: 'X', width: col.qual, align: 'center' },
          {
            text: quantitatives || 'NA',
            width: col.quant,
            align: 'center',
          },
          { text: exposure, width: col.expo, align: 'center' },
        ]);
      }
    }

    const epis = uniqueStrings(payload.os?.epis ?? []);
    itemCard(
      doc,
      "3. EPI'S DE USO OBRIGATORIO",
      epis.length > 0 ? epis : ['Nenhuma necessidade de EPI vinculada a funcao.'],
    );
    itemCard(
      doc,
      "4. EPC'S DE USO OBRIGATORIO",
      uniqueStrings(payload.os?.epcs ?? []),
    );

    section(doc, '5. RECOMENDACOES GERAIS');
    numberedList(doc, payload.os?.recommendations ?? []);

    section(doc, '6. RESPONSABILIDADE DO FUNCIONARIO');
    numberedList(doc, payload.os?.responsibilities ?? []);

    section(doc, '7. OBSERVACOES');
    numberedList(
      doc,
      payload.os?.observations?.length
        ? payload.os.observations
        : [...DEFAULT_OS_OBSERVATIONS],
    );

    if (payload.technicalResponsible.name) {
      section(doc, 'RESPONSAVEL TECNICO');
      fieldBox(doc, [
        [
          {
            label: 'NOME',
            value: payload.technicalResponsible.name,
            width: w * 0.62,
          },
          {
            label: 'REGISTRO MTE',
            value: payload.technicalResponsible.registry ?? '—',
            width: w * 0.38,
          },
        ],
      ]);
    }

    section(doc, 'TERMO DE RESPONSABILIDADE — ORDEM DE SERVICO NR-01');
    bodyText(doc, payload.termText);
    doc.moveDown(0.3);
    doc
      .font('Helvetica')
      .fontSize(8)
      .text(`Funcao: ${payload.worker.jobFunctionName ?? '—'}`);
    if (payload.company.city) {
      doc.text(
        `${payload.company.city}, ${formatDayBr(options.signedAt ?? payload.generatedAt)}.`,
      );
    }

    await drawFaceEvidence(doc, payload, options);
    writeGeneratedNote(doc, payload.generatedAt);
  }

  private async renderIntegration(
    doc: PDFKit.PDFDocument,
    payload: SstDocumentPayload,
    options: SstPdfBuildOptions,
  ) {
    const w = pageInnerWidth(doc);
    await titleBlock(
      doc,
      'COMPROVANTE DE TREINAMENTO DE INTEGRACAO DE SEGURANCA',
      'NR-01 — Disposicoes Gerais e Gerenciamento de Riscos Ocupacionais',
      options,
    );

    fieldBox(doc, [
      [
        {
          label: 'EMPRESA',
          value: payload.company.legalName,
          width: w * 0.68,
        },
        {
          label: 'CNPJ',
          value: formatCnpj(payload.company.cnpj),
          width: w * 0.32,
        },
      ],
      [
        {
          label: 'DATA DA ADMISSAO / INTEGRACAO',
          value: formatDayBr(payload.integration?.date),
          width: w * 0.4,
        },
        {
          label: 'HORARIO',
          value: payload.integration?.time ?? '08:00',
          width: w * 0.28,
        },
        {
          label: 'TEMPO DE INTEGRACAO',
          value: `${payload.integration?.durationHours ?? 2} hora(s)`,
          width: w * 0.32,
        },
      ],
      [
        {
          label: 'FUNCAO / REGISTRO',
          value: [
            payload.worker.jobFunctionName,
            payload.worker.registration,
          ]
            .filter(Boolean)
            .join('  ·  ') || '—',
          width: w * 0.5,
        },
        {
          label: 'SETOR',
          value: payload.worker.sectorName ?? '—',
          width: w * 0.5,
        },
      ],
    ]);

    section(doc, 'OBJETIVO');
    bodyText(doc, DEFAULT_INTEGRATION_OBJECTIVE);

    section(doc, 'FUNCIONARIO LIBERADO');
    drawTableRow(doc, [
      { text: 'NOME COMPLETO', width: w * 0.42, header: true },
      { text: 'CPF', width: w * 0.22, header: true, align: 'center' },
      { text: 'ASSINATURA / CIENCIA', width: w * 0.36, header: true, align: 'center' },
    ]);
    drawTableRow(doc, [
      { text: payload.worker.name, width: w * 0.42 },
      { text: payload.worker.cpfMasked, width: w * 0.22, align: 'center' },
      {
        text: options.signedAt
          ? `Ciencia facial em ${formatDateTimeBr(options.signedAt)}`
          : 'Aguardando ciencia facial',
        width: w * 0.36,
        align: 'center',
      },
    ]);

    section(doc, 'ASSUNTOS ABORDADOS');
    twoColumnChecks(doc, payload.integration?.topics ?? []);

    if (payload.technicalResponsible.name) {
      section(doc, 'RESPONSAVEL TECNICO');
      fieldBox(doc, [
        [
          {
            label: 'NOME',
            value: payload.technicalResponsible.name,
            width: w * 0.62,
          },
          {
            label: 'REGISTRO MTE',
            value: payload.technicalResponsible.registry ?? '—',
            width: w * 0.38,
          },
        ],
      ]);
    }

    section(doc, 'TERMO DE RESPONSABILIDADE');
    bodyText(doc, payload.termText);

    await drawFaceEvidence(doc, payload, options);
    writeGeneratedNote(doc, payload.generatedAt);
  }
}
