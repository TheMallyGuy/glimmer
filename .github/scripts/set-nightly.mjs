import { readFileSync, writeFileSync } from "node:fs";

const build = process.argv[2];
if (!/^\d+$/.test(build ?? "")) throw new Error("Pass the build number as a whole number.");

const path = "src-tauri/tauri.conf.json";
const conf = JSON.parse(readFileSync(path, "utf8"));

conf.version = `${conf.version.split("-")[0]}-${build}`;
conf.plugins.updater.endpoints = conf.plugins.updater.endpoints.map(
  (url) => url.replace("channel=prod", "channel=nightly"),
);

writeFileSync(path, JSON.stringify(conf, null, 2) + "\n");
console.log(`nightly ${conf.version}`);
