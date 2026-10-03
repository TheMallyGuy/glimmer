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
  const data = JSON.parse(text);

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error('Expected an object like { "FFlagName": "True" }.');
  }

  return Object.entries(data).map(([name, value]) =>
    newFlag(name, String(value)),
  );
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
