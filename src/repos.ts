import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface RepoInfo {
    readonly name: string;
    readonly repo: string;
    readonly absPath: string;
}

const originGroupRe = /\[remote "origin"\]([^\[]*)/,
    urlRe = /\s*url\s+\=\s+(.*.git)/;


export function collectLocalRepos(repoRoots: string[]): Promise<RepoInfo[]> {
    return Promise.all(repoRoots.map(findRepos))
        .then((arrays: RepoInfo[][]) => {
            return arrays.reduce((previous, current) => previous.concat(current), []);
        });
}

export function clone(cwd: string, cloneAddress: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = exec(
            `git clone ${cloneAddress}`,
            { cwd },
            (error, stdout, stderr) => {
                if (error === null) {
                    resolve();
                } else {
                    reject(error);
                }
            }
        );
    });
}

function findRepos(baseDir: string): Promise<RepoInfo[]> {
    return new Promise((resolve, reject) => {
        fs.readdir(baseDir, (err, items) => {
            if (err) {
                reject(err);
            } else {
                resolve(
                    items
                        .map((item) => ({ name: item, absPath: path.join(baseDir, item) }))
                        .filter(({ absPath }) => fs.statSync(absPath).isDirectory())
                        .filter(({ absPath }) => fs.existsSync(configPath(absPath)))
                        .map(({ name, absPath }) => {
                            const configContents = fs.readFileSync(configPath(absPath), 'utf8'),
                                originMatch = findFirst(originGroupRe, configContents),
                                urlMatch = findFirst(urlRe, originMatch);
                            if (urlMatch == undefined) {
                                return undefined;
                            } else {
                                return { name, repo: urlMatch, absPath };
                            }
                        })
                        .filter((item) => item !== undefined)
                );
            }
        });
    });
}

function configPath(root: string): string {
    return path.join(root, '.git', 'config');
}

function firstGroup(match: null | string[]) {
    return (match === null || match.length !== 2) ? undefined : match[1];
}

function findFirst(regex: RegExp, searchString: string | undefined): string | undefined {
    return firstGroup(regex.exec(searchString));
}
