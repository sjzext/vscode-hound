export interface ResultInfo {
    readonly repoName: string;
    readonly repoNamespace: string;
    readonly fileName: string;
    readonly fileNameShort: string;
    readonly lineNumber: number;
    readonly before: string;
    readonly line: string;
    readonly after: string;
}