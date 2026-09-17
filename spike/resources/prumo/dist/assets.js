import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
// Decided by where the CLI runs from, never by what exists on disk: after a build, `cli/templates` is a stale copy
// sitting right beside the source, and probing for it first made the source CLI generate from yesterday's templates.
export function assetsFor(here) {
    const root = basename(here) === 'dist' ? join(here, '..') : join(here, '..', '..');
    return { templates: join(root, 'templates'), knowledge: join(root, '.prumo-templates') };
}
export function requireAssets(assets) {
    for (const path of Object.values(assets)) {
        if (!existsSync(path)) {
            throw new Error(`Cannot find ${path}`);
        }
    }
    return assets;
}
