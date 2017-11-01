import * as http from 'http';

import { ResultInfo } from './ResultInfo';

const repoNamespaceRe = /([^\s]*)\s*\/\s*([^\s]*)/;

interface MatchDetails {
    before: string;
    line: string;
    after: string;
    fileNameShort: string;
}



export function fetchResults(baseUrl: string, searchText: string): Promise<(ResultInfo & { label: string; description: string; })[]> {
    return getTextResult(`${baseUrl}/api/v1/search?rng=0:100&repos=*&i=nope&q=${searchText}`).then(
        (body) => {
            const parsed = JSON.parse(body),
                results = parsed.Results;
                //fixme - types
            const out: (ResultInfo & { label: string; description: string; } & MatchDetails)[] = [];
            Object.keys(results).forEach((namespacedProject) => {
                const repoNamespaceMatch = repoNamespaceRe.exec(namespacedProject);
                if (repoNamespaceMatch !== null) {
                    const namespace = repoNamespaceMatch[1],
                        repoName = repoNamespaceMatch[2];
                    const projectReults = results[namespacedProject],
                        stripIndex = getCommonStringIndex(projectReults.Matches.map(({Filename}) => Filename));
                    results[namespacedProject].Matches.forEach(({ Filename, Matches }) => {
                        Matches.forEach(({ After, Before, Line, LineNumber }) => {
                            const fileNameShort = Filename.substr(stripIndex);
                            out.push({
                                label: `${repoName} - ${fileNameShort}: ${LineNumber}`,
                                description: Line,
                                name: repoName,
                                namespace: namespace,
                                fileName: Filename,
                                fileNameShort,
                                line: Line,
                                before: Before,
                                after: After,
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

function getCommonStringIndex(fileNames: string[]) {
    if(fileNames.length < 2) {
        return 0;
    }
    const sorted = fileNames.concat([]).sort(),
        first = fileNames[0];
    if(first.length < 8) {
        return 0;
    }
    const last = fileNames[fileNames.length -1],
        firstLength = first.length;
    let i;
    for(i = 0; i < firstLength && first[i] === last[i]; i++);
    return i === first.length ? 0 : i;
}   


