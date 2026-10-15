/**
 * 画作媒体脚手架：PNG 上传校验、R2 不可变写入与读取响应（platform 唯一实现）。
 *
 * 校验部分由 drawguess/mediaValidation.ts 的因子化实现原地搬运泛化；写入与
 * 读取部分由 drawguess/pictionary 两份 mediaRoutes 中逐字重复的实现搬运合并。
 * drawguess 与 pictionary 共用。各游戏仅通过 options 提供画布规格（宽/高/字节
 * 上限）与自家文案（drawguess 为中文原因、pictionary 为英文代码），状态码、
 * 判定顺序与存储行为逐项不变。
 */

import { HTTPException } from 'hono/http-exception';

export const DRAWING_PNG_CONTENT_TYPE = 'image/png';

const PRIVATE_MEDIA_CACHE_CONTROL = 'private, max-age=3600';

/** 以 HTTPException 抛出媒体路由错误（两家 mediaRoutes 原各有一份逐字相同的本地 fail）。 */
export function failMediaRequest(
  status: 400 | 403 | 404 | 409 | 413 | 415 | 500,
  reason: string,
): never {
  throw new HTTPException(status, { message: reason });
}

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10] as const;
const PNG_IHDR_CHUNK_TYPE = [73, 72, 68, 82] as const;

export interface DrawingUpload {
  readonly bytes: Uint8Array<ArrayBuffer>;
  readonly sha256: string;
  readonly sha256Digest: ArrayBuffer;
}

export type DrawingUploadRejection =
  | { readonly status: 400; readonly reason: string }
  | { readonly status: 413; readonly reason: string }
  | { readonly status: 415; readonly reason: string };

/** 各拒绝点的文案由游戏提供：同一校验点在不同游戏的既有文案逐字保留。 */
export interface DrawingUploadReasons {
  readonly invalidContentLength: string;
  readonly drawingTooLarge: string;
  readonly bodyRequired: string;
  readonly invalidBody: string;
  readonly lengthMismatch: string;
  readonly invalidPng: string;
  readonly invalidDimensions: string;
  readonly contentTypeInvalid: string;
}

export interface DrawingUploadOptions {
  readonly width: number;
  readonly height: number;
  readonly maxBytes: number;
  readonly reasons: DrawingUploadReasons;
}

function matchesBytes(bytes: Uint8Array, offset: number, expected: readonly number[]): boolean {
  return expected.every((value, index) => bytes[offset + index] === value);
}

/** 校验 PNG 文件签名、IHDR 块与固定尺寸；不通过返回拒绝原因。 */
function validatePng(
  bytes: Uint8Array,
  options: DrawingUploadOptions,
): { readonly ok: true } | { readonly ok: false; readonly reason: string } {
  if (
    bytes.byteLength < 24 ||
    !matchesBytes(bytes, 0, PNG_SIGNATURE) ||
    !matchesBytes(bytes, 12, PNG_IHDR_CHUNK_TYPE)
  ) {
    return { ok: false, reason: options.reasons.invalidPng };
  }
  const dimensions = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dimensions.getUint32(16) !== options.width || dimensions.getUint32(20) !== options.height) {
    return { ok: false, reason: options.reasons.invalidDimensions };
  }
  return { ok: true };
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function parseContentLength(
  request: Request,
  options: DrawingUploadOptions,
): number | null | DrawingUploadRejection {
  const value = request.headers.get('content-length');
  if (value === null) return null;
  if (!/^(0|[1-9]\d*)$/.test(value)) {
    return { status: 400, reason: options.reasons.invalidContentLength };
  }
  const length = Number(value);
  if (!Number.isSafeInteger(length)) {
    return { status: 400, reason: options.reasons.invalidContentLength };
  }
  if (length > options.maxBytes) {
    return { status: 413, reason: options.reasons.drawingTooLarge };
  }
  return length;
}

async function readBoundedBody(
  request: Request,
  options: DrawingUploadOptions,
): Promise<Uint8Array<ArrayBuffer> | DrawingUploadRejection> {
  const declaredLength = parseContentLength(request, options);
  if (declaredLength !== null && typeof declaredLength === 'object') return declaredLength;
  if (request.body === null) return { status: 400, reason: options.reasons.bodyRequired };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    const chunk: unknown = result.value;
    if (!(chunk instanceof Uint8Array)) {
      return { status: 400, reason: options.reasons.invalidBody };
    }
    byteLength += chunk.byteLength;
    if (byteLength > options.maxBytes) {
      await reader.cancel('DRAWING_TOO_LARGE');
      return { status: 413, reason: options.reasons.drawingTooLarge };
    }
    chunks.push(chunk);
  }
  if (byteLength === 0 || (typeof declaredLength === 'number' && declaredLength !== byteLength)) {
    return { status: 400, reason: options.reasons.lengthMismatch };
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
 * 读取并校验上传的 PNG：Content-Type、大小上限、文件签名与尺寸。
 * 成功返回字节与 SHA-256；失败返回 HTTP 状态与调用方提供的文案。
 */
export async function readDrawingUpload(
  request: Request,
  options: DrawingUploadOptions,
): Promise<DrawingUpload | DrawingUploadRejection> {
  if (request.headers.get('content-type') !== DRAWING_PNG_CONTENT_TYPE) {
    return { status: 415, reason: options.reasons.contentTypeInvalid };
  }
  const body = await readBoundedBody(request, options);
  if (!(body instanceof Uint8Array)) return body;
  const validated = validatePng(body, options);
  if (!validated.ok) return { status: 400, reason: validated.reason };
  const sha256Digest = await crypto.subtle.digest('SHA-256', body);
  return { bytes: body, sha256: toHex(new Uint8Array(sha256Digest)), sha256Digest };
}

export interface PutImmutableDrawingOptions {
  /** 已存在对象与本次上传内容不一致时的 409 文案（各家既有文案逐字保留）。 */
  readonly conflictReason: string;
  /** 条件写入失败且无已存在对象时抛出的 Error 文案（各家既有文案逐字保留）。 */
  readonly writeFailedMessage: string;
}

function assertMatchingObject(
  object: R2Object,
  upload: DrawingUpload,
  conflictReason: string,
): void {
  if (object.size !== upload.bytes.byteLength || object.customMetadata?.sha256 !== upload.sha256) {
    failMediaRequest(409, conflictReason);
  }
}

/**
 * 以「不存在才写」语义把画作写入 R2 并钉住内容哈希；已存在同键对象时校验
 * 内容一致，不一致按 conflictReason 拒绝（409）。
 */
export async function putImmutableDrawing(
  bucket: R2Bucket,
  objectKey: string,
  entryId: string,
  upload: DrawingUpload,
  options: PutImmutableDrawingOptions,
): Promise<void> {
  const stored = await bucket.put(objectKey, upload.bytes, {
    onlyIf: { etagDoesNotMatch: '*' },
    httpMetadata: { contentType: DRAWING_PNG_CONTENT_TYPE },
    customMetadata: { entryId, sha256: upload.sha256 },
    sha256: upload.sha256Digest,
  });
  if (stored !== null) return;
  const existing = await bucket.head(objectKey);
  if (existing === null) throw new Error(options.writeFailedMessage);
  assertMatchingObject(existing, upload, options.conflictReason);
}

/** 组装画作读取响应：私有缓存头、ETag 与 If-None-Match 304（两家原实现逐字相同）。 */
export function buildDrawingGetResponse(
  object: R2ObjectBody,
  ifNoneMatch: string | undefined,
): Response {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Content-Type', DRAWING_PNG_CONTENT_TYPE);
  headers.set('Content-Length', String(object.size));
  headers.set('Cache-Control', PRIVATE_MEDIA_CACHE_CONTROL);
  headers.set('ETag', object.httpEtag);
  headers.set('X-Content-Type-Options', 'nosniff');
  if (ifNoneMatch === object.httpEtag) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(object.body, { status: 200, headers });
}
