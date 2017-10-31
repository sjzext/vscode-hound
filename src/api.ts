import * as http from 'http';

import { ResultInfo } from './ResultInfo';

const repoNamespaceRe = /([^\s]*)\s*\/\s*([^\s]*)/;

export function fetchResults(baseUrl: string, searchText: string): Promise<(ResultInfo & { label: string; description: string; })[]> {
    return getTextResult(`${baseUrl}/api/v1/search?rng=0:100&repos=*&i=nope&q=${searchText}`).then(
        (body) => {
            const parsed = JSON.parse(body),
                results = parsed.Results;
            const out: (ResultInfo & { label: string; description: string; })[] = [];
            Object.keys(results).forEach((namespacedProject) => {
                const repoNamespaceMatch = repoNamespaceRe.exec(namespacedProject);
                if (repoNamespaceMatch !== null) {
                    const namespace = repoNamespaceMatch[1],
                        repoName = repoNamespaceMatch[2];
                    results[namespacedProject].Matches.forEach(({ Filename, Matches }) => {
                        Matches.forEach(({ After, Before, Line, LineNumber }) => {
                            out.push({
                                label: `${repoName} - ${Filename}: ${LineNumber}`,
                                description: Line,
                                name: repoName,
                                namespace: namespace,
                                fileName: Filename,
                                lineNumber: LineNumber
                            });
                        });
                    })
                }
            });
            return out;
        }
    );
}

function isOk(code: number) {
    return code > 199 && code < 300;
}

function getTextResult(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        http.get(url, (response) => {
            if (isOk(response.statusCode)) {
                let body = '';
                response.on('data', (data) => body += data);
                response.on('end', () => resolve(body));
            } else {
                reject(`Request failed: ${response.statusCode}`);
            }
        });
    });
}


