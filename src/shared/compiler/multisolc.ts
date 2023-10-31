import { errorToDiagnostic } from '@server/providers/utils/diagnostics';
import { CompilerType } from '@shared/enums';
import { Project } from '@shared/model/project';
import { SourceDocumentCollection } from '@shared/model/sourceDocuments';
import { initialiseProject } from '@shared/project';
import { MultisolcSettings, SolidityConfig } from '@shared/types';
import { ExtensionSolc } from './location/solc-default';
import { LocalSolc } from './location/solc-local';
import { NPMSolc } from './location/solc-npm';
import { RemoteSolc } from './location/solc-remote';
import { SolcInput, SolcOutput } from './solc-types';

export class Multisolc {
	public rootPath: string;
	public npm: NPMSolc;
	public local: LocalSolc;
	public remote: RemoteSolc;
	public extension: ExtensionSolc;
	public type: CompilerType;
	public settings: MultisolcSettings;
	public outputChannel: any;

	constructor(settings: MultisolcSettings, cachePath?: string, typeOverride?: CompilerType) {
		this.rootPath = settings.rootPath;
		this.npm = new NPMSolc();
		this.local = new LocalSolc();
		this.remote = new RemoteSolc(cachePath);
		this.extension = new ExtensionSolc();
		this.type = typeOverride || settings.selectedType;
		this.settings = settings;
		this.initExternalCompilers(settings, typeOverride);
	}

	public setRemoteSolcCache(solcCachePath: string): void {
		this.remote.setSolcCache(solcCachePath);
	}

	public isRootPathSet(): boolean {
		return this.rootPath != null;
	}

	public isSolcInitialized(selectedType = CompilerType.Extension): boolean {
		let result = false;
		switch (selectedType) {
			case CompilerType.Extension:
				result = this.extension.isSolcInitialized();
				break;
			case CompilerType.NPM:
				result = this.npm.isSolcInitialized(this.settings.npmSolcPackage);
				break;
			case CompilerType.File:
				result = this.local.isSolcInitialized(this.settings.localSolcVersion);
				break;
			case CompilerType.Remote:
				result = this.remote.isSolcInitialized(this.settings.remoteSolcVersion);
				break;
		}

		return result;
	}

	public initExternalCompilers(settings: MultisolcSettings, typeOverride?: CompilerType) {
		this.npm.initializeConfig(this.rootPath, settings.npmSolcPackage);
		this.remote.initializeConfig(settings.remoteSolcVersion);
		this.local.initializeConfig(settings.localSolcVersion);
		this.type = typeOverride || settings.selectedType;
		this.settings = settings;
	}

	public async initializeSolc(type: CompilerType): Promise<void> {
		const compiler = this.getCompiler(type);
		await compiler.initializeSolc();
	}

	public compileInputWith(input: SolcInput, type: CompilerType = null) {
		try {
			const compiler = this.getCompiler(type);
			return JSON.parse(compiler.solc.compile(JSON.stringify(input))) as SolcOutput;
		} catch (e) {
			console.debug('Unhandled (compile):', e);
		}
	}

	public getCompiler(type: CompilerType = this.type) {
		switch (type) {
			case CompilerType.Extension:
				return this.extension;
			case CompilerType.NPM:
				return this.npm;
			case CompilerType.File:
				return this.local;
			case CompilerType.Remote:
				return this.remote;
			default:
				return this.extension;
		}
	}

	public printInitializedCompilers(channel: any) {
		if (this.npm.isSolcInitialized(this.settings.npmSolcPackage)) {
			channel.appendLine(`Compiler type: ${CompilerType[CompilerType.NPM]} solc version: ${this.npm.getVersion()}`);
		}
		if (this.local.isSolcInitialized(this.settings.localSolcVersion)) {
			channel.appendLine(`Compiler type: ${CompilerType[CompilerType.File]} solc version: ${this.local.getVersion()}`);
		}
		if (this.remote.isSolcInitialized(this.settings.remoteSolcVersion)) {
			channel.appendLine(
				`Compiler type: ${CompilerType[CompilerType.Remote]} solc version: ${this.remote.getVersion()}`
			);
		}
		if (this.extension.isSolcInitialized()) {
			channel.appendLine(
				`Compiler type: ${CompilerType[CompilerType.Extension]} solc version: ${this.extension.getVersion()}`
			);
		}
	}

	public compileWithDiagnostic(
		filePath: string,
		documentText: string,
		config: SolidityConfig,
		selectedType: CompilerType = null
	) {
		if (!this.isRootPathSet()) {
			const output = this.compileInputWith({
				sources: {
					[filePath]: {
						content: documentText,
					},
				},
			});
			return output.errors?.map(errorToDiagnostic) ?? [];
		}
		const contracts = new SourceDocumentCollection();
		const project = initialiseProject(this.rootPath, config).project;
		contracts.addSourceDocumentAndResolveImports(filePath, documentText, project);

		try {
			const output = this.compileInputWith(contracts.getMinimalSolcInput(), selectedType);

			return output.errors?.map(errorToDiagnostic) ?? [];
		} catch (error) {
			console.debug('Unhandled (compileWithDiagnostic):', error);
			this.initializeSolc(selectedType).then(() => {
				const output = this.compileInputWith(contracts.getMinimalSolcInput(), selectedType);
				return output.errors?.map(errorToDiagnostic) ?? [];
			});
		}
	}
}
