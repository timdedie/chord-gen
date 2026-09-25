import type { ZodIssue } from 'zod';

export function buildValidationErrorMessage(issues: ZodIssue[]): string {
    const lines = issues.map((issue) => {
        const where = issue.path.length ? `${issue.path.join('.')}: ` : '';
        return `- ${where}${issue.message}`;
    });

    return `Your response was rejected. Fix these problems and return the complete response again:
${lines.join('\n')}

Every chord symbol must be musically valid, and every chord's notes must spell exactly that chord — lowest note on the bass, only chord tones, nothing essential left out.`;
}
