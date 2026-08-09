---
name: Maritime Logistics Framework
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f3'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#43474e'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f1f1f1'
  outline: '#73777f'
  outline-variant: '#c3c6cf'
  surface-tint: '#3f6186'
  primary: '#00182f'
  on-primary: '#ffffff'
  primary-container: '#002d50'
  on-primary-container: '#7495be'
  inverse-primary: '#a7c9f4'
  secondary: '#075fac'
  on-secondary: '#ffffff'
  secondary-container: '#70adff'
  on-secondary-container: '#004078'
  tertiary: '#2a1000'
  on-tertiary: '#ffffff'
  tertiary-container: '#492000'
  on-tertiary-container: '#c3845a'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d1e4ff'
  primary-fixed-dim: '#a7c9f4'
  on-primary-fixed: '#001d36'
  on-primary-fixed-variant: '#25496d'
  secondary-fixed: '#d4e3ff'
  secondary-fixed-dim: '#a5c8ff'
  on-secondary-fixed: '#001c3a'
  on-secondary-fixed-variant: '#004785'
  tertiary-fixed: '#ffdcc7'
  tertiary-fixed-dim: '#feb789'
  on-tertiary-fixed: '#311300'
  on-tertiary-fixed-variant: '#6b3a16'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
  status-pending: '#9F7B87'
  status-validated: '#005DAA'
  status-invoiced: '#212529'
  cargo-accent: '#D79375'
  vessel-dark: '#212529'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  title-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  sidebar-width: 260px
  container-max: 1440px
  gutter: 24px
  cell-padding-v: 12px
  cell-padding-h: 16px
---

## Brand & Style

The design system is engineered for high-stakes maritime logistics and vessel management. It bridges the gap between traditional industrial reliability and modern digital efficiency. The aesthetic is **Corporate Modern** with a lean toward **Minimalism**, prioritizing information density without sacrificing clarity.

The interface should feel architectural and robust, mirroring the precision of maritime engineering. It evokes a sense of stability, authority, and global connectivity through purposeful whitespace and a disciplined color application. The target experience is one of "calm control" amidst complex data environments.

## Colors

The palette is anchored by **Deep Navy (#002D50)**, representing the maritime foundation and authority. **Industrial Grey (#F4F4F4)** serves as the primary canvas color to reduce eye strain during prolonged data entry.

**Accent Blue (#005DAA)** is reserved strictly for primary actions and active states. Functional colors are derived from the maritime environment: a muted clay for cargo-related highlights and a deep charcoal for high-contrast text. Status badges utilize a logic of "progress intensity": neutral tones for pending states and deep corporate blues for validated or completed actions.

## Typography

This design system utilizes **Inter** for its exceptional legibility and neutral, professional tone. To handle the technical nature of maritime data (lat/long coordinates, vessel IDs, container numbers), **JetBrains Mono** is introduced for tabular data and specific labels, ensuring vertical alignment and character distinction.

Hierarchy is established through weight rather than dramatic size shifts. Use `label-caps` for table headers and section overviews to create a structured, "form-like" appearance. Maintain high contrast between primary body text and metadata levels.

## Layout & Spacing

The layout follows a **Fixed Sidebar** model for rapid navigation between fleet management, logistics, and invoicing. The main content area uses a fluid-width approach within a maximum boundary of 1440px to ensure data tables don't become excessively stretched on ultra-wide monitors.

A strict 8px spacing grid governs all margins and padding. Tables must use **sticky headers** to maintain context during deep vertical scrolls. For data-heavy views, density can be toggled, but the default state favors a "Comfortable" setting with 12px vertical cell padding to ensure touch targets are accessible and scanning is effortless.

## Elevation & Depth

Depth is communicated through **Tonal Layers** rather than heavy shadows. The background sits at the lowest level in Industrial Grey. Content "cards" and data modules are elevated using pure white surfaces with **low-contrast outlines** (1px solid #E0E0E0).

Shadows are used sparingly, reserved only for "floating" elements like dropdown menus or active modal windows. These shadows should be sharp and direct (e.g., `0px 4px 12px rgba(0, 45, 80, 0.08)`), tinted with the primary Deep Navy to maintain the maritime color profile.

## Shapes

The shape language is **Soft (0.25rem)**. This slight rounding takes the edge off the industrial aesthetic, making the platform feel modern and refined without appearing "playful" or consumer-grade. Buttons and input fields share this 4px radius, while larger container cards may scale to 8px (rounded-lg) to emphasize grouping. Status badges utilize a slightly more rounded 12px radius to distinguish them from interactive buttons.

## Components

### Buttons
Primary buttons use the Deep Navy background with white text. Secondary buttons use a ghost style with a Deep Navy border. Hover states should involve a subtle shift to Accent Blue.

### Data Tables
Tables are the core of the system. They must feature:
- Zebra striping using a 2% opacity of Deep Navy.
- Sticky headers with a distinct bottom border.
- Monospaced font for numerical columns.
- Inline status badges for "En attente" (muted), "Validé" (blue), and "Facturé" (dark).

### Side Navigation
The sidebar is dark-themed (#212529) to create a clear visual separation from the content area. Active links are indicated by an Accent Blue left-border highlight and a subtle background tint.

### Input Fields
Inputs use a white background with a 1px Industrial Grey border. On focus, the border transitions to Accent Blue with a soft 2px outer glow.

### Cards
Cards are the primary container for dashboard modules. They should have a simple 1px border, no shadow, and a clear header row separated by a subtle horizontal rule.