/** Another module's function that takes any value as `unknown` (P1 QA28 F1). */
export const keepPart = (value: unknown): void => {
  void value;
};
