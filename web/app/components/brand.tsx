export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span className={["brandMark", className].filter(Boolean).join(" ")} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}
