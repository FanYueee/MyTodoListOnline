export function PlusIcon() {
  return <Svg><path d="M12 5v14" /><path d="M5 12h14" /></Svg>;
}

export function CloseIcon() {
  return <Svg><path d="m6 6 12 12" /><path d="m18 6-12 12" /></Svg>;
}

export function ChevronRightIcon() {
  return <Svg><path d="m9 6 6 6-6 6" /></Svg>;
}

function Svg({ children }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
