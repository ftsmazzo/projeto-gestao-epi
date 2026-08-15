import { OccupationalRiskCategory } from '@prisma/client';

export type ExtractionConfidence = 'high' | 'low';
export type ExtractionSource = 'GHE' | 'KEYWORD' | 'GLOBAL';

export type PgroExtractedSector = {
  tempId: string;
  name: string;
  rawText: string;
  included: boolean;
  confidence: ExtractionConfidence;
  source: ExtractionSource;
  gheName: string | null;
};

export type PgroExtractedFunction = {
  tempId: string;
  name: string;
  sectorName: string | null;
  activityDescription: string | null;
  environmentDescription: string | null;
  gheName: string | null;
  rawText: string;
  included: boolean;
  confidence: ExtractionConfidence;
  source: ExtractionSource;
};

export type PgroExtractedRisk = {
  tempId: string;
  name: string;
  category: OccupationalRiskCategory;
  exposure: string | null;
  source: string | null;
  possibleDamage: string | null;
  riskLevel: string | null;
  functionNames: string[];
  rawText: string;
  included: boolean;
  confidence: ExtractionConfidence;
  extractionSource: ExtractionSource;
  gheName: string | null;
};

export type PgroExtractedEpiNeed = {
  tempId: string;
  extractedText: string;
  suggestedName: string;
  matchedEpiNeedId: string | null;
  matchedEpiNeedName: string | null;
  createNew: boolean;
  functionNames: string[];
  riskNames: string[];
  included: boolean;
  confidence: ExtractionConfidence;
  extractionSource: ExtractionSource;
  gheName: string | null;
};
