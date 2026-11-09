/** Section — titled role group holding the RoleChip list. */
import type { ReactNode } from 'react';

export function Section({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="config-section">
      <h3 className="config-section-title">{title}</h3>
      <div className="config-section-chips">{children}</div>
    </section>
  );
}
