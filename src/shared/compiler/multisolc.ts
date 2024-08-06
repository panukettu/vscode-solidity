import { errorToDiagnostic } from "@server/providers/utils/diagnostics"
import { CompilerType } from "@shared/enums"
import type { Project } from "@shared/project/project"
import type { SourceDocument } from "@shared/project/sourceDocument"
import type { MultisolcSettings, SolcExtras, SolidityConfig } from "@shared/types"
import { ExtensionSolc } from "./location/solc-default"
import { LocalSolc } from "./location/solc-local"
import { NPMSolc } from "./location/solc-npm"
import { RemoteSolc } from "./location/solc-remote"
import type { ContractLevelSolcOutput, SolcArgs, SolcInput, SolcOutput } from "./types-solc"
import { mergeUnique } from "./utils"

export class Multisolc {
	public rootPath: string
	public npm: NPMSolc
	public local: LocalSolc
	public remote: RemoteSolc
	public extension: ExtensionSolc
	public type: CompilerType
	public settings: MultisolcSettings
	public outputChannel: any

	constructor(settings: MultisolcSettings, cachePath?: string, typeOverride?: CompilerType) {
		this.rootPath = settings.rootPath
		this.npm = new NPMSolc()
		this.local = new LocalSolc()
		this.remote = new RemoteSolc(cachePath)
		this.extension = new ExtensionSolc()
		this.type = typeOverride || settings.compiler.type
		this.settings = settings
		this.initExternalCompilers(settings, typeOverride)
	}

	public setRemoteSolcCache(solcCachePath: string): void {
		this.remote.setSolcCache(solcCachePath)
	}

	public isRootPathSet(): boolean {
		return this.rootPath != null
	}

	public isSolcInitialized(selectedType = CompilerType.Extension): boolean {
		let result = false
		switch (selectedType) {
			case CompilerType.Extension:
				result = this.extension.isSolcInitialized()
				break
			case CompilerType.NPM:
				result = this.npm.isSolcInitialized(this.settings.compiler.npm)
				break
			case CompilerType.File:
				result = this.local.isSolcInitialized(this.settings.compiler.local)
				break
			case CompilerType.Remote:
				result = this.remote.isSolcInitialized(this.settings.compiler.remote)
				break
		}

		return result
	}

	public initExternalCompilers(settings: MultisolcSettings, typeOverride?: CompilerType) {
		this.npm.initializeConfig(this.rootPath, settings.compiler.npm)
		this.remote.initializeConfig(settings.compiler.remote)
		this.local.initializeConfig(settings.compiler.local)
		this.type = typeOverride || settings.compiler.type
		this.settings = settings
	}

	public async initializeSolc(type: CompilerType): Promise<void> {
		await this.getCompiler(type).initializeSolc()
	}

	public async compileWith(args: SolcArgs): Promise<SolcOutput> {
		try {
			const compiler = this.getCompiler(args.type)
			if (!compiler?.solc?.compile) {
				await this.initializeSolc(args.type)
			}

			const result = JSON.parse(compiler.solc.compile(JSON.stringify(args.input), args.callbacks)) as SolcOutput
			if (result?.errors?.length) result.errors = result.errors.filter((error) => error.errorCode !== "3805")

			return result
		} catch (e) {
			console.debug("Unhandled (compile):", e)
		}
	}

	public getCompiler(type: CompilerType = this.type) {
		switch (type) {
			case CompilerType.Extension:
				return this.extension
			case CompilerType.NPM:
				return this.npm
			case CompilerType.File:
				return this.local
			case CompilerType.Remote:
				return this.remote
			default:
				return this.extension
		}
	}

	public printInitializedCompilers(channel: any) {
		if (this.npm.isSolcInitialized(this.settings.compiler.npm)) {
			channel.appendLine(`Compiler type: ${CompilerType[CompilerType.NPM]} solc version: ${this.npm.getVersion()}`)
		}
		if (this.local.isSolcInitialized(this.settings.compiler.local)) {
			channel.appendLine(`Compiler type: ${CompilerType[CompilerType.File]} solc version: ${this.local.getVersion()}`)
		}
		if (this.remote.isSolcInitialized(this.settings.compiler.remote)) {
			channel.appendLine(
				`Compiler type: ${CompilerType[CompilerType.Remote]} solc version: ${this.remote.getVersion()}`,
			)
		}
		if (this.extension.isSolcInitialized()) {
			channel.appendLine(
				`Compiler type: ${CompilerType[CompilerType.Extension]} solc version: ${this.extension.getVersion()}`,
			)
		}
	}

	public async compileWithDiagnostic(project: Project, filePath: string, documentText: string) {
		const callbacks = project.contracts.addSourceDocumentAndResolveImports(filePath, documentText).getImportCallback()
		if (!this.isRootPathSet()) {
			const result = await this.compileWith({
				input: {
					language: "Solidity",
					sources: {
						[filePath]: {
							content: documentText,
						},
					},
				},
				callbacks,
			})
			return result.errors?.map(errorToDiagnostic) ?? []
		}

		const input = project.getMinSolcInput()

		try {
			return (await this.compileWith({ input, callbacks })).errors?.map(errorToDiagnostic) ?? []
		} catch (error: any) {
			if (this.isSolcInitialized(project.solc.compiler.type)) return []

			await this.initializeSolc(project.solc.compiler.type)

			const output = await this.compileWith({ input, callbacks })
			return output?.errors?.map(errorToDiagnostic) ?? []
		}
	}

	public static selectSolcOutputs(outputs: ContractLevelSolcOutput[] = []) {
		return {
			"*": {
				"": [],
				"*": outputs,
			},
		}
	}
	public static getSettings(project: Project, extras?: Partial<SolcExtras>) {
		return {
			input: {
				language: "Solidity",
				settings: {
					...project.solc.settings.input,
					evmVersion: project.solc.settings.input.evmVersion ?? "cancun",
					remappings: project.remappings.map((r) => r.value).concat(project.solc.settings.input.remappings ?? []),
					outputSelection: extras?.outputs ?? project.solc.settings?.input?.outputSelection,
				},
				sources: extras?.sources,
			},
			document: extras?.document,
			excludePaths: (extras?.exclusions ?? []).concat(project.excludes),
			rootPath: project.rootPath,
			sourceDir: extras?.sourceDir ?? project.src,
			compiler: { ...project.solc.compiler, type: extras?.type ?? project.solc.compiler.type },
		} satisfies MultisolcSettings
	}
}
