import * as fs from 'fs';
import path from 'path';
import { CompilerType } from '@shared/enums';
import solc from 'solc';
import { getRemoteSolc, parseReleaseVersion } from '../utils';
import { SolcLoader } from './loader';
export class RemoteSolc extends SolcLoader {
	private version: string;
	private solcCachePath: string;
	public type = CompilerType.Remote;

	constructor(cachePath?: string) {
		super();
		this.solcCachePath = cachePath;
	}

	public getConfiguration() {
		return this.version;
	}

	public matchesConfiguration(configuration: string): boolean {
		return configuration === this.version;
	}

	public setSolcCache(solcCachePath: string): void {
		this.solcCachePath = solcCachePath;
	}

	public initializeConfig(version: string) {
		if (!this.matchesConfiguration(version)) {
			this.version = version;
			this.solc = null;
		}
	}

	public hasValidConfig(): boolean {
		// this should check if the string version is valid
		if (this.version != null && this.version !== '') {
			return true;
		}
		return false;
	}

	public async initializeSolc(): Promise<void> {
		if (this.isSolcInitialized(this.version) || !this.hasValidConfig()) return;
		try {
			const resolvedVersion = await parseReleaseVersion(this.version);
			this.solc = await this.loadRemoteWithRetries(resolvedVersion, 1, 3);
		} catch (error) {
			this.solc = null;
			throw error;
		}
	}

	private async loadRemoteWithRetries(versionString: string, retryNumber: number, maxRetries: number): Promise<any> {
		try {
			console.debug('loadRemoteWithRetries', versionString, retryNumber, maxRetries);
			return this.loadRemoteVersion(versionString);
		} catch (error) {
			if (retryNumber <= maxRetries) {
				console.debug('loadRemoteWithRetries', versionString, retryNumber, maxRetries);
				return this.loadRemoteWithRetries(versionString, retryNumber + 1, maxRetries);
			} else {
				throw error;
			}
		}
	}

	private async loadRemoteVersion(versionString: string): Promise<any> {
		const pathVersion = path.resolve(path.join(this.solcCachePath, `soljson-${versionString}.js`));
		try {
			if (fs.existsSync(pathVersion) && versionString !== 'latest') {
				const solidityfile = require(pathVersion);
				return solc.setupMethods(solidityfile);
			} else {
				await getRemoteSolc(versionString, pathVersion);
				return solc.setupMethods(require(pathVersion));
			}
		} catch (error) {
			if (fs.existsSync(pathVersion)) {
				fs.unlinkSync(pathVersion);
				return this.loadRemoteVersion(versionString);
			} else {
				throw error;
			}
		}
	}
}
