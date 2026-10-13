// PetPal hero copy. Scratch exercise: no real client, no measured data.
// Claim to verify with the client before publish: sitter vetting steps (trustLine).

export interface HeroSectionProps {
  headline: string;
  subheadline: string;
  trustLine: string;
  primaryCta: { label: string; href: string; testId: string };
  ctaColorToken: "color.cta.primary";
  microcopy: string;
}

export const heroProps: HeroSectionProps = {
  headline: "A sitter your pet will love, close to home",
  subheadline:
    "Compare local pet sitters, check their profiles and message them before you book.",
  // Order is fixed by strategy.md: sitter vetting first, then reviews.
  trustLine:
    "Every sitter is vetted before they can take bookings. Read reviews from other pet owners before you choose.",
  primaryCta: {
    label: "Find a sitter near you",
    href: "/search",
    testId: "hero-primary-cta",
  },
  ctaColorToken: "color.cta.primary",
  microcopy: "No card needed to search. Free to browse sitters.",
};
