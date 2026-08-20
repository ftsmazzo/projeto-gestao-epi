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

const NAME_PARTICLES = new Set([
  'da',
  'das',
  'de',
  'do',
  'dos',
  'e',
  'di',
  'du',
]);

/** Nome pessoal: primeira letra maiúscula, restante minúsculo (partículas curtas ficam minúsculas). */
export function toPersonNameCase(value: string) {
  const parts = value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return parts
    .map((part, idx) => {
      if (idx > 0 && NAME_PARTICLES.has(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' ');
}

function wrapWords(
  doc: PDFKit.PDFDocument,
  text: string,
  width: number,
) {
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
  opts?: { stretch?: boolean },
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
    if (opts?.stretch) {
      // molde Word: estica na página inteira para as coordenadas baterem
      doc.image(filePath, x, y, { width: w, height: h });
    } else {
      doc.image(filePath, x, y, {
        fit: [w, h],
        align: 'center',
        valign: 'center',
      });
    }
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

function drawCertificateBody(
  doc: PDFKit.PDFDocument,
  input: TrainingPdfInput,
  worker: TrainingPdfWorker,
  bodyY: number,
  pageW: number,
) {
  // margem interna à moldura/faixa verde (~58pt) e à moldura direita (~790)
  const bodyX = 72;
  const bodyW = pageW - 160;
  const fontSize = 19;
  const lineGap = 11;
  const personName = toPersonNameCase(worker.name);
  const prefix = 'Certificamos que o Senhor';
  const suffix = `${input.certificateCourseClause}, Realizado no Período de ${formatDateExtenso(input.heldOn)}, Cumprindo a Carga Horária de ${padHours(input.hours)} Horas.`;
  const nameWords = personName.split(/\s+/).filter(Boolean);
  const prefixWords = prefix.split(/\s+/).filter(Boolean);
  const suffixWords = suffix.split(/\s+/).filter(Boolean);
  type Word = { text: string; name?: boolean; noSpaceBefore?: boolean };
  const allWords: Word[] = [
    ...prefixWords.map((text) => ({ text })),
    ...nameWords.map((text) => ({ text, name: true as const })),
    { text: ',', noSpaceBefore: true },
    ...suffixWords.map((text) => ({ text })),
  ];

  const measure = (word: Word) => {
    doc.font(word.name ? 'Times-Bold' : 'Times-Roman').fontSize(fontSize);
    return doc.widthOfString(word.text);
  };
  const spaceW = (() => {
    doc.font('Times-Roman').fontSize(fontSize);
    return doc.widthOfString(' ');
  })();

  const lines: Word[][] = [];
  let current: Word[] = [];
  let currentW = 0;
  for (const word of allWords) {
    const w = measure(word);
    const pad = current.length === 0 || word.noSpaceBefore ? 0 : spaceW;
    const next = current.length === 0 ? w : currentW + pad + w;
    if (next > bodyW && current.length > 0) {
      lines.push(current);
      current = [word.noSpaceBefore ? { ...word, noSpaceBefore: false } : word];
      currentW = w;
    } else {
      current.push(word);
      currentW = next;
    }
  }
  if (current.length) lines.push(current);

  let y = bodyY;
  const step = fontSize + lineGap;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const isLast = i === lines.length - 1;
    const wordsW = line.reduce((sum, word) => sum + measure(word), 0);
    const spaceSlots = line.reduce((count, word, idx) => {
      if (idx === 0 || word.noSpaceBefore) return count;
      return count + 1;
    }, 0);
    const gap =
      !isLast && spaceSlots > 0 ? (bodyW - wordsW) / spaceSlots : spaceW;
    let x = bodyX;
    for (let j = 0; j < line.length; j += 1) {
      const word = line[j];
      doc
        .font(word.name ? 'Times-Bold' : 'Times-Roman')
        .fontSize(fontSize)
        .fillColor(INK);
      const w = doc.widthOfString(word.text);
      doc.text(word.text, x, y, {
        lineBreak: false,
        width: Math.max(w, 1),
        height: fontSize + 2,
      });
      x += w;
      if (j < line.length - 1) {
        const nextWord = line[j + 1];
        x += nextWord.noSpaceBefore ? 0 : gap;
      }
    }
    y += step;
  }
}

function drawSignatureColumns(
  doc: PDFKit.PDFDocument,
  input: TrainingPdfInput,
  worker: TrainingPdfWorker,
  sigY: number,
) {
  const personName = toPersonNameCase(worker.name);
  const companyName = input.companyLegalName;
  const cols: Array<{ x: number; width: number; lines: string[] }> = [
    {
      x: 68,
      width: 224,
      lines: [
        input.instructorName || '_____________________________',
        input.instructorRole,
        input.instructorRegistry ? `MTB. ${input.instructorRegistry}` : '',
        'Instrutor/Responsável Técnico',
      ],
    },
    {
      x: 312,
      width: 236,
      lines: [
        companyName,
        `CNPJ: ${formatCnpj(input.companyCnpj)}`,
        'Representante Legal',
      ],
    },
    {
      x: 568,
      width: 206,
      lines: [personName, 'Treinando', `RG/CPF: ${formatCpf(worker.cpf)}`],
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
    const lines = col.lines.filter(Boolean);
    let y = sigY;
    for (const line of lines) {
      doc
        .font('Times-Roman')
        .fontSize(11)
        .fillColor(INK)
        .text(line, col.x, y, {
          width: col.width,
          align: 'center',
          lineBreak: false,
          ellipsis: true,
        });
      y += 13.5;
    }
  }
}

const FRONT_LAYOUT: Record<
  'nr01' | 'nr35',
  { bodyY: number; sigY: number; covers: Rect[] }
> = {
  nr01: {
    bodyY: 202,
    sigY: 486,
    // áreas variáveis já estão em branco no PNG do molde
    covers: [],
  },
  nr35: {
    bodyY: 236,
    sigY: 470,
    covers: [],
  },
};

const BACK_LAYOUT: Record<
  'nr01' | 'nr35',
  { addressBox: Rect }
> = {
  // ambos à direita e um pouco mais baixos, para não cobrir o fim da lista
  nr01: {
    addressBox: [458, 498, 318, 46],
  },
  nr35: {
    addressBox: [458, 498, 318, 46],
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

function drawDiamond(doc: PDFKit.PDFDocument, x: number, y: number, size = 3.1) {
  doc.save();
  doc
    .moveTo(x, y - size)
    .lineTo(x + size, y)
    .lineTo(x, y + size)
    .lineTo(x - size, y)
    .closePath()
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
      await drawImage(doc, template, 0, 0, w, h, { stretch: true });
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
    drawCertificateBody(doc, input, worker, 197, w);
    drawSignatureColumns(doc, input, worker, 478);
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
      await drawImage(doc, template, 0, 0, w, h, { stretch: true });
      const layout = BACK_LAYOUT[key];
      const [ax, ay, aw, ah] = layout.addressBox;
      const address = input.address?.trim() || '—';
      const pageRef =
        doc.bufferedPageRange().start + doc.bufferedPageRange().count - 1;
      doc.switchToPage(pageRef);
      // quadro redesenhado à direita (NR35 saiu da esquerda) e um pouco mais baixo
      doc.save();
      doc.rect(ax, ay, aw, ah).fill('#ffffff');
      doc.restore();
      doubleBox(doc, ax, ay, aw, ah);
      doc
        .font('Times-Bold')
        .fontSize(10)
        .fillColor(INK)
        .text('Endereço do Curso Realizado:', ax + 8, ay + 6, {
          width: aw - 16,
          align: 'center',
          underline: true,
          lineBreak: false,
          height: 14,
        });
      doc.font('Times-Roman').fontSize(8).fillColor(INK);
      const wrapW = Math.max(120, aw - 28);
      const lines = wrapWords(doc, address, wrapW).slice(0, 2);
      let ty = ay + 22;
      for (const line of lines) {
        doc.switchToPage(pageRef);
        doc.text(line, ax + 8, ty, {
          width: aw - 16,
          align: 'center',
          lineBreak: false,
          height: 10,
          ellipsis: true,
        });
        ty += 10;
      }
      doc.switchToPage(pageRef);
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
        .fontSize(15)
        .fillColor(INK)
        .text('Conteúdo Programático:', 71, 71.5, {
          width: 360,
          underline: true,
          height: 20,
          lineBreak: false,
        });
      doc
        .font('Times-BoldItalic')
        .fontSize(15)
        .text(`${topics[0]};`, 71, 97, { width: w - 360, height: 22 });
      let y = 123;
      for (const item of topics.slice(1)) {
        drawDiamond(doc, 78, y + 7);
        doc
          .font('Times-Roman')
          .fontSize(15)
          .fillColor(INK)
          .text(`${item};`, 90, y, { width: w - 380, height: 32 });
        y += 34.5;
      }
      this.drawAddressBox(doc, 458, h - 108, 332, 78, input.address);
    } else {
      doc
        .font('Times-BoldItalic')
        .fontSize(15)
        .fillColor(INK)
        .text(`${topics[0]};`, 71, 71.5, { width: w - 120, height: 22 });
      let y = 103;
      for (const item of topics) {
        drawDiamond(doc, 68, y + 7);
        doc
          .font('Times-Roman')
          .fontSize(item.length > 90 ? 14 : 15)
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
      const weights = [0.3, 0.22, 0.2, 0.28];
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
        doc.font('Times-Roman').fontSize(8.5).fillColor(INK);
        const label = `${pair[0]} `;
        const labelW = doc.widthOfString(label);
        doc.text(label, x + 3, y + 7, { lineBreak: false, height: 10 });
        doc.text(pair[1], x + 3 + labelW, y + 7, {
          width: Math.max(20, colW - 6 - labelW),
          height: 10,
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
          lineBreak: false,
          ellipsis: true,
        });
    });
    const addressText = `Endereço: ${input.address || '—'}`;
    doc.font('Times-Roman').fontSize(10);
    const addressLines = Math.max(
      1,
      Math.min(3, wrapWords(doc, addressText, boxW - 8).length),
    );
    const addressH = 8 + addressLines * 12;
    row(addressH, () => {
      doc
        .font('Times-Roman')
        .fontSize(10)
        .fillColor(INK)
        .text(addressText, left + 4, y + 4, {
          width: boxW - 8,
          align: 'left',
          height: addressH - 6,
        });
    });
    const summaryH = 76;
    row(
      summaryH,
      () => {
        doc
          .font('Times-Bold')
          .fontSize(10)
          .fillColor(INK)
          .text(
            'Conteúdo resumido do curso (utilizar máximo 10 linhas):',
            left + 4,
            y + 4,
            { width: boxW - 8, align: 'left' },
          );
        doc
          .font('Times-Roman')
          .fontSize(10)
          .text(input.registerSummary || '—', left + 6, y + 18, {
            width: boxW - 12,
            height: summaryH - 22,
            align: 'justify',
          });
      },
      false,
    );
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
        toPersonNameCase(worker.name),
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

    y += 14;
    const sigBoxH = 52;
    const sigBoxW = Math.min(280, boxW * 0.48);
    const sigBoxX = left + (boxW - sigBoxW) / 2;
    doc.save();
    doc.rect(sigBoxX, y, sigBoxW, sigBoxH).fill('#E8E8E8');
    doc.rect(sigBoxX, y, sigBoxW, sigBoxH).lineWidth(0.55).strokeColor(INK).stroke();
    doc.restore();
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
        sigBoxX + 6,
        y + 8,
        { width: sigBoxW - 12, align: 'center', lineGap: 1.5 },
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
