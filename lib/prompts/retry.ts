export function buildValidationErrorMessage(errorDetails: unknown): string {
    return `Invalid response. Fix these errors:\n${JSON.stringify(errorDetails, null, 2)}\n\nEvery chord symbol must be musically valid per the formatting rules.`;
}
