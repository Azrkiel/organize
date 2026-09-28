// The pdf.js worker, bundled as its own module the same way lib/client/whisper.worker.ts is:
// importing the worker build registers its message handler on this worker's global scope.
import "pdfjs-dist/build/pdf.worker.min.mjs";
