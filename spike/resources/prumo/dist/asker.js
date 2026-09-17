import * as prompt from '@clack/prompts';
const TYPES = ['api', 'web', 'mobile', 'site'];
function answered(value) {
    if (prompt.isCancel(value)) {
        prompt.cancel('Nothing was generated.');
        process.exit(1);
    }
    return value;
}
export function terminalAsker(validateName) {
    return {
        name: async () => answered(await prompt.text({ message: 'Project name', validate: (v) => validateName(v ?? '') })),
        types: async () => answered(await prompt.multiselect({
            message: 'What does the project have?',
            options: TYPES.map((type) => ({ value: type, label: type })),
            required: true,
        })),
        architecture: async () => answered(await prompt.select({
            message: 'One project, or a workspace ready to grow?',
            options: [
                { value: 'alone', label: 'alone' },
                { value: 'monorepo', label: 'monorepo' },
            ],
            initialValue: 'alone',
        })),
        multiTenant: async () => answered(await prompt.confirm({ message: 'Is it multi-tenant?', initialValue: false })),
    };
}
