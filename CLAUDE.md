# Glimmer

Glimmer is a Roblox bootstrapper built with Tauri, SvelteKit (Svelte 5, runes only) and Tailwind CSS v4. Icons come from `@lucide/svelte`. The community mods page is inspired by Froststrap and Crush.

## Project layout

```
src/
├── app.css / routes/layout.css   @import 'tailwindcss' + lib/theme.css
│   ├── ts/
│   │   ├── mod/
│   |   │   ├── community.ts              Froststrap + Kliko library loader
│   ├── roblox/
│   │   ├── download.ts
├── lib/
│   ├── theme.css                 design tokens (@theme) and base styles
│   ├── utils.ts                  cn(): class joining with tailwind-merge
│   ├── components/               shared UI (see Components)
│   ├── settings.svelte.ts        shared settings state
│   ├── mods.svelte.ts            mods state and actions (TODOs = Tauri commands)
│   └── flags.ts                  Fast Flag helpers
└── routes/
    ├── +layout.svelte            window chrome: header, tab bar, footer
    ├── +page.ts                  redirects / to /mods
    ├── <section>/+page.svelte    one route per tab
    └── mods/                     +layout (view cards + banner), manage, prebuilt, community
```

## Design principles

- Minimal and dark. Keep each screen to the content and one clear action.
- Corners are 2px everywhere (`rounded-gl`). Never use larger radii or pill shapes.
- No outlines or borders around cards, rows or buttons. Separate areas with background shades and 2px gaps (`gap-0.5`).
- Sentence case for all text. No uppercase labels. The one exception is the "Inspired from Froststrap" banner, which is uppercase by design.
- Yellow (`accent`) is only for:
  - the one main action on a screen (e.g. Save and launch),
  - the selected state (tab underline, selected icon, checked switch, dropdown check),
  - notes and warnings.
- No emoji, gradient backgrounds, glows or decorative shadows. The only shadows are on floating menus and dialogs.
- Motion is only used to answer something the person did (a switch sliding, a hover). Always add `motion-reduce:transition-none`.

## Tokens (lib/theme.css)

| Use | Class | Value |
|---|---|---|
| Window background | `bg-canvas` | #0d0d0d |
| Header, tab bar | `bg-surface` | #111111 |
| Setting rows, cards | `bg-row` | #151515 |
| Inputs | `bg-field` | #161616 |
| Row or ghost hover | `bg-hover` | #1a1a1a |
| Secondary button | `bg-tonal` / `bg-tonal-hover` | #1f1f1f / #292929 |
| Menus | `bg-menu` / `bg-menu-active` | #1c1c1c / #262626 |
| Switch off, disabled fill | `bg-track` | #2a2a2a |
| Footer | `bg-footer` | #0b0b0b |
| Text | `text-fg` / `text-fg-2` / `text-fg-3` | #f2f2f2 / #b4b4b4 / #a8a8a8 |
| Secondary text | `text-muted` | #8f8f8f |
| Placeholders, hints | `text-subtle` | #7c7c7c |
| Disabled text | `text-off` | #6b6b6b |
| Accent | `bg-accent` `text-accent` (+ `-hover`, `-press`) | #ffe54e |
| Text on accent | `text-on-accent` | #0d0d0d |
| Danger | `text-danger` / `bg-danger-bg` | #ff8f80 / #2a1a1a |

Never hard-code a hex value when a token exists. Add new colours to `theme.css` first.

## Type

- `font-display` (Cal Sans): page titles, tab labels, primary buttons, card titles, dialog titles. Cal Sans has one weight, so always pair it with `font-normal`, and use `tracking-[0.01em]`.
- `font-sans` (Geist): all body text, descriptions and secondary buttons.
- `font-mono` (Geist Mono): Fast Flag names and values, log timestamps.

Sizes:

| Element | Style |
|---|---|
| Page title | `text-[32px]` |
| Dialog title | `text-[22px]` |
| Row title | `text-[15px] font-medium` |
| Descriptions, labels | `text-[13px] text-muted` |
| Small meta | `text-xs` |

## Sizes and spacing

- Main content area padding: `px-8 py-7`.
- Page title, then the blurb (`text-sm text-muted max-w-[520px] mb-7`), then the content.
- Setting row: `px-[18px] py-4`, stacked with `gap-0.5`.
- Control heights:

  | Control | Height |
  |---|---|
  | Small button, dropdown in a row | 36px (`h-9`) |
  | Inputs, search, toolbar buttons | 40px (`h-10`) |
  | Standard buttons | 44px (`h-11`) |
  | Tabs | 48px (`h-12`) |

- Click targets must be at least 36px. Window buttons are 44px.

## Components (lib/components)

Use these instead of writing new markup for the same job.

| Component | Use for |
|---|---|
| `Button` | Actions. Variants: `primary` (yellow, one per screen), `secondary` (tonal), `ghost` (text only: Cancel, Discard), `danger` (destructive). Sizes: `sm` / `md` / `lg`. `arrow` adds a trailing arrow for launch actions. |
| `IconButton` | Icon-only actions. `label` is required (it becomes `aria-label` and the tooltip). |
| `SplitButton` | Save and launch with a Player/Studio target menu. |
| `Switch` | On/off settings. Always pass `label`. |
| `TabBar` | Top-level sections. Lucide icon plus label, with a yellow underline and icon on the selected tab. |
| `Dropdown` | Choosing one value from a short list. |
| `SearchField` | Search and filter inputs. |
| `TextField` | Labelled text input with `error` and `hint`. |
| `SettingRow` | Title, description, optional yellow `note`, and a control passed as the `control` snippet. Pass `href` to make it a link row. |
| `SettingGroup` | Stack of rows with an optional sentence-case label. |
| `Dialog` | Confirmations and small forms. Uses native `<dialog>`. Buttons go in the `actions` snippet: ghost Cancel first, then the action. |
| `FlagTable` | Fast Flag editor. |
| `InspiredBanner` | Froststrap credit at the bottom of the Mods pages. |

## Writing Svelte here

- **Svelte 5 runes only:** `$props`, `$state`, `$derived`, `$effect`, `$bindable`, `$props.id()`.
  - No `export let`, no `$:`, no `<slot>`. Use snippets and `{@render}`.
  - Layouts render `{@render children()}`. Only `+layout.svelte` files get `children`.
- **Styling:**
  - Tailwind classes only, no `<style>` blocks.
  - Use `cn()` whenever a component accepts a `class` prop, so the caller's classes override the defaults.
  - For complex grid templates, use an inline `style="grid-template-columns: …"`. Arbitrary `grid-cols-[repeat(...)]` classes didn't get generated in this project.
- **Shared state:** lives in `lib/*.svelte.ts` as exported `$state` objects. Mutate their properties; never reassign the export.
- **Imports:** get components from `$lib`, and icons from `@lucide/svelte` at `strokeWidth={1.75}` (16px in buttons and tabs, 18px in rows).
- **Tauri:**
  - Window dragging uses `data-tauri-drag-region` on the header row and its spacer, not on an empty div.
  - Disk and process work goes through Tauri commands. Leave a `// TODO:` naming the command rather than faking it silently.

## Accessibility (required)

- Use real `<button>`, `<a href>`, `<input>` + `<label>` elements. Never put a click handler on a div.
- Icon-only buttons need a label. Switches need `label`, or a visible label that points at them.
- The yellow focus ring comes from `theme.css`. Don't remove outlines without replacing them.
- Tabs, dropdowns and menus support arrow keys, Home/End, Enter and Escape. Keep that working when you change them.
- Text contrast must be at least 4.5:1. `text-muted` on `bg-row` is the lowest allowed pairing for body text.
- Pair drag-to-reorder with a keyboard option (the handle plus arrow keys) and announce the change in a live region.

## Copy

- Plain verbs and sentence case. Buttons say what happens: "Save and launch", "Delete mod", "Install".
- An action keeps the same name through the whole flow: Install, then Installing…, then Installed.
- Errors say what went wrong and how to fix it. They don't apologise.
- Empty states tell the person what to do next and offer the button to do it.
- Use placeholders like `[version hash]` for real data we don't have yet. Never invent numbers.

## Don'ts

- No borders or outlines as decoration, no rounded-lg or pills, no uppercase headings.
- No second yellow button on a screen.
- No new colours, fonts or radii outside `theme.css`.
- No emoji or decorative gradients (Froststrap's own thumbnail gradients are data, which is fine).
- Don't warp or restyle the Glimmer or Froststrap logos. Use `glimmer-logo.svg` and `static/froststrap.png` as they are.

## Before finishing a change

1. It uses tokens and existing components.
2. It works with the keyboard, and the focus ring is visible.
3. It has no `<style>` blocks and no Svelte 4 syntax.
4. `bun run check` passes.