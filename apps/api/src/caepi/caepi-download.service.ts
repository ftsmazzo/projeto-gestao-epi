import { Injectable, Logger } from '@nestjs/common';
import AdmZip from 'adm-zip';
import { Client as FtpClient } from 'basic-ftp';
import { basename } from 'path';
import { Writable } from 'stream';
import { assertCaepiSourceUrlConfigured } from './caepi-config';

export type DownloadedCaepiFile = {
  buffer: Buffer;
  fileName: string;
  sourceUrl: string;
  contentType: string | null;
};

const TEXT_EXT = ['.txt', '.csv', '.tsv'];
const SHEET_EXT = ['.xlsx', '.xls'];
const ARCHIVE_EXT = ['.zip'];

@Injectable()
export class CaepiDownloadService {
  private readonly logger = new Logger(CaepiDownloadService.name);

  async downloadOfficialBase(
    sourceUrlRaw: string | null,
  ): Promise<DownloadedCaepiFile> {
    const sourceUrl = assertCaepiSourceUrlConfigured(sourceUrlRaw);
    this.logger.log(`Baixando base CAEPI de ${sourceUrl}`);

    const url = new URL(sourceUrl);
    if (url.protocol === 'ftp:') {
      return this.downloadViaFtp(sourceUrl, url);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(
        `Protocolo nao suportado em CAEPI_SOURCE_URL: ${url.protocol}. Use http(s) ou ftp.`,
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
        `Falha ao baixar base CAEPI (${response.status} ${response.statusText}). Verifique CAEPI_SOURCE_URL.`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (!buffer.length) {
      throw new Error('Download CAEPI retornou arquivo vazio.');
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
  ): Promise<DownloadedCaepiFile> {
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
    file: DownloadedCaepiFile,
  ): DownloadedCaepiFile {
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

  private extractFromZip(file: DownloadedCaepiFile): DownloadedCaepiFile {
    let zip: AdmZip;
    try {
      zip = new AdmZip(file.buffer);
    } catch {
      throw new Error(
        'Arquivo ZIP CAEPI invalido ou corrompido. Verifique CAEPI_SOURCE_URL.',
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
