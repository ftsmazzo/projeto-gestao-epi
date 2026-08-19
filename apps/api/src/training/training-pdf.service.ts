import { Injectable } from '@nestjs/common';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import PDFDocument from 'pdfkit';
import { TrainingDeliveryKind } from '@prisma/client';
import { formatCnpj } from '../sst-documents/sst-document-content';

export type TrainingPdfWorker = {
  name: string;
  cpf: string | null;
  jobFunction: string;
};

export type TrainingPdfAssetMap = Partial<
  Record<'HEADER' | 'LEFT_LOGO' | 'RIGHT_LOGO' | 'SEAL' | string, string>
>;

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

const GOLD = '#b8860b';
const NAVY = '#1e3a5f';
const TEAL = '#0f766e';
const INK = '#1f2937';
const MUTED = '#475569';
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

function companyShortName(legalName: string, tradeName: string | null) {
  const trade = tradeName?.trim();
  if (trade) return trade;
  return legalName.length > 42 ? `${legalName.slice(0, 40)}…` : legalName;
}

function bufferFromPdf(
  layout: 'landscape' | 'portrait',
  build: (doc: PDFKit.PDFDocument) => void | Promise<void>,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout,
      margins: { top: 28, bottom: 28, left: 28, right: 28 },
      bufferPages: true,
      info: { Title: 'ProntEPI — Certificado / Registro', Author: 'ProntEPI' },
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
    const firstLayout =
      input.includeCertificate && input.workers.length > 0
        ? 'landscape'
        : 'portrait';
    return bufferFromPdf(firstLayout, async (doc) => {
      let started = false;
      if (input.includeCertificate) {
        for (const worker of input.workers) {
          if (started) doc.addPage({ size: 'A4', layout: 'landscape' });
          started = true;
          await this.drawCertificateFront(doc, input, worker);
          doc.addPage({ size: 'A4', layout: 'landscape' });
          await this.drawCertificateBack(doc, input);
        }
      }
      if (input.includeRegister) {
        const pages = this.chunkWorkers(input.workers, 22);
        for (let i = 0; i < pages.length; i += 1) {
          if (started) doc.addPage({ size: 'A4', layout: 'portrait' });
          started = true;
          await this.drawRegister(doc, input, pages[i], i, pages.length);
        }
        if (pages.length === 0) {
          if (started) doc.addPage({ size: 'A4', layout: 'portrait' });
          await this.drawRegister(doc, input, [], 0, 1);
        }
      }
    });
  }

  private chunkWorkers(workers: TrainingPdfWorker[], size: number) {
    if (workers.length === 0) return [] as TrainingPdfWorker[][];
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
    doc.rect(0, 0, w, h).fill('#fbf8f1');
    doc.restore();

    const m = 18;
    doc.save();
    doc.rect(m, m, w - 2 * m, h - 2 * m).lineWidth(3).strokeColor(GOLD).stroke();
    doc
      .rect(m + 8, m + 8, w - 2 * m - 16, h - 2 * m - 16)
      .lineWidth(1.2)
      .strokeColor(NAVY)
      .stroke();
    doc.restore();

    doc.save();
    doc.rect(m, m, 14, h - 2 * m).fill(NAVY);
    doc.restore();

    await drawImage(doc, input.assets.LEFT_LOGO, 48, 36, 150, 72);
    await drawImage(doc, input.assets.HEADER, w / 2 - 130, 32, 260, 58);
    await drawImage(doc, input.assets.RIGHT_LOGO, w - 198, 36, 140, 72);

    if (!input.assets.HEADER) {
      doc
        .font('Times-Bold')
        .fontSize(28)
        .fillColor(NAVY)
        .text('CERTIFICADO', 80, 48, {
          width: w - 160,
          align: 'center',
        });
    }

    const body = `Certificamos que o Senhor ${worker.name}, ${input.certificateCourseClause}, Realizado no Periodo de ${formatDateExtenso(input.heldOn)}, Cumprindo a Carga Horaria de ${padHours(input.hours)} Horas.`;

    doc
      .font('Times-Roman')
      .fontSize(14)
      .fillColor(INK)
      .text(body, 72, 150, {
        width: w - 130,
        align: 'center',
        lineGap: 6,
      });

    const afterBody = Math.max(doc.y + 12, 250);
    doc
      .font('Times-Italic')
      .fontSize(10)
      .fillColor(MUTED)
      .text(`Endereco do Curso Realizado: ${input.address || '—'}`, 72, afterBody, {
        width: w - 130,
        align: 'center',
      });

    await drawImage(doc, input.assets.SEAL, w / 2 - 42, afterBody + 28, 84, 84);

    const sigY = h - 148;
    const colW = (w - 120) / 3;
    const cols = [
      {
        x: 48,
        lines: [
          input.instructorName || '_____________________________',
          input.instructorRole,
          input.instructorRegistry ? `MTB. ${input.instructorRegistry}` : '',
          'Instrutor / Responsavel Tecnico',
        ],
      },
      {
        x: 48 + colW,
        lines: [
          companyShortName(input.companyLegalName, input.companyTradeName),
          `CNPJ: ${formatCnpj(input.companyCnpj)}`,
          input.legalRepName || '_____________________________',
          'Representante Legal',
        ],
      },
      {
        x: 48 + colW * 2,
        lines: [
          worker.name,
          `RG/CPF: ${formatCpf(worker.cpf)}`,
          '_____________________________',
          'Treinando',
        ],
      },
    ];
    for (const col of cols) {
      doc
        .moveTo(col.x + 12, sigY)
        .lineTo(col.x + colW - 16, sigY)
        .strokeColor(NAVY)
        .lineWidth(0.8)
        .stroke();
      doc
        .font('Times-Roman')
        .fontSize(8.5)
        .fillColor(INK)
        .text(col.lines.filter(Boolean).join('\n'), col.x + 8, sigY + 8, {
          width: colW - 20,
          align: 'center',
          lineGap: 2,
        });
    }
  }

  private async drawCertificateBack(
    doc: PDFKit.PDFDocument,
    input: TrainingPdfInput,
  ) {
    const w = doc.page.width;
    const h = doc.page.height;
    doc.save();
    doc.rect(0, 0, w, h).fill('#fbf8f1');
    doc.restore();
    const m = 18;
    doc.save();
    doc.rect(m, m, w - 2 * m, h - 2 * m).lineWidth(3).strokeColor(GOLD).stroke();
    doc
      .rect(m + 8, m + 8, w - 2 * m - 16, h - 2 * m - 16)
      .lineWidth(1.2)
      .strokeColor(NAVY)
      .stroke();
    doc.restore();

    await drawImage(doc, input.assets.HEADER, w / 2 - 130, 32, 260, 50);
    doc
      .font('Times-Bold')
      .fontSize(16)
      .fillColor(NAVY)
      .text('Conteudo Programatico', 60, 96, {
        width: w - 120,
        align: 'center',
      });

    const topics = input.topics.length
      ? input.topics
      : ['Conteudo definido no modelo do curso.'];
    const colCount = topics.length > 8 ? 2 : 1;
    const colW = (w - 120) / colCount;
    const perCol = Math.ceil(topics.length / colCount);
    for (let c = 0; c < colCount; c += 1) {
      const slice = topics.slice(c * perCol, (c + 1) * perCol);
      doc
        .font('Times-Roman')
        .fontSize(11)
        .fillColor(INK)
        .text(
          slice.map((t) => `•  ${t}`).join('\n'),
          60 + c * colW,
          130,
          { width: colW - 16, lineGap: 6 },
        );
    }
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
    doc.save();
    doc.rect(28, 28, w - 56, 56).fill(TEAL);
    doc.restore();
    await drawImage(doc, input.assets.LEFT_LOGO, 36, 34, 70, 44);
    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor('#fff')
      .text('REGISTRO DE TREINAMENTO', 112, 38, {
        width: w - 230,
        align: 'center',
      });
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#ecfeff')
      .text('CAPACITACAO EM SST', 112, 58, {
        width: w - 230,
        align: 'center',
      });
    await drawImage(doc, input.assets.RIGHT_LOGO, w - 110, 34, 70, 44);

    let y = 98;
    const label = (text: string, x: number, yy: number, width: number) => {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text(text, x, yy, {
        width,
      });
    };
    const value = (text: string, x: number, yy: number, width: number) => {
      doc.font('Helvetica').fontSize(9).fillColor(INK).text(text, x, yy, {
        width,
      });
    };

    label('Treinamento', 36, y, 360);
    value(input.courseTitle, 36, y + 11, 360);
    value(
      `Interno (${marks.interno})     T.L.T. (${marks.tlt})     Externo (${marks.externo})`,
      410,
      y + 11,
      160,
    );
    y += 34;
    label('N. Controle', 36, y, 90);
    value(input.controlNumber || '—', 36, y + 11, 90);
    label('Local', 136, y, 150);
    value(input.location || '—', 136, y + 11, 150);
    label('Carga horaria', 296, y, 90);
    value(`${padHours(input.hours)} horas`, 296, y + 11, 90);
    label('Data da Realizacao', 396, y, 160);
    value(formatDateBr(input.heldOn), 396, y + 11, 160);
    y += 34;
    label('Empresa', 36, y, 520);
    value(
      `${input.companyLegalName}  ·  CNPJ ${formatCnpj(input.companyCnpj)}`,
      36,
      y + 11,
      520,
    );
    y += 32;
    label('Endereco', 36, y, 520);
    value(input.address || '—', 36, y + 11, 520);
    y += 32;
    label('Conteudo resumido do curso', 36, y, 520);
    value(input.registerSummary || '—', 36, y + 11, 520);
    y = Math.max(doc.y + 14, y + 56);

    const cols = [
      { title: 'N.', width: 28 },
      { title: 'Nome Completo', width: 175 },
      { title: 'Funcao', width: 130 },
      { title: 'RG/CPF', width: 95 },
      { title: 'Presenca (Visto)', width: 110 },
    ];
    const tableX = 36;
    const rowH = 18;
    const drawRow = (
      cells: string[],
      yy: number,
      header: boolean,
    ) => {
      let x = tableX;
      doc.save();
      doc.rect(tableX, yy, 538, rowH).fill(header ? TEAL : '#fff');
      doc.restore();
      doc.save();
      doc.rect(tableX, yy, 538, rowH).strokeColor('#94a3b8').lineWidth(0.4).stroke();
      doc.restore();
      for (let i = 0; i < cols.length; i += 1) {
        doc
          .font(header ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(header ? 7.5 : 7.5)
          .fillColor(header ? '#fff' : INK)
          .text(cells[i] ?? '', x + 3, yy + 5, {
            width: cols[i].width - 6,
            ellipsis: true,
            lineBreak: false,
          });
        x += cols[i].width;
      }
    };

    drawRow(
      cols.map((c) => c.title),
      y,
      true,
    );
    y += rowH;
    const startN = pageIndex * 22 + 1;
    const emptyRows = Math.max(0, 22 - workers.length);
    const rows = [
      ...workers.map((worker, idx) => [
        String(startN + idx).padStart(2, '0'),
        worker.name,
        worker.jobFunction || '—',
        formatCpf(worker.cpf),
        '',
      ]),
      ...Array.from({ length: emptyRows }, () => ['', '', '', '', '']),
    ];
    for (const row of rows) {
      drawRow(row, y, false);
      y += rowH;
    }

    y += 18;
    doc
      .moveTo(36, y)
      .lineTo(220, y)
      .strokeColor(TEAL)
      .lineWidth(0.8)
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
        36,
        y + 6,
        { width: 240 },
      );
    if (pageCount > 1) {
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(MUTED)
        .text(`Pagina ${pageIndex + 1} de ${pageCount}`, 36, 770, {
          width: w - 72,
          align: 'center',
        });
    }
  }
}
