import * as fs from "fs"
import * as path from "path"
import { Config, getCurrentProjectInWorkspaceRootFsPath } from "@client/client-config"
import { BaseCommandArgs } from "@client/client-types"
import { CLIENT_COMMAND_LIST } from "@client/commands/commands"
import { Multisolc } from "@shared/compiler/multisolc"
import { SolcOutput } from "@shared/compiler/types-solc"
import { getRemoteSolc, getSolcReleases } from "@shared/compiler/utils"
import { CompilerType } from "@shared/enums"
import type { CompileArgs, SolidityConfig } from "@shared/types"
import * as fsex from "fs-extra"
import * as vscode from "vscode"
import { errorsToDiagnostics } from "./compiler-diagnostics"

const getCompiler = () => vscode.workspace.getConfiguration("solidity").get("compiler") as SolidityConfig["compiler"]
export class ClientCompilers {
	private solcCachePath: string
	public outputChannel: vscode.OutputChannel
	private multisolc: Multisolc

	constructor(solcCachePath: string) {
		this.solcCachePath = solcCachePath
		this.outputChannel = vscode.window.createOutputChannel("Solidity Compiler")
	}

	public printInitializedCompilers() {
		return this.multisolc.printInitializedCompilers(this.outputChannel)
	}

	public async changeSolcType(target: vscode.ConfigurationTarget) {
		try {
			// tslint:disable-next-line:max-line-length
			const compilers: string[] = [
				CompilerType[CompilerType.Remote],
				CompilerType[CompilerType.File],
				CompilerType[CompilerType.NPM],
				CompilerType[CompilerType.Extension],
			]
			const selectedCompiler: string = await vscode.window.showQuickPick(compilers)
			vscode.workspace
				.getConfiguration("solidity")
				.update("compiler", { ...getCompiler(), type: selectedCompiler }, target)
			vscode.window.showInformationMessage(`Compiler changed to: ${selectedCompiler}`)
		} catch (e) {
			vscode.window.showErrorMessage(`Error changing default compiler: ${e}`)
		}
	}

	public async downloadSolcAndSetAsLocal(target: vscode.ConfigurationTarget, folderPath: string) {
		const downloadPath = await this.downloadRemoteVersion(folderPath)
		vscode.workspace.getConfiguration("solidity").update("compiler", { ...getCompiler(), local: downloadPath }, target)
	}

	public async downloadRemoteVersion(folderPath: string): Promise<string> {
		try {
			const releases = await getSolcReleases()
			const releasesToSelect: string[] = []
			// tslint:disable-next-line: forin
			for (const release in releases) {
				releasesToSelect.push(release)
			}
			const selectedVersion: string = await vscode.window.showQuickPick(releasesToSelect)
			let version = ""

			const value: string = releases[selectedVersion]
			if (value !== "undefined") {
				version = value.replace("soljson-", "")
				version = version.replace(".js", "")
			}

			const pathVersion = path.resolve(path.join(folderPath, `soljson-${version}.js`))
			await getRemoteSolc(version, pathVersion)
			vscode.window.showInformationMessage(`Compiler downloaded: ${pathVersion}`)
			return pathVersion
		} catch (e) {
			vscode.window.showErrorMessage(`Error downloading compiler: ${e}`)
		}
	}

	public async selectRemoteVersion(target: vscode.ConfigurationTarget) {
		const releases = await getSolcReleases()
		const releasesToSelect: string[] = ["none", "latest"]
		// tslint:disable-next-line: forin
		for (const release in releases) {
			releasesToSelect.push(release)
		}
		vscode.window.showQuickPick(releasesToSelect).then((selected: string) => {
			let updateValue = ""
			if (selected !== "none") {
				if (selected === "latest") {
					updateValue = selected
				} else {
					const value: string = releases[selected]
					if (value !== "undefined") {
						updateValue = value.replace("soljson-", "")
						updateValue = updateValue.replace(".js", "")
					}
				}
			}
			vscode.workspace
				.getConfiguration("solidity")
				.update("compiler", { ...getCompiler(), remote: updateValue }, target)
		})
	}

	public async printSolcReleases() {
		this.outputChannel.clear()
		this.outputChannel.appendLine("Retrieving solc versions ..")
		try {
			const releases = await getSolcReleases()
			for (const release in releases) {
				this.outputChannel.appendLine(`${release}: ${releases[release]}`)
			}
		} catch (error) {
			this.outputChannel.appendLine(`Error: ${error}`)
		}
	}

	public async compile(commandArgs: BaseCommandArgs, args: CompileArgs): Promise<Array<string>> {
		if (!args.solcInput?.sources) {
			vscode.window.showWarningMessage("No solidity sources to compile!")
			return
		} else {
			const message = `Compiling ${Object.keys(args.solcInput.sources)?.length} files`
			vscode.window.showInformationMessage(message)
			vscode.window.setStatusBarMessage(message)
		}

		try {
			const output = await this.multisolc.compileInputWith(
				args.solcInput,
				args.solcType,
				args.contract.getImportCallback(),
			)

			this.handleOutputFeedback(output)
			return this.processCompilationOutput(commandArgs, output, this.outputChannel, args)
		} catch (e) {
			console.debug("Compile:", e.message)
			this.initializeSolcs(args.solcType).then(async () => {
				const output = await this.multisolc.compileInputWith(
					args.solcInput,
					args.solcType,
					args.contract.getImportCallback(),
				)
				this.handleOutputFeedback(output)
				return this.processCompilationOutput(commandArgs, output, this.outputChannel, args)
			})
		}
	}
	private handleOutputFeedback(output: SolcOutput) {
		if (output.errors?.length) {
			vscode.window.setStatusBarMessage(`Compiled with ${output.errors.length} errors`, 5000)
			vscode.window.showErrorMessage(JSON.stringify(output.errors, null, 2))
		} else {
			vscode.window.setStatusBarMessage("Compiled succesfully.", 5000)
		}
	}
	private outputErrorsToChannel(outputChannel: vscode.OutputChannel, errors: any[]) {
		for (const error of errors) {
			outputChannel.appendLine(error.formattedMessage)
		}
		outputChannel.show(true)
	}

	private outputCompilerInfo(overrideDefaultCompiler: CompilerType = null) {
		this.outputChannel.show(true)
		const compiler = this.multisolc.getCompiler(overrideDefaultCompiler)
		if (compiler.type === CompilerType.File) {
			this.outputChannel.appendLine(
				`Using solc from file: '${compiler.getConfiguration()}', version: ${compiler.getVersion()}`,
			)
		}

		if (compiler.type === CompilerType.NPM) {
			this.outputChannel.appendLine(
				`Using solc from npm: ${compiler.getConfiguration()} version: ${compiler.getVersion()}`,
			)
		}

		if (compiler.type === CompilerType.Remote) {
			this.outputChannel.appendLine(`Using solc from remote, version: ${compiler.getVersion()}`)
		}

		if (compiler.type === CompilerType.Extension) {
			this.outputChannel.appendLine(`Using embedded solc: ${compiler.getVersion()}`)
		}
	}

	public async initializeSolcs(typeOverride: CompilerType = null): Promise<void> {
		this.outputChannel.show(true)
		const multisolcConfig = Config.getCompilerOptions(undefined, undefined, typeOverride)
		const selectedType = typeOverride != null ? typeOverride : multisolcConfig.selectedType

		if (!this.multisolc) {
			this.multisolc = new Multisolc(multisolcConfig, this.solcCachePath, selectedType)
		} else {
			if (this.multisolc.isSolcInitialized(selectedType)) {
				this.outputCompilerInfo(selectedType)
				return
			}
		}

		try {
			await this.multisolc.initializeSolc(selectedType)
			this.outputCompilerInfo(selectedType)
		} catch (error) {
			this.outputChannel.appendLine(
				`Error initializing ${CompilerType[multisolcConfig.selectedType]} solc: ${error} - trying fallback..`,
			)
			await this.multisolc.initializeSolc(CompilerType.Extension)
			this.outputCompilerInfo(selectedType)
		}
	}

	private async processCompilationOutput(
		commandArgs: BaseCommandArgs,
		output: SolcOutput,
		outputChannel: vscode.OutputChannel,
		args: CompileArgs,
	): Promise<Array<string>> {
		await vscode.commands.executeCommand(CLIENT_COMMAND_LIST["solidity.diagnostics.clear"])

		if (Object.keys(output).length === 0) {
			const noOutputMessage = "Compilation output is empty."
			vscode.window.showWarningMessage(noOutputMessage)
			vscode.window.setStatusBarMessage(noOutputMessage)
			outputChannel.appendLine(noOutputMessage)
			return
		}

		if (output.errors?.length) {
			const errorWarningCounts = await errorsToDiagnostics(commandArgs, output.errors)
			this.outputErrorsToChannel(outputChannel, output.errors)

			if (errorWarningCounts.errors > 0) {
				const compilationWithErrorsMessage = `Compile failed with ${errorWarningCounts.errors} errors`
				const warningMessage = errorWarningCounts.warnings > 0 ? ` and ${errorWarningCounts.warnings} warnings.` : ""
				vscode.window.showErrorMessage(compilationWithErrorsMessage + warningMessage)
				vscode.window.showErrorMessage(compilationWithErrorsMessage)
				vscode.window.setStatusBarMessage(compilationWithErrorsMessage)
				outputChannel.appendLine(compilationWithErrorsMessage)
			} else if (errorWarningCounts.warnings > 0) {
				const files = this.writeCompilationOutputToBuildDirectory(
					output,
					args.options.outDir,
					args.options.sourceDir,
					args.options.excludePaths,
					args.contract.absolutePath,
				)
				const compilationWithWarningsMessage = `Compiled with ${errorWarningCounts.warnings} warnings.`
				vscode.window.showWarningMessage(compilationWithWarningsMessage)
				vscode.window.setStatusBarMessage(compilationWithWarningsMessage)
				outputChannel.appendLine(compilationWithWarningsMessage)
				return files
			}
		} else {
			try {
				const files = this.writeCompilationOutputToBuildDirectory(
					output,
					args.options.outDir,
					args.options.sourceDir,
					args.options.excludePaths,
					args.contract.absolutePath,
				)
				const compilationSuccessMessage = "Compiled succesfully."
				vscode.window.showInformationMessage(compilationSuccessMessage)
				vscode.window.setStatusBarMessage(compilationSuccessMessage)
				outputChannel.appendLine(compilationSuccessMessage)
				return files
			} catch (e: any) {
				this.outputChannel.appendLine(e.message)
			}
		}
	}

	private ensureDirectoryExistence(filePath: string) {
		const dirname = path.dirname(filePath)
		if (fs.existsSync(dirname)) {
			return true
		}
		this.ensureDirectoryExistence(dirname)
		fs.mkdirSync(dirname)
	}

	private writeCompilationOutputToBuildDirectory(
		output: SolcOutput,
		buildDir: string,
		sourceDir: string,
		excludePath?: string[],
		singleContractFilePath?: string,
	): Array<string> {
		const rootPath = getCurrentProjectInWorkspaceRootFsPath()
		const binPath = path.join(rootPath, buildDir)
		const compiledFiles: Array<string> = new Array<string>()

		if (!fs.existsSync(binPath)) {
			fs.mkdirSync(binPath)
		}

		if (singleContractFilePath) {
			const relativePath = path.relative(rootPath, singleContractFilePath)
			const dirName = path.dirname(path.join(binPath, relativePath))
			const outputCompilationPath = path.join(
				dirName,
				`${path.basename(singleContractFilePath, ".sol")}-solc-output.json`,
			)
			this.ensureDirectoryExistence(outputCompilationPath)
			fs.writeFileSync(outputCompilationPath, JSON.stringify(output, null, 4))
		} else {
			const dirName = binPath
			const outputCompilationPath = path.join(dirName, "solc-output-compile-all" + ".json")
			this.ensureDirectoryExistence(outputCompilationPath)
			if (fs.existsSync(outputCompilationPath)) {
				fs.unlinkSync(outputCompilationPath)
			}
			fs.writeFileSync(outputCompilationPath, JSON.stringify(output, null, 4))
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
							if (output.contracts[source].hasOwnProperty(contractName)) {
								const contract = output.contracts[source][contractName]
								const relativePath = path.relative(rootPath, source)
								const dirName = path.dirname(path.join(binPath, relativePath))

								if (!fs.existsSync(dirName)) {
									fsex.mkdirsSync(dirName)
								}

								const contractAbiPath = path.join(dirName, `${contractName}.abi`)
								const contractBinPath = path.join(dirName, `${contractName}.bin`)
								const contractJsonPath = path.join(dirName, `${contractName}.json`)

								if (fs.existsSync(contractAbiPath)) {
									fs.unlinkSync(contractAbiPath)
								}

								if (fs.existsSync(contractBinPath)) {
									fs.unlinkSync(contractBinPath)
								}

								if (fs.existsSync(contractJsonPath)) {
									fs.unlinkSync(contractJsonPath)
								}
								if (contract.evm?.bytecode?.object) {
									fs.writeFileSync(contractBinPath, contract.evm.bytecode.object)
								}
								if (contract.abi) {
									fs.writeFileSync(contractAbiPath, JSON.stringify(contract.abi))
								}

								fs.writeFileSync(contractJsonPath, JSON.stringify(contract, null, 2))
								compiledFiles.push(contractJsonPath)
							}
						}
					}
				}
			}
		}
		return compiledFiles
	}
}
