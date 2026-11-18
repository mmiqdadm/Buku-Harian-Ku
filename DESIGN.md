# DESIGN.md - Buku Harian Ku

## Identity & Audience
- **Product**: Buku Harian Ku, a web-based daily journaling app for children aged 6 to 10 years old (starting with Umar and Utsman, expandable for siblings) and readable/exportable by parents on a laptop.
- **Primary Devices**: Landscape tablet with wireless keyboard, and laptop web browser.
- **Personality**: Warm, tactile, calm, encouraging, and timeless like a real cream-paper diary notebook. Not noisy, not cluttered, and free of generic SaaS or AI tropes.

## Design Read & Dials
Reading this as: child-friendly daily journal web app for kids aged 6 to 10 (and parents reviewing on laptop), in a classic cream-paper notebook visual language, dial **ENERGY 2 / RHYTHM 2 / MOTION 1**.

- **ENERGY 2 (Balanced)**: Warm notebook craft with clear focal actions, never bland and never hyperactive.
- **RHYTHM 2 (Consistent with intentional breaks)**: Calm left navigation rail paired with a distinct stitched-spine lined writing sheet on the right, and a horizontal card strip for account selection.
- **MOTION 1 (Purposeful transitions & hover states only)**: Tactile button presses, smooth dialog open/close, and calm card shuffle feedback. No endless pulsing or floating animations.

## Color Palette (WCAG AA Verified)
Capped at 2 core colors + 1 deliberate accent + warm paper neutrals:
- **Canvas Background**: `#F6EFE2` (warm cream desk)
- **Paper Surface**: `#FFFDF8` (ivory notebook page)
- **Binding / Sidebar Surface**: `#F0E6D2` (warm parchment rail)
- **Primary Ink**: `#2C221C` (deep espresso; 15.27:1 on `#FFFDF8`, 12.53:1 on `#F0E6D2`)
- **Secondary Ink**: `#5F5147` (muted walnut; 7.50:1 on `#FFFDF8`, 6.67:1 on `#F6EFE2`, 6.16:1 on `#F0E6D2`)
- **Border / Paper Rule**: `#D9CCB8` (soft parchment border) and `#8E7D68` (interactive input borders for crisp non-text contrast)
- **Core Color 1 (Primary Action & Active Folder)**: `#2B6A58` (sage leaf green; `#FFFFFF` text ratio 6.35:1, on `#FFFDF8` ratio 6.25:1)
- **Deliberate Accent (Hint & Today's Action)**: `#B34423` (warm terracotta; `#FFFFFF` text ratio 5.57:1, on `#FFFDF8` ratio 5.48:1, on `#F6EFE2` ratio 4.87:1)
- **Danger Action (Delete Confirmation)**: `#9E2A2B` (`#FFFFFF` text ratio 7.45:1)

## Typography
- **Display / Headings**: `Fraunces` (warm storybook serif with soft terminals, fallback `Georgia, serif`) for diary titles, child names, and entry headings.
- **Body / Writing / UI**: `Nunito` (rounded humanist sans-serif with open letterforms ideal for early readers aged 6 to 10, fallback `"Segoe UI", sans-serif`).
- Minimum readable UI text: `13px` to `14px`; diary writing body: `17px` to `18px` with `32px` line height aligned to subtle horizontal paper lines.

## Layout & Key Decisions (R-31 Reasons)
1. **Horizontal Profile Picker**: Allows easy side-by-side browsing of Umar, Utsman, and additional siblings in landscape view without vertical scrolling or cramped grids.
2. **Google Keep-style Left Sidebar + Right Focused Area**: Keeps monthly folders, search, account switching, sync status, and Word export always one click away on the left while dedicating the entire right pane to reading or distraction-free writing.
3. **Stitched Notebook Spine & Lined Writing Sheet**: Anchors the visual identity so the app unmistakably belongs to a children's diary rather than a generic note tool.
4. **Bottom "Simpan" Button**: Placed at the bottom of the writing sheet so children naturally finish typing, attach photos or voice notes, and press "Simpan" at the end of their flow.
5. **Custom Storybook SVG Icons**: Medium-stroke custom SVGs (`Icons.tsx`) instead of generic thin icon packs or decorative emojis.
6. **Zero Em Dashes & Honest Copy**: Natural, warm Indonesian copy tailored to children and parents with clear empty, loading, offline, and error states.
