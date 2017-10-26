'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

function doit(searchText: string): Promise<void> {
    const baseUrl = vscode.workspace.getConfiguration("").get("hound.url");
    console.error(JSON.stringify(baseUrl));
    // vscode.window.showInformationMessage(baseUrl);
    const url = new URL(`${baseUrl}/api/v1/search?rng=0:100&repos=*&i=nope&q=${searchText}`);
    console.error(url.protocol);
    const fetcher: any = url.protocol === 'https:' ? https.get : http.get;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    
    return new Promise((resolve, reject) => {
        console.error(url.toString());
        fetcher(url.toString(), (response) => {
            let body = '';
            response.on('data', (data) => body += data);
            response.on('end', () => {
                console.error(body);
                const parsed = JSON.parse(body),
                results = parsed.Results;
                const out = [];
                Object.keys(results).forEach((projectName) => {
                    results[projectName].Matches.forEach(({Filename, Matches}) => {
                        Matches.forEach(({After, Before, Line, LineNumber}) => {
                            out.push({
                                label: `${projectName} - ${Filename}: ${LineNumber}`,
                                description: Line,
                                details: 'derp'
                            });
                        });
                    })
                });
                return vscode.window.showQuickPick(out);
            });
        });
    
    });

}


function processSearch(text: string): Thenable<void> {
   return doit(text);
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    const disposable = vscode.commands.registerCommand('extension.sayHello', () => {
        // The code you place here will be executed every time your command is executed
        return vscode.window.showInputBox({prompt: "Enter a search term regex"}).then(
            (inputString) => inputString === undefined ? Promise.resolve() : processSearch(inputString),
            (error) => vscode.window.showErrorMessage(`Failed to hound search, reason: ${error}`)
        ) 
    });
    context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {
}