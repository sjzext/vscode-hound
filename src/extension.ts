'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { launcherMatches, runLauncher, LauncherConfig } from './launch';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import { fetchResults } from './api';
import { clone, collectLocalRepos, RepoInfo } from './repos';
import { ResultInfo } from './ResultInfo';

let localReposPromise: Promise<RepoInfo[]>;

function openResult(dir: string, result: ResultInfo): Thenable<void> {
    const launchers = getConfig().get('launchers') as LauncherConfig[],
        applicableLaunchers = launchers.filter(
            (launcher) => launcherMatches(dir, result, launcher)
        );
    if (applicableLaunchers.length === 0) {
        vscode.window.showErrorMessage('No applicable launchers found');
    } else if (applicableLaunchers.length === 1) {
        return runLauncher(applicableLaunchers[0].launch, dir, result.fileName, result.lineNumber);
    } else {
        vscode.window.showQuickPick(
            launchers.map((launcher) => ({ label: launcher.name, description: launcher.name, launcher }))
        ).then(
            (selection) => {
                if (selection !== undefined) {
                    return runLauncher(selection.launcher.launch, dir, result.fileName, result.lineNumber);
                }
            }
        );
    }

}
const PLACEHOLDER_NAMESPACE_RE = /\${namespace}/g,
    PLACEHOLDER_REPO_RE = /\${repo}/g;

function processSearch(baseUrl: string, searchText: string, repoPattern: string, localRepoRoots: string[]): Thenable<void> {
    return selectResult(baseUrl, searchText).then(
        (result) => {
            if (result === undefined) {
                return Promise.resolve();
            } else {
                let selectedFolderPromise: Promise<string>;

                const selectedLocalRepo = localReposPromise.then((localRepos) => {
                    const matchingLocalRepos = findLocalRepos(localRepos, result.name);
                    if (matchingLocalRepos.length === 0) {
                        const cloneAddress = repoPattern
                            .replace(PLACEHOLDER_NAMESPACE_RE, result.namespace)
                            .replace(PLACEHOLDER_REPO_RE, result.name);

                        let rootFolderPromise: Thenable<string | undefined>;
                        if (localRepoRoots.length === 1) {
                            rootFolderPromise = confirm(`Select to clone ${result.name} to ${localRepoRoots[0]}`).then(
                                (confirmed) => confirmed ? localRepoRoots[0] : undefined
                            );
                        } else {
                            rootFolderPromise = vscode.window.showQuickPick(
                                localRepoRoots.map((repoDir) => ({
                                    label: repoDir,
                                    description: '( Clone here )',
                                    repoDir
                                }))
                            ).then(
                                (selection) => selection === undefined ? undefined : selection.repoDir
                                );
                        }
                        rootFolderPromise.then((root) => {
                            if (root === undefined) {
                                return Promise.resolve(undefined);
                            } else {
                                return clone(root, cloneAddress).then(() => {
                                    const absPath = `${root}/${result.name}`;
                                    localReposPromise = Promise.resolve(localRepos.concat([{ absPath, name: result.name, repo: cloneAddress }]));
                                    return openResult(absPath, result)
                                });
                            }
                        });
                    } else if (matchingLocalRepos.length === 1) {
                        return openResult(matchingLocalRepos[0].absPath, result);
                    } else {
                        return vscode.window.showQuickPick(
                            matchingLocalRepos.map(
                                (repoInfo) => Object.assign(
                                    {},
                                    repoInfo,
                                    {
                                        label: repoInfo.absPath,
                                        description: '( Open here )'
                                    }
                                )
                            ),
                            { placeHolder: 'Select the local repository to open' }
                        ).then((selection) => {
                            if (selection === undefined) {
                                return Promise.resolve();
                            } else {
                                return openResult(selection.absPath, result);
                            }
                        });
                    }
                });
            }
        }
    );
}

function getConfig() {
    return vscode.workspace.getConfiguration("hound");
}

function getLocalRepoRoots() {
    return getConfig().get('localRepoRoots') as string[];
}

export function refreshLocalProjects() {
    localReposPromise = collectLocalRepos(getLocalRepoRoots());
    return localReposPromise;
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    const config = getConfig(),
        url = config.get('url') as string,
        repoPattern = config.get('repoPattern') as string;
    refreshLocalProjects();
    const searchDisposable = vscode.commands.registerCommand('extension.houndSearch', () => {
        // The code you place here will be executed every time your command is executed
        return vscode.window.showInputBox({ prompt: "Enter a search term regex" }).then(
            (inputString) => inputString === undefined ? Promise.resolve() : processSearch(url, inputString, repoPattern, getLocalRepoRoots()),
            (error) => vscode.window.showErrorMessage(`Failed to hound search, reason: ${error}`)
        );
    });
    // not the best spot to register this
    const refreshDisposable = vscode.commands.registerCommand('extension.refreshLocalProjects', () => {
        refreshLocalProjects().then(() => vscode.window.showInformationMessage('Refresh Complete'));
    });
    context.subscriptions.push(searchDisposable);
    context.subscriptions.push(refreshDisposable);
}

// this method is called when your extension is deactivated
export function deactivate() {
}

function selectResult(baseUrl: string, searchText: string): Promise<ResultInfo | undefined> {
    return fetchResults(baseUrl, searchText)
        .then(vscode.window.showQuickPick);
}

function findLocalRepos(localRepos: RepoInfo[], repoName: string): RepoInfo[] {
    return localRepos.filter((localRepo) => localRepo.name === repoName);
}

function simplePickItem(value: string): vscode.QuickPickItem & { value: string } {
    return { label: value, description: value, value };
}

function confirm(text: string): Thenable<boolean> {
    return vscode.window.showQuickPick([text]).then((selection) => selection === text);
}