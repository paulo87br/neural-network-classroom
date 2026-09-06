export function BrandSignature({ compact = false }: { compact?: boolean }) {
  return (
    <a
      className={`brand-signature ${compact ? 'is-compact' : ''}`}
      href="https://paulonascimento.me"
      target="_blank"
      rel="noreferrer"
      aria-label="Paulo Nascimento — site pessoal"
    >
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <circle cx="100" cy="100" r="95" fill="currentColor" />
        <circle cx="100" cy="100" r="82" fill="none" stroke="#0a0c10" strokeWidth="1" opacity="0.35" />
        <g transform="translate(97,100)" fill="none" stroke="#0a0c10" strokeWidth="7">
          <path d="M -36 36 L -36 -36 H -14 A 20 20 0 0 1 -14 4 H -36" />
          <path d="M 8 36 L 8 -36 L 42 36 L 42 -36" />
        </g>
      </svg>
      <span>Paulo <em>Nascimento</em><small>Laboratório</small></span>
    </a>
  )
}
