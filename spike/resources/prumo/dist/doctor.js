import { spawnSync } from 'node:child_process';
const NODE_FLOOR = [22, 17, 0];
export const systemProbe = {
    nodeVersion: process.versions.node,
    run: (command, args) => {
        const result = spawnSync(command, args, { encoding: 'utf8', timeout: 10_000 });
        return { ok: result.error === undefined && result.status === 0, stdout: result.stdout ?? '' };
    },
};
function atLeast(version, floor) {
    const parts = version.split('.').map(Number);
    for (const [index, minimum] of floor.entries()) {
        const part = parts[index] ?? 0;
        if (part !== minimum) {
            return part > minimum;
        }
    }
    return true;
}
function firstLine(text) {
    return text.trim().split('\n')[0] ?? '';
}
export async function doctor(probe = systemProbe) {
    const checks = [];
    checks.push({
        id: 'node',
        label: 'Node',
        required: true,
        ...(atLeast(probe.nodeVersion, NODE_FLOOR)
            ? { status: 'ok', detail: probe.nodeVersion }
            : { status: 'fail', detail: `${probe.nodeVersion}; 22.17.0 or later is required` }),
    });
    for (const [id, label, why] of [
        ['pnpm', 'pnpm', 'installs and runs every generated project'],
        ['git', 'git', 'every generated project starts as a repository'],
    ]) {
        const result = probe.run(id, ['--version']);
        checks.push({
            id,
            label,
            required: true,
            ...(result.ok
                ? { status: 'ok', detail: firstLine(result.stdout) }
                : { status: 'fail', detail: `not found; it ${why}` }),
        });
    }
    const docker = probe.run('docker', ['--version']);
    const dockerRunning = docker.ok && probe.run('docker', ['info']).ok;
    checks.push({
        id: 'docker',
        label: 'Docker',
        required: false,
        ...(dockerRunning
            ? { status: 'ok', detail: firstLine(docker.stdout) }
            : {
                status: 'warn',
                detail: docker.ok
                    ? 'installed but not running; open Docker Desktop. The API runs its database and tests in it'
                    : 'not found; install Docker Desktop. The API runs its database and tests in it',
            }),
    });
    return { ready: checks.every((check) => !check.required || check.status === 'ok'), checks };
}
const SYMBOL = { ok: '✓', warn: '!', fail: '✗' };
export function doctorText(report) {
    const width = Math.max(...report.checks.map((check) => check.label.length));
    const lines = report.checks.map((check) => `${SYMBOL[check.status]} ${check.label.padEnd(width)}  ${check.detail}`);
    lines.push('', report.ready ? 'Ready.' : 'Not ready: fix what is marked ✗ before generating a project.');
    return lines.join('\n');
}
