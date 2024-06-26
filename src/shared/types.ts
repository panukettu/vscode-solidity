import type { ClientState } from "@client/client-state"
import type { Diagnostic } from "vscode-languageclient/node"
import type { ContractLevelSolcOutput, SolcInput } from "./compiler/types-solc"
import type { CompilerType } from "./enums"
import type { SourceDocument } from "./project/sourceDocument"

export type FoundryConfigParsed = {
	profile?: Partial<FoundryCoreConfig> | null
	etherscan?: FoundryConfig["etherscan"] | null
	fmt?: FoundryConfig["fmt"] | null
	rpc_endpoints?: FoundryConfig["rpc_endpoints"] | null
}
export type FoundryCoreConfig = {
	src: string
	script: string
	test: string
	libs: string[]
	out: string
	broadcast?: boolean
	cache_path: string
	include_paths?: string[]
	solc: SolcVersion
	evm_version: EVMVersion
	optimizer?: boolean
	optimizer_runs?: number
	remappings: string[]
	ffi?: boolean
	via_ir?: boolean
}

export type FoundryConfig = {
	profile: {
		[key: string]: FoundryCoreConfig | undefined
	}
	rpc_endpoints: {
		[key: string]: string | undefined
	}
	etherscan: {
		[key: string]: { key: string; chain: number; url: string } | undefined
	}
	fmt:
		| {
				multiline_func_header: string
				single_line_block_style: string
				line_length: number
		  }
		| undefined
}

export type MinimalURI = { toString(skipEncoding?: boolean): string }
export type FunctionName<N extends string = string, A extends string = string> = `${N}(${A})`

type URI = string
type Scope = string
export type ScopedURI = `${Scope}-${URI}`

export type SolcVersion = `${number}.${number}.${number}`
export type Prerelease = `nightly-${number}.${number}.${number}`

export type EVMVersion =
	| "homestead"
	| "tangerineWhistle"
	| "spuriousDragon"
	| "byzantium"
	| "constantinople"
	| "petersburg"
	| "istanbul"
	| "berlin"
	| "london"
	| "paris"
	| "shanghai"
	| "cancun"
export type SolcList = {
	builds: {
		path: string
		version: SolcVersion
		prerelease: Prerelease
		build: string
	}[]
	releases: {
		[version: SolcVersion]: string
	}
	latestRelease: SolcVersion
}

export type CompileArgs = {
	solcInput: SolcInput
	state: ClientState
	options: MultisolcSettings
	contract?: SourceDocument
	solcType?: CompilerType
}
export type InitializationOptions = {
	solcCachePath: string
}

export type MultisolcSettings = {
	outDir: string
	sourceDir?: string
	excludePaths?: string[]
	localSolcVersion: string
	remoteSolcVersion: string
	compilerConfig?: Partial<SolcInput>
	npmSolcPackage: string
	rootPath: string
	selectedType: CompilerType
}

export interface ErrorWarningCounts {
	errors: number
	warnings: number
}

export interface SolidityConfig {
	linter: {
		type: boolean | string
		rules?: object
	}
	fuzzLevel: {
		suggestions: number
		suggestionsLoose: number
		suggestionsWithImport: number
	}
	validation: {
		onSave: boolean
		onChange: boolean
		onOpen: boolean
		delay: number
	}
	test: {
		verbosity: number
		executeOnSave: boolean
	}
	compiler: {
		outDir: string
		npm: string
		remote: string
		local: string
		type: CompilerType
	}
	compilerSettings: {
		remappings?: string[]
		input: Partial<SolcInput["settings"]>
		output: ContractLevelSolcOutput[]
	}
	project: {
		exclude: string[]
		sources: string
		libs: string[]
		libSources: string[]
		includePaths: string[]
		remappings: string[]
		remappingsWindows: string[]
		remappingsUnix: string[]
		monorepo: boolean
	}
	// localSolcVersion: string
	// remoteSolcVersion: string
	// npmSolcPackage: string
	// compilerType: CompilerType
	// solhintRules: object
	// initExclude: string[]
	// outDir: string
	// validationDelay: number
	// libs: string[]
	// libSources: string[]
	// sources: string
	// remappings: string[]
	// remappingsWindows: string[]
	// remappingsUnix: string[]
	// monoRepoSupport: boolean
}

export interface DiagnosticWithFileName {
	diagnostic: Diagnostic
	fileName: string
}
