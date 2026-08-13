declare module 'svg-to-pdfkit' {
  function SVGtoPDF(
    doc: PDFKit.PDFDocument,
    svg: string,
    x?: number,
    y?: number,
    options?: {
      width?: number;
      height?: number;
      preserveAspectRatio?: string;
      useCSS?: boolean;
      assumePt?: boolean;
    },
  ): void;
  export default SVGtoPDF;
}
