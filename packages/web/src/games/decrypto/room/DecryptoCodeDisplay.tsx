import type { DecryptoCode } from '@game-judge/game-engine/games/decrypto/public';

/** Three non-interactive digits, with optional staggered reveal. */
export function DecryptoCodeDisplay({
  code,
  label,
  animated = false,
  testId,
}: {
  readonly code: DecryptoCode;
  readonly label: string;
  readonly animated?: boolean;
  readonly testId?: string;
}) {
  return (
    <div
      className="decrypto-code-display"
      role="group"
      aria-label={`${label}：${code.join('、')}`}
      data-animated={animated || undefined}
      data-testid={testId}
    >
      {code.map((number, index) => (
        <span className="decrypto-code-digit" key={index} aria-hidden="true">
          {number}
        </span>
      ))}
    </div>
  );
}
