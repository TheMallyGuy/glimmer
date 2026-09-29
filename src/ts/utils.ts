export function joinUrl(base: string, path: string) {
    return base.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
}

export function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
