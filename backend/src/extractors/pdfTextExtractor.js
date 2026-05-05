import { log } from '../utils/logger.js';

const MODULE = 'pdfTextExtractor';

/**
 * Extract plain text from a PDF buffer using pdf-parse.
 * Throws if the PDF appears to be image-only (no extractable text).
 * @param {Buffer} buffer
 * @returns {Promise<string>}
 */
export async function extractText(buffer) {
  const fn = 'extractText';
  log.info({ module: MODULE, fn, bytes: buffer.length }, 'Extracting text from PDF');
  try {
    // Import via subpath to avoid pdf-parse's test-file side-effect on main entry
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
    const result = await pdfParse(buffer);
    const text = result.text || '';
    if (text.trim().length < 50) {
      throw new Error('PDF appears to contain no extractable text. Please upload a text-based PDF, not a scan.');
    }
    log.info({ module: MODULE, fn, chars: text.length, pages: result.numpages }, 'Text extracted');
    return text;
  } catch (err) {
    log.error({ module: MODULE, fn, err }, 'Failed to extract PDF text');
    throw err;
  }
}
