/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Semantic Surfaces (Dark/Light aware via CSS variables)
        surface: {
          canvas: "var(--surface-canvas)",
          sunken: "var(--surface-sunken)",
          base: "var(--surface-base)",
          raised: "var(--surface-raised)",
          overlay: "var(--surface-overlay)",
        },
        // Semantic Texts
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
          placeholder: "var(--text-placeholder)",
          link: "var(--text-link)",
        },
        // Borders
        border: {
          default: "var(--border-default)",
          subtle: "var(--border-subtle)",
          strong: "var(--border-strong)",
        },
        // Brand & Accents
        primary: "var(--color-primary, #005DAA)",
        primaryDark: "var(--color-primary-dark, #002B49)",
        primaryLight: "var(--color-primary-light, #F0F7FF)",
        success: "var(--color-success, #00875A)",
        // Status Surfaces
        accent: {
          soft: "var(--surface-accent-soft)",
        },
        positive: {
          soft: "var(--surface-positive-soft)",
          text: "var(--text-positive)",
        },
        caution: {
          soft: "var(--surface-caution-soft)",
          text: "var(--text-caution)",
        },
        critical: {
          soft: "var(--surface-critical-soft)",
          text: "var(--text-critical)",
        },
        // Thème sombre bleu BOCS (tokens.css §12) — à utiliser derrière `dark:`.
        night: Object.fromEntries(
          [
            "canvas", "sunken", "surface", "raised", "line", "line-strong",
            "ink", "ink-2", "ink-3",
            "accent", "accent-strong", "accent-soft", "accent-line", "link",
            "positive", "positive-soft", "positive-line",
            "caution", "caution-soft", "caution-line",
            "critical", "critical-soft", "critical-line",
          ].map((k) => [k, `rgb(var(--night-${k}) / <alpha-value>)`])
        ),
      },
      borderRadius: {
        "DEFAULT": "var(--radius-sm)",
        "xs": "var(--radius-xs)",
        "sm": "var(--radius-sm)",
        "md": "var(--radius-md)",
        "lg": "var(--radius-lg)",
        "xl": "var(--radius-xl)",
        "full": "var(--radius-pill)"
      },
      spacing: {
        "margin-mobile": "16px",
        "margin-desktop": "40px",
        "container-max": "1440px",
        "sidebar-width": "260px",
        "1": "var(--space-1)",
        "2": "var(--space-2)",
        "3": "var(--space-3)",
        "4": "var(--space-4)",
        "5": "var(--space-5)",
        "6": "var(--space-6)",
        "8": "var(--space-8)",
        "10": "var(--space-10)",
        "12": "var(--space-12)",
        "16": "var(--space-16)",
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        display: ['var(--font-display)'],
        brand: ['var(--font-brand)'],
        data: ['var(--font-data)'],
        mono: ['var(--font-data)'],
      },
      fontSize: {
        "2xs": "var(--text-2xs)",
        "xs": "var(--text-xs)",
        "sm": "var(--text-sm)",
        "md": "var(--text-md)",
        "base": "var(--text-base)",
        "lg": "var(--text-lg)",
        "xl": "var(--text-xl)",
        "2xl": "var(--text-2xl)",
        "3xl": "var(--text-3xl)",
      },
      boxShadow: {
        "1": "var(--elevation-1)",
        "2": "var(--elevation-2)",
        "3": "var(--elevation-3)",
      }
    },
  },
  plugins: [],
}
