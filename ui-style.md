# UI Style Guide - Premium Minimal (Apple-inspired)

## 1) Document Purpose
- This guide defines a premium, minimal UI direction inspired by Apple's design tone.
- It is tailored for this project's web frontend and kiosk interface.
- Goal: maintain technical stack (React) while upgrading visual consistency, readability, and touch usability.

## 2) Brand Tone and Principles

### Tone Keywords
- Minimal
- Premium
- Calm
- Precise
- Human-centered

### Core Principles
- Remove visual noise and keep only meaningful elements.
- Use generous spacing to create focus and hierarchy.
- Prefer strong typography and contrast over decorative effects.
- Keep interactions subtle, fast, and predictable.
- Ensure consistency across web and kiosk while optimizing each context.

## 3) Color System

### Neutral Palette
- `--color-text-primary`: `#111111`
- `--color-text-secondary`: `#6E6E73`
- `--color-bg-primary`: `#FFFFFF`
- `--color-bg-secondary`: `#F5F5F7`
- `--color-border`: `#D2D2D7`

### Brand / Action Colors
- `--color-accent`: `#0071E3`
- `--color-accent-hover`: `#0077ED`
- `--color-success`: `#34C759`
- `--color-error`: `#FF3B30`
- `--color-warning`: `#FF9F0A`

### Color Usage Rules
- Use neutral backgrounds by default and reserve accent colors for key actions.
- Never use more than one strong accent color in the same section.
- Maintain sufficient text contrast for accessibility (WCAG AA minimum).

## 4) Typography System

### Font Stack
- `Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans KR", sans-serif`

### Type Scale
- `Display`: `56/64`, `700` (hero headline only)
- `H1`: `48/56`, `700`
- `H2`: `36/44`, `700`
- `H3`: `28/36`, `600`
- `Body Large`: `19/30`, `400`
- `Body`: `17/26`, `400`
- `Body Small`: `15/22`, `400`
- `Caption`: `13/18`, `400`

### Typography Rules
- Keep heading hierarchy strict and avoid skipping levels.
- Limit text width for long paragraphs (recommended 60-75 characters per line).
- Use secondary text color only for supportive information, not for primary content.

## 5) Layout, Spacing, and Geometry

### Spacing Scale (px)
- `4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80`

### Radius
- Small controls: `10px`
- Standard cards/inputs: `16px`
- Hero containers: `24px`
- Pill buttons/chips: `9999px`

### Shadows
- Default: minimal or none.
- Elevated card (optional):
  - `0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)`
- Avoid heavy, layered shadows.

### Width and Grid
- Web content max width: `1200px`
- Recommended page padding: `24px` (mobile), `40px` (tablet), `64px` (desktop)
- Use simple 12-column grid on web for scalable layout consistency.

## 6) Component Guidelines

### Button
- Primary:
  - Background: accent color
  - Text: white
  - Border: none
  - Hover: slightly brighter accent
- Secondary:
  - Background: white
  - Text: primary text
  - Border: `1px` border color
- Tertiary (text button):
  - No fill, no border
  - Accent text
- Heights:
  - Web: `44px`
  - Kiosk: `56px` minimum
- Disabled:
  - Reduce contrast clearly but keep legible text.

### Card
- Background: secondary background or white
- Border: `1px solid` border color
- Radius: `16px`
- Padding: `20-24px`
- Keep content grouping simple: title, body, action.

### Input / Select
- Heights:
  - Web: `44px`
  - Kiosk: `56px`
- Border: `1px solid` neutral border
- Focus:
  - `2px` accent ring (or equivalent focus style)
- Placeholder:
  - secondary text color, never too low contrast.

### Header / Navigation
- Clean, low-noise top bar with strong spacing.
- Keep primary navigation options limited (recommended 4-6 max).
- Current section should be clearly identifiable.

## 7) Motion and Interaction
- Transition duration: `160-220ms`
- Easing: `ease-out` for entry, `ease-in-out` for state changes
- Hover effects:
  - subtle background shift, border emphasis, or tiny scale (`1.01`)
- Press/click feedback should feel immediate.
- Avoid bouncy, exaggerated, or long animations.

## 8) Iconography and Imagery
- Prefer simple line icons with consistent stroke weight.
- Do not mix many icon styles in one view.
- Product imagery should be high quality with ample whitespace.
- Avoid overly saturated or noisy visuals.

## 9) Web Frontend Screen Rules

### Home / Landing
- Large, concise headline.
- Short supporting text.
- One primary CTA and one optional secondary CTA.
- Strong vertical rhythm between sections.

### List / Catalog
- Clear filter/sort hierarchy.
- Card spacing should emphasize scanability.
- Important values (price, status, ETA) must be visually prominent.

### Detail / Checkout
- Minimize distractions during critical tasks.
- Keep summary and action area visible.
- Emphasize trust cues and final confirmation clarity.

## 10) Kiosk-Specific Rules

### Touch and Readability
- Minimum touch target: `48x48px`; recommended `56x56px+`
- Main action buttons: `56-72px` height
- Minimum readable text: `18px` (primary actions often `20px+`)
- High contrast between interactive elements and background.

### Flow Simplification
- Keep primary ordering/payment flow to `3-4` steps when possible.
- Show clear progress indicator (Step 1/3 style).
- Avoid dense text blocks; prefer chunked choices and visual grouping.

### Error Prevention
- Require explicit confirmation for destructive actions (cancel, reset).
- Provide easy back navigation without losing all progress.
- Show concise, clear error text with direct recovery action.

### Environmental Considerations
- Account for glare and viewing distance.
- Do not rely on hover-only affordances (touch-first UI).
- Use larger spacing to reduce mis-taps.

## 11) Accessibility Baseline
- Meet WCAG AA contrast requirements.
- All controls must have visible focus states.
- Support keyboard navigation on web.
- Do not encode meaning by color alone.
- Provide text alternatives for key icons/images where needed.

## 12) Implementation Notes for React
- Keep React stack unchanged; apply this guide through design tokens and shared components.
- Recommended rollout order:
  1. Create global tokens (color, type, spacing, radius, motion)
  2. Refactor shared UI components (Button, Input, Card, Modal)
  3. Apply page-level layout updates
  4. Apply kiosk touch optimizations
- Use one source of truth for tokens to keep web and kiosk aligned.

## 13) Do / Don't Checklist

### Do
- Use generous spacing and clear hierarchy.
- Keep UI calm and focused.
- Make primary actions obvious.
- Preserve consistency across screens and devices.

### Don't
- Overuse shadows, gradients, or decorative effects.
- Mix too many accent colors.
- Use small touch targets in kiosk screens.
- Add animation that delays user intent.

## 14) Review Criteria (for submission and QA)
- Visual consistency across main pages is maintained.
- Typography and spacing follow the token system.
- Primary user tasks are faster and clearer than before.
- Kiosk tasks are touch-friendly and readable from distance.
- Accessibility baseline checks pass for core flows.
