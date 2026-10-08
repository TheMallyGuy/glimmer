export interface Flag {
  id: string;
  name: string;
  value: string;
}

export type FlagType =
  "Boolean" | "Integer" | "String" | "Log" | "Unknown prefix" | "Empty";

export function flagType(name: string): FlagType {
  if (!name.trim()) return "Empty";
  if (/^(D|S)?FFlag/.test(name)) return "Boolean";
  if (/^(D|S)?FInt/.test(name)) return "Integer";
  if (/^(D|S)?FString/.test(name)) return "String";
  if (/^(D|S)?FLog/.test(name)) return "Log";

  return "Unknown prefix";
}

export function newFlag(name = "", value = ""): Flag {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  return { id, name, value };
}

export function parseFlagsJson(text: string): Flag[] {
  // trimStart also drops the byte order mark Notepad can save, which JSON.parse refuses
  const data = JSON.parse(text.trimStart());

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error('Expected an object like { "FFlagName": "True" }.');
  }

  return Object.entries(data)
    .filter(([name]) => name.trim())
    .map(([name, value]) => newFlag(name.trim(), String(value)));
}

/**
 * puts incoming flags into `flags`: a name already there takes the new value, a new name is
 * added at the end. Says how many of each, for the import message
 */
export function mergeFlags(flags: Flag[], incoming: Flag[]) {
  let added = 0;
  let updated = 0;

  for (const f of incoming) {
    const existing = flags.find((x) => x.name.trim() === f.name.trim());
    if (existing) {
      existing.value = f.value;
      updated++;
    } else {
      flags.push(f);
      added++;
    }
  }

  return { added, updated };
}

export type FlagValueProblem = "notBoolean" | "notInteger";

/**
 * what is wrong with a value for the type its name says, or null. A blank value is left alone,
 * since it is usually still being typed
 */
export function flagValueProblem(
  name: string,
  value: string,
): FlagValueProblem | null {
  const v = value.trim();
  if (!v) return null;

  const type = flagType(name);
  if (type === "Boolean" && !/^(true|false)$/i.test(v)) return "notBoolean";
  if ((type === "Integer" || type === "Log") && !/^-?\d+$/.test(v)) {
    return "notInteger";
  }

  return null;
}

export function flagsToObject(flags: Flag[]): Record<string, string> {
  const out: Record<string, string> = {};

  for (const f of flags) if (f.name.trim()) out[f.name.trim()] = f.value;

  return out;
}

export function getFlagValue(flags: Flag[], name: string): string | undefined {
  return flags.find((f) => f.name === name)?.value;
}

export function setFlagValue(
  flags: Flag[],
  name: string,
  value: string | undefined,
) {
  const existing = flags.find((f) => f.name === name);

  if (value === undefined) {
    if (existing) flags.splice(flags.indexOf(existing), 1);
    return;
  }

  if (existing) existing.value = value;
  else flags.push(newFlag(name, value));
}
