import * as fs from 'fs';
import * as path from 'path';
import * as fsex from 'fs-extra';
import * as vscode from 'vscode';
import { CompilerType, RemoteCompilerDownloader, RemoteReleases, SolcCompiler } from '../common/solcCompiler';
import { SolidityConfig } from '../server/types';
import { errorsToDiagnostics } from './solErrorsToDiaganosticsClient';
import * as workspaceUtil from './workspaceUtil';

export class Compiler {
	private solcCachePath: string;
	private outputChannel: vscode.OutputChannel;
	private solc: SolcCompiler;

	constructor(solcCachePath: string) {
		this.solcCachePath = solcCachePath;
		this.outputChannel = vscode.window.createOutputChannel('Solidity Compiler');
	}

	public outputCompilerInfoEnsuringInitialised() {
		// initialise compiler outputs the information and validates existing settings
		return this.initialiseCompiler();
	}

	public async changeDefaultCompilerType(target: vscode.ConfigurationTarget) {
		try {
			// tslint:disable-next-line:max-line-length
			const compilers: string[] = [
				CompilerType[CompilerType.Remote],
				CompilerType[CompilerType.File],
				CompilerType[CompilerType.NPM],
				CompilerType[CompilerType.Default],
			];
			const selectedCompiler: string = await vscode.window.showQuickPick(compilers);
			vscode.workspace.getConfiguration('solidity').update('defaultCompiler', selectedCompiler, target);
			vscode.window.showInformationMessage(`Compiler changed to: ${selectedCompiler}`);
		} catch (e) {
			vscode.window.showErrorMessage(`Error changing default compiler: ${e}`);
		}
	}

	public async downloadRemoteVersionAndSetLocalPathSetting(target: vscode.ConfigurationTarget, folderPath: string) {
		const downloadPath = await this.downloadRemoteVersion(folderPath);
		vscode.workspace.getConfiguration('solidity').update('compileUsingLocalVersion', downloadPath, target);
	}

	public async downloadRemoteVersion(folderPath: string): Promise<string> {
		try {
			const releases = await this.getSolcReleases();
			const releasesToSelect: string[] = [];
			// tslint:disable-next-line: forin
			for (const release in releases) {
				releasesToSelect.push(release);
			}
			const selectedVersion: string = await vscode.window.showQuickPick(releasesToSelect);
			let version = '';

			const value: string = releases[selectedVersion];
			if (value !== 'undefined') {
				version = value.replace('soljson-', '');
				version = version.replace('.js', '');
			}
			const pathVersion = path.resolve(path.join(folderPath, `soljson-${version}.js`));
			await new RemoteCompilerDownloader().downloadCompilationFile(version, pathVersion);
			vscode.window.showInformationMessage(`Compiler downloaded: ${pathVersion}`);
			return pathVersion;
		} catch (e) {
			vscode.window.showErrorMessage(`Error downloading compiler: ${e}`);
		}
	}

	public async selectRemoteVersion(target: vscode.ConfigurationTarget) {
		const releases = await this.getSolcReleases();
		const releasesToSelect: string[] = ['none', 'latest'];
		// tslint:disable-next-line: forin
		for (const release in releases) {
			releasesToSelect.push(release);
		}
		vscode.window.showQuickPick(releasesToSelect).then((selected: string) => {
			let updateValue = '';
			if (selected !== 'none') {
				if (selected === 'latest') {
					updateValue = selected;
				} else {
					const value: string = releases[selected];
					if (value !== 'undefined') {
						updateValue = value.replace('soljson-', '');
						updateValue = updateValue.replace('.js', '');
					}
				}
			}
			vscode.workspace.getConfiguration('solidity').update('compileUsingRemoteVersion', updateValue, target);
		});
	}

	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	public getSolcReleases(): Promise<any> {
		return new RemoteReleases().getSolcReleases();
	}

	public async outputSolcReleases() {
		this.outputChannel.clear();
		this.outputChannel.appendLine('Retrieving solc versions ..');
		try {
			const releases = await this.getSolcReleases();
			// tslint:disable-next-line: forin
			for (const release in releases) {
				this.outputChannel.appendLine(`${release}: ${releases[release]}`);
			}
		} catch (error) {
			this.outputChannel.appendLine(`Error: ${error}`);
		}
	}

	public async compile({
		contracts,
		diagnosticCollection,
		buildDir,
		rootDir,
		sourceDir,
		excludePath,
		singleContractFilePath,
		overrideDefaultCompiler,
	}: {
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		contracts: any;
		diagnosticCollection: vscode.DiagnosticCollection;
		buildDir: string;
		rootDir: string;
		sourceDir: string;
		excludePath?: string[];
		singleContractFilePath?: string;
		overrideDefaultCompiler?: CompilerType;
	}): Promise<Array<string>> {
		// Did we find any sol files after all?
		if (Object.keys(contracts).length === 0) {
			vscode.window.showWarningMessage('No solidity files (*.sol) found');
			return;
		}
		return new Promise((resolve, reject) => {
			this.initialiseCompiler(overrideDefaultCompiler).then(() => {
				try {
					this.outputChannel.appendLine(`Compiling ${Object.keys(contracts.sources).length} source files..`);
					const output = this.solc.compile(JSON.stringify(contracts), overrideDefaultCompiler);
					resolve(
						this.processCompilationOutput(
							output,
							this.outputChannel,
							diagnosticCollection,
							buildDir,
							sourceDir,
							excludePath,
							singleContractFilePath
						)
					);
				} catch (reason) {
					vscode.window.showWarningMessage(reason);
					reject(reason);
				}
			});
		});
	}

	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	private outputErrorsToChannel(outputChannel: vscode.OutputChannel, errors: any[]) {
		for (const error of errors) {
			outputChannel.appendLine(error.formattedMessage);
		}
		outputChannel.show();
	}

	private outputCompilerInfo(overrideDefaultCompiler: CompilerType = null) {
		this.outputChannel.clear();
		this.outputChannel.show();
		this.outputChannel.appendLine('Retrieving compiler information:');
		const compiler = this.solc.getCompiler(overrideDefaultCompiler);
		if (compiler.type === CompilerType.File) {
			this.outputChannel.appendLine(
				`Using solc from file: '${compiler.getConfiguration()}', version: ${compiler.getVersion()}`
			);
		}

		if (compiler.type === CompilerType.NPM) {
			this.outputChannel.appendLine(
				`Using solc from npm: ${compiler.getConfiguration()} version: ${compiler.getVersion()}`
			);
		}

		if (compiler.type === CompilerType.Remote) {
			this.outputChannel.appendLine(
				`Using solc from remote: '${compiler.getConfiguration()}', version: ${compiler.getVersion()}`
			);
		}

		if (compiler.type === CompilerType.Default) {
			this.outputChannel.appendLine(`Using embedded solc: ${compiler.getVersion()}`);
		}
	}

	private initialiseCompiler(compilerTypeOverride: CompilerType = null): Promise<void> {
		const rootPath = workspaceUtil.getCurrentProjectInWorkspaceRootFsPath();

		if (this.solc == null) {
			this.solc = new SolcCompiler(rootPath);
			this.solc.setSolcCache(this.solcCachePath);
		}
		this.outputChannel.appendLine(this.solcCachePath);
		this.outputChannel.clear();
		this.outputChannel.show();
		const compileUsingRemoteVersion = vscode.workspace
			.getConfiguration('solidity')
			.get<string>('compileUsingRemoteVersion');
		const compileUsingLocalVersion = vscode.workspace
			.getConfiguration('solidity')
			.get<string>('compileUsingLocalVersion');
		const compilerPackage = vscode.workspace.getConfiguration('solidity').get<string>('compilerPackage');
		const compilerSetting = vscode.workspace.getConfiguration('solidity').get<string>('compilerType');
		const selectedType = CompilerType[compilerSetting];
		this.outputChannel.appendLine('Compilers:');
		this.outputChannel.appendLine(`Remote: ${compileUsingRemoteVersion}`);
		this.outputChannel.appendLine(`Local: ${compileUsingLocalVersion}`);
		this.outputChannel.appendLine(`npm: ${compilerPackage}`);
		if (compilerTypeOverride != null) {
			this.outputChannel.appendLine(`Compiling with: ${CompilerType[compilerTypeOverride]}`);
		}
		this.outputChannel.appendLine('A few seconds may be needed to download the solc binaries..');
		return new Promise((resolve, reject) => {
			try {
				this.solc.initialiseAllCompilerSettings(
					{
						compileUsingRemoteVersion,
						compileUsingLocalVersion,
						compilerPackage,
					} as SolidityConfig,
					selectedType
				);

				if (!compilerTypeOverride) {
					this.solc
						.initialiseSelectedCompiler()
						.then(() => {
							this.outputCompilerInfo();
							resolve();
						})
						.catch((reason: string) => {
							vscode.window.showWarningMessage(reason);
							reject(reason);
						});
				} else {
					this.solc
						.initialiseCompiler(compilerTypeOverride)
						.then(() => {
							this.outputCompilerInfo(compilerTypeOverride);
							resolve();
						})
						.catch((reason: string) => {
							vscode.window.showWarningMessage(reason);
							reject(reason);
						});
				}
			} catch (e) {
				console.debug('Compiler Initialization Failed:', e.message);
			}
		});
	}

	private processCompilationOutput(
		outputString: string,
		outputChannel: vscode.OutputChannel,
		diagnosticCollection: vscode.DiagnosticCollection,
		buildDir: string,
		sourceDir: string,
		excludePath?: string[],
		singleContractFilePath?: string
	): Array<string> {
		const output = JSON.parse(outputString);
		if (Object.keys(output).length === 0) {
			const noOutputMessage = 'Compiled but output is empty.';
			vscode.window.showWarningMessage(noOutputMessage);
			vscode.window.setStatusBarMessage(noOutputMessage);
			outputChannel.appendLine(noOutputMessage);
			return;
		}

		diagnosticCollection.clear();
		if (output.errors) {
			const errorWarningCounts = errorsToDiagnostics(diagnosticCollection, output.errors);
			this.outputErrorsToChannel(outputChannel, output.errors);

			if (errorWarningCounts.errors > 0) {
				const compilationWithErrorsMessage = `Compile failed with ${errorWarningCounts.errors} errors`;
				const warningMessage = errorWarningCounts.warnings > 0 ? ` and ${errorWarningCounts.warnings} warnings.` : '';
				vscode.window.showErrorMessage(compilationWithErrorsMessage + warningMessage);
				vscode.window.showErrorMessage(compilationWithErrorsMessage);
				vscode.window.setStatusBarMessage(compilationWithErrorsMessage);
				outputChannel.appendLine(compilationWithErrorsMessage);
			} else if (errorWarningCounts.warnings > 0) {
				const files = this.writeCompilationOutputToBuildDirectory(
					output,
					buildDir,
					sourceDir,
					excludePath,
					singleContractFilePath
				);
				const compilationWithWarningsMessage = `Compiled with ${errorWarningCounts.warnings} warnings.`;
				vscode.window.showWarningMessage(compilationWithWarningsMessage);
				vscode.window.setStatusBarMessage(compilationWithWarningsMessage);
				outputChannel.appendLine(compilationWithWarningsMessage);
				return files;
			}
		} else {
			try {
				const files = this.writeCompilationOutputToBuildDirectory(
					output,
					buildDir,
					sourceDir,
					excludePath,
					singleContractFilePath
				);
				const compilationSuccessMessage = 'Compiled succesfully.';
				vscode.window.showInformationMessage(compilationSuccessMessage);
				vscode.window.setStatusBarMessage(compilationSuccessMessage);
				outputChannel.appendLine(compilationSuccessMessage);
				return files;
				// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			} catch (e: any) {
				this.outputChannel.appendLine(e.message);
			}
		}
	}

	private ensureDirectoryExistence(filePath: string) {
		const dirname = path.dirname(filePath);
		if (fs.existsSync(dirname)) {
			return true;
		}
		this.ensureDirectoryExistence(dirname);
		fs.mkdirSync(dirname);
	}

	private writeCompilationOutputToBuildDirectory(
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		output: { contracts: any; sources: any },
		buildDir: string,
		sourceDir: string,
		excludePath?: string[],
		singleContractFilePath?: string
	): Array<string> {
		const rootPath = workspaceUtil.getCurrentProjectInWorkspaceRootFsPath();
		const binPath = path.join(rootPath, buildDir);
		const compiledFiles: Array<string> = new Array<string>();

		if (!fs.existsSync(binPath)) {
			fs.mkdirSync(binPath);
		}

		if (singleContractFilePath) {
			const relativePath = path.relative(rootPath, singleContractFilePath);
			const dirName = path.dirname(path.join(binPath, relativePath));
			const outputCompilationPath = path.join(
				dirName,
				`${path.basename(singleContractFilePath, '.sol')}-solc-output.json`
			);
			this.ensureDirectoryExistence(outputCompilationPath);
			fs.writeFileSync(outputCompilationPath, JSON.stringify(output, null, 4));
		} else {
			const dirName = binPath;
			const outputCompilationPath = path.join(dirName, 'solc-output-compile-all' + '.json');
			this.ensureDirectoryExistence(outputCompilationPath);
			if (fs.existsSync(outputCompilationPath)) {
				fs.unlinkSync(outputCompilationPath);
			}
			fs.writeFileSync(outputCompilationPath, JSON.stringify(output, null, 4));
		}

		// iterate through all the sources,
		// find contracts and output them into the same folder structure to avoid collisions, named as the contract
		for (const source in output.contracts) {
			// TODO: ALL this validation to a method

			// Output only single contract compilation or all
			if (!singleContractFilePath || source === singleContractFilePath) {
				if (!excludePath || !excludePath.some((x) => source.startsWith(x))) {
					// Output only source directory compilation or all (this will exclude external references)
					if (!sourceDir || source.startsWith(sourceDir)) {
						for (const contractName in output.contracts[source]) {
							// biome-ignore lint/suspicious/noPrototypeBuiltins: <explanation>
							if (output.contracts[source].hasOwnProperty(contractName)) {
								const contract = output.contracts[source][contractName];
								const relativePath = path.relative(rootPath, source);
								const dirName = path.dirname(path.join(binPath, relativePath));

								if (!fs.existsSync(dirName)) {
									fsex.mkdirsSync(dirName);
								}

								const contractAbiPath = path.join(dirName, `${contractName}.abi`);
								const contractBinPath = path.join(dirName, `${contractName}.bin`);
								const contractJsonPath = path.join(dirName, `${contractName}.json`);

								if (fs.existsSync(contractAbiPath)) {
									fs.unlinkSync(contractAbiPath);
								}

								if (fs.existsSync(contractBinPath)) {
									fs.unlinkSync(contractBinPath);
								}

								if (fs.existsSync(contractJsonPath)) {
									fs.unlinkSync(contractJsonPath);
								}

								fs.writeFileSync(contractBinPath, contract.evm.bytecode.object);
								fs.writeFileSync(contractAbiPath, JSON.stringify(contract.abi));

								let version = '';
								try {
									version = JSON.parse(contract.metadata).compiler.version;
									// tslint:disable-next-line: no-empty
								} catch {} // i could do a check for string.empty but this catches (literally :) ) all scenarios

								const shortJsonOutput = {
									contractName,
									// tslint:disable-next-line:object-literal-sort-keys
									abi: contract.abi,
									metadata: contract.metadata,
									bytecode: contract.evm.bytecode.object,
									deployedBytecode: contract.evm.deployedBytecode.object,
									sourceMap: contract.evm.bytecode.sourceMap,
									deployedSourceMap: contract.evm.deployedBytecode.sourceMap,
									sourcePath: source,
									compiler: {
										name: 'solc',
										version: version,
									},
									ast: output.sources[source].ast,
									functionHashes: contract.evm.methodIdentifiers,
									gasEstimates: contract.evm.gasEstimates,
								};

								fs.writeFileSync(contractJsonPath, JSON.stringify(shortJsonOutput, null, 4));
								compiledFiles.push(contractJsonPath);
							}
						}
					}
				}
			}
		}
		return compiledFiles;
	}
}
