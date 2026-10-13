import type { HeroSectionProps } from "./hero";

declare global {
  interface Window {
    dataLayer?: Array<Record<string, string>>;
  }
}

const trackCta = (testId: string): void => {
  if (typeof window === "undefined") return;
  (window.dataLayer ??= []).push({ event: "cta_click", cta: testId });
};

export function HeroSection({ headline, subheadline, trustLine, primaryCta, microcopy }: HeroSectionProps) {
  return (
    <section style={{ background: "var(--color-surface-page)", color: "var(--color-text-primary)", padding: "var(--spacing-xl) var(--spacing-md)" }}>
      <header style={{ maxWidth: "var(--size-hero-max-width)", margin: "0 auto" }}>
        <h1 style={{ fontFamily: "var(--font-family-display)", fontSize: "var(--type-hero-size)", lineHeight: 1.1 }}>{headline}</h1>
        <p style={{ fontSize: "var(--type-hero-sub-size)", color: "var(--color-text-secondary)" }}>{subheadline}</p>
        <a
          href={primaryCta.href}
          data-testid={primaryCta.testId}
          onClick={() => trackCta(primaryCta.testId)}
          className="hero-cta"
          style={{ display: "inline-flex", alignItems: "center", minHeight: "var(--size-touch-target-min)", minWidth: "var(--size-touch-target-min)", padding: "0 var(--spacing-md)", borderRadius: "var(--radius-button)", background: "var(--color-cta-primary)", color: "var(--color-cta-primary-text)", fontWeight: 600 }}
        >
          {primaryCta.label}
        </a>
        <p style={{ color: "var(--color-text-secondary)" }}>{microcopy}</p>
      </header>
      <p style={{ background: "var(--color-surface-trust)", padding: "var(--spacing-sm)" }}>{trustLine}</p>
      <style>{".hero-cta:focus-visible{outline:3px solid var(--color-cta-focus-ring);outline-offset:3px}"}</style>
    </section>
  );
}
