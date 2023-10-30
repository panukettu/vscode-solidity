import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';
import * as solc from 'solc';
import { errorToDiagnostic } from '../server/providers/utils/diagnostics';
import { SolidityConfig } from '../server/types';
import { Project } from './model/project';
import { SourceDocumentCollection } from './model/sourceDocumentCollection';
import { initialiseProject } from './projectService';

export enum CompilerType {
	NPM = 0,
	Remote = 1,
	File = 2,
	Default = 3,
}

export abstract class SolcCompilerLoader {
	public type: CompilerType;

	public localSolc: typeof solc;

	public getVersion(): string {
		return this.localSolc.version();
	}

	public abstract matchesConfiguration(configuration: string): boolean;
	public abstract canCompilerBeLoaded(): boolean;
	public abstract getConfiguration(): string;
	public abstract initialiseCompiler(): Promise<void>;

	public isInitialisedAlready(configuration?: string): boolean {
		if (!this.localSolc) {
			return false;
		}
		return this.matchesConfiguration(configuration);
	}
}

export class EmbeddedCompilerLoader extends SolcCompilerLoader {
	public matchesConfiguration(configuration: string): boolean {
		return true;
	}

	public getConfiguration() {
		return '';
	}

	constructor() {
		super();
		this.type = CompilerType.Default;
	}

	public init() {
		this.localSolc = null;
	}

	public canCompilerBeLoaded(): boolean {
		return true;
	}

	public initialiseCompiler(): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			this.localSolc = require('solc');
			resolve();
		});
	}
}

export class NpmModuleCompilerLoader extends SolcCompilerLoader {
	private npmModule: string;
	private rootPath: string;

	public matchesConfiguration(configuration: string): boolean {
		return configuration === this.npmModule;
	}

	public getConfiguration() {
		return this.npmModule;
	}

	constructor() {
		super();
		this.npmModule = 'solc';
		this.type = CompilerType.NPM;
	}

	public init(rootPath: string, npmModule = 'solc') {
		if (rootPath !== this.rootPath) {
			this.localSolc = null;
			this.rootPath = rootPath;
		}

		if (!this.matchesConfiguration(npmModule)) {
			this.npmModule = npmModule;
			this.localSolc = null;
		}
	}

	public canCompilerBeLoaded(): boolean {
		return this.isInstalledSolcUsingNode(this.rootPath);
	}

	public getLocalSolcNodeInstallation() {
		return path.join(this.rootPath, 'node_modules', this.npmModule, 'soljson.js');
	}

	public isInstalledSolcUsingNode(rootPath: string): boolean {
		return fs.existsSync(this.getLocalSolcNodeInstallation());
	}

	public initialiseCompiler(): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			if (this.isInitialisedAlready(this.npmModule)) {
				resolve();
			}
			if (this.canCompilerBeLoaded()) {
				try {
					const solidityfile = require(this.getLocalSolcNodeInstallation());
					this.localSolc = solc.setupMethods(solidityfile);
					resolve();
				} catch (e) {
					this.localSolc = null;
					reject(`Error occured, loading solc from npm: ${this.getLocalSolcNodeInstallation()}, ${e}`);
				}
			} else {
				this.localSolc = null;
				reject(`Cant load solc from: ${this.getLocalSolcNodeInstallation()}`);
			}
		});
	}
}

export class LocalPathCompilerLoader extends SolcCompilerLoader {
	private localPath: string;

	public matchesConfiguration(configuration: string): boolean {
		return configuration === this.localPath;
	}

	public getConfiguration() {
		return this.localPath;
	}

	constructor() {
		super();
		this.type = CompilerType.File;
	}

	public init(localPath: string) {
		if (!this.matchesConfiguration(localPath)) {
			this.localPath = localPath;
			this.localSolc = null;
		}
	}

	public canCompilerBeLoaded(): boolean {
		if (this.localPath?.length > 0) {
			return this.compilerExistsAtPath(this.localPath);
		}
		return false;
	}
	public compilerExistsAtPath(localPath: string): boolean {
		return fs.existsSync(localPath);
	}

	public initialiseCompiler(): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			if (this.isInitialisedAlready(this.localPath)) {
				resolve();
			}
			if (this.canCompilerBeLoaded()) {
				try {
					const solidityfile = require(this.localPath);
					this.localSolc = solc.setupMethods(solidityfile);
					resolve();
				} catch (e) {
					this.localSolc = null;
					reject(`Error ocurred, loading solc from: ${this.localPath}, ${e}`);
				}
			} else {
				this.localSolc = null;
				reject(`Cant load solc from: ${this.localPath}`);
			}
		});
	}
}

export class RemoteCompilerDownloader {
	public downloadCompilationFile(version: string, savePath: string): Promise<void> {
		const file = fs.createWriteStream(savePath);
		return new Promise((resolve, reject) => {
			const request = https
				.get(`https://binaries.soliditylang.org/bin/soljson-${version}.js`, function (response) {
					if (response.statusCode !== 200) {
						reject(`Error retrieving solr: ${response.statusMessage}`);
					} else {
						response.pipe(file);
						file.on('finish', function () {
							file.close();
							resolve();
						});
					}
				})
				.on('error', function (error) {
					reject(error);
				});
			request.end();
		});
	}
}

export class RemoteReleases {
	public getSolcReleases(): Promise<object> {
		const url = 'https://binaries.soliditylang.org/bin/list.json';
		return new Promise((resolve, reject) => {
			https
				.get(url, (res) => {
					let body = '';
					res.on('data', (chunk) => {
						body += chunk;
					});
					res.on('end', () => {
						try {
							const binList = JSON.parse(body);
							resolve(binList.releases);
						} catch (error) {
							reject(error.message);
						}
					});
				})
				.on('error', (error) => {
					reject(error.message);
				});
		});
	}

	public getFullVersionFromFileName(fileName: string): string {
		let version = '';
		const value: string = fileName;
		if (value !== 'undefined') {
			version = value.replace('soljson-', '');
			version = version.replace('.js', '');
		} else {
			throw 'Remote version: Invalid file name';
		}
		return version;
	}

	public async resolveRelease(version: string): Promise<string> {
		// biome-ignore lint/suspicious/noAsyncPromiseExecutor: <explanation>
		return new Promise(async (resolve, reject) => {
			if (version === 'latest') {
				resolve(version);
			}
			try {
				const releases = await this.getSolcReleases();
				// tslint:disable-next-line:forin
				for (const release in releases) {
					const fullVersion = this.getFullVersionFromFileName(releases[release]);
					if (version === fullVersion) {
						resolve(fullVersion);
					}
					if (version === release) {
						resolve(fullVersion);
					}
					if (version === releases[release]) {
						resolve(fullVersion);
					}
					if (`v${release}` === version) {
						resolve(fullVersion);
					}
					if (version.startsWith(`v${release}+commit`)) {
						resolve(fullVersion);
					}
				}
				reject('Remote solc: invalid version');
			} catch (error) {
				reject(error);
			}
		});
	}
}

export class RemoteCompilerLoader extends SolcCompilerLoader {
	private version: string;
	private solcCachePath: string;

	public getConfiguration() {
		return this.version;
	}

	public matchesConfiguration(configuration: string): boolean {
		return configuration === this.version;
	}

	public setSolcCache(solcCachePath: string): void {
		this.solcCachePath = solcCachePath;
	}

	constructor() {
		super();
		this.type = CompilerType.Remote;
	}

	public init(version: string) {
		if (!this.matchesConfiguration(version)) {
			this.version = version;
			this.localSolc = null;
		}
	}

	public canCompilerBeLoaded(): boolean {
		// this should check if the string version is valid
		if (this.version != null && this.version !== '') {
			return true;
		}
		return false;
	}

	public initialiseCompiler(): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			if (this.isInitialisedAlready(this.version)) {
				resolve();
			}
			if (this.canCompilerBeLoaded()) {
				const solcService = this;
				new RemoteReleases()
					.resolveRelease(this.version)
					.then((resolvedVersion) =>
						this.loadRemoteVersionRetry(resolvedVersion, 1, 3)
							.then((solcSnapshot) => {
								solcService.localSolc = solcSnapshot;
								resolve();
							})
							.catch((error) => {
								reject(`There was an error loading the remote version: ${this.version}, ${error}`);
							})
					)
					.catch((error) => {
						reject(`There was an error loading the remote version: ${this.version}, ${error}`);
					});
			} else {
				this.localSolc = null;
				reject(`Compiler cannot load remote version: ${this.version}`);
			}
		});
	}

	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	private loadRemoteVersionRetry(versionString: string, retryNumber: number, maxRetries: number): Promise<any> {
		return new Promise((resolve, reject) => {
			this.loadRemoteVersion(versionString)
				.then((solcConfigured) => resolve(solcConfigured))
				.catch((reason) => {
					if (retryNumber <= maxRetries) {
						return this.loadRemoteVersionRetry(versionString, retryNumber + 1, maxRetries);
					} else {
						reject(reason);
					}
				});
		});
	}

	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	private loadRemoteVersion(versionString: string): Promise<any> {
		const pathVersion = path.resolve(path.join(this.solcCachePath, `soljson-${versionString}.js`));
		return new Promise((resolve, reject) => {
			try {
				if (fs.existsSync(pathVersion) && versionString !== 'latest') {
					const solidityfile = require(pathVersion);
					const solcConfigured = solc.setupMethods(solidityfile);
					resolve(solcConfigured);
				} else {
					new RemoteCompilerDownloader()
						.downloadCompilationFile(versionString, pathVersion)
						.then(() => {
							const solidityfile = require(pathVersion);
							const solcConfigured = solc.setupMethods(solidityfile);
							resolve(solcConfigured);
						})
						.catch((reason) => reject(reason));
				}
			} catch (error) {
				if (fs.existsSync(pathVersion)) {
					fs.unlinkSync(pathVersion);
					return this.loadRemoteVersion(versionString);
				} else {
					reject(error);
				}
			}
		});
	}
}

export class SolcCompiler {
	public nodeCompiler: NpmModuleCompilerLoader;
	public localCompiler: LocalPathCompilerLoader;
	public remoteCompiler: RemoteCompilerLoader;
	public embeddedCompiler: EmbeddedCompilerLoader;
	public rootPath: string;
	public type: CompilerType;

	constructor(rootPath: string) {
		this.rootPath = rootPath;
		this.nodeCompiler = new NpmModuleCompilerLoader();
		this.localCompiler = new LocalPathCompilerLoader();
		this.remoteCompiler = new RemoteCompilerLoader();
		this.embeddedCompiler = new EmbeddedCompilerLoader();
		this.type = CompilerType.Default;
	}

	public setSolcCache(solcCachePath: string): void {
		this.remoteCompiler.setSolcCache(solcCachePath);
	}

	public isRootPathSet(): boolean {
		return this.rootPath != null;
	}

	public initialisedAlready(setting: string, selectedType: CompilerType): boolean {
		if (selectedType === CompilerType.Remote) {
			return this.remoteCompiler.isInitialisedAlready(setting);
		}

		if (selectedType === CompilerType.File) {
			return this.localCompiler.isInitialisedAlready(setting);
		}

		if (selectedType === CompilerType.NPM) {
			return this.nodeCompiler.isInitialisedAlready(setting);
		}

		if (selectedType === CompilerType.Default) {
			return this.embeddedCompiler.isInitialisedAlready();
		}
	}

	public initialiseAllCompilerSettings(config: SolidityConfig, selectedType: CompilerType) {
		this.nodeCompiler.init(this.rootPath, config.compilerPackage);
		this.remoteCompiler.init(config.compileUsingRemoteVersion);
		this.localCompiler.init(config.compileUsingLocalVersion);
		this.embeddedCompiler.init();
		this.type = selectedType;
	}

	public initialiseSelectedCompiler(): Promise<void> {
		return this.getCompiler().initialiseCompiler();
	}

	public initialiseCompiler(selectedCompiler: CompilerType): Promise<void> {
		return this.getCompiler(selectedCompiler).initialiseCompiler();
	}

	public compile(
		contracts:
			| {
					sources: {
						[x: string]: {
							content: string;
						};
					};
			  }
			| string,
		selectedType: CompilerType = null,
		project?: Project
	) {
		try {
			const compiler = this.getCompiler(selectedType);
			return compiler.localSolc.compile(contracts);
		} catch (e) {
			console.debug('Unhandled (compile):', e);
		}
	}

	public getCompiler(selectedType: CompilerType = this.type): SolcCompilerLoader {
		switch (selectedType) {
			case CompilerType.Default:
				return this.embeddedCompiler;
			case CompilerType.NPM:
				return this.nodeCompiler;
			case CompilerType.File:
				return this.localCompiler;
			case CompilerType.Remote:
				return this.remoteCompiler;
			default:
				throw new Error(`Invalid compiler ${selectedType}`);
		}
	}

	public compileSolidityDocumentAndGetDiagnosticErrors(
		filePath: string,
		documentText: string,
		config: SolidityConfig,
		selectedType: CompilerType = null
	) {
		if (this.isRootPathSet()) {
			const contracts = new SourceDocumentCollection();
			const project = initialiseProject(this.rootPath, config).project;
			contracts.addSourceDocumentAndResolveImports(filePath, documentText, project);

			const contractsForCompilation = contracts.getDefaultSourceDocumentsForCompilationDiagnostics(project);

			try {
				const outputString = this.compile(JSON.stringify(contractsForCompilation), selectedType, project);
				const output = JSON.parse(outputString);
				if (output.errors) {
					return output.errors.map((error: unknown) => errorToDiagnostic(error));
				}
			} catch (e) {
				// console.debug(e);
			}
		} else {
			try {
				const output = this.compile({
					sources: {
						[filePath]: {
							content: documentText,
						},
					},
				});
				if (output.errors) {
					return output.errors.map((error: unknown) => errorToDiagnostic(error));
				}
			} catch (error: unknown) {
				// console.debug("compileSolidityDocumentAndGetDiagnosticErrors:", e);
			}
		}
		return [];
	}
}
