import './AdminComponents.css';

interface AdminPillProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
}

/** Toggle pill for admin sort, filter, and time-preset choices; the parent owns selection. */
export function AdminPill({ label, isActive, onPress }: AdminPillProps) {
  return (
    <button type="button" className="admin-pill" aria-pressed={isActive} onClick={onPress}>
      {label}
    </button>
  );
}
