import { Injectable } from '@nestjs/common';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import PDFDocument from 'pdfkit';
import { TrainingDeliveryKind } from '@prisma/client';
import { formatCnpj } from '../sst-documents/sst-document-content';
import { bundledAssetsForNr, bundledTemplatePage } from './bundled-assets';

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
  clientLogoPath?: string | null;
};

const GREEN = '#6BB12A';
const INK = '#000000';
const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
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

function isNr35(nrLabel: string) {
  return (nrLabel || '').toUpperCase().includes('35');
}

type Rect = [number, number, number, number];

function coverWhite(
  doc: PDFKit.PDFDocument,
  [x, y, w, h]: Rect,
) {
  doc.save();
  doc.rect(x, y, w, h).fill('#ffffff');
  doc.restore();
}

function wrapCenteredLines(
  doc: PDFKit.PDFDocument,
  text: string,
  width: number,
  fontSize: number,
) {
  doc.font('Times-Roman').fontSize(fontSize);
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (doc.widthOfString(trial) <= width) {
      current = trial;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawCertificateBody(
  doc: PDFKit.PDFDocument,
  input: TrainingPdfInput,
  worker: TrainingPdfWorker,
  bodyY: number,
  pageW: number,
) {
  const bodyX = 72;
  const bodyW = pageW - 144;
  const fontSize = 26;
  const full = `Certificamos que o Senhor ${worker.name}, ${input.certificateCourseClause}, Realizado no Período de ${formatDateExtenso(input.heldOn)}, Cumprindo a Carga Horária de ${padHours(input.hours)} Horas.`;
  const lines = wrapCenteredLines(doc, full, bodyW * 0.86, fontSize);
  let y = bodyY;
  for (const line of lines) {
    doc
      .font('Times-Roman')
      .fontSize(fontSize)
      .fillColor(INK)
      .text(line, bodyX, y, {
        width: bodyW,
        align: 'center',
        lineBreak: false,
      });
    y += fontSize + 18;
  }
}

function drawSignatureColumns(
  doc: PDFKit.PDFDocument,
  input: TrainingPdfInput,
  worker: TrainingPdfWorker,
  sigY: number,
) {
  const cols: Array<{ x: number; width: number; lines: string[] }> = [
    {
      x: 64,
      width: 232,
      lines: [
        input.instructorName || '_____________________________',
        input.instructorRole,
        input.instructorRegistry ? `MTB. ${input.instructorRegistry}` : '',
        'Instrutor/Responsável Técnico',
      ],
    },
    {
      x: 312,
      width: 242,
      lines: [
        input.legalRepName ||
          input.companyTradeName ||
          input.companyLegalName,
        `CNPJ: ${formatCnpj(input.companyCnpj)}`,
        'Representante Legal',
      ],
    },
    {
      x: 568,
      width: 214,
      lines: [worker.name, 'Treinando', `RG/CPF: ${formatCpf(worker.cpf)}`],
    },
  ];
  for (const col of cols) {
    const lineY = sigY - 16;
    doc.save();
    doc
      .moveTo(col.x + 8, lineY)
      .lineTo(col.x + col.width - 8, lineY)
      .lineWidth(0.8)
      .strokeColor(INK)
      .stroke();
    doc.restore();
    doc
      .font('Times-Roman')
      .fontSize(16)
      .fillColor(INK)
      .text(col.lines.filter(Boolean).join('\n'), col.x, sigY, {
        width: col.width,
        align: 'center',
        lineGap: 1.4,
        height: 82,
      });
  }
}

const FRONT_LAYOUT: Record<
  'nr01' | 'nr35',
  { bodyY: number; sigY: number; covers: Rect[] }
> = {
  nr01: {
    bodyY: 188,
    sigY: 468,
    covers: [
      [58, 175, 726, 220],
      // apaga assinaturas de caneta + texto do molde Word
      [72, 388, 230, 160],
      [300, 410, 255, 130],
      [555, 448, 245, 95],
    ],
  },
  nr35: {
    bodyY: 193,
    sigY: 462,
    covers: [
      [58, 186, 726, 220],
      [72, 370, 230, 160],
      [300, 400, 250, 130],
      [555, 430, 245, 100],
    ],
  },
};

const BACK_LAYOUT: Record<
  'nr01' | 'nr35',
  {
    topicCovers: Rect[];
    addressCover: Rect;
    addressTextY: number;
  }
> = {
  nr01: {
    topicCovers: [
      [64, 94, 510, 368],
      [64, 460, 452, 28],
      [64, 496, 385, 30],
    ],
    addressCover: [462, 506, 322, 42],
    addressTextY: 509,
  },
  nr35: {
    topicCovers: [
      [58, 98, 560, 340],
      [58, 438, 90, 40],
    ],
    addressCover: [164, 470, 318, 36],
    addressTextY: 471,
  },
};

function bufferFromPdf(
  layout: 'landscape' | 'portrait',
  build: (doc: PDFKit.PDFDocument) => void | Promise<void>,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
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

function drawGreenBar(doc: PDFKit.PDFDocument) {
  const h = doc.page.height;
  const bar = 12;
  doc.save();
  doc.rect(0, 0, bar, h).fill(GREEN);
  doc.restore();
  doc.save();
  doc.rect(0, 0, bar, h).lineWidth(0.7).strokeColor('#111111').stroke();
  doc.restore();
}

function drawDoubleRule(doc: PDFKit.PDFDocument, x: number, y: number, w: number) {
  doc.save();
  doc.moveTo(x, y).lineTo(x + w, y).lineWidth(1.1).strokeColor(INK).stroke();
  doc.moveTo(x, y + 2.4).lineTo(x + w, y + 2.4).lineWidth(0.5).strokeColor(INK).stroke();
  doc.restore();
}

function drawTopicMarker(doc: PDFKit.PDFDocument, x: number, y: number) {
  const cx = x + 5;
  const cy = y + 8;
  doc.save();
  doc
    .polygon(
      [cx, cy - 4.1],
      [cx + 1.45, cy - 1.45],
      [cx + 4.1, cy],
      [cx + 1.45, cy + 1.45],
      [cx, cy + 4.1],
      [cx - 1.45, cy + 1.45],
      [cx - 4.1, cy],
      [cx - 1.45, cy - 1.45],
    )
    .fill(INK);
  doc.restore();
}

function doubleBox(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  doc.save();
  doc.rect(x, y, w, h).lineWidth(1.05).strokeColor(INK).stroke();
  doc.rect(x + 2.2, y + 2.2, w - 4.4, h - 4.4).lineWidth(0.45).strokeColor(INK).stroke();
  doc.restore();
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
        const pages = this.chunkWorkers(payload.workers, 24);
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
    const key = isNr35(input.nrLabel) ? 'nr35' : 'nr01';
    const template = bundledTemplatePage(input.nrLabel, 1);
    if (template) {
      await drawImage(doc, template, 0, 0, w, h);
      const layout = FRONT_LAYOUT[key];
      for (const rect of layout.covers) coverWhite(doc, rect);
      drawCertificateBody(doc, input, worker, layout.bodyY, w);
      drawSignatureColumns(doc, input, worker, layout.sigY);
      return;
    }

    doc.save();
    doc.rect(0, 0, w, doc.page.height).fill('#ffffff');
    doc.restore();
    drawGreenBar(doc);
    drawDoubleRule(doc, 14, 16, w - 22);
    const nr35 = key === 'nr35';
    if (nr35) {
      await drawImage(doc, input.assets.LEFT_LOGO, 22, 28, 96, 96);
    } else {
      await drawImage(doc, input.assets.LEFT_LOGO, 22, 32, 148, 76);
    }
    await drawImage(doc, input.assets.HEADER, w - 268, 26, 246, 78);
    drawCertificateBody(doc, input, worker, 193, w);
    drawSignatureColumns(doc, input, worker, 456);
    if (nr35) {
      await drawImage(doc, input.assets.SEAL, 592, 508, 168, 68);
    }
  }

  private async drawCertificateBack(
    doc: PDFKit.PDFDocument,
    input: TrainingPdfInput,
  ) {
    const w = doc.page.width;
    const h = doc.page.height;
    const key = isNr35(input.nrLabel) ? 'nr35' : 'nr01';
    const topics = input.topics.length
      ? input.topics
      : ['Conteúdo definido no modelo do curso'];
    const template = bundledTemplatePage(input.nrLabel, 2);
    if (template) {
      await drawImage(doc, template, 0, 0, w, h);
      const layout = BACK_LAYOUT[key];
      for (const rect of layout.topicCovers) coverWhite(doc, rect);
      coverWhite(doc, layout.addressCover);
      if (key === 'nr01') {
        doc
          .font('Times-BoldItalic')
          .fontSize(16)
          .fillColor(INK)
          .text(`${topics[0]};`, 71, 97, { width: w - 300, height: 22 });
        let y = 123;
        topics.slice(1).forEach((item, idx) => {
          const nearAddress = idx >= 10;
          drawTopicMarker(doc, 70, y);
          doc
            .font('Times-Roman')
            .fontSize(16)
            .fillColor(INK)
            .text(`${item};`, 90, y, {
              width: nearAddress ? 348 : w - 300,
              height: nearAddress ? 32 : 30,
            });
          y += 34.5;
        });
      } else {
        doc
          .font('Times-BoldItalic')
          .fontSize(16)
          .fillColor(INK)
          .text(`${topics[0]};`, 71, 103, { width: w - 120, height: 22 });
        let y = 135;
        for (const item of topics.slice(1)) {
          drawTopicMarker(doc, 60, y);
          doc
            .font('Times-Roman')
            .fontSize(item.length > 90 ? 15 : 16)
            .fillColor(INK)
            .text(`${item};`, 80, y, { width: w - 140, height: 40 });
          y += 43;
        }
      }
      const [ax, , aw] = layout.addressCover;
      doc
        .font('Times-Roman')
        .fontSize(12)
        .fillColor(INK)
        .text(input.address?.trim() || '—', ax, layout.addressTextY, {
          width: aw,
          align: 'center',
          lineGap: 1.2,
          height: 36,
        });
      return;
    }

    doc.save();
    doc.rect(0, 0, w, h).fill('#ffffff');
    doc.restore();
    const nr35 = key === 'nr35';
    if (!nr35) {
      await drawImage(doc, input.assets.RIGHT_LOGO, w - 276, 36, 220, 92);
      doc
        .font('Times-Bold')
        .fontSize(16)
        .fillColor(INK)
        .text('Conteúdo Programático:', 71, 71.5, {
          width: 360,
          underline: true,
          height: 20,
          lineBreak: false,
        });
      doc
        .font('Times-BoldItalic')
        .fontSize(16)
        .text(`${topics[0]};`, 71, 97, { width: w - 360, height: 22 });
      let y = 123;
      for (const item of topics.slice(1)) {
        drawTopicMarker(doc, 70, y);
        doc
          .font('Times-Roman')
          .fontSize(16)
          .fillColor(INK)
          .text(`${item};`, 90, y, { width: w - 380, height: 32 });
        y += 34.5;
      }
      this.drawAddressBox(doc, 458, h - 108, 332, 78, input.address);
    } else {
      doc
        .font('Times-BoldItalic')
        .fontSize(16)
        .fillColor(INK)
        .text(`${topics[0]};`, 71, 71.5, { width: w - 120, height: 22 });
      let y = 103;
      for (const item of topics) {
        drawTopicMarker(doc, 60, y);
        doc
          .font('Times-Roman')
          .fontSize(item.length > 90 ? 15 : 16)
          .fillColor(INK)
          .text(`${item};`, 80, y, { width: w - 140, height: 40 });
        y += 43;
      }
      this.drawAddressBox(doc, 72, Math.min(y + 18, h - 120), 332, 78, input.address);
    }
  }

  private drawAddressText(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    w: number,
    h: number,
    address: string,
  ) {
    doc
      .font('Times-Bold')
      .fontSize(12)
      .fillColor(INK)
      .text('Endereço do Curso Realizado:', x + 8, y + 10, {
        width: w - 16,
        align: 'center',
        underline: true,
        height: 16,
      });
    doc
      .font('Times-Roman')
      .fontSize(12)
      .text(address || '—', x + 10, y + 30, {
        width: w - 20,
        align: 'center',
        lineGap: 1.5,
        height: h - 40,
      });
  }

  private drawAddressBox(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    w: number,
    h: number,
    address: string,
  ) {
    doubleBox(doc, x, y, w, h);
    this.drawAddressText(doc, x, y, w, h, address);
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
    const left = 20;
    const right = w - 20;
    const boxW = right - left;

    doubleBox(doc, left, 16, boxW, 48);
    doc.save();
    doc.moveTo(190, 16).lineTo(190, 64).lineWidth(0.6).strokeColor(INK).stroke();
    doc.moveTo(422, 16).lineTo(422, 64).lineWidth(0.6).strokeColor(INK).stroke();
    doc.restore();
    await drawImage(doc, input.assets.HEADER, left + 6, 20, 160, 40);
    doc
      .font('Times-Bold')
      .fontSize(14)
      .fillColor(INK)
      .text('REGISTRO DE TREINAMENTO', 190, 22, {
        width: 232,
        align: 'center',
      });
    doc
      .font('Times-Bold')
      .fontSize(14)
      .text('CAPACITAÇÃO EM SST', 190, 40, {
        width: 232,
        align: 'center',
      });
    await drawImage(doc, input.clientLogoPath, 428, 20, 164, 40);

    let y = 64;
    const metaTop = y;
    const row = (height: number, draw: () => void, withRule = true) => {
      draw();
      y += height;
      if (!withRule) return;
      doc.save();
      doc
        .moveTo(left, y)
        .lineTo(right, y)
        .lineWidth(0.55)
        .strokeColor(INK)
        .stroke();
      doc.restore();
    };

    row(20, () => {
      doc
        .font('Times-Roman')
        .fontSize(11)
        .fillColor(INK)
        .text(`Treinamento: ${input.courseTitle}`, left + 4, y + 5, {
          width: boxW - 210,
        });
      doc.text(
        `Interno (${marks.interno})     T.L.T. (${marks.tlt})     Externo (${marks.externo})`,
        right - 200,
        y + 5,
        { width: 196 },
      );
    });
    row(22, () => {
      const cells = [
        ['Nº. Controle:', input.controlNumber || '—'],
        ['Local:', input.location || '—'],
        ['Carga horária:', `${padHours(input.hours)} horas`],
        ['Data da Realização:', formatDateBr(input.heldOn)],
      ];
          const weights = [0.2, 0.24, 0.2, 0.36];
      let x = left;
      cells.forEach((pair, idx) => {
        const colW = boxW * weights[idx];
        if (idx > 0) {
          doc.save();
          doc
            .moveTo(x, y)
            .lineTo(x, y + 22)
            .lineWidth(0.5)
            .strokeColor(INK)
            .stroke();
          doc.restore();
        }
        doc
          .font('Times-Roman')
          .fontSize(10)
          .fillColor(INK)
          .text(`${pair[0]} ${pair[1]}`, x + 4, y + 6, {
            width: colW - 8,
            lineBreak: false,
            ellipsis: true,
          });
        x += colW;
      });
    });
    row(20, () => {
      doc
        .font('Times-Roman')
        .fontSize(11)
        .fillColor(INK)
        .text(`Empresa: ${input.companyLegalName}`, left + 4, y + 5, {
          width: boxW - 8,
        });
    });
    row(20, () => {
      doc
        .font('Times-Roman')
        .fontSize(11)
        .fillColor(INK)
        .text(`Endereço: ${input.address || '—'}`, left + 4, y + 5, {
          width: boxW - 8,
        });
    });
    const summaryH = 76;
    row(summaryH, () => {
      doc
        .font('Times-Bold')
        .fontSize(11)
        .fillColor(INK)
        .text(
          'Conteúdo resumido do curso (utilizar máximo 10 linhas):',
          left + 4,
          y + 4,
          { width: boxW - 8, align: 'center' },
        );
      doc
        .font('Times-Roman')
        .fontSize(10.5)
        .text(input.registerSummary || '—', left + 36, y + 20, {
          width: boxW - 72,
          height: summaryH - 24,
          align: 'center',
        });
    }, false);
    doc.save();
    doc.rect(left, metaTop, boxW, y - metaTop).lineWidth(0.6).strokeColor(INK).stroke();
    doc.restore();

    const cols = [
      { title: 'Nº.', width: 28 },
      { title: 'Nome Completo', width: 168 },
      { title: 'Função', width: 118 },
      { title: 'RG/CPF', width: 92 },
      { title: 'Presença (Visto)', width: boxW - 28 - 168 - 118 - 92 },
    ];
    const tableW = cols.reduce((sum, col) => sum + col.width, 0);
    const headerH = 22;
    const leftHeaderW = 28 + 168 + 118 + 92;
    doc.save();
    doc.rect(left, y, leftHeaderW, headerH).fill(GREEN);
    doc.rect(left + leftHeaderW, y, cols[4].width, headerH).fill(GREEN);
    doc.restore();
    doc
      .font('Times-Bold')
      .fontSize(9)
      .fillColor('#ffffff')
      .text('PARTICIPANTES', left, y + 6, {
        width: leftHeaderW,
        align: 'center',
      });
    doc
      .font('Times-Bold')
      .fontSize(7.5)
      .fillColor('#ffffff')
      .text('ASSINATURA DOS\nPARTICIPANTES', left + leftHeaderW, y + 2, {
        width: cols[4].width,
        align: 'center',
        lineGap: 0.5,
      });
    y += headerH;

    const subH = 14;
    doc.save();
    doc.rect(left, y, tableW, subH).fill('#D8D8D8');
    doc.restore();
    let x = left;
    for (const col of cols) {
      doc
        .font('Times-Roman')
        .fontSize(9)
        .fillColor(INK)
        .text(col.title, x, y + 3, { width: col.width, align: 'center' });
      x += col.width;
    }
    y += subH;

    const rowH = 16;
    const startN = pageIndex * 24 + 1;
    const empty = Math.max(0, 24 - workers.length);
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
    for (const cells of rows) {
      doc.save();
      doc.rect(left, y, tableW, rowH).lineWidth(0.4).strokeColor('#111111').stroke();
      doc.restore();
      let cx = left;
      cells.forEach((text, i) => {
        if (i > 0) {
          doc.save();
          doc
            .moveTo(cx, y)
            .lineTo(cx, y + rowH)
            .lineWidth(0.35)
            .strokeColor('#111111')
            .stroke();
          doc.restore();
        }
        doc
          .font('Times-Roman')
          .fontSize(9)
          .fillColor(INK)
          .text(text, cx + 2, y + 4, {
            width: cols[i].width - 4,
            ellipsis: true,
            lineBreak: false,
            align: i === 0 || i === 3 ? 'center' : 'left',
          });
        cx += cols[i].width;
      });
      y += rowH;
    }

    y += 18;
    doc
      .font('Times-Roman')
      .fontSize(10)
      .fillColor(INK)
      .text(
        [
          input.instructorName || 'Instrutor',
          input.instructorRole
            ? `Instrutor – ${input.instructorRole}`
            : 'Instrutor',
          input.instructorRegistry ? `MTB/${input.instructorRegistry}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
        left,
        y,
        { width: boxW, align: 'center', lineGap: 1.5 },
      );
    if (pageCount > 1) {
      doc
        .font('Times-Roman')
        .fontSize(8)
        .fillColor('#444444')
        .text(`Página ${pageIndex + 1} de ${pageCount}`, left, 772, {
          width: boxW,
          align: 'center',
        });
    }
  }
}
