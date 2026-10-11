import type { ExportFiles } from './types';

export const EXPORT_JSON_MIME_TYPE = 'application/json';
export const EXPORT_CSV_MIME_TYPE = 'text/csv';

export type WebExportResult =
  | { ok: true; method: 'web-share' | 'browser-download' }
  | { ok: false; reason: string };

type WebExportEnvironment = {
  Blob: typeof Blob;
  File?: typeof File;
  URL: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>;
  document: Document;
  navigator: {
    canShare?: (data?: ShareData) => boolean;
    share?: (data?: ShareData) => Promise<void>;
  };
};

function browserEnvironment(): WebExportEnvironment {
  return {
    Blob,
    File: typeof File === 'undefined' ? undefined : File,
    URL,
    document,
    navigator,
  };
}

function errorReason(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'Export sharing was cancelled.';
  }
  return error instanceof Error ? error.message : String(error);
}

/** Share files when the browser supports file sharing, otherwise download both. */
export async function exportFilesViaWeb(
  files: ExportFiles,
  environment: WebExportEnvironment = browserEnvironment(),
): Promise<WebExportResult> {
  const { File: FileConstructor, navigator: webNavigator } = environment;

  if (FileConstructor && webNavigator.share && webNavigator.canShare) {
    const shareFiles = [
      new FileConstructor([files.json], files.suggestedJsonName, {
        type: EXPORT_JSON_MIME_TYPE,
      }),
      new FileConstructor([files.csv], files.suggestedCsvName, {
        type: EXPORT_CSV_MIME_TYPE,
      }),
    ];

    if (webNavigator.canShare({ files: shareFiles })) {
      try {
        await webNavigator.share({
          title: 'Macro-tracker export',
          files: shareFiles,
        });
        return { ok: true, method: 'web-share' };
      } catch (error) {
        return { ok: false, reason: errorReason(error) };
      }
    }
  }

  const objectUrls: string[] = [];
  const anchors: HTMLAnchorElement[] = [];
  try {
    const downloads = [
      {
        content: files.json,
        filename: files.suggestedJsonName,
        mimeType: EXPORT_JSON_MIME_TYPE,
      },
      {
        content: files.csv,
        filename: files.suggestedCsvName,
        mimeType: EXPORT_CSV_MIME_TYPE,
      },
    ];

    for (const download of downloads) {
      const blob = new environment.Blob([download.content], {
        type: download.mimeType,
      });
      const objectUrl = environment.URL.createObjectURL(blob);
      objectUrls.push(objectUrl);

      const anchor = environment.document.createElement('a');
      anchors.push(anchor);
      anchor.href = objectUrl;
      anchor.download = download.filename;
      anchor.style.display = 'none';
      environment.document.body.appendChild(anchor);
      anchor.click();
    }
    return { ok: true, method: 'browser-download' };
  } catch (error) {
    return { ok: false, reason: errorReason(error) };
  } finally {
    for (const anchor of anchors) {
      anchor.remove();
    }
    for (const objectUrl of objectUrls) {
      environment.URL.revokeObjectURL(objectUrl);
    }
  }
}
