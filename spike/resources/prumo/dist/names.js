const PROJECT_NAME = /^[a-z][a-z0-9-]*$/;
export function validateProjectName(name) {
    if (!PROJECT_NAME.test(name)) {
        return 'Use lowercase letters, digits and hyphens, starting with a letter.';
    }
    return undefined;
}
export function schemeFor(name) {
    return name.replaceAll('-', '');
}
