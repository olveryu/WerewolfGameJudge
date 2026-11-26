export const DECRYPTO_WORD_CATEGORIES = ['general'] as const;
export type DecryptoWordCategory = (typeof DECRYPTO_WORD_CATEGORIES)[number];

export const DECRYPTO_WORD_CATEGORY_NAMES: Record<DecryptoWordCategory, string> = {
  general: '常用词',
};
