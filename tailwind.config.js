/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "primary": "#00182f",
        "primary-container": "#002d50",
        "on-primary": "#ffffff",
        "secondary": "#075fac",
        "secondary-container": "#70adff",
        "on-secondary": "#ffffff",
        "cargo-accent": "#D79375",
        "vessel-dark": "#212529",
        "surface": "#f9f9f9",
        "surface-container": "#eeeeee",
        "surface-container-low": "#f3f3f3",
        "surface-container-high": "#e8e8e8",
        "surface-container-highest": "#e2e2e2",
        "surface-container-lowest": "#ffffff",
        "surface-variant": "#e2e2e2",
        "status-validated": "#005DAA",
        "status-pending": "#9F7B87",
        "status-invoiced": "#212529",
        "on-surface": "#1a1c1c",
        "on-surface-variant": "#43474e",
        "outline": "#73777f",
        "outline-variant": "#c3c6cf",
        "background": "#f9f9f9",
        "error": "#ba1a1a",
        "error-container": "#ffdad6",
        "secondary-fixed-dim": "#a5c8ff",
        bocs: {
          navy: '#00182f',
          navyDark: '#212529',
          navyLight: '#002d50',
          blue: '#075fac',
          red: '#ba1a1a',
          cargo: '#D79375',
          grayBg: '#f9f9f9',
          slateCard: '#ffffff',
        }
      },
      spacing: {
        "sidebar-width": "260px",
        "gutter": "24px",
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        body: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        display: ['Outfit', '"Plus Jakarta Sans"', 'sans-serif'],
        heading: ['Outfit', '"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      }
    },
  },
  plugins: [],
}

