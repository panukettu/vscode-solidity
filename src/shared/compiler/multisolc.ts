import { errorToDiagnostic } from "@server/providers/utils/diagnostics"
import { getConfig } from "@server/server-config"
import { CompilerType } from "@shared/enums"
import { Project } from "@shared/project/project"
import type { SourceDocument } from "@shared/project/sourceDocument"
import { SourceDocumentCollection } from "@shared/project/sourceDocuments"
import type { MultisolcSettings, SolidityConfig } from "@shared/types"
import { ExtensionSolc } from "./location/solc-default"
import { LocalSolc } from "./location/solc-local"
import { NPMSolc } from "./location/solc-npm"
import { RemoteSolc } from "./location/solc-remote"
import type { SolcArgs, SolcInput, SolcOutput } from "./types-solc"

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
		this.type = typeOverride || settings.selectedType
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
				result = this.npm.isSolcInitialized(this.settings.npmSolcPackage)
				break
			case CompilerType.File:
				result = this.local.isSolcInitialized(this.settings.localSolcVersion)
				break
			case CompilerType.Remote:
				result = this.remote.isSolcInitialized(this.settings.remoteSolcVersion)
				break
		}

		return result
	}

	public initExternalCompilers(settings: MultisolcSettings, typeOverride?: CompilerType) {
		this.npm.initializeConfig(this.rootPath, settings.npmSolcPackage)
		this.remote.initializeConfig(settings.remoteSolcVersion)
		this.local.initializeConfig(settings.localSolcVersion)
		this.type = typeOverride || settings.selectedType
		this.settings = settings
	}

	public async initializeSolc(type: CompilerType): Promise<void> {
		const compiler = this.getCompiler(type)
		await compiler.initializeSolc()
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
		if (this.npm.isSolcInitialized(this.settings.npmSolcPackage)) {
			channel.appendLine(`Compiler type: ${CompilerType[CompilerType.NPM]} solc version: ${this.npm.getVersion()}`)
		}
		if (this.local.isSolcInitialized(this.settings.localSolcVersion)) {
			channel.appendLine(`Compiler type: ${CompilerType[CompilerType.File]} solc version: ${this.local.getVersion()}`)
		}
		if (this.remote.isSolcInitialized(this.settings.remoteSolcVersion)) {
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

	public async compileWithDiagnostic(filePath: string, documentText: string) {
		const config = getConfig()
		if (!this.isSolcInitialized(config.compiler.type)) {
			await this.initializeSolc(config.compiler.type)
		}

		if (!this.isRootPathSet()) {
			const output = await this.compileWith({
				input: {
					language: "Solidity",
					settings: {
						evmVersion: "cancun",
					},
					sources: {
						[filePath]: {
							content: documentText,
						},
					},
				},
			})
			return output.errors?.map(errorToDiagnostic) ?? []
		}

		const project = new Project(config, this.rootPath)

		try {
			const output = await this.compileWith({
				input: project.getMinSolcInput(),
				type: config.compiler.type,
				callbacks: project.getImportCallback(project.addSource(filePath, documentText)),
			})
			return output.errors?.map(errorToDiagnostic) ?? []
		} catch (error: any) {
			console.debug("compileWithDiagnostic:", error.message)
		}
	}

	public static getSettings(
		project: Project,
		document?: SourceDocument,
		overrides?: {
			sources?: SolcInput["sources"]
			exclusions?: string[]
			sourceDir?: string
			type?: CompilerType
		},
	): MultisolcSettings {
		const { settings, compiler } = project.solc
		const { input, output } = settings
		if (!input?.outputSelection)
			input.outputSelection = {
				"*": { "*": output, "": [] },
			}
		return {
			input: {
				language: "Solidity",
				sources: overrides?.sources,
				settings: {
					...input,
					remappings: project.getRawRemappings().concat(input.remappings ?? []),
				},
			},
			document,
			excludePaths: (overrides?.exclusions ?? []).concat(project.excludes),
			rootPath: project.rootPath,
			sourceDir: overrides.sourceDir ?? project.src,
			outDir: project.projectPackage.outDir,
			remoteSolcVersion: compiler.remote,
			localSolcVersion: compiler.local,
			npmSolcPackage: compiler.npm,
			selectedType: overrides?.type ?? compiler.type,
		}
	}
}
