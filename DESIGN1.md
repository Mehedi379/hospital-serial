---
name: Clinical Precision High-Contrast Healthcare System
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#44474c'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#75777d'
  outline-variant: '#c5c6cd'
  surface-tint: '#525f75'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#0e1c2f'
  on-primary-container: '#77849c'
  inverse-primary: '#bac7e1'
  secondary: '#005db7'
  on-secondary: '#ffffff'
  secondary-container: '#64a1ff'
  on-secondary-container: '#003670'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#001d31'
  on-tertiary-container: '#188ace'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d6e3fe'
  primary-fixed-dim: '#bac7e1'
  on-primary-fixed: '#0e1c2f'
  on-primary-fixed-variant: '#3a475c'
  secondary-fixed: '#d6e3ff'
  secondary-fixed-dim: '#a9c7ff'
  on-secondary-fixed: '#001b3d'
  on-secondary-fixed-variant: '#00468c'
  tertiary-fixed: '#cce5ff'
  tertiary-fixed-dim: '#93ccff'
  on-tertiary-fixed: '#001d31'
  on-tertiary-fixed-variant: '#004b73'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display-tv:
    fontFamily: Plus Jakarta Sans
    fontSize: 96px
    fontWeight: '800'
    lineHeight: 104px
    letterSpacing: -0.03em
  display-token:
    fontFamily: JetBrains Mono
    fontSize: 80px
    fontWeight: '700'
    lineHeight: 88px
    letterSpacing: -0.02em
  display-token-mobile:
    fontFamily: JetBrains Mono
    fontSize: 44px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-numeric:
    fontFamily: JetBrains Mono
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-tv: 2.5rem
  margin: 1.5rem
  margin-tv: 3rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system establishes an authoritative, mission-critical healthcare aesthetic built for zero-error clinical operations and high-stress patient environments. Operating across three distinct viewports—high-density clinician desktop workstations, dynamic nurse handheld triage tablets/phones, and high-visibility waiting hall public monitors—the visual tone balances surgical precision, calm reassurance, and instantaneous optical clarity.

### Personality Matrix
- **Clinical Rigor & Authority:** Deep, stable foundations convey enterprise reliability, stability, and HIPAA-grade security.
- **Urgent Legibility:** Glanceable information hierarchy designed to avoid triage delays, audible signal ambiguity, and patient confusion.
- **Modern Institutional Warmth:** Replaces sterile, antiquated hospital software with a refined, tactile, and professional interface that reduces cognitive fatigue for clinicians during 12-hour shifts.

### Design Movement
The system implements a structured **High-Contrast Modern Clinical** style: crisp borders, disciplined tonal layering, tabular numeric clarity, and controlled ambient depth. It discards decorative noise, excessive blur effects, and frivolous animations in favor of functional precision, deliberate contrast ratios (conforming to WCAG AAA for public displays and WCAG AA for administrative tooling), and ergonomic touch targets.

## Colors

The color palette is derived from clinical optics: deep midnight navy anchors data boundaries, surgical sapphire blue directs deliberate user actions, and sky cyan signals live vocalization, active token calls, and ongoing patient telemetry.

### Palette Architecture
- **Primary Navy (`#0B192C`):** Used for structural navigation, primary typography, high-priority status panels, and the dominant background in dark/TV display modes.
- **Secondary Sapphire Blue (`#1565C0`):** Drives affirmative workflow triggers, interactive patient queues, primary action buttons, and active chamber routing indicators.
- **Tertiary Sky/Cyan (`#0284C7`):** Reserved for live voice calling visualizers, current ticket highlight pulses, broadcast active states, and focus states.
- **Slate Neutrals (`#FFFFFF`, `#F8FAFC`, `#F1F5F9`, `#E2E8F0`, `#64748B`):** Establishes sanitary card backgrounds, subtle compartmentalization lines, and secondary descriptive metadata.

### Functional Alerts & Statuses
- **Live / In-Consultation (`#0D9488` / Deep Teal):** Signals patient currently in examination room.
- **Calling / Chime Alert (`#F59E0B` / Amber Glow):** Flashed when a token number is broadcast over speaker audio.
- **Critical / Emergency Bypass (`#BE123C` / Clinical Crimson):** Unlocks triage priority overrides and stat lab notifications.

## Typography

Typography prioritizes absolute optical separation between names, instructions, and critical serial identifiers.

### Font Family Roles
- **Plus Jakarta Sans (Headings & Signage Display):** Delivers clean geometry with open apertures and distinct letterforms, preventing misread department labels or room numbers from extreme angles.
- **Inter (Body & Administrative Data):** Provides neutral, utilitarian balance across patient files, medication notes, and clinical records with distinct glyph clarity.
- **JetBrains Mono (Serial Identifiers, Queue Codes & Timers):** Employs fixed-width tabular figures to prevent optical jumping when queue counters increment and allows immediate differentiating between `0` (zero) and `O` (uppercase letter), avoiding dangerous patient identification mismatches.

### Specialized Rules
- All numeric tokens (e.g., `A-104`, `EM-009`) must enforce tabular numbers (`font-variant-numeric: tabular-nums`) regardless of font family.
- Public display monitors running in 4K or 1080p must use `display-tv` or `display-token` levels with a minimum optical contrast ratio of 7:1 against their container card.

## Layout & Spacing

The layout model is governed by an adaptive 12-column grid configured for high-density administrative workflows, touch-first mobile nurse triage, and fixed-viewport wall displays.

### Layout Form Factors
- **Clinician Workstation (Desktop, 1200px+):** 12-column fluid grid, `1.5rem` gutters. Left-fixed collapsible utility panel (queue control), central consultation space, and right-hand telemetry timeline.
- **Nurse & Mobile Assistant (Touchscreen, 360px - 768px):** Single-column stacked cards with bottom-anchored action bars. Horizontal padding matches `margin` (`1.5rem`). Touch targets enforce a minimum height of `48px` to support gloved operations.
- **Waiting Room TV Display (Full-Screen 16:9 / 1920x1080 & 3840x2160):** Fixed 3-column split view (Now Calling / Room Directories / General Queue) utilizing `gutter-tv` (`2.5rem`) and outer canvas `margin-tv` (`3rem`) to prevent overscan clipping on commercial monitors.

### Spacing Rhythm
Interior elements within cards follow an 8px architectural grid. Data rows within triage tables use `space-md` (`1rem`) vertical padding for balanced visual density without cramped interactions.

## Elevation & Depth

Visual hierarchy uses clean architectural layering: razor-sharp structural outlines paired with diffused ambient shadows to avoid muddy visual weight.

### Tonal Tiers
- **Canvas Base (Level 0):** `#F8FAFC` (Clinical off-white) in workstation mode; `#0B192C` (Deep clinical navy) on TV public display boards.
- **Sub-Surface Containers (Level 1):** `#FFFFFF` cards bordered by a solid 1px `#E2E8F0` stroke. Zero shadow in rest state; provides crisp separation without cognitive clutter.
- **Raised Interactive Cards (Level 2):** Active token queues and doctor consultation counters. Lifted via an ambient shadow: `0 4px 16px -2px rgba(11, 25, 44, 0.06), 0 2px 6px -1px rgba(11, 25, 44, 0.04)`.
- **Floating Modals & Urgent Overrides (Level 3):** Emergency bypass modals and voice broadcast controllers utilize `0 16px 32px -8px rgba(11, 25, 44, 0.16)` with a 1px border colored `#CBD5E1`.

### Ambient Shadows & Light Cast
Shadows are tinted strictly with the deep clinical navy base (`#0B192C`), preventing dirty grey hazing and preserving pristine clinical cleanliness. Public TV displays dispense with drop shadows entirely, leveraging solid 2px outline accents (`#0284C7` and `#1565C0`) to optimize viewability under harsh fluorescent lighting.

## Shapes

The design system maintains a disciplined **Soft (`1`)** shape language: structural, crisp, and medical.

### Corner Radius System
- **Base Components (`rounded` / 0.25rem / 4px):** Used on inner tokens, input elements, data grid tags, and status dots.
- **Cards & Modules (`rounded-lg` / 0.5rem / 8px):** Applied to patient record cards, consultation room modules, and queue counter segments.
- **Modals & Large Panels (`rounded-xl` / 0.75rem / 12px):** Reserved for system-level overlays, triage control drawers, and triage flow dialogs.

Overly playful pill shapes and excessive bubbles are prohibited; corners must convey precision tooling, reliability, and architectural firmness.

## Components

### 1. Buttons & Triggers
- **Primary Call Button:** Solid `#1565C0` fill, white text, 4px border radius. Accompanied by an icon indicating voice synthesis or patient invocation. Active states trigger `#0B192C`.
- **Stat / Emergency Button:** `#BE123C` fill, white bold lettering. High visual prominence for immediate patient routing bypasses.
- **Secondary / Pass Trigger:** 1px border `#CBD5E1`, text `#0B192C`, white background. Hover transforms background to `#F1F5F9`.
- **Target Sizes:** 48px height on handheld tablets; 40px height on desktop workstation tables.

### 2. Serial Token Badges & Chips
- **Serial Badges:** Rendered using `JetBrains Mono` with heavy border contrast. For example: `Token B-204` displays within a `#F1F5F9` background, `#0B192C` text, and a crisp 1.5px `#CBD5E1` border.
- **State Indicator Chips:**
  - *Calling Now:* Solid `#0284C7` with white text and an animated audio-wave indicator.
  - *In Room:* `#0D9488` background tint with dark teal border and text.
  - *Delayed:* Subtle `#F59E0B` tint.

### 3. Queue Lists & Real-Time Tables
- Alternating subtle row coloring (`#FFFFFF` to `#F8FAFC`) with border-bottom in `#E2E8F0`.
- Rows feature a left border stripe indicator (3px width): transparent for pending, cyan for actively being summoned, and emerald for in-consultation.
- High touch-target row spacing (`52px` minimum) on mobile triage devices for quick single-tap status advancement.

### 4. TV Signage & Waiting-Room Display Boards
- Dark mode default (`#0B192C` canvas) to reduce eye strain in waiting rooms and enhance viewing angles.
- Giant high-contrast split layout:
  - Left panel: "NOW SERVING" with large `JetBrains Mono` token (96px), designated chamber number, and doctor name.
  - Right panel: Upcoming queue list arranged in a high-legibility 2-column matrix.
- Pulsing sky-cyan (`#0284C7`) perimeter flash along the card edge synchronized with audio chime alerts.

### 5. Input Fields & Search Bars
- Background: `#FFFFFF`. Border: 1.5px `#CBD5E1`. On focus: 2px `#0284C7` ring with zero vertical displacement blur.
- Patient National ID / Phone / Token search inputs enforce `JetBrains Mono` formatting with integrated clear buttons for swift input cycles.

### 6. Cards & Chamber Pods
- Doctor chamber cards group room status, current patient ticket, queue wait count, and audio recall controls.
- Framed with 1px `#E2E8F0` borders and an active status badge fixed to the upper-right corner.