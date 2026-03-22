# Frontend Design Brief — Secure File Manager with Adaptive Steganography
**For: Lead Frontend Developer / UI Agent**
**Project**: Intelligent Secure File Manager
**Stack**: React 18 + Vite + TypeScript + Tailwind CSS + Framer Motion
**Date**: March 2026

---

## 1. Project Summary

This is a **covert, dual-persona web application** that presents itself as an innocent photo gallery to the public while hiding an encrypted file vault beneath the surface. The core design challenge is that the **same UI must serve two completely different audiences** — a casual observer who sees a beautiful photo gallery, and the authenticated owner who sees their secure vault — without any visual betrayal of the secret layer.

The frontend must be **visually stunning enough to be believable as a real gallery app**, while being **functionally precise enough to handle complex steganography workflows** like capacity validation, method selection, and context-aware decryption.

---

## 2. Design Identity & Aesthetic Direction

### Theme: "Obsidian Glass" — Dark Luxury Minimal

The overall aesthetic is **refined, dark, and cinematic**. Think high-end photography portfolio meets secure ops dashboard. Not hacker-green-on-black, not flat corporate — something that looks like it belongs on Dribbble's front page while still being completely functional.

**Mood board keywords**: obsidian, frosted glass, bento grid, editorial photography layout, silent luxury, deep navy-charcoal palette, crisp white typography, amber/gold micro-accents.

### Color Palette

```
Background primary:    #0A0B0F  (near-black, not pure black)
Background secondary:  #111318  (elevated surfaces)
Background elevated:   #181C24  (cards, modals)
Glass surface:         rgba(255,255,255,0.04) with blur
Border default:        rgba(255,255,255,0.08)
Border hover:          rgba(255,255,255,0.16)

Text primary:          #F2F0EB  (warm white, not pure white)
Text secondary:        #8A8D99
Text muted:            #4A4D58

Accent gold:           #C8A96E  (used sparingly — hover states, active indicators, success)
Accent gold glow:      rgba(200, 169, 110, 0.15)
Accent teal:           #2DD4BF  (LSB method indicator, vault status)
Accent rose:           #FB7185  (warnings, over-capacity alerts)
Accent blue:           #60A5FA  (DCT method indicator, info states)

Success:               #34D399
Warning:               #FBBF24
Danger:                #F87171
```

### Typography

```
Display font:     'Cormorant Garamond' or 'Playfair Display'
                  — Used for the gallery name, hero headings, large stats
                  — Weight 300 italic for the gallery persona
                  — Weight 600 for vault headings

UI font:          'DM Mono' or 'IBM Plex Mono'
                  — Used for metadata, file sizes, method tags (LSB/DCT),
                    fingerprint hashes, timestamps, capacity percentages
                  — Creates a technical-but-refined contrast to the display font

Body/nav font:    'DM Sans' or 'Outfit'
                  — Navigation labels, button text, form labels, descriptions
                  — Weight 400 regular, 500 medium only
```

### Motion Philosophy

**Purposeful, choreographed, never decorative for its own sake.**

Every animation must serve the UX: reveal information, communicate state change, guide the eye, or reward interaction. The app should feel **alive but calm** — like a high-end product demo, not a flashy portfolio site.

Motion library: **Framer Motion** for all React component animations.
CSS transitions for micro-interactions (hover, focus, active states).

---

## 3. Application Structure & Pages

### 3.1 — Gallery Page (Public Persona / Default View)

This is what anyone sees. It must look like a **beautiful, real photo gallery**.

**Layout**: Masonry grid with variable-height cards. Not a rigid equal-size grid — photos should breathe and vary like a real photography portfolio. Use CSS Grid with `grid-auto-rows` masonry or a JS masonry library.

**Entry animation**: On page load, photos cascade in from the bottom with staggered delays — each card slides up 24px and fades in, with 60ms delay between each card. The navbar fades in 200ms before the grid.

**Photo cards**:
- Rounded corners: 12px
- No borders by default — they float on the dark background
- On hover: a very subtle white border `rgba(255,255,255,0.1)` appears + image scales to 1.02 + an overlay appears from the bottom with the photo filename in the gallery persona name (not the real filename)
- The overlay uses a glass-morphism style: `backdrop-filter: blur(12px)` with `rgba(0,0,0,0.5)` background
- Hover transition: 250ms ease-out

**Navbar**:
- Fixed, translucent: `backdrop-filter: blur(20px)` + `background: rgba(10,11,15,0.8)`
- Left: App name in Cormorant Garamond italic — e.g. *"Lumière"* (the public-facing brand name, not "Secure File Manager")
- Right: Navigation links — Gallery, Upload, Settings
- A single tiny dot (5px circle) on the right edge of the navbar — invisible until vault is unlocked, then glows gold with a soft pulse animation. This is the **only** visual signal that vault mode is active.

**Empty state**: If no photos exist yet, show a centered illustration-style SVG of a camera icon with a subtle animated shimmer, and a gentle CTA: "Upload your first photo."

---

### 3.2 — Upload Page

This page handles **two operations in one interface**: uploading a carrier image for the gallery, and embedding a secret payload. The key insight is that these two actions must look like a single, unified "photo upload" experience.

**Layout**: Full-width, vertically centered on screen. Two drop zones side by side on desktop, stacked on mobile.

**Drop Zone — Carrier Image (left, larger)**:
- Label: "Photo" (public persona) — no mention of "carrier"
- Accepts: PNG, JPEG, WebP
- Visual: Large dashed border rectangle that animates to a solid glowing border on drag-over. The dashes themselves animate (stroke-dashoffset animation) on hover to create a "marching ants" effect in gold color.
- On file drop: Image preview replaces the drop zone with a smooth cross-fade. The preview shows the image with a slight vignette overlay.
- Shows image dimensions and file size in DM Mono below.

**Drop Zone — Payload (right, smaller)**:
- Label: "Attachment" (neutral phrasing) — not "secret file" or "payload"
- Accepts: Any file type
- Only appears/expands after a carrier is selected. Animate in with a 300ms ease-out expand from left.
- On file selection: shows filename + size in mono font.

**Capacity Meter** (appears after both files are selected):
- A horizontal progress bar, full-width, below both drop zones
- Uses smooth animated fill — the bar fills from 0 to the actual percentage with a spring animation on load
- Color transitions: green (0–10%) → amber (10–14%) → red (14%+), with smooth color interpolation
- Below the bar: two labels — left shows "X% used", right shows the detected method ("LSB — PNG detected" or "DCT — JPEG detected") in DM Mono with a colored dot matching the accent color for that method (teal for LSB, blue for DCT)
- If over 15%: the bar turns red, the excess portion shows a striped pattern (CSS diagonal stripes animation), and a warning banner slides down: "Payload too large — visual artifacts may occur. Reduce payload or use a larger carrier."

**Encryption Settings** (below the meter, collapsed by default):
- A subtle expandable section: "Advanced options ›" in muted text
- Expands to show: password field (for AES key derivation), context lock toggle (bind to current device), method override dropdown
- All fields styled with the glass-morphism card style

**Submit Button**:
- Full-width, tall (52px)
- Background: `linear-gradient(135deg, #C8A96E, #A07840)` — gold gradient
- Text: "Encrypt & Embed" in DM Sans medium
- On hover: glow effect spreads outward — `box-shadow: 0 0 24px rgba(200,169,110,0.4)`
- On click: button morphs into a progress indicator. The text fades out, a loading ring appears inside the button, and a progress percentage counts up in real time.
- On success: the button turns green with a checkmark icon, then after 1.5s the page transitions to the Gallery with the new photo appearing in the grid.

---

### 3.3 — Vault View (Covert Trigger State)

**Trigger mechanism**: The vault activates when the device fingerprint matches AND the user performs the covert gesture. The exact gesture is configurable but could be: long-press (800ms) on the navbar brand name, or a keyboard shortcut, or a specific click sequence.

**Transition animation**: This is the most important animation in the entire app. When the vault is triggered:
1. The gallery grid blurs out smoothly (300ms, `filter: blur(8px)` + `opacity: 0.3`)
2. A subtle gold shimmer sweeps across the screen (a diagonal gradient line moving left-to-right at 400ms)
3. The gallery grid cross-fades to the vault file list (400ms)
4. The tiny navbar dot begins pulsing gold
5. The app name in the navbar shifts from italic gallery persona to the vault label — a character-by-character text morph animation
Total transition: ~700ms end-to-end.

**Vault file list layout**:
- Full-width list, not a grid
- Each file row is a glass-morphism card: `background: rgba(255,255,255,0.04)`, `backdrop-filter: blur(12px)`, `border: 0.5px solid rgba(255,255,255,0.08)`, `border-radius: 12px`
- Left: A lock icon with a colored glow (teal for LSB-embedded, blue for DCT-embedded, purple for multi-file distributed)
- Center: Real filename (top, warm white, DM Sans medium) + carrier image name (bottom, muted, DM Mono small)
- Right: Method badge (LSB / DCT / Multi) + file size + decrypt button
- Row hover: border brightens to `rgba(255,255,255,0.16)`, a very subtle gold left-border accent appears (2px, `#C8A96E`)
- Rows animate in with staggered slide-from-right when vault opens (50ms delay between rows)

**Decrypt action**:
- Click "Decrypt" on a row → a modal slides up from the bottom (sheet-style on mobile, centered dialog on desktop)
- Modal shows: file details, fingerprint match status (animated green checkmark if current device matches), passphrase field if needed
- On decrypt: progress animation inside the modal, then file downloads automatically
- If fingerprint mismatch: the modal shakes gently (CSS keyframe shake) and shows the decoy content instead — the carrier image downloads as if that were the requested file

---

### 3.4 — Settings Page

**Layout**: Single-column, centered, max-width 640px. Clean form layout.

**Sections** (each a glass card):
1. **Vault access** — covert trigger gesture config, passphrase change
2. **Device fingerprint** — shows current fingerprint hash (in DM Mono), fuzzy threshold slider, registered devices list
3. **Decoy content** — configure what unauthorized access returns
4. **Danger zone** — emergency wipe, recovery key generation (styled with a subtle red border on the card)

---

## 4. Global UI Components

### Navigation / Navbar
- Height: 56px
- Position: Fixed, full-width
- Background: `backdrop-filter: blur(20px)` + `background: rgba(10,11,15,0.85)`
- Bottom border: `1px solid rgba(255,255,255,0.06)`
- Active nav link: gold underline that slides in from left (200ms)
- Vault-active indicator: 5px gold pulsing dot, `animation: pulse 2s ease-in-out infinite`

### Modals / Dialogs
- Entry: slides up + fades in (300ms, spring easing)
- Backdrop: `backdrop-filter: blur(4px)` + `rgba(0,0,0,0.7)`
- Card: `background: #181C24`, `border: 0.5px solid rgba(255,255,255,0.1)`, `border-radius: 20px`
- Exit: fades out + slides down (200ms)

### Buttons
- **Primary (gold)**: gradient gold, glow on hover, 44px height, 12px border-radius
- **Secondary**: glass surface, white border, no background fill
- **Ghost**: text only, gold color on hover, underline slides in
- **Danger**: subtle red glow, `border: 1px solid rgba(248,113,113,0.3)`
- All buttons: `transform: scale(0.97)` on active (pressed feel)

### Badges / Tags
- Method tags (LSB, DCT, Multi): pill shape, monospaced font, colored left-border accent
- Status tags (Safe, Warning, Over): color-coded dot + text

### Toast Notifications
- Bottom-right corner, slide in from right
- Stack upward when multiple are present
- Auto-dismiss after 4s with a progress bar showing time remaining
- Types: success (teal), warning (amber), error (rose), info (blue)

### Loading States
- Skeleton screens for gallery grid (animated shimmer in dark grey)
- Inline spinners for buttons (ring that completes, morphs to checkmark on success)
- Full-page loader: a centered animated logo mark with a subtle orbit ring

---

## 5. Responsive Behavior

| Breakpoint | Gallery | Upload | Vault |
|---|---|---|---|
| Mobile (<640px) | 2-column grid | Stacked drop zones | Full-width list rows |
| Tablet (640–1024px) | 3-column grid | Side-by-side drop zones | Full-width list rows |
| Desktop (>1024px) | 4-column masonry | Side-by-side + capacity panel | Full-width list rows + detail panel |

**Mobile-specific**: The covert trigger on mobile should be a long-press on the app name (800ms). A ripple effect confirms the hold. Navigation collapses to a bottom tab bar.

---

## 6. Animation Catalogue

| Animation | Duration | Easing | Trigger |
|---|---|---|---|
| Page load — gallery cards cascade in | 60ms per card stagger | ease-out | Mount |
| Navbar fade-in | 300ms | ease-out | Mount |
| Drop zone marching ants | Infinite loop | linear | Hover |
| Capacity bar fill | 600ms | spring | File selected |
| Vault transition sweep | 700ms total | ease-in-out | Trigger |
| Vault rows slide in | 50ms stagger | ease-out | Vault open |
| Gold dot pulse | 2s loop | ease-in-out | Vault active |
| Button hover glow | 200ms | ease | Hover |
| Button press scale | 100ms | ease | Active |
| Modal slide-up | 300ms | spring | Open |
| Toast slide-in | 250ms | ease-out | Event |
| Fingerprint mismatch shake | 400ms | ease-in-out | Decrypt fail |
| Photo hover scale | 250ms | ease-out | Hover |
| Success checkmark draw | 400ms | ease-out | Complete |

---

## 7. Key Implementation Notes for the Agent

1. **Framer Motion** is the primary animation library. Use `AnimatePresence` for all mount/unmount animations. Use `motion.div` with `variants` for staggered lists.

2. **Tailwind CSS** for utility classes, but extend the config with the custom color tokens above. Do NOT use Tailwind's default color names for anything project-specific.

3. **Glass morphism** requires `backdrop-filter: blur()` — ensure `-webkit-backdrop-filter` is also set for Safari. Test on dark background only (the design assumes dark bg behind glass surfaces).

4. **The vault transition** is the hero interaction — spend the most polish here. It must feel smooth, intentional, and slightly surprising. A bad vault transition breaks the illusion.

5. **DM Mono** for all technical data: hashes, file sizes, percentages, method labels, timestamps. Never use a proportional font for these values — the monospaced rhythm communicates precision and trust.

6. **No skeleton loaders for the vault** — the vault list should only render after fingerprint verification is complete. Show a single centered spinner (the orbit-ring loader) while verifying, then the list fades in all at once.

7. **Decoy behavior must be silent** — if fingerprint fails and decoy content is returned, there must be zero UI indication that anything failed. The file simply downloads. No error messages, no toasts.

8. **Accessibility**: All animations must respect `prefers-reduced-motion`. Wrap all Framer Motion animations in a check and reduce to simple fades when reduced motion is preferred.

9. **z-index stack**: Navbar (100) → Modals (200) → Toasts (300) → Vault overlay transition (400, temporary).

10. **React Router** page transitions: use Framer Motion's `AnimatePresence` on the router outlet. Each page slides in from the right on forward navigation, from the left on back navigation.

---

## 8. File/Folder Conventions

```
frontend/src/
├── components/
│   ├── Navbar.tsx
│   ├── GalleryGrid.tsx
│   ├── PhotoCard.tsx
│   ├── DropZone.tsx
│   ├── CapacityMeter.tsx
│   ├── VaultList.tsx
│   ├── VaultRow.tsx
│   ├── DecryptModal.tsx
│   ├── Toast.tsx
│   └── PageTransition.tsx
├── pages/
│   ├── Gallery.tsx
│   ├── Upload.tsx
│   ├── Vault.tsx        ← separate component, same route as Gallery
│   └── Settings.tsx
├── animations/
│   └── variants.ts      ← all Framer Motion variant definitions
├── hooks/
│   ├── useVaultTrigger.ts
│   └── useCapacity.ts
├── store/
│   └── vaultStore.ts    ← Zustand: isVaultActive, files, fingerprint
└── styles/
    └── globals.css      ← CSS variables, base styles
```

---

## 9. Deliverable Checklist for Agent

- [ ] Tailwind config extended with full custom color token set
- [ ] Google Fonts imported: Cormorant Garamond, DM Mono, DM Sans
- [ ] Global CSS variables defined for all color tokens
- [ ] `PageTransition.tsx` wrapper with Framer Motion route transitions
- [ ] Gallery masonry grid with staggered load animation
- [ ] PhotoCard hover states (scale, overlay, border)
- [ ] Dual drop zone Upload page with marching ants border animation
- [ ] Capacity meter with animated fill + color transitions
- [ ] Vault trigger hook (`useVaultTrigger`) with long-press + keyboard shortcut
- [ ] Vault transition animation (blur → sweep → cross-fade)
- [ ] Vault file list with staggered slide-in
- [ ] Decrypt modal with fingerprint status animation
- [ ] Gold navbar dot with pulse animation
- [ ] Toast notification system
- [ ] All animations wrapped in `prefers-reduced-motion` check
- [ ] Fully responsive across mobile, tablet, desktop

---

*This brief is the single source of truth for the frontend visual direction. Any ambiguities should default to: darker, more refined, more cinematic. When in doubt, add 8px more padding and reduce the animation duration by 20%.*
