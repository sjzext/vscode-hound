import { OutputChannel, window } from 'vscode';

import { ResultInfo } from './ResultInfo';

const CHANNEL_NAME: string = 'Hound: Result Preview';

export interface ResultPreview {
    setSelection(resultInfo: ResultInfo): void;
    terminate(): void;
}

export function openResultPreview(): ResultPreview {
    const channel = window.createOutputChannel(CHANNEL_NAME);
    channel.append('Select a result');
    channel.show(true);
    let lastSelection = undefined,
        terminated = false;
    return {
        setSelection(selection) {
            if (terminated) {
                throw new Error('Previewer is terminated');
            } else {
                if (lastSelection !== selection) {
                    renderPreview(channel, selection);
                    lastSelection = selection;
                }
            }
        },
        terminate() {
            if (!terminated) {
                channel.hide();
                channel.dispose();
                terminated = true;
            }
        }
    }
}

function renderPreview(channel: OutputChannel, resultInfo: ResultInfo): void {
    channel.clear();
    const namespaceString = resultInfo.repoNamespace === undefined ? '' : resultInfo.repoNamespace,
        nameWithNamespace = namespaceString + (namespaceString.length === 0 ? '' : ' / ') + resultInfo.repoName,
        title = nameWithNamespace + ' - ' + resultInfo.fileName;
    channel.appendLine(title);
    channel.appendLine('-'.repeat(title.length));
    channel.appendLine(resultInfo.before);
    channel.appendLine('>>');
    channel.appendLine(resultInfo.line);
    channel.appendLine('>>');
    channel.appendLine(resultInfo.after);
}