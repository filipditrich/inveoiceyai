import {
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRawStream,
  PDFStream,
  PDFString,
} from "pdf-lib";

import { ISDOC_EMBEDDED_FILENAME } from "../pdf/embed-isdoc-in-pdf";

function decodeName(value: unknown): string | null {
  if (value instanceof PDFString || value instanceof PDFHexString) {
    return value.decodeText();
  }
  return null;
}

function streamBytes(stream: PDFStream): Uint8Array {
  if (stream instanceof PDFRawStream) {
    return decodePDFRawStream(stream).decode();
  }
  return stream.getContents();
}

function fileSpecBytes(fileSpec: PDFDict): Uint8Array | null {
  const ef = fileSpec.lookup(PDFName.of("EF"));
  if (!(ef instanceof PDFDict)) {
    return null;
  }
  const fileStream = ef.lookup(PDFName.of("F")) ?? ef.lookup(PDFName.of("UF"));
  if (!(fileStream instanceof PDFStream)) {
    return null;
  }
  return streamBytes(fileStream);
}

function fileSpecName(fileSpec: PDFDict): string {
  return (
    decodeName(fileSpec.lookup(PDFName.of("UF"))) ??
    decodeName(fileSpec.lookup(PDFName.of("F"))) ??
    "attachment"
  );
}

type NamedFile = { name: string; bytes: Uint8Array };

function walkNameTree(node: PDFDict, out: NamedFile[]): void {
  const names = node.lookup(PDFName.of("Names"));
  if (names instanceof PDFArray) {
    for (let i = 0; i + 1 < names.size(); i += 2) {
      const name = decodeName(names.lookup(i)) ?? `file-${i}`;
      const spec = names.lookup(i + 1);
      if (spec instanceof PDFDict) {
        const bytes = fileSpecBytes(spec);
        if (bytes) {
          out.push({ name: fileSpecName(spec) || name, bytes });
        }
      }
    }
  }

  const kids = node.lookup(PDFName.of("Kids"));
  if (kids instanceof PDFArray) {
    for (let i = 0; i < kids.size(); i++) {
      const kid = kids.lookup(i);
      if (kid instanceof PDFDict) {
        walkNameTree(kid, out);
      }
    }
  }
}

function collectFromCatalogAf(catalog: PDFDict, out: NamedFile[]): void {
  const af = catalog.lookup(PDFName.of("AF"));
  if (!(af instanceof PDFArray)) {
    return;
  }
  for (let i = 0; i < af.size(); i++) {
    const spec = af.lookup(i);
    if (!(spec instanceof PDFDict)) {
      continue;
    }
    const bytes = fileSpecBytes(spec);
    if (bytes) {
      out.push({ name: fileSpecName(spec), bytes });
    }
  }
}

function pickIsdoc(files: NamedFile[]): string | null {
  const preferred = files.find(
    (f) =>
      f.name.toLowerCase() === ISDOC_EMBEDDED_FILENAME ||
      f.name.toLowerCase().endsWith(".isdoc"),
  );
  const candidate =
    preferred ??
    files.find((f) => {
      const head = new TextDecoder("utf-8", { fatal: false })
        .decode(f.bytes.slice(0, 200))
        .toLowerCase();
      return (
        head.includes("isdoc") || head.includes("http://isdoc.cz/namespace")
      );
    });
  if (!candidate) {
    return null;
  }
  return new TextDecoder("utf-8").decode(candidate.bytes);
}

/**
 * Extract embedded ISDOC XML from a PDF (ISDOC.PDF / PDF EmbeddedFiles).
 * Returns null when no ISDOC attachment is found.
 */
export async function extractIsdocFromPdf(
  pdfBytes: Uint8Array,
): Promise<string | null> {
  const pdfDoc = await PDFDocument.load(pdfBytes, {
    updateMetadata: false,
    ignoreEncryption: true,
  });
  const files: NamedFile[] = [];
  const catalog = pdfDoc.catalog;

  const names = catalog.lookup(PDFName.of("Names"));
  if (names instanceof PDFDict) {
    const embedded = names.lookup(PDFName.of("EmbeddedFiles"));
    if (embedded instanceof PDFDict) {
      walkNameTree(embedded, files);
    }
  }
  collectFromCatalogAf(catalog, files);

  return pickIsdoc(files);
}

/** PDF info dictionary strings used for origin heuristics. */
export async function readPdfOriginHints(pdfBytes: Uint8Array): Promise<{
  producer?: string;
  creator?: string;
  keywords?: string;
}> {
  const pdfDoc = await PDFDocument.load(pdfBytes, {
    updateMetadata: false,
    ignoreEncryption: true,
  });
  return {
    producer: pdfDoc.getProducer() ?? undefined,
    creator: pdfDoc.getCreator() ?? undefined,
    keywords: pdfDoc.getKeywords() ?? undefined,
  };
}
