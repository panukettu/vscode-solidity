import * as fs from "node:fs"
import * as path from "node:path"
import { Config, getCurrentProjectInWorkspaceRootFsPath, getRootFsPath } from "@client/client-config"
import type { BaseCommandArgs } from "@client/client-types"
import { CLIENT_COMMAND_LIST } from "@client/commands/commands"
import { Multisolc } from "@shared/compiler/multisolc"
import type { Callbacks, SolcOutput } from "@shared/compiler/types-solc"
import { getRemoteSolc, getSolcReleases } from "@shared/compiler/utils"
import { CompilerType } from "@shared/enums"
import { Project } from "@shared/project/project"
import type { MultisolcSettings, SolidityConfig } from "@shared/types"
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

	public async setType(target: vscode.ConfigurationTarget) {
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

	public async compile(commandArgs: BaseCommandArgs, solc: MultisolcSettings, callbacks: Callbacks) {
		if (!solc.input?.sources) {
			vscode.window.showWarningMessage("No solidity sources to compile!")
			return
		}
		const message = `Compiling ${Object.keys(solc.input.sources)?.length} files`
		vscode.window.showInformationMessage(message)
		vscode.window.setStatusBarMessage(message)

		try {
			const output = await this.multisolc.compileWith({
				input: solc.input,
				type: solc.compiler.type,
				callbacks,
			})
			return this.processCompilationOutput(commandArgs, output, this.outputChannel, solc)
		} catch (e) {
			console.debug("Compile:", e.message)
			vscode.window.setStatusBarMessage("Unhandled error.", 7500)
			vscode.window.showErrorMessage(e.message)
			return []
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
		for (const error of errors) outputChannel.appendLine(error.formattedMessage)
		outputChannel.show(true)
	}

	private outputCompilerInfo(override: CompilerType = null) {
		this.outputChannel.show(true)
		const compiler = this.multisolc.getCompiler(override)
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

	public async initializeSolcs(solc?: MultisolcSettings, override: CompilerType = null): Promise<void> {
		this.outputChannel.show(true)
		const cfg =
			solc ??
			Multisolc.getSettings(new Project(Config.all(), getRootFsPath()), {
				type: override,
			})

		if (!this.multisolc) this.multisolc = new Multisolc(cfg, this.solcCachePath)
		else {
			if (this.multisolc.isSolcInitialized(cfg.compiler.type)) {
				this.outputCompilerInfo(cfg.compiler.type)
				return
			}
		}

		try {
			await this.multisolc.initializeSolc(cfg.compiler.type)
			this.outputCompilerInfo(cfg.compiler.type)
		} catch (error) {
			this.outputChannel.appendLine(
				`Error initializing ${CompilerType[cfg.compiler.type]} solc: ${error} - trying fallback..`,
			)
			await this.multisolc.initializeSolc(CompilerType.Extension)
			this.outputCompilerInfo(CompilerType.Extension)
		}
	}

	private async processCompilationOutput(
		commandArgs: BaseCommandArgs,
		output: SolcOutput,
		outputChannel: vscode.OutputChannel,
		solc: MultisolcSettings,
	) {
		this.handleOutputFeedback(output)
		await vscode.commands.executeCommand(CLIENT_COMMAND_LIST["solidity.diagnostics.clear"])

		if (Object.keys(output).length === 0) {
			const emptyOut = "Compilation output is empty."
			vscode.window.showWarningMessage(emptyOut)
			vscode.window.setStatusBarMessage(emptyOut)
			outputChannel.appendLine(emptyOut)
			return
		}

		if (output.errors?.length) {
			const errWarns = await errorsToDiagnostics(commandArgs, output.errors)
			this.outputErrorsToChannel(outputChannel, output.errors)

			if (errWarns.errors > 0) {
				const withErrs = `Compile failed with ${errWarns.errors} errors`
				const warning = errWarns.warnings > 0 ? ` and ${errWarns.warnings} warnings.` : ""
				vscode.window.showErrorMessage(withErrs + warning)
				vscode.window.showErrorMessage(withErrs)
				vscode.window.setStatusBarMessage(withErrs)
				outputChannel.appendLine(withErrs)
			} else if (errWarns.warnings > 0) {
				const files = this.emit(
					output,
					solc.compiler.outDir,
					solc.sourceDir,
					solc.excludePaths,
					solc.document?.absolutePath,
				)
				const withWarns = `Compiled with ${errWarns.warnings} warnings.`
				vscode.window.showWarningMessage(withWarns)
				vscode.window.setStatusBarMessage(withWarns)
				outputChannel.appendLine(withWarns)
				return files
			}
		} else {
			try {
				const files = this.emit(
					output,
					solc.compiler.outDir,
					solc.sourceDir,
					solc.excludePaths,
					solc.document?.absolutePath,
				)
				const message = "Compiled succesfully."
				vscode.window.showInformationMessage(message)
				vscode.window.setStatusBarMessage(message)
				outputChannel.appendLine(message)
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

	private emit(
		output: SolcOutput,
		buildDir: string,
		sourceDir: string,
		excludePath?: string[],
		sourcePath?: string,
	): Array<string> {
		const rootPath = getCurrentProjectInWorkspaceRootFsPath()
		const binPath = path.join(rootPath, buildDir)
		const compiledFiles: Array<string> = new Array<string>()

		if (!fs.existsSync(binPath)) {
			fs.mkdirSync(binPath)
		}

		if (sourcePath) {
			const relativePath = path.relative(rootPath, sourcePath)
			const dirName = path.dirname(path.join(binPath, relativePath))
			const out = path.join(dirName, `${path.basename(sourcePath, ".sol")}-solc-output.json`)
			this.ensureDirectoryExistence(out)
			fs.writeFileSync(out, JSON.stringify(output, null, 4))
		} else {
			const dirName = binPath
			const out = path.join(dirName, "solc-output-compile-all" + ".json")
			this.ensureDirectoryExistence(out)
			if (fs.existsSync(out)) {
				fs.unlinkSync(out)
			}
			fs.writeFileSync(out, JSON.stringify(output, null, 4))
		}

		// iterate through all the sources,
		// find contracts and output them into the same folder structure to avoid collisions, named as the contract
		for (const source in output.contracts) {
			// TODO: ALL this validation to a method

			// Output only single contract compilation or all
			if (!sourcePath || source === sourcePath) {
				if (!excludePath || !excludePath.some((x) => source.startsWith(x))) {
					// Output only source directory compilation or all (this will exclude external references)
					if (!sourceDir || source.startsWith(sourceDir)) {
						for (const name in output.contracts[source]) {
							if (output.contracts[source].hasOwnProperty(name)) {
								const contract = output.contracts[source][name]
								const relativePath = path.relative(rootPath, source)
								const dirName = path.dirname(path.join(binPath, relativePath))

								if (!fs.existsSync(dirName)) fsex.mkdirsSync(dirName)

								const abiOut = path.join(dirName, `${name}.abi`)
								const binOut = path.join(dirName, `${name}.bin`)
								const jsonOut = path.join(dirName, `${name}.json`)

								if (fs.existsSync(abiOut)) fs.unlinkSync(abiOut)
								if (fs.existsSync(binOut)) fs.unlinkSync(binOut)
								if (fs.existsSync(jsonOut)) fs.unlinkSync(jsonOut)
								if (contract.evm?.bytecode?.object) fs.writeFileSync(binOut, contract.evm.bytecode.object)
								if (contract.abi) fs.writeFileSync(abiOut, JSON.stringify(contract.abi))

								fs.writeFileSync(jsonOut, JSON.stringify(contract, null, 2))
								compiledFiles.push(jsonOut)
							}
						}
					}
				}
			}
		}
		return compiledFiles
	}
}
