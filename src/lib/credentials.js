import { res } from "file-ez";
import fs from "fs";

function atob(string) {
    return Buffer.from(string, "utf-8").toString("base64");
}

function fileKey(site, email, password) {
    return res(`../../creds/${site}-${atob(email)}:${atob(password)}.json`);
}

export function loadCredentials(site, email, password) {
    const key = fileKey(site, email, password);
    if (!fs.existsSync(key)) return;

    const { data, time } = JSON.parse(fs.readFileSync(key, "utf-8"));

    if (Date.now() - time > 36_000_000) return;

    return data;
}

export function saveCredentials(site, email, password, data) {
    const key = fileKey(site, email, password);
    const dir = res("../../creds");

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }

    fs.writeFileSync(key, JSON.stringify({ data, time: Date.now() }));
}
