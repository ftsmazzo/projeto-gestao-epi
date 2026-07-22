import { Injectable, Logger } from '@nestjs/common';
import AdmZip from 'adm-zip';
import { Client as FtpClient } from 'basic-ftp';
import { basename } from 'path';
import { Writable } from 'stream';
import {
  CAEPI_ALL_SOURCES_FAILED_MESSAGE,
  resolveCaepiSourceCandidates,
} from './caepi-config';

export type DownloadedCaepiFile = {
  buffer: Buffer;
  fileName: string;
  sourceUrl: string;
  contentType: string | null;
  /** Erros amigaveis das fontes tentadas antes da bem-sucedida (se houver). */
  attemptErrors: string[];
};

type DownloadedCaepiPayload = Omit<DownloadedCaepiFile, 'attemptErrors'>;

const TEXT_EXT = ['.txt', '.csv', '.tsv'];
const SHEET_EXT = ['.xlsx', '.xls'];
const ARCHIVE_EXT = ['.zip'];

@Injectable()
export class CaepiDownloadService {
  private readonly logger = new Logger(CaepiDownloadService.name);

  async downloadOfficialBase(
    sourceUrlRaw?: string | null,
  ): Promise<DownloadedCaepiFile> {
    const candidates = sourceUrlRaw?.trim()
      ? [sourceUrlRaw.trim()]
      : resolveCaepiSourceCandidates();

    if (candidates.length === 0) {
      throw new Error(CAEPI_ALL_SOURCES_FAILED_MESSAGE);
    }

    const attemptErrors: string[] = [];

    for (const sourceUrl of candidates) {
      this.logger.log(`Tentando fonte CAEPI: ${sourceUrl}`);
      try {
        const downloaded = await this.downloadSingleSource(sourceUrl);
        return {
          ...downloaded,
          attemptErrors,
        };
      } catch (error) {
        const message = this.toFriendlyAttemptError(sourceUrl, error);
        this.logger.warn(message);
        attemptErrors.push(message);
      }
    }

    const detail = attemptErrors.slice(0, 5).join(' | ');
    throw new Error(
      `${CAEPI_ALL_SOURCES_FAILED_MESSAGE}${detail ? ` Detalhes: ${detail}` : ''}`,
    );
  }

  private toFriendlyAttemptError(sourceUrl: string, error: unknown): string {
    const raw =
      error instanceof Error ? error.message : 'Falha desconhecida no download.';
    const clean = raw.replace(/\s+/g, ' ').trim().slice(0, 240);
    return `${sourceUrl}: ${clean}`;
  }

  private async downloadSingleSource(
    sourceUrl: string,
  ): Promise<DownloadedCaepiPayload> {
    const url = new URL(sourceUrl);
    if (url.protocol === 'ftp:') {
      return this.downloadViaFtp(sourceUrl, url);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(
        `Protocolo nao suportado (${url.protocol}). Use http(s) ou ftp.`,
      );
    }

    const response = await fetch(sourceUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'gestao-epi-caepi-sync/1.0',
        Accept: '*/*',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Falha ao baixar (${response.status} ${response.statusText}).`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (!buffer.length) {
      throw new Error('Download retornou arquivo vazio.');
    }

    const contentType = response.headers.get('content-type');
    const fileName = this.resolveFileName(sourceUrl, response, buffer);
    return this.normalizeDownloadedFile({
      buffer,
      fileName,
      sourceUrl,
      contentType,
    });
  }

  /** Normaliza buffer local (upload) extraindo ZIP quando necessario. */
  prepareLocalFile(
    buffer: Buffer,
    originalName?: string,
  ): { buffer: Buffer; fileName: string } {
    const prepared = this.normalizeDownloadedFile({
      buffer,
      fileName: originalName?.trim() || 'caepi-upload.bin',
      sourceUrl: 'upload://local',
      contentType: null,
    });
    return { buffer: prepared.buffer, fileName: prepared.fileName };
  }

  private async downloadViaFtp(
    sourceUrl: string,
    url: URL,
  ): Promise<DownloadedCaepiPayload> {
    const client = new FtpClient(60_000);
    try {
      await client.access({
        host: url.hostname,
        port: url.port ? Number(url.port) : 21,
        user: decodeURIComponent(url.username || 'anonymous'),
        password: decodeURIComponent(url.password || 'anonymous@'),
        secure: false,
      });

      const remotePath = decodeURIComponent(url.pathname);
      const chunks: Buffer[] = [];
      const writable = new Writable({
        write(chunk, _enc, cb) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          cb();
        },
      });
      await client.downloadTo(writable, remotePath);
      const buffer = Buffer.concat(chunks);
      if (!buffer.length) {
        throw new Error('Download FTP CAEPI retornou arquivo vazio.');
      }
      const fileName = basename(remotePath) || 'tgg_export_caepi.txt';
      return this.normalizeDownloadedFile({
        buffer,
        fileName,
        sourceUrl,
        contentType: null,
      });
    } finally {
      client.close();
    }
  }

  private resolveFileName(
    sourceUrl: string,
    response: Response,
    buffer: Buffer,
  ): string {
    const disposition = response.headers.get('content-disposition');
    if (disposition) {
      const match =
        /filename\*=UTF-8''([^;]+)|filename="([^"]+)"|filename=([^;]+)/i.exec(
          disposition,
        );
      const raw = match?.[1] || match?.[2] || match?.[3];
      if (raw) {
        return decodeURIComponent(raw.trim());
      }
    }

    try {
      const pathName = new URL(sourceUrl).pathname;
      const base = basename(pathName);
      if (base && base !== 'file' && base !== '@@download') {
        return base;
      }
    } catch {
      // ignore
    }

    if (buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b) {
      return 'tgg_export_caepi.zip';
    }
    return 'tgg_export_caepi.txt';
  }

  private normalizeDownloadedFile(
    file: DownloadedCaepiPayload,
  ): DownloadedCaepiPayload {
    const lower = file.fileName.toLowerCase();
    const isZip =
      ARCHIVE_EXT.some((ext) => lower.endsWith(ext)) ||
      (file.buffer.length >= 2 &&
        file.buffer[0] === 0x50 &&
        file.buffer[1] === 0x4b &&
        !SHEET_EXT.some((ext) => lower.endsWith(ext)));

    if (!isZip) {
      this.assertSupportedPayload(file.fileName, file.buffer);
      return file;
    }

    return this.extractFromZip(file);
  }

  private extractFromZip(file: DownloadedCaepiPayload): DownloadedCaepiPayload {
    let zip: AdmZip;
    try {
      zip = new AdmZip(file.buffer);
    } catch {
      throw new Error(
        'Arquivo ZIP CAEPI invalido ou corrompido.',
      );
    }

    const entries = zip
      .getEntries()
      .filter((entry) => !entry.isDirectory)
      .map((entry) => entry.entryName.replace(/\\/g, '/'));

    const preferred =
      entries.find((name) =>
        /tgg_export_caepi\.(txt|csv|tsv|xlsx)$/i.test(name),
      ) ||
      entries.find((name) =>
        TEXT_EXT.some((ext) => name.toLowerCase().endsWith(ext)),
      ) ||
      entries.find((name) =>
        SHEET_EXT.some((ext) => name.toLowerCase().endsWith(ext)),
      );

    if (!preferred) {
      throw new Error(
        'ZIP CAEPI sem arquivo .txt/.csv/.xlsx legivel. Verifique o conteudo oficial.',
      );
    }

    const entry = zip.getEntry(preferred);
    if (!entry) {
      throw new Error(`Nao foi possivel extrair ${preferred} do ZIP CAEPI.`);
    }

    const buffer = entry.getData();
    const fileName = basename(preferred);
    this.logger.log(`ZIP CAEPI extraido: ${fileName} (${buffer.length} bytes)`);
    this.assertSupportedPayload(fileName, buffer);
    return {
      buffer,
      fileName,
      sourceUrl: file.sourceUrl,
      contentType: file.contentType,
    };
  }

  private assertSupportedPayload(fileName: string, buffer: Buffer) {
    const lower = fileName.toLowerCase();
    const okExt =
      TEXT_EXT.some((ext) => lower.endsWith(ext)) ||
      SHEET_EXT.some((ext) => lower.endsWith(ext));
    const looksXlsx =
      buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b;
    const looksText = buffer.length > 0 && !looksXlsx;

    if (!okExt && !looksXlsx && !looksText) {
      throw new Error(
        `Formato CAEPI nao suportado (${fileName}). Use .zip, .txt, .csv ou .xlsx.`,
      );
    }
  }
}
