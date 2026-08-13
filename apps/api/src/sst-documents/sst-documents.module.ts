import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CommunicationsModule } from '../communications/communications.module';
import { PortalSstDocumentsController } from './portal-sst-documents.controller';
import { PublicSstDocumentsController } from './public-sst-documents.controller';
import { SstDocumentPdfService } from './sst-document-pdf.service';
import { SstDocumentSignService } from './sst-document-sign.service';
import { SstDocumentsService } from './sst-documents.service';

@Module({
  imports: [AuditModule, CommunicationsModule],
  controllers: [PortalSstDocumentsController, PublicSstDocumentsController],
  providers: [
    SstDocumentsService,
    SstDocumentSignService,
    SstDocumentPdfService,
  ],
})
export class SstDocumentsModule {}
