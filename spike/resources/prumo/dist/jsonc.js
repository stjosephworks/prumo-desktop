import { applyEdits, findNodeAtLocation, modify, parse, parseTree, } from 'jsonc-parser';
const FORMAT = { formattingOptions: { insertSpaces: true, tabSize: 2 } };
function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function pathsEqualTo(target, base, path) {
    if (!isObject(target) || !isObject(base)) {
        return JSON.stringify(target) === JSON.stringify(base) ? [path] : [];
    }
    return Object.keys(target).flatMap((key) => key in base ? pathsEqualTo(target[key], base[key], [...path, key]) : []);
}
function emptyObjectPath(value, path) {
    if (!isObject(value)) {
        return undefined;
    }
    for (const [key, child] of Object.entries(value)) {
        const found = emptyObjectPath(child, [...path, key]);
        if (found !== undefined) {
            return found;
        }
    }
    return Object.keys(value).length === 0 && path.length > 0 ? path : undefined;
}
// jsonc-parser's own removal also deletes the comment written above the next property, which here is the
// one-line reason a rule change must carry. So a property is cut out by its offsets, and nothing after it moves.
function removeProperty(text, path) {
    const value = findNodeAtLocation(parseTree(text), path);
    const property = value?.parent;
    if (property === undefined) {
        return text;
    }
    let start = property.offset;
    let end = property.offset + property.length;
    const after = text.slice(end).match(/^\s*,/);
    if (after !== null) {
        end += after[0].length;
    }
    else {
        const before = text.slice(0, start).match(/,\s*$/);
        if (before !== null) {
            start -= before[0].length;
        }
    }
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    if (text.slice(lineStart, start).trim() === '') {
        start = lineStart;
        const lineEnd = text.indexOf('\n', end);
        if (lineEnd !== -1 && text.slice(end, lineEnd).trim() === '') {
            end = lineEnd + 1;
        }
    }
    return text.slice(0, start) + text.slice(end);
}
export function readJsonc(text) {
    return parse(text);
}
export function setJsonc(text, path, value) {
    return value === undefined
        ? removeProperty(text, path)
        : applyEdits(text, modify(text, path, value, FORMAT));
}
export function prependProperty(text, key, value) {
    const open = text.indexOf('{');
    return `${text.slice(0, open + 1)}\n  ${JSON.stringify(key)}: ${JSON.stringify(value)},${text.slice(open + 1)}`;
}
export function removeWhatBaseDeclares(text, baseText) {
    let result = text;
    for (const path of pathsEqualTo(parse(text), parse(baseText), [])) {
        result = removeProperty(result, path);
    }
    for (let empty = emptyObjectPath(parse(result), []); empty !== undefined;) {
        result = removeProperty(result, empty);
        empty = emptyObjectPath(parse(result), []);
    }
    return result;
}
