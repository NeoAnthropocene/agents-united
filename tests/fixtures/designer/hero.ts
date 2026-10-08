/**
 * PetPal hero copy for the scratch exercise of plan 036 (H10).
 * PetPal is a fictional product: every figure and claim below is invented and unsubstantiated.
 * Contract with design and engineering: ctaTestId and ctaColorToken are fixed.
 */
export interface FictionalFigure {
  text: string;
  status: 'fictional';
}

export interface HeroHook {
  angle: 'trust' | 'comfort' | 'proof';
  headline: string;
  status: 'fictional';
}

export interface HeroSectionProps {
  headline: string;
  subhead: string;
  ctaLabel: string;
  ctaTestId: 'hero-primary-cta';
  ctaColorToken: 'color.cta.primary';
  proof: string;
  figures: readonly FictionalFigure[];
  hooks: readonly HeroHook[];
}

export const hero: HeroSectionProps = {
  headline: 'Sitters you can trust',
  subhead: 'Background-checked, reviewed by neighbours, insured up to $1M.',
  ctaLabel: 'Book now',
  ctaTestId: 'hero-primary-cta',
  ctaColorToken: 'color.cta.primary',
  proof: '4.9 average rating, 12,000 stays',
  figures: [
    { text: '4.9 average rating', status: 'fictional' },
    { text: '12,000 stays', status: 'fictional' },
    { text: 'insured up to $1M', status: 'fictional' },
  ],
  hooks: [
    { angle: 'trust', headline: 'Sitters you can trust', status: 'fictional' },
    { angle: 'comfort', headline: 'Your dog, happy at home', status: 'fictional' },
    { angle: 'proof', headline: '12,000 stays, 4.9 stars', status: 'fictional' },
  ],
};
