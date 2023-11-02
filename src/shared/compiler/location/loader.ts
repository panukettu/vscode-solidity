import { CompilerType } from "@shared/enums"
import type { SolcWrapper } from "../types-solc"
export abstract class SolcLoader {
	public abstract type: CompilerType

	public solc: SolcWrapper

	public getVersion(): string {
		return this.solc.version()
	}

	public abstract matchesConfiguration(configuration: string): boolean
	public abstract hasValidConfig(): boolean
	public abstract getConfiguration(): string
	public abstract initializeSolc(): Promise<void>

	public isSolcInitialized(configuration?: string): boolean {
		if (!this.solc) {
			return false
		}
		return this.matchesConfiguration(configuration)
	}
}
