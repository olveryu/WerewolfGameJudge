import { requestSpecAt, respondWithJson, spyOnApiJson } from '@/test-utils/apiClient';

import { CFAvatarUploadService } from '../CFAvatarUploadService';

const AVATAR_URL = 'https://media.example.com/avatars/u1.jpg';
const jsonSpy = spyOnApiJson();
const photo = new File(['raw'], 'photo.png', { type: 'image/png' });
const encoded = new Blob(['jpeg'], { type: 'image/jpeg' });

interface FakeBitmap {
  readonly width: number;
  readonly height: number;
  readonly close: ReturnType<typeof vi.fn>;
}

function stubDecode(width: number, height: number): FakeBitmap {
  const bitmap: FakeBitmap = { width, height, close: vi.fn() };
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap));
  return bitmap;
}

const drawImage = vi.fn();
let encodeResult: Blob | null = encoded;

describe('CFAvatarUploadService', () => {
  beforeEach(() => {
    jsonSpy.mockReset();
    drawImage.mockReset();
    encodeResult = encoded;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ({
      drawImage,
    })) as unknown as HTMLCanvasElement['getContext']);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(encodeResult);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockRestore();
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockRestore();
  });

  it('decodes the file upright, fits it in 512px and uploads the JPEG as avatar.jpg', async () => {
    const bitmap = stubDecode(2048, 1024);
    respondWithJson(jsonSpy, { url: AVATAR_URL });

    await expect(new CFAvatarUploadService().uploadAvatar(photo)).resolves.toBe(AVATAR_URL);

    expect(createImageBitmap).toHaveBeenCalledWith(photo, { imageOrientation: 'from-image' });
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 512, 256);
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      'image/jpeg',
      0.85,
    );
    expect(bitmap.close).toHaveBeenCalledOnce();
    const spec = requestSpecAt(jsonSpy, 0);
    expect(spec).toMatchObject({ method: 'POST', path: '/avatar/upload', auth: 'required' });
    if (!(spec.body instanceof FormData)) throw new Error('Avatar upload body must be FormData');
    const uploaded = spec.body.get('file');
    expect(uploaded).toBeInstanceOf(File);
    expect(uploaded).toMatchObject({ name: 'avatar.jpg', size: encoded.size });
  });

  it('keeps an image already within the avatar size at its own size', async () => {
    const bitmap = stubDecode(300, 200);
    respondWithJson(jsonSpy, { url: AVATAR_URL });

    await new CFAvatarUploadService().uploadAvatar(photo);

    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 300, 200);
  });

  it('reports an undecodable file as a decode failure and uploads nothing', async () => {
    const decodeError = new DOMException(
      'The source image could not be decoded.',
      'InvalidStateError',
    );
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(decodeError));

    const upload = new CFAvatarUploadService().uploadAvatar(photo);

    await expect(upload).rejects.toThrow('图片解码失败，请换一张图片重试');
    await expect(upload).rejects.toMatchObject({ cause: { cause: decodeError } });
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it('reports a failed encode, releases the bitmap and uploads nothing', async () => {
    const bitmap = stubDecode(800, 800);
    encodeResult = null;

    await expect(new CFAvatarUploadService().uploadAvatar(photo)).rejects.toThrow(
      '图片压缩失败，请换一张图片重试',
    );
    expect(bitmap.close).toHaveBeenCalledOnce();
    expect(jsonSpy).not.toHaveBeenCalled();
  });
});
