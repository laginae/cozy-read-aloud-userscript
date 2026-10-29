let runtime;
function bytes(base64) { return Uint8Array.from(atob(base64), c => c.charCodeAt(0)); }
export function loadPdfRuntime() {
  if (!runtime) runtime = import('pdfjs-dist').then(module => {
    module.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([__PDF_WORKER__], { type: 'text/javascript' }));
    const assets = __PDF_ASSETS__;
    class CMaps {
      async fetch({ name }) {
        const data = assets['cmaps/' + name + '.bcmap'];
        if (!data) throw Error('Missing bundled CMap');
        return { cMapData: bytes(data), compressionType: 1 };
      }
    }
    class Fonts {
      async fetch({ filename }) {
        const data = assets['standard_fonts/' + filename];
        if (!data) throw Error('Missing bundled font');
        return bytes(data);
      }
    }
    return {
      TextLayer: module.TextLayer,
      getDocument: options => module.getDocument({ ...options,
        cMapUrl: undefined, standardFontDataUrl: undefined, wasmUrl: undefined,
        CMapReaderFactory: CMaps, StandardFontDataFactory: Fonts,
        useWorkerFetch: false, useWasm: false, isEvalSupported: false,
      }),
    };
  });
  return runtime;
}
