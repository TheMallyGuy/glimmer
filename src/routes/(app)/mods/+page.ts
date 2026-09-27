import { redirect } from '@sveltejs/kit';
// TODO: save what pages did the user left off
export const load = () => redirect(307, '/mods/manage');