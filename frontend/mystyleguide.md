# Election Monitor — Style Guide

What's actually in the codebase today, not an aspirational spec. Every value here is pulled directly from `globals.css`, `layout.tsx`, and the component library in `src/components/ui/`.

## Philosophy

Two distinct surfaces, one shared visual language:

- **Admin dashboard** (`/dashboard`, `/agents`, `/collation`, `/polling-units`, ...) — dense, data-table-driven, built for someone scanning a lot of information quickly on a laptop.
- **Field agent app** (`/field/*`) — mobile-first, card-based, large touch targets, built for someone on a phone, often one-handed, sometimes outdoors, sometimes offline.

Both share the same tokens (color, type, radius, spacing) so the product reads as one system, but the field app leans into bigger tap targets, bottom-tab navigation, and simpler single-column layouts, while the dashboard leans into tables, filters, and side sheets.

Underlying stack: **shadcn/ui components on top of Base UI primitives** (`@base-ui/react`, not Radix), styled with **Tailwind v4** (CSS-first config via `@theme inline`, not a `tailwind.config.js`), variants managed with **class-variance-authority (CVA)**.

## Typography

Three typefaces, each wired to a specific CSS variable that Tailwind's theme reads directly:

| Role | Font | Variable | Utility class | Weights loaded |
|---|---|---|---|---|
| Body / UI text | **Plus Jakarta Sans** | `--font-sans` | `font-sans` (the `html` default) | 400, 500, 600, 700, 800 |
| Headings | **Space Grotesk** | `--font-heading` | `font-heading` | 500, 600, 700 |
| Code / monospace | **Geist Mono** | `--font-geist-mono` | `font-mono` | variable |

Loaded via `next/font/google` in `app/layout.tsx` — no external font requests, no FOUT.

**Usage pattern**: every page/card heading is `font-heading font-bold tracking-tight`, body copy is the default sans (no class needed), and anything referencing a code/id/hash value (usernames, PU codes, fingerprints) gets `font-mono` at a small size (`text-xs`).

**Scale in practice** (Tailwind defaults, no custom scale):
- Page titles: `text-2xl font-bold`
- Card/section titles: `text-lg font-bold`
- Body: `text-sm`
- Secondary/meta text: `text-xs text-muted-foreground`
- Micro labels (badges, timestamps): `text-[11px]` / `text-[10px]`

## Color

### Base tokens

Defined as `oklch()` values in `globals.css`, swapped wholesale between `:root` and `.dark`. These are the shadcn "neutral" base — background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring — plus a 5-step `--chart-*` ramp and a separate `--sidebar-*` set. Dark mode is a `.dark` class on `<html>`, toggled by `next-themes`; `@custom-variant dark (&:is(.dark *))` is how Tailwind's `dark:` variant hooks into it.

In practice, **most of the app doesn't reach for these raw tokens directly** — it reaches for explicit Tailwind slate/color-scale utilities instead (see below), which gives more predictable control than the abstract `primary`/`accent` tokens. The tokens mainly drive the shadcn primitive components themselves (Dialog, Select, Button's `default`/`outline`/`ghost` variants, etc.).

### Semantic colors (the ones that actually carry meaning)

This is the real palette — a fixed, consistent mapping used everywhere, light and dark:

| Meaning | Color | Typical pairing |
|---|---|---|
| **Brand / primary action** | Indigo | `bg-indigo-600 text-white hover:bg-indigo-500` (buttons), `text-indigo-600 dark:text-indigo-400` (links/accents) |
| **Success / active / voting** | Emerald | `bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300` |
| **Warning / offline / pending / not-started** | Amber | `bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300` |
| **Danger / distress / critical / destructive** | Red | `bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300`; destructive buttons use `text-red-500 hover:bg-red-50` |
| **Info** | Blue | `text-blue-500`, used sparingly (e.g. "voting in progress" icon tone) |
| **Neutral surfaces / borders / muted text** | Slate | `bg-white dark:bg-slate-900`, `border-slate-200 dark:border-slate-800`, `text-slate-500 dark:text-slate-400` |

The pattern for a status pill is always the same four-part formula: `bg-{color}-100 text-{color}-700 dark:bg-{color}-950-or-500/15 dark:text-{color}-300`. Never a raw hex, never an inline style, except for chart color assignment (below) where a design-token indigo/slate isn't precise enough for categorical identity.

Theme color (browser chrome / PWA): `#4f46e5` (indigo-600), set via `viewport.themeColor` in `layout.tsx`.

### Data visualization palette

A separate, deliberately validated palette lives in `src/components/dashboard/charts/palette.ts`, built for the specific job of a chart (not a badge):

- **`CATEGORICAL_SLOTS`** — 8 fixed hues (blue, orange, aqua, yellow, magenta, green, violet, red), each with a light/dark pair, assigned to series **alphabetically by name, never by current rank** — so a party's color never changes when the data reorders.
- **`SEQUENTIAL`** — a single blue hue for magnitude comparisons (e.g. reporting completion).
- **`CHART_INK`** — primary/secondary/muted/gridline text colors, kept separate from the categorical hues so labels never compete with series color.
- **`assignCandidateColors(names)`** — the helper every chart calls to get this stable, colorblind-aware mapping instead of hand-picking colors per chart.

This palette follows the project's `dataviz` skill: color is the *last* decision in building a chart, chosen by the data's job (categorical/sequential/diverging/status), never eyeballed.

## Shape & spacing

Radius is a single CSS variable (`--radius: 0.625rem`) that every other radius step derives from (`--radius-sm` through `--radius-4xl`, each a multiple of the base). In component classnames this shows up as plain Tailwind radius utilities:

| Utility | Used for |
|---|---|
| `rounded-full` | Avatars, status pills/badges, icon buttons in a circular treatment |
| `rounded-xl` | Inputs, buttons, small interactive controls, list-item cards |
| `rounded-2xl` | Cards, dialogs, page-level containers (the dominant "card" radius) |
| `rounded-lg` / `rounded-md` | Base UI primitives' own internal radius (Button, Select trigger) |

Spacing is plain Tailwind scale, no custom values: card padding is `p-3` to `p-5` depending on density, vertical rhythm inside a card is `space-y-2` to `space-y-4`, flex gaps are `gap-1.5` to `gap-3`. Page-level containers are `space-y-4 p-6` (dashboard) or a single `space-y-5` column (field app, no side padding since `FieldShell` already provides it).

## Components

Built as thin, styled wrappers over Base UI primitives (`@base-ui/react/*`) using CVA for variants — the same shape as shadcn/ui, just on Base UI instead of Radix. Key ones:

- **Button** (`variant`: `default` | `outline` | `secondary` | `ghost` | `destructive` | `link`; `size`: `xs` | `sm` | `default` | `lg` | `icon*`) — `destructive` is a *tinted* red (`bg-destructive/10 text-destructive`), not a solid red fill; primary actions almost always override to explicit `bg-indigo-600 text-white hover:bg-indigo-500` rather than the default token-driven `bg-primary` (which resolves to near-black/white, used for lower-emphasis default buttons).
- **Card** — `rounded-2xl border-slate-200/70 dark:border-slate-800`, `CardContent` typically `p-0` when it wraps a `Table` (table supplies its own cell padding) or `p-4`/`py-4` otherwise.
- **Dialog** — default `sm:max-w-sm`, explicitly widened (`sm:max-w-lg`) for forms with more than 2-3 fields. Not dismissable by backdrop click when the content is a hard gate (e.g. `SessionExpiredDialog` uses `disablePointerDismissal`).
- **Badge / status pill** — always the four-part semantic-color formula above, `rounded-full px-2 py-0.5 text-[11px] font-medium/semibold`.
- **Sheet** — right-side slide-over for "detail" views launched from a table row (agent detail, PU detail), `w-full sm:max-w-xl`.
- **Toast** — `sonner`, mounted once in the root layout with `richColors position="top-center"`. Four intents map to the four semantic colors: `toast.success` (emerald), `toast.error` (red), `toast.info` (blue), `toast.warning`/plain (amber-ish neutral). Offline-queue toasts specifically use `.info` for "saved, will send automatically" and `.error` (deliberately, longer duration) for anything urgent like a distress alert that hasn't actually gone out yet.

## Iconography

**lucide-react**, exclusively — no other icon set anywhere in the app. Sized to match the surrounding text: `h-3 w-3` / `h-3.5 w-3.5` next to `text-xs`/`text-[11px]` micro-copy, `h-4 w-4` at normal body/button scale, `h-5 w-5`+ for a card's leading "icon chip" (e.g. the colored rounded-square icon next to a section title).

## Motion & interaction

Deliberately restrained — nothing bounces or slides gratuitously:

- `transition-colors` on anything with a hover background change (buttons, list rows).
- `transition-all` + `hover:-translate-y-0.5 hover:shadow-md` on clickable cards in a grid (e.g. incident/result submission cards) — a subtle lift, not a full animation.
- `active:translate-y-px` on buttons (from the base `Button` component) for a pressed-state micro-interaction.
- Animated-ping "live" indicators (`animate-ping` + a solid dot) for real-time state: "moving now" on an agent's location, the recording indicator, the distress-alert pulse.
- Loading state is always a `Loader2` icon with `animate-spin`, never a custom spinner.

## "Modern UI" conventions this app follows

- **Soft elevation, not hard shadows** — `shadow-sm` is the ceiling for most surfaces; `shadow-md` only appears as a *hover* state, never at rest.
- **Borders over heavy shadows for separation** — `border-slate-200/70 dark:border-slate-800` does most of the "this is a distinct surface" work; shadow is a secondary cue.
- **Full dark-mode parity, not an afterthought** — every semantic color, every border, every surface has a `dark:` pair defined alongside it in the same class string, not in a separate stylesheet.
- **Optimistic, explained UI over spinners-and-silence** — status changes (check-in, distress, offline queueing) update local state immediately and tell the user what's happening in plain language ("No connection — saved on this device and will send automatically once you're back online") rather than a bare loading spinner with no explanation.
- **Real touch targets on mobile surfaces** — field-app interactive elements target a `min-h-9` (36px) floor after touch-target issues surfaced during testing; icon-only buttons use the `icon-sm`/`icon` button sizes (28-32px) rather than shrinking to the icon's own bounding box.
- **Plain-language over domain jargon** — e.g. the PU voting-status picker asks "What's happened at your polling unit?" with options like "Voting is happening now" rather than exposing the raw `not_open` / `voting` / `completed` enum values to the person using it.
- **Semantic color is load-bearing, not decorative** — status pills, sync-queue banners, and severity badges all use the same fixed color-to-meaning mapping everywhere, so color alone is a reliable, learnable signal across the whole app.
