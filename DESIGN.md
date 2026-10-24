# Glimmer design

Shared design rules for the Glimmer app (`super duper duper long name`) and the Glimmer website (`gmLink`). Forked from the app's `AGENTS.md`. The real file lives in the app repo; `gmLink/DESIGN.md` is a symlink to it, so edit it once and both see the change.

Where the two differ, the rule says which one it covers.

## Principles

- Minimal and dark. Keep each screen to the content and one clear action.
- One solid colour on black. Every mark, shape and highlight is a flat fill: no gradients, chrome, metal, bevels, glows or textures.
- Corners are 2px everywhere (`rounded-gl`). Never use larger radii or pill shapes.
- No outlines or borders around cards, rows or buttons. Separate areas with background shades and 2px gaps (`gap-0.5`).
- Sentence case for all text. No uppercase labels. The one exception is the app's "Inspired from Froststrap" banner, which is uppercase by design.
- `accent` is only for:
  - the one main action on a screen (e.g. Save and launch, Get, Join),
  - the selected state (tab underline, selected icon, checked switch, dropdown check),
  - notes and warnings.
- No emoji in the UI. No decorative shadows: the only shadows are on floating menus and dialogs.
- Website only: the faint white `Aurora` band and the floating `Shapes` are the two allowed decorations. Both are a single flat colour.

## Logo

- The mark is `logo.svg` (the two arcs and the sparkle). Draw it inline so it takes `currentColor`; never as an `<img>`.
  - Website: `GlimmerMark` component.
  - App: `GlimmerLogo` component (the wordmark from `glimmer-logo.svg`, mark follows the accent).
- Don't warp, recolour per part, outline or add effects to the mark. One flat colour, as it is.
- App icon reference: `Frame 47.svg` (white mark and shapes on a black rounded square).

## Shapes

- Shapes come from the `glms metal` sheet (`shapes.svg`). Stick to the sparkle and star family that matches the mark: 4-point sparkles, thin glints, 8-point stars, bursts, the gear, simple flowers.
- Flat `currentColor` fill, same colour as the text. No opacity tints, no shadows.
- They sit behind content (`-z-10`, `pointer-events-none`, `aria-hidden`), in the corners and margins, never behind text you need to read.
- Website: `Shapes` component with entries from `src/lib/shapes.ts`. To add a shape, copy its cell from the sheet into `SHAPES` with its 200x200 `box`.

## Motion

- Short (under 300ms), ease-out, and never blocks anything: entrances, the sliding tab underline, press feedback and hovers.
- Use the tokens in `theme.css` (`animate-fade-in`, `animate-fade-up`, `animate-pop-in`). App: Svelte transitions go through `motionMs()` from `$lib/motion`.
- Nothing loops, except: the app's launch progress and `[danger]` shimmer text; the website's `Aurora` sway and `Shapes` drift.
- Always add `motion-reduce:transition-none`. `theme.css` also finishes every animation at once when the system asks for less motion.
- `ease-out` for things that enter or leave, `ease-in-out` for things already on screen that move, never `ease-in`. Animate `transform` and `opacity`, not `width` or `left`.
- What opens many times a day or from a held key (context menus, the overlay) shows at once, with no entrance.

## Tokens (theme.css)

Each project has its own `src/lib/theme.css`. Keep the shared values below the same in both.

| Use                       | Class                                            | Value                       |
| ------------------------- | ------------------------------------------------ | --------------------------- |
| Window background         | `bg-canvas`                                      | #0d0d0d                     |
| Header, tab bar           | `bg-surface`                                     | #111111                     |
| Setting rows, cards       | `bg-row`                                         | #151515                     |
| Inputs                    | `bg-field`                                       | #161616                     |
| Row or ghost hover        | `bg-hover`                                       | #1a1a1a                     |
| Secondary button          | `bg-tonal` / `bg-tonal-hover`                    | #1f1f1f / #292929           |
| Menus                     | `bg-menu` / `bg-menu-active`                     | #1c1c1c / #262626           |
| Switch off, disabled fill | `bg-track`                                       | #2a2a2a                     |
| Footer                    | `bg-footer`                                      | #0b0b0b                     |
| Text                      | `text-fg` / `text-fg-2` / `text-fg-3`            | #f2f2f2 / #b4b4b4 / #a8a8a8 |
| Secondary text            | `text-muted`                                     | #8f8f8f                     |
| Placeholders, hints       | `text-subtle`                                    | #7c7c7c                     |
| Disabled text             | `text-off`                                       | #6b6b6b                     |
| Accent                    | `bg-accent` `text-accent` (+ `-hover`, `-press`) | see below                   |
| Text on accent            | `text-on-accent`                                 | #0d0d0d                     |
| Danger                    | `text-danger` / `bg-danger-bg`                   | #ff8f80 / #2a1a1a           |

Accent:

- Website: `#ffffff` (hover `#e6e6e6`, press `#cccccc`).
- App: default `#ffe54e`, and user-themable through `AccentTheme` (`src/ts/theme.ts`). Always use the tokens, never a fixed colour, so a custom accent reaches everything. A custom accent has to be readable as text on the canvas (4.5:1).

Never hard-code a hex value when a token exists. Add new colours to `theme.css` first.

## Type

- `font-display` (Cal Sans): page titles, tab labels, primary buttons, card titles, dialog titles. One weight only, so always `font-normal` with `tracking-[0.01em]`.
- `font-sans` (Geist): body text, descriptions, secondary buttons.
- `font-mono` (Geist Mono): Fast Flag names and values, log timestamps, list numbers.

| Element              | Style                     |
| -------------------- | ------------------------- |
| Page title           | `text-[32px]`             |
| Dialog title         | `text-[22px]`             |
| Row title            | `text-[15px] font-medium` |
| Descriptions, labels | `text-[13px] text-muted`  |
| Small meta           | `text-xs`                 |

## Sizes and spacing

- Setting row: `px-[18px] py-4`, stacked with `gap-0.5`.
- Control heights: small button or dropdown in a row 36px (`h-9`); inputs, search, toolbar buttons 40px (`h-10`); standard buttons 44px (`h-11`); tabs 48px (`h-12`).
- Click targets are at least 36px.

## Shared components

Both projects have these in `src/lib/components`. Use them instead of new markup for the same job.

| Component      | Use for                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------ |
| `Button`       | Actions. `primary` (accent, one per screen), `secondary`, `ghost`, `danger`. `arrow` for launch. |
| `IconButton`   | Icon-only actions. `label` is required.                                                          |
| `Switch`       | On/off settings. Always pass `label`.                                                            |
| `TabBar`       | Top-level sections, accent underline on the selected tab.                                        |
| `Dropdown`     | One value from a short list.                                                                     |
| `SearchField`  | Search and filter inputs.                                                                        |
| `TextField`    | Labelled text input with `error` and `hint`.                                                     |
| `SettingRow`   | Title, description, optional `note`, and a `control` snippet.                                    |
| `SettingGroup` | Stack of rows with an optional sentence-case label.                                              |
| `Dialog`       | Confirmations and small forms. Native `<dialog>`; ghost Cancel first, then the action.           |
| `Menu`         | Context and popup menus, with arrow keys and focus return.                                       |
| `ToastHost`    | Bottom-left toasts for the result of an action.                                                  |

When a component changes in one project, make the same change in the other.

## Accessibility (required)

- Use real `<button>`, `<a href>`, `<input>` + `<label>` elements. Never put a click handler on a div.
- Icon-only buttons need a label. Switches need `label`, or a visible label that points at them.
- The focus ring comes from `theme.css` (2px `accent` outline). Don't remove outlines without replacing them.
- Tabs, dropdowns and menus support arrow keys, Home/End, Enter and Escape.
- Text contrast is at least 4.5:1. `text-muted` on `bg-row` is the lowest allowed pairing for body text.
- Decoration (`Shapes`, `Aurora`, logo copies next to a labelled heading) is `aria-hidden`.

## Copy

- Plain verbs and sentence case. Buttons say what happens: "Save and launch", "Delete mod", "Get".
- An action keeps the same name through the whole flow: Install, then Installing…, then Installed.
- Errors say what went wrong and how to fix it. They don't apologise.
- Empty states tell the person what to do next and offer the button to do it.
- Never invent numbers. Use placeholders like `[version hash]` for real data we don't have yet.

## Don'ts

- No gradients, chrome or metallic fills, glows or textures on marks, shapes, text or buttons.
- No borders or outlines as decoration, no `rounded-lg` or pills, no uppercase headings.
- No second accent button on a screen.
- No new colours, fonts or radii outside `theme.css`.
- No `<style>` blocks. Tailwind classes only, with `cn()` when a component takes `class`.
