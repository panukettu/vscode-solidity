# Solidity for Visual Studio Code.

[![Version](https://vsmarketplacebadges.dev/version/0xp.vsc-solidity.png)](https://marketplace.visualstudio.com/items?itemName=0xp.vsc-solidity) [![Downloads](https://vsmarketplacebadges.dev/downloads-short/0xp.vsc-solidity.png)](https://marketplace.visualstudio.com/items?itemName=0xp.vsc-solidity) [![Installs](https://vsmarketplacebadges.dev/installs-short/0xp.vsc-solidity.png)](https://marketplace.visualstudio.com/items?itemName=0xp.vsc-solidity) [![Rating](https://vsmarketplacebadges.dev/rating-short/0xp.vsc-solidity.png)](https://marketplace.visualstudio.com/items?itemName=0xp.vsc-solidity#review-details)

_Disclaimer_: bugs likely

## LATEST

- new command, find by selector: finds error/function from workspace by its 4-byte selector
- new config, project.downloads: set folder for etherscan command output.
- new config, solidity.lsp.enabled: enable/disable the language server.
- new config, solidity.validation.autoOpenProblems: opens problem panel if diagnostics were sent from compilation.
- new config, solidity.validation.ignoreErrorCodes: ignores some error codes from compiler.

### 0.9.1

- new command: keccak256 from input (cmd+shift+p -> hash)
- new command: encode from input (cmd+shift+p -> encode)
- new command: decode from input (cmd+shift+p -> decode)
- new lens: view all error selectors in file (click selectors on top of an error)
- new lens: view all func selectors in file (click selectors on top of function)
- misc: view info on import source

### 0.8.30

- code action suggesting fixes for unresolved imports
- code action for removing unused imports
- use `foundry remappings` by default for remappings

### previous

- rename config, fix incorrect enum usage
- include paths, fix compiler issues and disable semantic tokens (too ugly perf)
- add semantic tokens
- Fix custom type using for star
- Do not validate forge-std/safeconsole.sol
- Enable validation in t.sol and s.sol files
- Jump to finished test if on another file
- Clear status bars and decorations on test runs
- Improve perf on big contracts
- Pass all diagnostic through server so all compilations get auto fixes
- Fix auto-import in file with no existing imports in file
- Improve definition lookup
- Improve codelens func lookup

## FEATURES OVERVIEW

- quickfix

  - fix unresolved import paths / symbols
  - remove unused import paths / symbols
  - import missing symbols (supports remappings)
  - correct naming errors (and argument-dependent lookup)
    - fuzzy suggestion for this can be configured with `solidity.fuzzLevel` items.
  - add spdx license
  - correct compiler version to match extension settings
  - correct address to checksum

- execute forge t.sol functions
  - get function level output
  - get assertion results inline at location (requires using a label)
  - get logs inline at the location (requires using a label)
- compiler

  - configure compilation output location
  - configure full settings or just output selection

- validation (mostly like original extension)

  - diagnostic on exact locations when compiler has errors
  - code validation with triggers: onChange | onSave | onOpen
  - toggle this validation on/off from menus.
  - note: validation is currently disabled in t.sol or s.sol files and there is no automatic full validation of project.

- signature help
  - get signature help on function calls args
- codelens
  - peek 4bytes selector of function/error
  - generate func natspec stub
- misc

  - go to definition is more aware of context,
  - find all references works with library based patterns
  - auto completions work with library based patterns
  - extension bundles all deps so no node_modules included
  - works a bit faster on big projects than original
  - .solhintignore works (atleast at one point it did)
  - removes Nethereum, Solium and dApproject related things.

## ISSUES

- copilot code-actions break autofix, put cursor at the start of diagnostic for keyboard trigger or disable copilot code-actions
- extension provided compilation likely to crash with huuuuge source files
- t.sol and s.sol files have validation mechanism disabled for now - too unstable on big repos
- go to definition can at times show eg. "click to show 3 definitions" - it rather forces a definition than not providing one.
- no idea of performance outside apple silicon
- "solidity.diagnostics.clear" command exists if things get too heavy on UI.

_for feature ideas just https://github.com/panukettu/vscode-solidity_
_probably moving this extension to some more comfy fork later buuut this works for now_

## FORGE

### Execute test

- execute t.sol functions under cursor on save
- diagnostics/highlights for failed assertions and logs:

![onsave](screenshots/test-function-execute.gif)

- duplicate exec will just restart
- can optionally execute the test from codelens:

![executor](screenshots/test-execute-lens.png)

#### Test output

- function level output with gas difference etc:

![test-output](screenshots/test-output.png)

#### Test status

- Can be seen next to function and in bottom status bar:

![test-status-bar](screenshots/test-status-bar.png)

#### Test diagnostics

- semi stable diagnostics for asserts + logs but you do need to specify some identifier: `assertEq(a,b, "identifier")`, `console.log("foo", bar)` etc.

![test-inline-diagnostic](screenshots/test-inline-diagnostic.png)

#### Tracing output

- Only small support
  - setup included: verbosity 5
  - only function: 4
  - only fails: 3

![tracing-data](screenshots/test-inline-tracing-data.png)

#### Print test runtime info

- data from tracing: contains contract names, addresses sizes, event counts and call counts.
- extending further but I guess it has some utility here

![function-runtime-info](screenshots/test-output-info.png)

- Foundry verbosity can be toggled from context menus that are a bit more compact than in the original extension.

![menu](screenshots/menus.png)

### SOLC SETTINGS `solidity.compilerOutputSelection` or `solidity.compilerSettings`.

- Compiler settings will override others.

![Solc Config](screenshots/solc-config.png)

- Adds some CodeLens:
  - Run active test function (t.sol).
  - Preview bytes4 selector of functions without compilation (should work on structs and custom types as well)
  - Preview hash of eg. keccak256("some.string")
  - Generate natspec for functions with a click.
    <br>

## NEW CONFIG

- solidity.test.executeOnSave
  - run forge test in cursor position on file save.
  - default: true
- solidity.test.verbosity
  - forge verbosity setting
  - default: 3 (traces on failed tests)
- solidity.compiler.outDir
  - output for compilation artifacts generated from this extension.
  - default: 'bin'
- solidity.compilerSettings.output
  - configure contract output items.
- solidity.compilerSettings.input
  - configure all solcjs supported settings for the compiler. ![Reference](https://github.com/panukettu/vscode-solidity/blob/master/src/shared/compiler/types-solc.ts#L371)
- solidity.validation.onSave:
  - validate file on save.
  - default: true
- solidity.validation.onChange
  - validate file on change (typing)
  - default: false
- solidity.validation.onOpen
  - validate file on open.
  - default: true
- solidity.project.sources (string):
  - your solidity source folder.
  - tries to get from foundry.toml or hardhat.config.js if not set.
  - default: ""
- solidity.project.exclude (string[]):

  - exclude some folders from initial parsing. eg. ["temp", "test"]
  - default: []

## CONFIG CHANGES

- solidity.sources -> solidity.project.sources
- solidity.defaultCompiler -> solidity.compiler.location
  - default: "Default"
- solidity.nodemodulespackage -> solidity.compiler.npm
  - default: "solc"
- solidity.packageDefaultDependenciesDirectory -> solidity.project.libs
  - default: ["node_modules", "lib"]
- solidity.packageDefaultDependenciesContractsDirectory -> solidity.project.libSources
  - default: ["src", "contracts"]
- remote solc -> solidity.compiler.remote
- local solc -> solidity.compiler.local
- npm solc -> solidity.compiler.npm
- compiler -> solidity.compiler.type

## _DISCLAIMER_ no idea how many things below are not supported by this version

# Original Features

Solidity is the language used in Ethereum to create smart contracts, this extension provides:

- Syntax highlighting
- Snippets
- Compilation of the current contract (Press <kbd>F1</kbd> Solidity : Compile Current Solidity Contract), or <kbd>F5</kbd>
- Compilation of all the contracts (Press <kbd>F1</kbd> Solidity : Compile all Solidity Contracts), or <kbd>Ctrl</kbd> + <kbd>F5</kbd> or <kbd>Cmd</kbd> + <kbd>F5</kbd>
- Code completion for all contracts / libraries in the current file and all referenced imports
- Goto definition
- Find all references in project
- Hover information
- Code actions / quick fixes (change compiler, format address, add sdpx license.. )
- Mono repo support (identifies the project by finding the files: remappings.txt, foundry.toml, brownie-config.yaml, truffle-config.js, hardhat.config.js)
- Default project structure (solidity files needs to be in the `src/` directory, and libraries in the `lib/` directory). Libraries will follow the same structure.
- Compilation supporting EIP82 (dappfile and dependency packages)
- Support for different solidity versions (Remote and local)
- Download source code and Abi from Etherscan
- Linting using [Solhint](https://github.com/protofire/solhint)

## Instructions

## Using a different version of the solidity compiler

Sometimes you may want to use a different compiler than the one provided. You can find all the different versions in the solc-bin repository https://binaries.soliditylang.org/

Currently we support four ways supported to use a different version of the solidity compiler. Remote, File, NPM and Default

You can change the compiler, in your user settings or workspace settings.

![image](https://user-images.githubusercontent.com/562371/112019635-85d13d80-8b27-11eb-9e91-dc74dcf9e2fa.png)

### Remote download

When selecting remote download the compiler gets downloaded from the solc-bin repository.

You will need to change the following user setting, with the version required, for example `'latest'` or `'v0.8.18+commit.87f61d96'`, for your workspace user setting (current project) or global user setting (all projects)

```
"solidity.compileUsingRemoteVersion" : "latest"
```

![Screenshot](screenshots/change-compiler-version-gui-setting.png)

You can simply change this setting using the context menu:

![Screenshot](screenshots/change-compiler-version-contextmenu.png)

![Screenshot](screenshots/change-compiler-version-selectversion.png)

#### Using a code action

If your code is targetting a specific version for solidity, and see the issue highlighted you can also trigger the menu directly from the import.

![Screenshot](screenshots/solidity-change-workspacecompiler-codeaction.gif)

### Using a Local file

If you want to keep a compiler version locally, you can download the compiler from https://binaries.soliditylang.org/ and change your user settings to use this.

```
"solidity.compileUsingLocalVersion" : "C:\\Users\\JuanFran\\Downloads\\soljson-v0.8.18%2Bcommit.87f61d96.js"
```

The simplest way to download a compiler is to use the context menu, this will download your desired version at the root of the project and configure your workspace accordingly.

![image](https://user-images.githubusercontent.com/562371/112136733-435f3d80-8bc7-11eb-91e5-e1d04a51cd72.png)

### Npm / node installation

Another option, is to use the solc npm package in your project, if this is enabled it will try to find the compiler in your configured node_modules at root.

You can install solc using npm at the root of your project as follows.

````
npm install solc

The default module package is "solc", but you may want to use other node module containing a compiler, this can be configured in the settings:
![image](https://user-images.githubusercontent.com/562371/112137067-b668b400-8bc7-11eb-90bc-73e972da98d6.png)


### Compiling a specific contract using a different compiler than the default one.

There might be scenarios, that you want to use a different compiler for a specific file, using one of the other configured compilers.

![image](https://user-images.githubusercontent.com/562371/112020727-7f8f9100-8b28-11eb-91ca-0a43ef491e57.png)

![image](https://user-images.githubusercontent.com/562371/112020877-a3eb6d80-8b28-11eb-895d-bbee7665e38d.png)



## ERC, ERC drafts and Smart contracts snippets / reference

It is pretty hard sometimes to find interfaces or information about an EIP (ERC) or specific libraries to simply get started working with Solidity.
The solidity extension now includes ERC approved and most drafts (wip) to help get you started.

Just type ```erc``` and select the erc example or interface you want.

![Screenshot](screenshots/ercautocomplete1.png)
![Screenshot](screenshots/ercautocomplete2.png)

### Smart contract project interfaces
In a similar to way to ERCs and as we work towards to more interoperable smart contracts, being able to quickly examine those interfaces that you want to integrate is a time saver.

The current release includes the interfaces for Uniswap V2 (to get started), just type ```uni``` to list them all.
![Screenshot](screenshots/unigen1.png)
![Screenshot](screenshots/unigen2.png)

Note: If an ERC or your project is not included, please create a pull request. Note: Only established projets will be included.

## Compiler optimization
Optimize for how many times you intend to run the code. Lower values will optimize more for initial deployment cost, higher values will optimize more for high-frequency usage. The default value is **200**.
```"solidity.compilerOptimization": 200```

## Project structure and Remappings

## Mono repo support
Mono repo support enables having different projects in the same workspace as opposed to different open workspaces in the same window.

To provide mono repo support, idenfify the project by finding one of the files used by different tools, for example remappings.txt, foundry.toml, brownie-config.yaml, truffle-config.js, hardhat.config.js. Solidity does not have a standard project file yet, or many not have it ever, so this is the best solution.

The settings enable Mono repo support by default, but if wanted can be disabled.

### Dependencies for both "Node_modules" and "Lib" (Default)

If you're using a library like [`@openzeppelin/contracts`](https://github.com/OpenZeppelin/openzeppelin-contracts), the OpenZeppelin Contracts will be found in your node_modules folder, or you might be using a library like [`Solmate`](https://github.com/transmissions11/solmate) and you might put it in your `lib` folder.
So the user settings will be the following, assuming your solidity project is at root.

This is the default now, so you don't need to set it.

````

"solidity.packageDefaultDependenciesContractsDirectory": "src",
"solidity.packageDefaultDependenciesDirectory": ["node_modules", "lib"],

```

If you have a deeper structure, like

```

Solution
└───solidity_project
│ │
| │ xx.sol
│ └───node_modules
│  
└───Web3Js_Project
| │ xx.js
| │ yy.js

```

Your user settings configuration will need to represent the full structure:

```

"solidity.packageDefaultDependenciesContractsDirectory": "src",
"solidity.packageDefaultDependenciesDirectory": "solidity_project/node_modules"

```

## Dappsys (old ERC)

The project  / library dependency structure can use the DappSys library model, this was the default mode before as it was part of an ERC:

![Screenshot](screenshots/simpleProjectStructure.PNG)

Libraries will have the same name as their folder they are included.
Solidity files will be in the 'src' folder.
Libraries will be included in the 'lib' folder.

Currently there is no name conflicting resolution, so the first library found matching a name, will be the first one used.

The user settings for this structure is:

```

"solidity.packageDefaultDependenciesContractsDirectory": "src",
"solidity.packageDefaultDependenciesDirectory": "lib"

````

## Resolving imports from different contract directories shortcuts
There are projects that may have their contracts in the "contracts" directory or you may have a mixture of them that are both in "contracts", "src" or just not specific shortcut. For this the extension internally tries to resolve these generic shortcuts if an import is not found. The default are ["contract", "src", ""]

This behaves in the same way as ```"solidity.packageDefaultDependenciesDirectory": "lib"```. If you see there is a need for other folder names shortcuts, raise an issue.

### Remappings
Another option is to use remappings to define where your dependency libraries are, this can be achieved using the settings or creating a "remappings.txt" file in the root folder. For more info on remappings check the solidity documentation here https://docs.soliditylang.org/en/latest/path-resolution.html?highlight=remapping#import-remapping

If you want to use the solidity user settings for your workspace / global remappings, please include them in the ```solidity.remappings```

````

"solidity.remappings": [
"@chainlink/=/Users/patrick/.brownie/packages/smartcontractkit/chainlink-brownie-contracts@0.2.2",
"@openzeppelin/=/Users/patrick/.brownie/packages/OpenZeppelin/openzeppelin-contracts@4.3.2"
]

````

Or if you want to include them in the remappings.txt file, just put the file at the root of your project folder. Note: These will override your solidity settings if included
![image](https://user-images.githubusercontent.com/562371/136204736-be94e8d8-1954-4981-891c-278145b27cdf.png)

#### Platform specific remappings

There are situations when cross-platform paths are needed, in this case you can use the ```solidity.remappingsWindows``` or ```solidity.remappingsUnix``` settings.

````

"solidity.remappingsWindows": [
"@openzeppelin/=C:/Users/<USERNAME>/.brownie/packages/OpenZeppelin/openzeppelin-contracts@4.4.2"
],

"solidity.remappingsUnix": [
"@openzeppelin/=/Users/<USERNAME>/.brownie/packages/OpenZeppelin/openzeppelin-contracts@4.4.2"
]
<<<OR>>>
"solidity.remappingsUnix": [
"@openzeppelin/=/home/<USERNAME>/.brownie/packages/OpenZeppelin/openzeppelin-contracts@4.4.2"
]

```

## Code completion

Autocomplete is generally supported across for smart contracts, structs, functions, events, variables, using, inheritance. Autocomplete should happen automatically or press Ctrl+Space or Command+Space in areas like "import".

![Screenshot](screenshots/simpleDemoAutocomplete.gif)

## Auto compilation and error highlighting

Auto compilation of files and error highlighting can be enabled or disabled using user settings. Also a default delay is implemented for all the validations (compilation and linting) as solidity compilation can be slow when you have many dependencies.

```

"solidity.enabledAsYouTypeCompilationErrorCheck": true,
"solidity.validationDelay": 1500

````

## Go To definition
To navigate to a definition, just press F12 or Ctrl + click to find a definition and navigate to it.

## Hover information
To find more information about a method, function, variable, contract etc, you can just hover over it with your mouse. Natspecs and comments are extracted for all types to provide you all the documentation required.

![Screenshot](screenshots/solidity-hover.gif)

## Goto references
To find all usages of a specific type, method, etc you can press Shift + F12 or right click to find all references

![Screenshot](screenshots/solidity-references.gif)

## Code actions / quick fixes
The extension provides some code actions and quick fixes, like change compiler, format address, add sdpx license, feel free to make pull requests with new ones!

![Screenshot](screenshots/solidity-corrections.gif)

## Download source code and ABI from Etherscan
To download verified source code from Etherscan, you can right click on the folder area or in a soldity file. First select what chain the smart contract it(for example Ethereum) and then input the smart contract address. The source code will be saved in the root folder of your project. Please note that remappings will be generated for multiple files, so these might conflict with existing ones.

![Screenshot](screenshots/solidity-etherscan-download.gif)

## Solparse-Exp
The extension uses https://github.com/juanfranblanco/solparse-exp as the main parser, this continues the work that many have done over the years. Tim Coulter, @cgewecke, @duaraghav8 @federicobond, as a Peg solidity parser in javascript.

## Linting

There are two linters included with the extension, solhint and solium / ethlint. You can chose your preferred linter using this setting, or disable it by typing ''

![Screenshot](screenshots/select-linter.png)

### Solhint

To lint Solidity code you can use the Solhint linter https://github.com/protofire/solhint, the linter can be configured it using the following user settings:

```json
"solidity.linter": "solhint",
"solidity.solhintRules": {
  "avoid-sha3": "warn"
}
````

This extension supports `.solhint.json` configuration file. It must be placed to project root
directory. After any changes in `.solhint.json` it will be synchronized with current IDE
configuration.

This is the default linter now.

NOTE: Solhint plugins are not supported yet.

# Formatting using Prettier and the Prettier Solidity Plugin

Formatting is provided thanks to the Prettier plugin for Solidity for more info check https://prettier.io/ and https://github.com/prettier-solidity/prettier-plugin-solidity

Formatting uses the default formatting settings provided by prettier, if you want to provide your custom settings create a **.prettierrc** file as follows

```json
{
	"overrides": [
		{
			"files": "*.sol",
			"options": {
				"printWidth": 80,
				"tabWidth": 4,
				"useTabs": true,
				"singleQuote": false,
				"bracketSpacing": true,
				"explicitTypes": "always"
			}
		}
	]
}
```

> :information_source: Settings are applied immediately on the latest version of the plugin. If your settings are not reflected immediately consider updating to the latest version, if it still doesn't work please restart visual studio code.

If you would like to format on save, add this entry to your user / workspace settings:

`"editor.formatOnSave": true`

# Formatting using forge fmt

Formatting can also be performed with `forge fmt` by [Foundry](https://getfoundry.sh/). You can configure it using a `foundry.toml` in your project directory as [explained in the Foundry book](https://book.getfoundry.sh/reference/config/formatter?highlight=fmt#formatter) and then choosing `forge` as your formatter in the extension settings:

![image](https://user-images.githubusercontent.com/89424366/199959085-d7393779-801b-45d7-aebe-a9c4d25b1571.png)

## Abi contract code generation

You may have only the abi of a smart contract and want to code generate the contract definition. Just create a file containing the abi, with the extension `.abi` and another with the `.bin` content (if needed) and use this context menu.

![Screenshot](screenshots/abigeneration.png)

## Contributing / Issues / Requests

For ideas, issues, additions, modifications please raise an issue, if your change is significant please head to the Netherum discord for a chat https://discord.gg/u3Ej2BReNn.
Note: All contributions will be under the same project license.

# Credits

Many thanks to:

Christian Reitwiessner and the Ethereum team for Solidity https://github.com/ethereum/solidity, for their amazing and none stop work. Thanks to them Ethereum and all the other EVM compatible chains are they way they are. This extension piggybacks on their work.

Raghav Dua and everyone that contributed to Solium, the solidity linter, and the solidity parser.

Ilya Drabenia for creating the Solhint linter and the integration into the extension.

Nexus team for the original creation of the dappfile to structure contracts in projects https://github.com/nexusdev/dapple.

Beau Gunderson for contributing the initial integration of solium https://github.com/juanfranblanco/vscode-solidity/issues/24, the initial server and error mappings.

Mattia Richetto, Klaus Hott Vidal and Franco Victorio for creating the Prettier Solidity plugin and of course all the developers of Prettier. Please go to https://github.com/prettier-solidity/prettier-plugin-solidity for help and collaboration.

Bram Hoven for starting the multiple package dependency support for different environments (node_modules, lib)

Piotr Szlachciak for refactoring the syntaxes

James Lefrere for further refactoring the syntaxes.

Forest Fang for providing the first implementation of the "Go to definition", allowing you to navigate to structs, contracts, functions calls, etc and we have used for years.

Bernardo Vieira for adding the capability to read the solium settings from a file in the workspace root directory.

Mirko Garozzo and Rocky Bernstein for the work on creating and integrating the Mythx api to analyse smart contracts (OBSOLETE NOW)

Nick Addison, Elazar Gershuni, Joe Whittles, Iñigo Villalba, Thien Toan, Jonathan Carter, Stefan Lew, Nikita Savchenko, Josh Stevens, Paul Berg for their contributions.

Sebastian Bürgel for keeping reminding me of the offline installation suppport

David Krmpotic and Ralph Pichler for the original Sublime extension
https://github.com/davidhq/SublimeEthereum

Everyone for their support and feedback!
