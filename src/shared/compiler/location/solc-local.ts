import { existsSync } from 'fs';
import { CompilerType } from '@shared/enums';
import solc from 'solc';
import { SolcLoader } from './loader';
export class LocalSolc extends SolcLoader {
	private localPath: string;
	public type = CompilerType.File;

	public matchesConfiguration(configuration: string): boolean {
		return configuration === this.localPath;
	}

	public getConfiguration() {
		return this.localPath;
	}

	public initializeConfig(localPath: string) {
		if (!this.matchesConfiguration(localPath)) {
			this.localPath = localPath;
			this.solc = null;
		}
	}

	public hasValidConfig(): boolean {
		if (this.localPath?.length > 0) {
			return this.compilerExistsAtPath(this.localPath);
		}
		return false;
	}
	public compilerExistsAtPath(localPath: string): boolean {
		return existsSync(localPath);
	}

	public async initializeSolc(): Promise<void> {
		if (this.isSolcInitialized(this.localPath) || !this.hasValidConfig()) return;
		try {
			this.solc = solc.setupMethods(require(this.localPath));
		} catch (e) {
			this.solc = null;
			throw new Error(`Error while loading solc from: ${this.localPath}, error: ${e}`);
		}
	}
}
