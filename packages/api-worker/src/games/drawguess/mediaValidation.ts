/**
 * DrawGuess 终稿 PNG 上传校验（校验逻辑与接龙版同构，复制而非跨游戏 import）。
 *
 * V1 画作规格固定：1024×768 PNG，单文件最大 2 MiB。
 */

const DRAWGUESS_DRAWING_WIDTH = 1024;
const DRAWGUESS_DRAWING_HEIGHT = 768;
const DRAWGUESS_DRAWING_MAX_BYTES = 2 * 1024 * 1024;
export const DRAWGUESS_PNG_CONTENT_TYPE = 'image/png';

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10] as const;
const PNG_IHDR_CHUNK_TYPE = [73, 72, 68, 82] as const;

export interface DrawGuessDrawingUpload {
  readonly bytes: Uint8Array<ArrayBuffer>;
  readonly sha256: string;
  readonly sha256Digest: ArrayBuffer;
}

export type DrawGuessUploadRejection =
  | { readonly status: 400; readonly reason: string }
  | { readonly status: 413; readonly reason: string }
  | { readonly status: 415; readonly reason: string };

function matchesBytes(bytes: Uint8Array, offset: number, expected: readonly number[]): boolean {
  return expected.every((value, index) => bytes[offset + index] === value);
}

/** 校验 PNG 文件签名、IHDR 块与固定尺寸；不通过返回拒绝原因。 */
function validateDrawGuessPng(
  bytes: Uint8Array,
): { readonly ok: true } | { readonly ok: false; readonly reason: string } {
  if (
    bytes.byteLength < 24 ||
    !matchesBytes(bytes, 0, PNG_SIGNATURE) ||
    !matchesBytes(bytes, 12, PNG_IHDR_CHUNK_TYPE)
  ) {
    return { ok: false, reason: 'PNG 文件签名无效' };
  }
  const dimensions = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    dimensions.getUint32(16) !== DRAWGUESS_DRAWING_WIDTH ||
    dimensions.getUint32(20) !== DRAWGUESS_DRAWING_HEIGHT
  ) {
    return { ok: false, reason: '画作尺寸必须为 1024×768' };
  }
  return { ok: true };
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function parseContentLength(request: Request): number | null | DrawGuessUploadRejection {
  const value = request.headers.get('content-length');
  if (value === null) return null;
  if (!/^(0|[1-9]\d*)$/.test(value)) return { status: 400, reason: '请求长度头无效' };
  const length = Number(value);
  if (!Number.isSafeInteger(length)) return { status: 400, reason: '请求长度头无效' };
  if (length > DRAWGUESS_DRAWING_MAX_BYTES) return { status: 413, reason: '画作超过 2 MiB 上限' };
  return length;
}

async function readBoundedBody(
  request: Request,
): Promise<Uint8Array<ArrayBuffer> | DrawGuessUploadRejection> {
  const declaredLength = parseContentLength(request);
  if (declaredLength !== null && typeof declaredLength === 'object') return declaredLength;
  if (request.body === null) return { status: 400, reason: '缺少画作数据' };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    const chunk: unknown = result.value;
    if (!(chunk instanceof Uint8Array)) return { status: 400, reason: '画作数据读取失败' };
    byteLength += chunk.byteLength;
    if (byteLength > DRAWGUESS_DRAWING_MAX_BYTES) {
      await reader.cancel('DRAWING_TOO_LARGE');
      return { status: 413, reason: '画作超过 2 MiB 上限' };
    }
    chunks.push(chunk);
  }
  if (byteLength === 0 || (typeof declaredLength === 'number' && declaredLength !== byteLength)) {
    return { status: 400, reason: '请求长度与实际数据不一致' };
  }
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/**
 * 读取并校验上传的 PNG：Content-Type、大、小上限、文件签名与尺寸。
 * 成功返回字节与 SHA-256；失败返回 HTTP 状态与中文原因。
 */
export async function readDrawGuessDrawingUpload(
  request: Request,
): Promise<DrawGuessDrawingUpload | DrawGuessUploadRejection> {
  if (request.headers.get('content-type') !== DRAWGUESS_PNG_CONTENT_TYPE) {
    return { status: 415, reason: '只接受 image/png' };
  }
  const body = await readBoundedBody(request);
  if (!(body instanceof Uint8Array)) return body;
  const validated = validateDrawGuessPng(body);
  if (!validated.ok) return { status: 400, reason: validated.reason };
  const sha256Digest = await crypto.subtle.digest('SHA-256', body);
  return { bytes: body, sha256: toHex(new Uint8Array(sha256Digest)), sha256Digest };
}
