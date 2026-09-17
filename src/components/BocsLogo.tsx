import React from 'react';

interface BocsLogoProps {
  className?: string;
}

/**
 * Logo officiel BOCS ABIDJAN (wordmark vectoriel).
 * Reprise du SVG de marque utilisé dans la Sidebar et le drawer mobile.
 * Taille pilotée via `className` (ex. "h-10 w-auto").
 */
export const BocsLogo: React.FC<BocsLogoProps> = ({ className = 'h-10 w-auto' }) => (
  <svg
    className={className}
    viewBox="0 0 350 90"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="BOCS Abidjan"
  >
    <text
      x="340"
      y="42"
      fontFamily="'Plus Jakarta Sans', 'Arial Black', Arial, sans-serif"
      fontWeight="900"
      fontSize="52"
      fontStyle="italic"
      fill="#00875A"
      textAnchor="end"
      letterSpacing="-2"
    >
      BOCS
    </text>
    <polygon points="0,48 350,48 315,88 290,88 316.25,58 0,58" fill="#002B49" />
    <text
      x="282"
      y="81"
      fontFamily="'Plus Jakarta Sans', Arial, sans-serif"
      fontWeight="bold"
      fontSize="19"
      fill="#002B49"
      textAnchor="end"
    >
      ABIDJAN
    </text>
  </svg>
);
