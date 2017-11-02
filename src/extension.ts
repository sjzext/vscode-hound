'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { fetchResults, ResultInfoSelections } from './api';
import { getConfig, getOrPromptConfig } from './config';
import { LauncherConfig, launcherMatches, runLauncher } from './launch';
import { openResultPreview } from './preview';
import { clone, collectLocalRepos, RepoInfo } from './repos';
import { ResultInfo } from './ResultInfo';
import { confirm } from './util';

function openResult(dir: string, result: ResultInfo, launchers: LauncherConfig[]): Thenable<void> {
    const applicableLaunchers = launchers.filter(
        (launcher) => launcherMatches(dir, result, launcher)
    );
    if (applicableLaunchers.length === 0) {
        return Promise.reject('No applicable launchers found');
    } else if (applicableLaunchers.length === 1) {
        return runLauncher(applicableLaunchers[0].launch, dir, result.fileName, result.lineNumber);
    } else {
        vscode.window.showQuickPick(
            launchers.map((launcher) => ({ label: launcher.name, description: '( Use launcher )', launcher }))
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

function processSearch(baseUrl: string, searchText: string, repoPattern: string, localReposPromise: Promise<RepoInfo[]>, localRepoRoots: string[]): Thenable<{ absPath: string, result: ResultInfo } | undefined> {
    return selectResult(baseUrl, searchText).then(
        (result) => {
            if (result === undefined) {
                return Promise.resolve(undefined);
            } else {
                let selectedFolderPromise: Promise<string>;

                return localReposPromise.then((localRepos) => {
                    const matchingLocalRepos = findLocalRepos(localRepos, result.repoName);
                    if (matchingLocalRepos.length === 0) {
                        const cloneAddress = repoPattern
                            .replace(PLACEHOLDER_NAMESPACE_RE, result.repoNamespace)
                            .replace(PLACEHOLDER_REPO_RE, result.repoName);

                        let rootFolderPromise: Thenable<string | undefined>;
                        if (localRepoRoots.length === 1) {
                            rootFolderPromise = confirm(`Select to clone ${result.repoName} to ${localRepoRoots[0]}`).then(
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
                        return rootFolderPromise.then((root) => {
                            if (root === undefined) {
                                return Promise.resolve(undefined);
                            } else {
                                return clone(root, cloneAddress).then(() => {
                                    const absPath = `${root}/${result.repoName}`;
                                    localReposPromise = Promise.resolve(localRepos.concat([{ absPath, name: result.repoName, repo: cloneAddress }]));
                                    return Promise.resolve({ absPath, result });
                                });
                            }
                        });
                    } else if (matchingLocalRepos.length === 1) {
                        return Promise.resolve({ absPath: matchingLocalRepos[0].absPath, result });
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
                                return Promise.resolve(undefined);
                            } else {
                                return Promise.resolve({ absPath: selection.absPath, result });
                            }
                        });
                    }
                });
            }
        }
    );
}



function getExtensionConfig(): Promise<any> {

    const launchersConfig = getConfig<LauncherConfig[]>('launchers');

    if (launchersConfig === undefined) {
        return Promise.reject('Launcher config not provided')
    }

    return Promise.all([
        getOrPromptConfig('url', 'Hound API URL not configured, enter one to continue'),
        getOrPromptConfig('localRepoRoots', 'No local repo root set, enter a directory to continue', (repoRoot) => [repoRoot]),
        getOrPromptConfig('repoPattern', 'No repo pattern specified, enter one to continue'),
        Promise.resolve(launchersConfig)
    ]).then(
        ([url, localRepoRoots, repoPattern, launchers]) => {
            return {
                url,
                localRepoRoots,
                repoPattern,
                launchers
            };
        }
        );
}

function selectResult(baseUrl: string, searchText: string): Promise<ResultInfoSelections | undefined> {
    return fetchResults(baseUrl, searchText)
        .then((selections: ResultInfoSelections[]) => {
            const resultsPreview = openResultPreview();
            return vscode.window.showQuickPick<ResultInfoSelections>(selections, {
                placeHolder: 'Navigate to preview results, or select to launch',
                onDidSelectItem: (resultInfo) => resultsPreview.setSelection(resultInfo as any)
            }).then((selection) => {
                resultsPreview.terminate();
                return selection;
            });
        });
}

function findLocalRepos(localRepos: RepoInfo[], repoName: string): RepoInfo[] {
    return localRepos.filter((localRepo) => localRepo.name === repoName);
}

export function activate(context: vscode.ExtensionContext) {

    let localReposPromise: Promise<RepoInfo[]>,
        configPromise: Promise<any>; //fixme

    configPromise = getExtensionConfig();
    configPromise.catch((error) => vscode.window.showErrorMessage(error.message));

    const refreshLocalProjects = () => {
        return configPromise.then(
            ({ localRepoRoots }) => {
                localReposPromise = collectLocalRepos(localRepoRoots)
            },
            (error) => vscode.window.showErrorMessage(error)
        );
    }

    refreshLocalProjects();

    context.subscriptions.push(

        vscode.workspace.onDidChangeConfiguration(() => {
            configPromise = getExtensionConfig();
            configPromise.catch((error) => vscode.window.showErrorMessage(error.message));
        }),

        vscode.commands.registerCommand('extension.houndSearch', () => {
            configPromise.then(({ url, localRepoRoots, repoPattern, launchers }) => {
                return vscode.window.showInputBox({ prompt: "Enter a search term regex" }).then(
                    (inputString) => {
                        if (inputString === undefined || inputString.length === 0) {
                            return Promise.resolve();
                        } else {
                            return processSearch(url, inputString, repoPattern, localReposPromise, localRepoRoots).then(
                                (choice: { absPath: string; result: ResultInfo; } | undefined) => {
                                    return choice === undefined ? Promise.resolve() : openResult(choice.absPath, choice.result, launchers);
                                }
                            );
                        }
                    }
                );
            }).catch(vscode.window.showErrorMessage);
        }),
        vscode.commands.registerCommand('extension.refreshLocalProjects', () => {
            refreshLocalProjects().then(() => vscode.window.showInformationMessage('Refresh Complete'));
        }),
    );

}

export function deactivate() {
}