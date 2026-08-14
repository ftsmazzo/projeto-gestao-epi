/** Le CSV do Excel (UTF-8 ou Windows-1252) e devolve base64 + texto para a API. */

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function readCsvFileForImport(file: File): Promise<{
  csvBase64: string;
  csvText: string;
}> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const csvBase64 = bytesToBase64(bytes);

  // Texto local so para debug/fallback; o backend e a fonte da verdade.
  let csvText = '';
  try {
    const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    if (!utf8.includes('\uFFFD')) {
      csvText = utf8;
    } else {
      csvText = new TextDecoder('windows-1252').decode(bytes);
    }
  } catch {
    csvText = new TextDecoder('utf-8').decode(bytes);
  }

  return { csvBase64, csvText };
}
