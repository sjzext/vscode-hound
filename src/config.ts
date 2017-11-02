import { ConfigurationTarget, window, workspace } from 'vscode';

const CONFIG_GROUP = 'hound';
export function getOrPromptConfig<T>(name: string, prompt: string, storageTransform: (inputString: string) => T = (x) => x as any): Thenable<T> {

    const savedConfig = getConfig<T>(name);
    if (savedConfig == undefined) {
        return window.showInputBox({ prompt }).then(
            (userInput) => {
                if (userInput === undefined || userInput.length === 0) {
                    return Promise.reject('Config not entered');
                } else {
                    const transformedConfig = storageTransform(userInput);

                    return workspace.getConfiguration().update(
                        `${CONFIG_GROUP}.${name}`,
                        transformedConfig,
                        ConfigurationTarget.Global
                    ).then(() => transformedConfig);
                }
            }
        );
    } else {
        return Promise.resolve(savedConfig);
    }
}

export function getConfig<T>(name: string): T | undefined{
    return getConfigGroup().get(name) as T;
}

function getConfigGroup() {
    return workspace.getConfiguration(CONFIG_GROUP);
}
