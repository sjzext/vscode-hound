import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { ResultInfo } from './ResultInfo';

export interface LauncherConfig {
    name: string;
    launch: string;
    matchers: MatcherConfig[]
}

export interface MatcherConfig {
    containsFile?: string;
    nameMatchesRegex?: string;
    hasExtension?: string;
}

const PLACEHOLDER_FOLDER_RE = /\${folder}/g,
    PLACEHOLDER_FILENAME_RE = /\${fileName}/g,
    PLACEHOLDER_LINENUMBER_RE = /\${lineNumber}/g;

export function runLauncher(launchCmd: string, dir: string, fileName: string, lineNumber: number): Thenable<void> {
    exec(
        launchCmd
            .replace(PLACEHOLDER_FOLDER_RE, dir)
            .replace(PLACEHOLDER_FILENAME_RE, fileName)
            .replace(PLACEHOLDER_LINENUMBER_RE, lineNumber + '')
    );
    return Promise.resolve();
}

export function launcherMatches(dir: string, result: ResultInfo, config: LauncherConfig) {
    for (let i = 0; i < config.matchers.length; i++) {
        let matcherConfig = config.matchers[i];
        const matchers = Object.keys(matcherConfig)
            .map((matcherKey) => createMatcher(matcherKey, matcherConfig[matcherKey]))
            .filter((matcher) => matcher !== undefined);
        if (matchers.length === 0) {
            return true;
        } else {
            for (let i = 0; i < matchers.length; i++) {
                if (matchers[i](dir, result)) {
                    return true;
                }
            }
            return false;
        }
    }
    return false;
}

function createMatcher(matcherKey: string, matcherValue: string) {
    const matcherCreator = MATCHERS[matcherKey];
    return matcherCreator === undefined ? undefined : matcherCreator(matcherValue);
}

const MATCHERS = {
    containsFile: (fileName: string) => {
        return (dir: string, result: ResultInfo) => {
            return fs.existsSync(path.join(dir, fileName));
        }
    },
    nameMatchesRegex: (nameRe: string) => {
        const re = new RegExp(nameRe);
        return (dir: string, result: ResultInfo) => re.exec(result.name) !== null;
    },
    hasExtension: (extension: string) => {
        return (dir: string, result: ResultInfo) => result.fileName.endsWith(`.${extension}`);
    }
}