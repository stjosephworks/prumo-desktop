export class CliError extends Error {
    code;
    data;
    constructor(code, message, data) {
        super(message);
        this.code = code;
        this.data = data;
    }
}
export function errorEnvelope(command, error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = error instanceof CliError ? error.code : isParseArgsError(error) ? 'usage' : 'failed';
    const data = error instanceof CliError ? error.data : undefined;
    return data === undefined
        ? { ok: false, command, error: { code, message } }
        : { ok: false, command, error: { code, message }, data };
}
function isParseArgsError(error) {
    const code = error?.code;
    return typeof code === 'string' && code.startsWith('ERR_PARSE_ARGS_');
}
export function writeEnvelope(envelope) {
    process.stdout.write(`${JSON.stringify(envelope)}\n`);
}
