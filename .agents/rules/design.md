# BOCS Design System & Visual Guidelines

This document outlines the visual system and guidelines for BOCS Abidjan Maritime Platform. All UI modifications, pages, and new components must adhere strictly to these principles to maintain a consistent premium aesthetic.

---

## 1. Theme and Page Structure
- **Light, Neutral Aesthetic**: The main application interface uses a light, crisp theme.
- **Page Background**: The default background color is `#f8fafc` (Slate 50). Use the `.bg-background` CSS class or style directly.
- **Card Containers**: Cards (`.bocs-card`, `.bg-white`) must use a solid white background (`#ffffff`), a thin border (`1px solid #e2e8f0`), and a soft ambient shadow (`0 1px 3px rgba(0, 0, 0, 0.04)`).
- **Hover Transitions**: Interactive cards should have a subtle hover effect (transitions to a slightly darker border `#cbd5e1` and slightly larger shadow) to feel responsive.

---

## 2. Brand Color Palette
- **Primary Blue (BOCS Blue)**: `#005daa` — Used for active navigation links, primary buttons, borders, and brand accents.
- **Secondary Yellow (BOCS Yellow/Gold)**: `#ffe135` (Hover: `#ffe855`) — Used for specific prominent filters, select buttons, and highlights.
- **Emerald Green (BOCS Green)**: `#209641` (Hover: `#1b7e36`) — Used for validation success status, active badges, and primary action triggers.
- **Text Color**: `#0f172a` (Slate 900) for body text and headers to maintain high readability and high contrast.
- **Border Color**: `#e2e8f0` (Slate 200) for default divider lines, card borders, and boundaries.

---

## 3. Typography
- **Primary Font**: `Inter`, system-ui, sans-serif — Used for high readability in tables, inputs, and paragraphs.
- **Header Font**: `Inter`, `Outfit`, sans-serif — Used for titles, section headings, and labels.
- **Letter Spacing**: Use slight tracking constraints (`letter-spacing: -0.01em` or `-0.02em`) to give text a crisp, premium editorial look.

---

## 4. Components & Interactive Elements
- **Input Fields**:
  - Background: `#ffffff`
  - Border: `1px solid #cbd5e1`
  - Shadow: Soft inset shadow (`inset 0 1px 2px rgba(15, 23, 42, 0.04)`)
  - Focus Ring: Border transitions to BOCS Blue (`#005daa`) with a soft glow outer ring (`rgba(0, 93, 170, 0.15)`).
- **Badges and Pills**:
  - Success/Paid: Light green background with dark green text (`bg-emerald-500/15 text-emerald-400 border border-emerald-500/30` or similar).
  - Info/Status: Light blue background with BOCS blue text.
  - Warning/Danger: Light rose/red background with dark red text.
- **Tables**:
  - Header: Low-contrast grey background, bold dark grey text, with tracking constraints and uppercase lettering.
  - Rows: Alternating states, with thin bottom borders and clean spacing.

---

## 5. Exclusions & Welcome Screen
- **Welcome Screen Page**: The welcome/landing screen is the only section that uses a dark, high-tech maritime console style (`#001122` background, glows, custom animations) to deliver a high-impact initial entry. All subsequent pages inside the platform must transition back to the main light, neutral design system documented above.
