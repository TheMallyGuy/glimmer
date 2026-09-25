import { newFlag, type Flag } from '$lib/flags';

// global state for everything

export const settings = $state({
  discord: true,
  join: true,
  fonts: false,
  sound: true,
  cursor: false,
  theme: true,
  compact: false,
  update: true,
  close: true,
  desktop: true,
  startmenu: true,
});

export const prefs = $state({
  lighting: 'Future',
  fps: 'unlimited',
  target: 'player',
  query: '',
});

export const fastFlags = $state({
  list: [
    newFlag('DFIntTaskSchedulerTargetFps', '144'),
    newFlag('FFlagDebugGraphicsPreferD3D11', 'True'),
  ] as Flag[],
});

export function save() {
  // TODO: persist settings, prefs and fastFlags.list
  console.log('save', $state.snapshot({ settings, prefs, flags: fastFlags.list }));
}

export function discard() {
  // TODO: reload the last saved values
  console.log('discard');
}

export function launch(target: string) {
  save();
  // TODO: invoke your Tauri launch command, e.g. invoke('launch', { target })
  console.log('launch', target);
}