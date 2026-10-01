import { open, save } from '@tauri-apps/plugin-dialog';
import { applyIconFont } from '$lib/mods.svelte';
import {
  buildFont,
  countEdits,
  findBuilderIcons,
  listGlyphs,
  saveFont,
  type FontEdits,
  type IconEdit,
  type IconGlyph,
  type SourceFont
} from '$ts/roblox/mod/fontEditor';

export const SOURCE_FAMILY = 'glimmer-icons-source';
export const PREVIEW_FAMILY = 'glimmer-icons-preview';
export const DEFAULT_COLOR = '#ffffff';

/** A status line: a `modsFontEditor` string key plus its values, so the view can translate it. */
interface Message {
  key: string;
  values?: Record<string, string>;
  error: boolean;
}

export const editor = $state({
  fonts: [] as SourceFont[],
  fontPath: '',
  glyphs: [] as IconGlyph[],
  status: 'loading' as 'loading' | 'ready' | 'empty' | 'error',
  query: '',
  /** glyph name of the icon shown in the inspector */
  selected: null as string | null,
  /** edits for every font, keyed by font path */
  edits: {} as Record<string, FontEdits>,
  /** last preview build per font path */
  previews: {} as Record<string, string>,
  showPreview: false,
  busy: '' as '' | 'preview' | 'mod' | 'ttf',
  message: null as Message | null
});

const baseName = (path: string) => path.split(/[\\/]/).pop() ?? path;

function say(key: string, error = false, values?: Record<string, string>) {
  editor.message = { key, values, error };
}

// ---------------------------------------------------------------- read helpers
export const currentSource = () => editor.fonts.find((f) => f.path === editor.fontPath);
export const currentEdits = (): FontEdits => editor.edits[editor.fontPath] ?? {};
export const editedTotal = () =>
  Object.values(editor.edits).reduce((n, e) => n + countEdits(e), 0);
export const selectedGlyph = () => editor.glyphs.find((g) => g.name === editor.selected);
export const selectedEdit = () => (editor.selected ? currentEdits()[editor.selected] : undefined);
export const fontFamily = () =>
  editor.showPreview && editor.previews[editor.fontPath] ? PREVIEW_FAMILY : SOURCE_FAMILY;

export function shownGlyphs() {
  const q = editor.query.trim().toLowerCase();
  return q ? editor.glyphs.filter((g) => g.name.toLowerCase().includes(q)) : editor.glyphs;
}

// ---------------------------------------------------------------- loading
async function loadFace(family: string, bytes: Uint8Array) {
  const face = new FontFace(family, bytes.slice().buffer);
  await face.load();
  for (const existing of document.fonts) {
    if (existing.family === family) document.fonts.delete(existing);
  }
  document.fonts.add(face);
}

export async function selectFont(path: string) {
  editor.fontPath = path;
  editor.showPreview = false;
  editor.selected = null;
  editor.status = 'loading';
  try {
    const { glyphs, bytes } = await listGlyphs(path);
    await loadFace(SOURCE_FAMILY, bytes);
    editor.glyphs = glyphs;
    editor.status = glyphs.length ? 'ready' : 'empty';
  } catch (err) {
    console.error(err);
    say('loadError', true, { error: String(err) });
    editor.status = 'error';
  }
}

export async function initEditor() {
  try {
    editor.fonts = await findBuilderIcons();
  } catch (err) {
    console.error(err);
    editor.fonts = [];
  }
  if (!editor.fonts.length) {
    editor.status = 'empty';
    return;
  }
  await selectFont(editor.fonts[0].path);
}

// ---------------------------------------------------------------- editing
function setEdit(name: string, edit: IconEdit | null) {
  const next = { ...currentEdits() };
  if (edit) next[name] = edit;
  else delete next[name];
  editor.edits[editor.fontPath] = next;
}

export function setColor(index: 0 | 1, value: string) {
  if (!editor.selected) return;
  const colors = [...(selectedEdit()?.colors ?? [DEFAULT_COLOR])];
  colors[index] = value;
  setEdit(editor.selected, { colors });
}

export function setGradient(on: boolean) {
  if (!editor.selected) return;
  const first = selectedEdit()?.colors?.[0] ?? DEFAULT_COLOR;
  setEdit(editor.selected, { colors: on ? [first, first] : [first] });
}

export async function pickArt() {
  if (!editor.selected) return;
  const path = await open({
    multiple: false,
    filters: [{ name: 'Artwork', extensions: ['svg', 'png'] }]
  });
  if (typeof path !== 'string') return;
  setEdit(editor.selected, {
    art: { kind: path.toLowerCase().endsWith('.png') ? 'png' : 'svg', path }
  });
}

export function resetSelected() {
  if (editor.selected) setEdit(editor.selected, null);
}

// ---------------------------------------------------------------- building
/** builds every font that has edits, or only the selected font for a preview */
async function build(onlySelected: boolean) {
  const targets = editor.fonts.filter(
    (f) => countEdits(editor.edits[f.path] ?? {}) > 0 && (!onlySelected || f.path === editor.fontPath)
  );
  const built: { font: SourceFont; path: string }[] = [];
  for (const font of targets) {
    built.push({ font, path: await buildFont(font, editor.edits[font.path]) });
  }
  return built;
}

async function run(kind: 'preview' | 'mod' | 'ttf', task: () => Promise<void>) {
  editor.busy = kind;
  try {
    await task();
  } catch (err) {
    console.error(err);
    say('buildError', true, { error: String(err) });
  } finally {
    editor.busy = '';
  }
}

export async function previewFont() {
  if (!countEdits(currentEdits())) return say('nothingToExport', true);
  say('previewing');
  await run('preview', async () => {
    const [built] = await build(true);
    const { bytes } = await listGlyphs(built.path);
    await loadFace(PREVIEW_FAMILY, bytes);
    editor.previews[editor.fontPath] = built.path;
    editor.showPreview = true;
    say('previewReady');
  });
}

export async function exportMod() {
  if (!editedTotal()) return say('nothingToExport', true);
  await run('mod', async () => {
    const built = await build(false);
    await applyIconFont(built.map((b) => ({ path: b.path, rel: b.font.rel })));
    say('modExported');
  });
}

export async function exportTtf() {
  const source = currentSource();
  if (!source || !countEdits(currentEdits())) return say('nothingToExport', true);
  const dest = await save({
    defaultPath: `BuilderIcons-${source.label}.ttf`,
    filters: [{ name: 'Font', extensions: ['ttf'] }]
  });
  if (!dest) return;
  await run('ttf', async () => {
    const [built] = await build(true);
    await saveFont(built.path, dest);
    say('fontExported', false, { file: baseName(dest) });
  });
}

export { baseName };
