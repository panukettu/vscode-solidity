import { errorToDiagnostic } from '@server/providers/utils/diagnostics';
import { CompilerType } from '@shared/enums';
import { Project } from '@shared/model/project';
import { SourceDocumentCollection } from '@shared/model/sourceDocuments';
import { initialiseProject } from '@shared/project';
import { MultisolcSettings, SolidityConfig } from '@shared/types';
import { DefaultSolc } from './location/solc-default';
import { LocalSolc } from './location/solc-local';
import { NPMSolc } from './location/solc-npm';
import { RemoteSolc } from './location/solc-remote';
import { SolcInput, SolcOutput } from './solc-types';

export class Multisolc {
	public rootPath: string;
	public npm: NPMSolc;
	public local: LocalSolc;
	public remote: RemoteSolc;
	public default: DefaultSolc;
	public type: CompilerType;
	public settings: MultisolcSettings;
	public outputChannel: any;

	constructor(settings: MultisolcSettings, cachePath?: string, typeOverride?: CompilerType) {
		this.rootPath = settings.rootPath;
		this.npm = new NPMSolc();
		this.local = new LocalSolc();
		this.remote = new RemoteSolc(cachePath);
		this.default = new DefaultSolc();
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

	public isSolcInitialized(selectedType = CompilerType.Default): boolean {
		let result = false;
		switch (selectedType) {
			case CompilerType.Default:
				result = this.default.isSolcInitialized();
			case CompilerType.NPM:
				result = this.npm.isSolcInitialized(this.settings.compilerPackage);
			case CompilerType.File:
				result = this.local.isSolcInitialized(this.settings.localSolcVersion);
			case CompilerType.Remote:
				result = this.remote.isSolcInitialized(this.settings.remoteSolcVersion);
		}

		console.debug({
			selectedType: CompilerType[selectedType],
			result,
			settings: this.settings,
		});

		return result;
	}

	public initExternalCompilers(settings: MultisolcSettings, typeOverride?: CompilerType) {
		this.npm.initializeConfig(this.rootPath, settings.compilerPackage);
		this.remote.initializeConfig(settings.remoteSolcVersion);
		this.local.initializeConfig(settings.localSolcVersion);
		this.type = typeOverride || settings.selectedType;
		this.settings = settings;
	}

	public async initializeSolc(type: CompilerType): Promise<void> {
		const compiler = this.getCompiler(type);
		await compiler.initializeSolc();
	}

	public compileInputWith(input: SolcInput, type: CompilerType = null, project?: Project) {
		try {
			console.debug('Compiling input');
			return JSON.parse(this.getCompiler(type).solc.compile(JSON.stringify(input))) as SolcOutput;
		} catch (e) {
			console.debug('Unhandled (compile):', e);
		}
	}

	public getCompiler(type: CompilerType = this.type) {
		switch (type) {
			case CompilerType.Default:
				return this.default;
			case CompilerType.NPM:
				return this.npm;
			case CompilerType.File:
				return this.local;
			case CompilerType.Remote:
				return this.remote;
			default:
				return this.default;
		}
	}

	public printInitializedCompilers(channel: any) {
		if (this.npm.isSolcInitialized(this.settings.compilerPackage)) {
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

		if (this.default.isSolcInitialized()) {
			channel.appendLine(
				`Compiler type: ${CompilerType[CompilerType.Default]} solc version: ${this.default.getVersion()}`
			);
		}
	}

	public compileWithDiagnostic(
		filePath: string,
		documentText: string,
		config: SolidityConfig,
		selectedType: CompilerType = null
	) {
		try {
			if (!this.isRootPathSet()) {
				console.debug('No root path');
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

			console.debug('Compiling input');
			const output = this.compileInputWith(contracts.getMinimalSolcInput(), selectedType, project);
			console.debug('Compiled');

			return output.errors?.map(errorToDiagnostic) ?? [];
		} catch (error) {
			console.debug('Unhandled (compileWithDiagnostic):', error);
			return [];
		}
	}
}
