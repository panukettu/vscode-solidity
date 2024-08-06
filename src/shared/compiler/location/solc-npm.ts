import { existsSync } from "node:fs"
import path from "node:path"
import { CompilerType } from "@shared/enums"
import solc from "solc"
import { SolcLoader } from "./loader"
export class NPMSolc extends SolcLoader {
	public type = CompilerType.NPM
	private module: string
	private rootPath: string

	public matchesConfiguration(configuration: string): boolean {
		return configuration === this.module
	}

	public getConfiguration() {
		return this.module
	}

	constructor() {
		super()
		this.module = "solc"
		this.type = CompilerType.NPM
	}

	public initializeConfig(rootPath: string, npmModule = "solc") {
		if (rootPath !== this.rootPath) {
			this.solc = null
			this.rootPath = rootPath
		}

		if (!this.matchesConfiguration(npmModule)) {
			this.module = npmModule
			this.solc = null
		}
	}

	public hasValidConfig(): boolean {
		return this.hasValidSolcModule(this.rootPath)
	}

	public getLocalSolcNodeInstallation() {
		return path.join(this.rootPath, "node_modules", this.module, "soljson.js")
	}

	public hasValidSolcModule(rootPath: string): boolean {
		return existsSync(this.getLocalSolcNodeInstallation())
	}

	public async initializeSolc(): Promise<void> {
		if (this.isSolcInitialized(this.module) || !this.hasValidConfig()) return
		try {
			this.solc = solc.setupMethods(require(this.getLocalSolcNodeInstallation()))
		} catch (e) {
			this.solc = null
			throw new Error(`Error occured, loading solc from npm: ${this.getLocalSolcNodeInstallation()}, ${e}`)
		}
	}
}
