import { CompilerType } from '@shared/enums';
import { SolcLoader } from './loader';

export class ExtensionSolc extends SolcLoader {
	public type: CompilerType = CompilerType.Extension;
	public matchesConfiguration(): boolean {
		return true;
	}

	public getConfiguration() {
		return '';
	}

	constructor() {
		super();
		this.solc = require('solc');
	}

	public hasValidConfig(): boolean {
		return true;
	}

	public async initializeSolc(): Promise<void> {
		return;
	}
}
