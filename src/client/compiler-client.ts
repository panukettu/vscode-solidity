import type { CompileArgs } from '@shared/types';
import * as fs from 'fs';
import * as fsex from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';

import { Multisolc } from '@shared/compiler/multisolc';
import { SolcOutput } from '@shared/compiler/solc-types';
import { getRemoteSolc, peekSolcReleases } from '@shared/compiler/utils';
import { Config, getCurrentProjectInWorkspaceRootFsPath } from '@shared/config';
import { CompilerType } from '@shared/enums';
import { errorsToDiagnostics } from './compiler/compiler-diagnostics';

export class ClientCompilers {
	private solcCachePath: string;
	public outputChannel: vscode.OutputChannel;
	private multisolc: Multisolc;

	constructor(solcCachePath: string) {
		this.solcCachePath = solcCachePath;
		this.outputChannel = vscode.window.createOutputChannel('Solidity Compiler');
	}

	public printInitializedCompilers() {
		return this.multisolc.printInitializedCompilers(this.outputChannel);
	}

	public async changeSolcType(target: vscode.ConfigurationTarget) {
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

	public async downloadSolcAndSetAsLocal(target: vscode.ConfigurationTarget, folderPath: string) {
		const downloadPath = await this.downloadRemoteVersion(folderPath);
		vscode.workspace.getConfiguration('solidity').update('localSolcVersion', downloadPath, target);
	}

	public async downloadRemoteVersion(folderPath: string): Promise<string> {
		try {
			const releases = await this.peekSolcReleases();
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
			await getRemoteSolc(version, pathVersion);
			vscode.window.showInformationMessage(`Compiler downloaded: ${pathVersion}`);
			return pathVersion;
		} catch (e) {
			vscode.window.showErrorMessage(`Error downloading compiler: ${e}`);
		}
	}

	public async selectRemoteVersion(target: vscode.ConfigurationTarget) {
		const releases = await this.peekSolcReleases();
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
			vscode.workspace.getConfiguration('solidity').update('remoteSolcVersion', updateValue, target);
		});
	}

	public peekSolcReleases(): Promise<any> {
		return peekSolcReleases();
	}

	public async printSolcReleases() {
		this.outputChannel.clear();
		this.outputChannel.appendLine('Retrieving solc versions ..');
		try {
			const releases = await this.peekSolcReleases();
			// tslint:disable-next-line: forin
			for (const release in releases) {
				this.outputChannel.appendLine(`${release}: ${releases[release]}`);
			}
		} catch (error) {
			this.outputChannel.appendLine(`Error: ${error}`);
		}
	}

	public compile(args: CompileArgs): Promise<Array<string>> | string[] {
		if (!this.outputChannel) {
			console.debug('No output channel');
		} else {
			this.outputChannel.clear();
		}
		if (!args.solcInput?.sources) {
			vscode.window.showWarningMessage('No solidity files (*.sol) found');
			return;
		}

		if (!this.multisolc?.isSolcInitialized(args.solcType)) {
			this.initializeSolcs(args.solcType).then(() => {
				return this.processCompilationOutput(
					this.multisolc.compileInputWith(args.solcInput, args.solcType),
					this.outputChannel,
					args
				);
			});
		}
		try {
			const output = this.multisolc.compileInputWith(args.solcInput, args.solcType);
			return this.processCompilationOutput(output, this.outputChannel, args);
		} catch (e) {
			vscode.window.showWarningMessage(`Unhandled (compile): ${e}`);
			throw new Error(`Unhandled (compile): ${e}`);
		}
	}

	private outputErrorsToChannel(outputChannel: vscode.OutputChannel, errors: any[]) {
		for (const error of errors) {
			outputChannel.appendLine(error.formattedMessage);
		}
		outputChannel.show();
	}

	private outputCompilerInfo(overrideDefaultCompiler: CompilerType = null) {
		this.outputChannel.appendLine('Retrieving compiler information:');
		const compiler = this.multisolc.getCompiler(overrideDefaultCompiler);
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

	public async initializeSolcs(typeOverride: CompilerType = null): Promise<void> {
		this.outputChannel.show();
		const multisolcConfig = Config.getCompilerOptions();
		console.debug('CreateClientMultiSolc', multisolcConfig);
		const selectedType = typeOverride != null ? typeOverride : multisolcConfig.selectedType;

		if (!this.multisolc) {
			this.outputChannel.appendLine('no solc initialized, creating.. ' + this.solcCachePath);
			this.multisolc = new Multisolc(multisolcConfig, this.solcCachePath, selectedType);
		} else {
			if (this.multisolc.isSolcInitialized(selectedType)) {
				return;
			}
		}
		this.outputChannel.appendLine('initializing solc..');

		if (selectedType === CompilerType.Remote) {
			this.outputChannel.appendLine('A few seconds may be needed to download the solc binaries..');
		}
		this.outputChannel.show();

		try {
			this.outputChannel.appendLine(`Initializing solc: ${CompilerType[multisolcConfig.selectedType]}`);
			await this.multisolc.initializeSolc(selectedType);
		} catch (error) {
			this.outputChannel.appendLine(`Error: ${error}`);
			await this.multisolc.initializeSolc(CompilerType.Default);
			vscode.window.showWarningMessage(error.message);
		}

		this.outputCompilerInfo(typeOverride);
	}

	private processCompilationOutput(
		output: SolcOutput,
		outputChannel: vscode.OutputChannel,
		args: CompileArgs
	): Array<string> {
		if (Object.keys(output).length === 0) {
			const noOutputMessage = 'Compilation output is empty.';
			vscode.window.showWarningMessage(noOutputMessage);
			vscode.window.setStatusBarMessage(noOutputMessage);
			outputChannel.appendLine(noOutputMessage);
			return;
		}

		args.state.diagnostics.clear();
		if (output.errors) {
			const errorWarningCounts = errorsToDiagnostics(args.state.diagnostics, output.errors);
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
					args.options.outDir,
					args.options.sourceDir,
					args.options.excludePaths,
					args.contractPath
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
					args.options.outDir,
					args.options.sourceDir,
					args.options.excludePaths,
					args.contractPath
				);
				const compilationSuccessMessage = 'Compiled succesfully.';
				vscode.window.showInformationMessage(compilationSuccessMessage);
				vscode.window.setStatusBarMessage(compilationSuccessMessage);
				outputChannel.appendLine(compilationSuccessMessage);
				return files;
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
		output: SolcOutput,
		buildDir: string,
		sourceDir: string,
		excludePath?: string[],
		singleContractFilePath?: string
	): Array<string> {
		const rootPath = getCurrentProjectInWorkspaceRootFsPath();
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
								if (contract.evm?.bytecode?.object) {
									fs.writeFileSync(contractBinPath, contract.evm.bytecode.object);
								}
								if (contract.abi) {
									fs.writeFileSync(contractAbiPath, JSON.stringify(contract.abi));
								}

								fs.writeFileSync(contractJsonPath, JSON.stringify(contract, null, 2));
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
