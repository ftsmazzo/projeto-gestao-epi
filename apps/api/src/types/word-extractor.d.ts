declare module 'word-extractor' {
  class WordDocument {
    getBody(options?: { filterUnicode?: boolean }): string;
    getHeaders(options?: {
      includeFooters?: boolean;
      filterUnicode?: boolean;
    }): string;
    getFootnotes(options?: { filterUnicode?: boolean }): string;
    getEndnotes(options?: { filterUnicode?: boolean }): string;
    getAnnotations(options?: { filterUnicode?: boolean }): string;
    getTextboxes(options?: {
      filterUnicode?: boolean;
      includeHeadersAndFooters?: boolean;
      includeBody?: boolean;
    }): string;
  }

  class WordExtractor {
    extract(source: Buffer | string): Promise<WordDocument>;
  }

  export = WordExtractor;
}
