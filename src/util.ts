import { window } from 'vscode';

export function confirm(text: string): Thenable<boolean> {
    return window.showQuickPick([text]).then((selection) => selection === text);
}