import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { CliError } from "./output.js";
const SCRIPT = join('scripts', 'database.mjs');
export function findProjectRoot(from) {
    let directory = resolve(from);
    while (!existsSync(join(directory, '.prumo', 'config.json'))) {
        if (dirname(directory) === directory) {
            throw new CliError('not_a_project', 'Not inside a Prumo project: no .prumo/config.json here or above.');
        }
        directory = dirname(directory);
    }
    return directory;
}
export function readConfig(root) {
    return JSON.parse(readFileSync(join(root, '.prumo', 'config.json'), 'utf8'));
}
// Where the API sits, or undefined when the project has none.
export function apiPath(root) {
    const config = readConfig(root);
    if (!config.types.includes('api')) {
        return undefined;
    }
    return config.architecture === 'alone' ? root : join(root, 'apps', 'api');
}
export function apiDirectory(root) {
    const api = apiPath(root);
    if (api === undefined) {
        throw new CliError('no_api', 'This project has no api, so it has no database to create.');
    }
    if (!existsSync(join(api, SCRIPT))) {
        throw new CliError('script_missing', `${join(api, SCRIPT)} does not exist; the project predates \`prumo db\` or was cleaned.`);
    }
    return api;
}
// The logic lives in the project, so it runs without Prumo installed; this command only finds it and runs it.
// The script answers --json itself, so its stdout is passed through untouched.
export function runDatabase(args, cwd) {
    const api = apiDirectory(findProjectRoot(cwd));
    const result = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: api, stdio: 'inherit' });
    if (result.error !== undefined) {
        throw result.error;
    }
    return result.status ?? 1;
}
