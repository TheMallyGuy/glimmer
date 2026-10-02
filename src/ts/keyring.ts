import { commands } from "./bindings";

/** secrets in the OS credential store (Windows Credential Manager). Secrets never touch config.json. */
export class Keyring {
    async set(key: string, secret: string): Promise<void> {
        const result = await commands.keyringSet(key, secret);
        if (result.status === "error") throw new Error(result.error);
    }

    /** the secret saved under `key`, or null when there is none */
    async get(key: string): Promise<string | null> {
        const result = await commands.keyringGet(key);
        if (result.status === "error") throw new Error(result.error);
        return result.data;
    }

    /** deleting a secret that is not there is fine */
    async delete(key: string): Promise<void> {
        const result = await commands.keyringDelete(key);
        if (result.status === "error") throw new Error(result.error);
    }
}
