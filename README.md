# Hound Search

[Hound](https://github.com/etsy/hound) search, clone, launch.

## Features

Provides a [Hound](https://github.com/etsy/hound) search client that on selection:
* checks for matching local repos in a configurable set of root project directories
* prompts to clone repos that do not exist locally
* launches search results in the program of your choice

## Requirements

* Local installation of git
* Hound [config](https://github.com/etsy/hound/blob/master/config-example.json) with keys in the `"repos"` following a `namespace/repo` structure

  e.g. 

      {
          ...
          "repos": {
              "szinsli/vscode-hound": {
                  "url": "git@bitbucket.org:szinsli/vscode-hound.git"
              },
              "otherNamespace/otherRepo": {
                  "url": ...
              }
          }
      }


## Extension Settings

This extension contributes the following settings:

* `hound.url`: API endpoint for your hound installation e.g. `http://localhost:6080`
* `hound.repoPattern`: pattern to use to create a repo URL for a given namespace and repo name.
    * `namespace`: the owner namespace of the repo
    * `repo`: the name of the repo itself
    
        e.g. `git@github.com:${namespace}/${repo}.git`

* `hound.localRepoRoots`: array of directories for this extension to search for repos non-recursively

    e.g.  `["~/projects"]`
* `hound.launchers`: array of launcher configs containing:
    * `launch`: command to launch when a search result is selected.

      Takes the following substitutions (using the `${substitution}` syntax):
      * `folder`: the local repo directory path
      * `fileName`: the relative filepath of the match within the repo
      * `lineNumber`: line number of the match
    * `matchers`: an array of rule objects. Any single match will enable the launcher.

      Can contain one of the following:
            
      * `containsFile`: the launcher will match if the repo contains a file with this name (e.g. `{"containsFile": "index.html"}`)
      * `nameMatchesRegex`: the launcher will match if the supplied regex matches the repo name (e.g. `{"nameMatchesReges": "some.*thing"}`)
      * `hasExtension`: the launcher will match if the selected file has the supplied extension (e.g. `{"hasExtension": "java"}`)

    * example:
          
          "hound.launchers": [
            { 
                "launch": "code ${folder} -g '${folder}/${fileName}:${lineNumber}'",
                "matchers": [
                    { "containsFile": "package.json": },
                    { "hasExtension": "ts" }
                ]
            },
            {
                ...
            }
          ]

## Known Issues

## Release Notes

### 0.0.1

Initial release
