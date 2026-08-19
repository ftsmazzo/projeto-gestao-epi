import { Injectable } from '@nestjs/common';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import PDFDocument from 'pdfkit';
import { TrainingDeliveryKind } from '@prisma/client';
import { formatCnpj } from '../sst-documents/sst-document-content';
import { bundledAssetsForNr } from './bundled-assets';

export type TrainingPdfWorker = {
  name: string;
  cpf: string | null;
  jobFunction: string;
};

export type TrainingPdfAssetMap = Partial<Record<string, string>>;

export type TrainingPdfInput = {
  includeCertificate: boolean;
  includeRegister: boolean;
  courseTitle: string;
  nrLabel: string;
  certificateCourseClause: string;
  topics: string[];
  registerSummary: string;
  companyLegalName: string;
  companyTradeName: string | null;
  companyCnpj: string;
  heldOn: Date;
  hours: number;
  location: string;
  address: string;
  instructorName: string;
  instructorRole: string;
  instructorRegistry: string;
  legalRepName: string;
  deliveryKind: TrainingDeliveryKind;
  controlNumber: string;
  workers: TrainingPdfWorker[];
  assets: TrainingPdfAssetMap;
};

const NAVY = '#12345A';
const GREEN = '#6BB12A';
const INK = '#000000';
const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Marco',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

function padHours(hours: number) {
  return String(hours).padStart(2, '0');
}

export function formatDateExtenso(value: Date) {
  return `${value.getUTCDate()} de ${MONTHS[value.getUTCMonth()]} de ${value.getUTCFullYear()}`;
}

export function formatDateBr(value: Date) {
  const d = String(value.getUTCDate()).padStart(2, '0');
  const m = String(value.getUTCMonth() + 1).padStart(2, '0');
  return `${d}/${m}/${value.getUTCFullYear()}`;
}

export function formatCpf(cpf: string | null | undefined) {
  const d = (cpf ?? '').replace(/\D/g, '');
  if (d.length !== 11) return cpf?.trim() || '—';
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function deliveryMarks(kind: TrainingDeliveryKind) {
  return {
    interno: kind === 'INTERNO' ? 'X' : ' ',
    tlt: kind === 'TLT' ? 'X' : ' ',
    externo: kind === 'EXTERNO' ? 'X' : ' ',
  };
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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const loaded = require('svg-to-pdfkit') as
      | ((
          document: PDFKit.PDFDocument,
          svg: string,
          left: number,
          top: number,
          opts?: object,
        ) => void)
      | {
          default?: (
            document: PDFKit.PDFDocument,
            svg: string,
            left: number,
            top: number,
            opts?: object,
          ) => void;
        };
    const fn = typeof loaded === 'function' ? loaded : loaded.default;
    return typeof fn === 'function' ? fn : null;
  } catch {
    return null;
  }
}

async function drawImage(
  doc: PDFKit.PDFDocument,
  filePath: string | null | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (!filePath || !existsSync(filePath)) return false;
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
        return true;
      }
      const svgToPdf = loadSvgToPdf();
      if (!svgToPdf) return false;
      svgToPdf(doc, svg, x, y, {
        width: w,
        height: h,
        preserveAspectRatio: 'xMidYMid meet',
      });
      return true;
    }
    doc.image(filePath, x, y, {
      fit: [w, h],
      align: 'center',
      valign: 'center',
    });
    return true;
  } catch {
    return false;
  }
}

function mergeAssets(nrLabel: string, uploaded: TrainingPdfAssetMap) {
  return { ...bundledAssetsForNr(nrLabel), ...uploaded };
}

function bufferFromPdf(
  layout: 'landscape' | 'portrait',
  build: (doc: PDFKit.PDFDocument) => void | Promise<void>,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout,
      margins: { top: 18, bottom: 18, left: 22, right: 22 },
      bufferPages: true,
      info: { Title: 'Certificado / Registro de Treinamento', Author: 'INSEG' },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    Promise.resolve(build(doc))
      .then(() => doc.end())
      .catch(reject);
  });
}

@Injectable()
export class TrainingPdfService {
  async build(input: TrainingPdfInput): Promise<Buffer> {
    const assets = mergeAssets(input.nrLabel, input.assets);
    const payload = { ...input, assets };
    const firstLayout =
      payload.includeCertificate && payload.workers.length > 0
        ? 'landscape'
        : 'portrait';
    return bufferFromPdf(firstLayout, async (doc) => {
      let started = false;
      if (payload.includeCertificate) {
        for (const worker of payload.workers) {
          if (started) doc.addPage({ size: 'A4', layout: 'landscape' });
          started = true;
          await this.drawCertificateFront(doc, payload, worker);
          doc.addPage({ size: 'A4', layout: 'landscape' });
          await this.drawCertificateBack(doc, payload);
        }
      }
      if (payload.includeRegister) {
        const pages = this.chunkWorkers(payload.workers, 22);
        const list = pages.length ? pages : [[]];
        for (let i = 0; i < list.length; i += 1) {
          if (started) doc.addPage({ size: 'A4', layout: 'portrait' });
          started = true;
          await this.drawRegister(doc, payload, list[i], i, list.length);
        }
      }
    });
  }

  private chunkWorkers(workers: TrainingPdfWorker[], size: number) {
    const pages: TrainingPdfWorker[][] = [];
    for (let i = 0; i < workers.length; i += size) {
      pages.push(workers.slice(i, i + size));
    }
    return pages;
  }

  private async drawCertificateFront(
    doc: PDFKit.PDFDocument,
    input: TrainingPdfInput,
    worker: TrainingPdfWorker,
  ) {
    const w = doc.page.width;
    const h = doc.page.height;
    doc.save();
    doc.rect(0, 0, w, h).fill('#ffffff');
    doc.restore();
    doc.save();
    doc.rect(0, 0, 10, h).fill(GREEN);
    doc.restore();

    await drawImage(doc, input.assets.LEFT_LOGO, 24, 16, 150, 78);
    await drawImage(doc, input.assets.HEADER, w / 2 - 120, 14, 240, 52);
    if (!input.assets.HEADER) {
      doc
        .font('Times-Bold')
        .fontSize(36)
        .fillColor(NAVY)
        .text('CERTIFICADO', 180, 22, { width: w - 360, align: 'center' });
    }
    await drawImage(doc, input.assets.SEAL, w - 118, 12, 92, 92);
    await drawImage(doc, input.assets.RIGHT_LOGO, w - 210, 18, 88, 56);

    const body = `Certificamos que o Senhor ${worker.name}, ${input.certificateCourseClause}, Realizado no Periodo de ${formatDateExtenso(input.heldOn)}, Cumprindo a Carga Horaria de ${padHours(input.hours)} Horas.`;
    doc
      .font('Times-Roman')
      .fontSize(25)
      .fillColor(INK)
      .text(body, 48, 118, {
        width: w - 96,
        align: 'center',
        lineGap: 3,
      });

    doc
      .font('Times-Roman')
      .fontSize(12)
      .fillColor(INK)
      .text(`Endereco do Curso Realizado:\n${input.address || '—'}`, w / 2 + 20, 318, {
        width: w / 2 - 50,
        align: 'left',
      });

    const sigY = 390;
    const colW = (w - 80) / 3;
    const cols = [
      {
        x: 28,
        lines: [
          input.instructorName || '_____________________________',
          input.instructorRole,
          input.instructorRegistry ? `MTB. ${input.instructorRegistry}` : '',
          'Instrutor/Responsavel Tecnico',
        ],
      },
      {
        x: 28 + colW,
        lines: [
          input.legalRepName ||
            input.companyTradeName ||
            input.companyLegalName,
          `CNPJ: ${formatCnpj(input.companyCnpj)}`,
          'Representante Legal',
        ],
      },
      {
        x: 28 + colW * 2,
        lines: [
          worker.name,
          'Treinando',
          `RG/CPF: ${formatCpf(worker.cpf)}`,
        ],
      },
    ];
    for (const col of cols) {
      doc
        .moveTo(col.x + 16, sigY)
        .lineTo(col.x + colW - 20, sigY)
        .strokeColor(INK)
        .lineWidth(0.7)
        .stroke();
      doc
        .font('Times-Roman')
        .fontSize(15)
        .fillColor(INK)
        .text(col.lines.filter(Boolean).join('\n'), col.x + 10, sigY + 8, {
          width: colW - 24,
          align: 'center',
          lineGap: 1,
        });
    }

    await drawImage(doc, input.assets.FOOTER, 22, h - 72, w - 44, 56);
  }

  private async drawCertificateBack(
    doc: PDFKit.PDFDocument,
    input: TrainingPdfInput,
  ) {
    const w = doc.page.width;
    const h = doc.page.height;
    doc.save();
    doc.rect(0, 0, w, h).fill('#ffffff');
    doc.restore();
    doc.save();
    doc.rect(0, 0, 10, h).fill(GREEN);
    doc.restore();
    await drawImage(doc, input.assets.LEFT_LOGO, 24, 16, 140, 70);
    doc
      .font('Times-Bold')
      .fontSize(22)
      .fillColor(NAVY)
      .text('Conteudo Programatico:', 48, 100, { width: w - 96 });
    const topics = input.topics.length
      ? input.topics
      : ['Conteudo definido no modelo do curso.'];
    doc
      .font('Times-Roman')
      .fontSize(14)
      .fillColor(INK)
      .text(
        topics.map((item) => `${item};`).join('\n'),
        48,
        136,
        { width: w - 96, lineGap: 4 },
      );
    await drawImage(doc, input.assets.FOOTER, 22, h - 72, w - 44, 56);
  }

  private async drawRegister(
    doc: PDFKit.PDFDocument,
    input: TrainingPdfInput,
    workers: TrainingPdfWorker[],
    pageIndex: number,
    pageCount: number,
  ) {
    const w = doc.page.width;
    const marks = deliveryMarks(input.deliveryKind);
    await drawImage(doc, input.assets.BANNER, 28, 24, 170, 40);
    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor(NAVY)
      .text('REGISTRO DE TREINAMENTO', 210, 28, {
        width: w - 250,
        align: 'center',
      });
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(GREEN)
      .text('CAPACITACAO EM SST', 210, 46, {
        width: w - 250,
        align: 'center',
      });

    const box = (x: number, y: number, bw: number, bh: number) => {
      doc.save();
      doc.rect(x, y, bw, bh).strokeColor('#111111').lineWidth(0.6).stroke();
      doc.restore();
    };
    let y = 78;
    box(28, y, w - 56, 22);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(INK).text('Treinamento:', 32, y + 6);
    doc.font('Helvetica').fontSize(8).text(input.courseTitle, 100, y + 6, {
      width: 300,
    });
    doc.font('Helvetica').fontSize(8).text(
      `Interno (${marks.interno})     T.L.T. (${marks.tlt})     Externo (${marks.externo})`,
      w - 250,
      y + 6,
      { width: 214 },
    );
    y += 22;
    const metaH = 36;
    box(28, y, w - 56, metaH);
    const cells = [
      ['N. Controle:', input.controlNumber || '—'],
      ['Local:', input.location || '—'],
      ['Carga horaria:', `${padHours(input.hours)} horas`],
      ['Data da Realizacao:', formatDateBr(input.heldOn)],
    ];
    cells.forEach((pair, idx) => {
      const x = 32 + idx * 135;
      doc.font('Helvetica-Bold').fontSize(7).fillColor(INK).text(pair[0], x, y + 5);
      doc.font('Helvetica').fontSize(8).text(pair[1], x, y + 16, { width: 128 });
    });
    y += metaH;
    box(28, y, w - 56, 28);
    doc.font('Helvetica-Bold').fontSize(7).text('Empresa:', 32, y + 4);
    doc
      .font('Helvetica')
      .fontSize(8)
      .text(
        `${input.companyLegalName}   CNPJ: ${formatCnpj(input.companyCnpj)}`,
        32,
        y + 14,
        { width: w - 72 },
      );
    y += 28;
    box(28, y, w - 56, 28);
    doc.font('Helvetica-Bold').fontSize(7).text('Endereco:', 32, y + 4);
    doc.font('Helvetica').fontSize(8).text(input.address || '—', 32, y + 14, {
      width: w - 72,
    });
    y += 28;
    const summaryH = 70;
    box(28, y, w - 56, summaryH);
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .text('Conteudo resumido do curso (utilizar maximo 10 linhas):', 32, y + 4);
    doc
      .font('Helvetica')
      .fontSize(8)
      .text(input.registerSummary || '—', 32, y + 16, {
        width: w - 72,
        height: summaryH - 22,
      });
    y += summaryH + 8;

    const cols = [
      { title: 'N.', width: 28 },
      { title: 'Nome Completo', width: 175 },
      { title: 'Funcao', width: 128 },
      { title: 'RG/CPF', width: 95 },
      { title: 'Presenca (Visto)', width: 112 },
    ];
    const tableW = cols.reduce((sum, col) => sum + col.width, 0);
    const rowH = 16;
    const drawRow = (cellsText: string[], yy: number, header: boolean) => {
      let x = 28;
      doc.save();
      doc.rect(28, yy, tableW, rowH).fill(header ? NAVY : '#ffffff');
      doc.restore();
      doc.save();
      doc.rect(28, yy, tableW, rowH).strokeColor('#111111').lineWidth(0.45).stroke();
      doc.restore();
      for (let i = 0; i < cols.length; i += 1) {
        doc
          .font(header ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(7)
          .fillColor(header ? '#ffffff' : INK)
          .text(cellsText[i] ?? '', x + 3, yy + 4, {
            width: cols[i].width - 6,
            ellipsis: true,
            lineBreak: false,
          });
        x += cols[i].width;
      }
    };
    drawRow(
      ['N.', 'Nome Completo', 'Funcao', 'RG/CPF', 'Presenca (Visto)'],
      y,
      true,
    );
    y += rowH;
    const startN = pageIndex * 22 + 1;
    const empty = Math.max(0, 22 - workers.length);
    const rows = [
      ...workers.map((worker, idx) => [
        String(startN + idx).padStart(2, '0'),
        worker.name,
        worker.jobFunction || '—',
        formatCpf(worker.cpf),
        '',
      ]),
      ...Array.from({ length: empty }, () => ['', '', '', '', '']),
    ];
    for (const row of rows) {
      drawRow(row, y, false);
      y += rowH;
    }

    y += 16;
    doc
      .moveTo(28, y)
      .lineTo(220, y)
      .strokeColor(INK)
      .lineWidth(0.7)
      .stroke();
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(INK)
      .text(
        [
          input.instructorName || 'Instrutor',
          input.instructorRole,
          input.instructorRegistry ? `MTB/${input.instructorRegistry}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
        28,
        y + 6,
        { width: 240 },
      );
    if (pageCount > 1) {
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#444444')
        .text(`Pagina ${pageIndex + 1} de ${pageCount}`, 28, 770, {
          width: w - 56,
          align: 'center',
        });
    }
  }
}
