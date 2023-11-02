import type { ABI, AST } from "@shared/types-abi-ast"

/**
 * A mapping between libraries and the addresses to which they were deployed.
 *
 * Containing support for two level configuration, These two level
 * configurations can be seen below.
 *
 * {
 *     "lib.sol:L1": "0x...",
 *     "lib.sol:L2": "0x...",
 *     "lib.sol": {"L3": "0x..."}
 * }
 */
export interface LibraryAddresses {
	[qualifiedNameOrSourceUnit: string]: string | { [unqualifiedLibraryName: string]: string }
}

/**
 * A mapping between libraries and lists of placeholder instances present in their hex-encoded bytecode.
 * For each placeholder its length and the position of the first character is stored.
 *
 * Each start and length entry will always directly refer to the position in
 * binary and not hex-encoded bytecode.
 */
export interface LinkReferences {
	[libraryLabel: string]: Array<{ start: number; length: number }>
}

export interface SolJson {
	/**
	 * Returns a native JavaScript wrapper for a C function.
	 *
	 * This is similar to ccall(), but returns a JavaScript function that can be
	 * reused as many times as needed. The C function can be defined in a C file,
	 * or be a C-compatible C++ function defined using extern "C" (to prevent
	 * name mangling).
	 *
	 * @param ident The name of the C function to be called.
	 *
	 * @param returnType The return type of the function. This can be "number",
	 * "string" or "array", which correspond to the appropriate JavaScript
	 * types (use "number" for any C pointer, and "array" for JavaScript arrays
	 * and typed arrays; note that arrays are 8-bit), or for a void function it
	 * can be null (note: the JavaScript null value, * not a string containing
	 * the word “null”).
	 *
	 * @param argTypes An array of the types of arguments for the function (if
	 * there are no arguments, this can be omitted). Types are as in returnType,
	 * except that array is not supported as there is no way for us to know the
	 * length of the array).
	 *
	 * @returns A JavaScript function that can be used for running the C function.
	 */
	cwrap<T>(ident: string, returnType: string | null, argTypes: string[]): T

	/**
	 * Sets a value at a specific memory address at run-time.
	 *
	 * Note:
	 * setValue() and getValue() only do aligned writes and reads.
	 *
	 * The type is an LLVM IR type (one of i8, i16, i32, i64, float, double, or
	 * a pointer type like i8* or just *), not JavaScript types as used in ccall()
	 * or cwrap(). This is a lower-level operation, and we do need to care what
	 * specific type is being used.
	 *
	 * @param ptr A pointer (number) representing the memory address.
	 *
	 * @param value The value to be stored
	 *
	 * @param type  An LLVM IR type as a string (see “note” above).
	 *
	 * @param noSafe Developers should ignore this variable. It is only
	 * used in SAFE_HEAP compilation mode, where it can help avoid infinite recursion
	 * in some specialist use cases.
	 */
	setValue(ptr: number, value: any, type: string, noSafe?: boolean): void

	/**
	 * Given a pointer ptr to a null-terminated UTF8-encoded string in the
	 * Emscripten HEAP, returns a copy of that string as a JavaScript String
	 * object.
	 *
	 * @param ptr A pointer to a null-terminated UTF8-encoded string in the
	 * Emscripten HEAP.
	 *
	 * @param maxBytesToRead An optional length that specifies the maximum number
	 * of bytes to read. You can omit this parameter to scan the string until the
	 * first 0 byte. If maxBytesToRead is passed, and the string at
	 * [ptr, ptr+maxBytesToReadr) contains a null byte in the middle, then the
	 * string will cut short at that byte index (i.e. maxBytesToRead will not
	 * produce a string of exact length [ptr, ptr+maxBytesToRead)) N.B. mixing
	 * frequent uses of UTF8ToString() with and without maxBytesToRead may throw
	 * JS JIT optimizations off, so it is worth to consider consistently using
	 * one style or the other.
	 */
	UTF8ToString(ptr: number, maxBytesToRead?: number): string

	/**
	 * v1.38.27: 02/10/2019 (emscripten)
	 * --------------------
	 *  - Remove deprecated Pointer_stringify (use UTF8ToString instead). See #8011
	 *
	 * @param ptr
	 * @param length
	 * @constructor
	 *
	 * @deprecated use UTF8ToString instead
	 */
	// eslint-disable-next-line camelcase
	Pointer_stringify(ptr: number, length?: number): string

	/**
	 * Given a string input return the current length of the given UTF8 bytes.
	 * Used when performing stringToUTF8 since stringToUTF8  will require at most
	 * str.length*4+1 bytes of space in the HEAP.
	 *
	 * @param str The input string.
	 */
	lengthBytesUTF8(str: string): number

	/**
	 * Copies the given JavaScript String object str to the Emscripten HEAP at
	 * address outPtr, null-terminated and encoded in UTF8 form.
	 *
	 * The copy will require at most str.length*4+1 bytes of space in the HEAP.
	 * You can use the function lengthBytesUTF8() to compute the exact amount
	 * of bytes (excluding the null terminator) needed to encode the string.
	 *
	 * @param str A JavaScript String object.
	 *
	 * @param outPtr Pointer to data copied from str, encoded in UTF8 format and
	 * null-terminated.
	 *
	 * @param maxBytesToWrite A limit on the number of bytes that this function
	 * can at most write out. If the string is longer than this, the output is
	 * truncated. The outputted string will always be null terminated, even if
	 * truncation occurred, as long as maxBytesToWrite > 0
	 */
	stringToUTF8(str: string, outPtr: number, maxBytesToWrite?: number): void

	/**
	 * Allocates size bytes of uninitialized storage.
	 *
	 * If allocation succeeds, returns a pointer that is suitably aligned for any
	 * object type with fundamental alignment.
	 *
	 * @param size number of bytes to allocate
	 *
	 * @returns On success, returns the pointer to the beginning of newly
	 * allocated memory. To avoid a memory leak, the returned pointer must be
	 * deallocated with free() or realloc().
	 */
	_malloc(size: number): number

	/**
	 * Use addFunction to return an integer value that represents a function
	 * pointer. Passing that integer to C code then lets it call that value as a
	 * function pointer, and the JavaScript function you sent to addFunction will
	 * be called.
	 *
	 * when using addFunction on LLVM wasm backend, you need to provide an
	 * additional second argument, a Wasm function signature string. Each
	 * character within a signature string represents a type. The first character
	 * represents the return type of the function, and remaining characters are for
	 * parameter types.
	 *
	 * 'v': void type
	 * 'i': 32-bit integer type
	 * 'j': 64-bit integer type (currently does not exist in JavaScript)
	 * 'f': 32-bit float type
	 * 'd': 64-bit float type
	 *
	 * @param func
	 * @param signature
	 */
	addFunction(func: (...args: any[]) => any, signature?: string): number

	/**
	 * Removes an allocated function by the provided function pointer.
	 *
	 * @param funcPtr
	 */
	removeFunction(funcPtr: number): void

	/**
	 * Fallback runtime which can contain the add/remove functions
	 */
	Runtime: {
		addFunction(func: (...args: any[]) => any, signature?: string): number
		removeFunction(funcPtr: number): void
	}
}

/**************************
 * core binding functions
 *************************/

/**
 * Allocates a chunk of memory of size bytes.
 *
 * Use this function inside callbacks to allocate data that is to be passed to
 * the compiler. You may use solidity_free() or solidity_reset() to free this
 * memory again, but it is not required as the compiler takes ownership for any
 * data passed to it via callbacks.
 *
 * This function will return NULL if the requested memory region could not be
 * allocated.
 *
 * @param size The size of bytes to be allocated.
 */
export type Alloc = (size: number) => number

/**
 * Returns the complete license document.
 */
export type License = () => string | undefined

/**
 * This should be called right before each compilation, but not at the end,
 * so additional memory can be freed.
 */
export type Reset = () => string

/**
 * Returns the compiler version.
 */
export type Version = () => string

/**
 * Returns the compiler version as a semver version style.
 */
export type VersionToSemver = () => string

// compile binding functions
export type ReadCallbackResult = { contents: string } | { error: string }
export type ReadCallback = (path: string) => ReadCallbackResult
export type Callbacks = { [x: string]: ReadCallback }

/**
 * Compile a single file.
 *
 * @solidityMaxVersion 0.5.0
 *
 * @param input
 * @param optimize
 */
export type CompileJson = (input: string, optimize: boolean) => string

/**
 * Compile a single file with a callback.
 *
 * @solidityMinVersion 0.2.1
 * @solidityMaxVersion 0.5.0
 *
 * @param input
 * @param optimize
 * @param readCallbackPtr
 */
export type CompileJsonCallback = (input: string, optimize: boolean, readCallbackPtr: number) => string

/**
 *  Compile multiple files.
 *
 * @solidityMinVersion 0.1.6
 * @solidityMaxVersion 0.5.0
 *
 * @param input
 * @param optimize
 */
export type CompileJsonMulti = (input: string, optimize: boolean) => string

/**
 * Will attempt to bind into compileStandard before falling back to solidity_compile.
 * compileStandard - solidityMaxVersion 0.5.0
 *
 * @solidityMinVersion 0.4.11
 *
 * @param input
 * @param callbackPtr
 * @param contextPtr
 */
export type CompileJsonStandard = (input: string, callbackPtr: number, contextPtr?: number) => string

/**
 * Compile the provided input, using the best case implementation based on the
 * current binary.
 *
 * @param input
 * @param readCallback
 */
export type CompileSolidity = (input: string, readCallback?: Callbacks) => string

export interface CompileBindings {
	compileJson: CompileJson
	compileJsonCallback: CompileJsonCallback
	compileJsonMulti: CompileJsonMulti
	compileStandard: CompileJsonStandard
}

export interface CoreBindings {
	alloc: Alloc
	license: License
	reset: Reset

	version: Version
	versionToSemver: VersionToSemver

	copyFromCString: (ptr: string) => string
	copyToCString: (input: string, ptr: string) => string

	addFunction: (func: (...args: any[]) => any, signature: string) => number
	removeFunction: (ptr: number) => void

	isVersion6OrNewer: boolean
}

export interface SupportedMethods {
	licenseSupported: boolean
	versionSupported: boolean
	allocSupported: boolean
	resetSupported: boolean
	compileJsonSupported: boolean
	compileJsonMultiSupported: boolean
	compileJsonCallbackSupported: boolean
	compileJsonStandardSupported: boolean
}

export type FileLevelSolcOutput = "ast" | "*"
export type ContractLevelSolcOutput =
	| "*"
	| "abi"
	| "devdoc"
	| "userdoc"
	| "metadata"
	| "ir"
	| "irOptimized"
	| "irOptimizedAst"
	| "storageLayout"
	| "evm.assembly"
	| "evm.legacyAssembly"
	| "evm.bytecode"
	| "evm.bytecode.functionDebugData"
	| "evm.bytecode.object"
	| "evm.bytecode.opcodes"
	| "evm.bytecode.sourceMap"
	| "evm.bytecode.linkReferences"
	| "evm.bytecode.generatedSources"
	| "evm.deployedBytecode"
	| "evm.deployedBytecode.object"
	| "evm.deployedBytecode.opcodes"
	| "evm.deployedBytecode.functionDebugData"
	| "evm.deployedBytecode.sourceMap"
	| "evm.deployedBytecode.linkReferences"
	| "evm.deployedBytecode.generatedSources"
	| "evm.deployedBytecode.immutableReferences"
	| "evm.methodIdentifiers"
	| "evm.gasEstimates"

export interface SolcInput {
	language?: string
	sources: {
		[name: string]: {
			ast?: any
			urls?: string[]
			content: string
			keccak256?: string
		}
	}
	settings?: {
		evmVersion?:
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
		stopAfter?: "parsing"
		remappings?: string[]
		// Optional: Change compilation pipeline to go through the Yul intermediate representation.
		// This is false by default.
		viaIR?: boolean
		optimizer?: {
			enabled: boolean
			runs: number
			details?: {
				// The peephole optimizer is always on if no details are given,
				// use details to switch it off.
				peephole?: boolean
				// The unused jumpdest remover is always on if no details are given,
				// use details to switch it off.
				jumpdestRemover?: boolean
				// Sometimes re-orders literals in commutative operations.
				orderLiterals?: boolean
				// Removes duplicate code blocks
				deduplicate?: boolean
				// Common subexpression elimination, this is the most complicated step but
				// can also provide the largest gain.
				cse?: boolean
				// Optimize representation of literal numbers and strings in code.
				constantOptimizer?: boolean
				// The new Yul optimizer. Mostly operates on the code of ABI coder v2
				// and inline assembly.
				// It is activated together with the global optimizer setting
				// and can be deactivated here.
				// Before Solidity 0.6.0 it had to be activated through this switch.
				yul?: boolean
				allocate?: boolean
				yulDetails: {
					stackAllocation?: boolean
					optimizerSteps?: string
				}
			}
		}
		outputSelection?: {
			// Filename matcher
			[filename: string | "*"]:
				| {
						[innerName: string]: ContractLevelSolcOutput[]
				  }
				| {
						"": [FileLevelSolcOutput] // non-contracts
				  }
		}
		// Metadata settings (optional)
		metadata?: {
			// Use only literal content and not URLs (false by default)
			useLiteralContent?: boolean
			// The CBOR metadata is appended at the end of the bytecode by default.
			// Setting this to false omits the metadata from the runtime and deploy time code.
			appendCBOR?: boolean
			// Use the given hash method for the metadata hash that is appended to the bytecode.
			// The metadata hash can be removed from the bytecode via option "none".
			// The other options are "ipfs" and "bzzr1".
			// If the option is omitted, "ipfs" is used by default.
			bytecodeHash?: "none" | "ipfs" | "bzzr1" | "bzzr2"
		}
		// Addresses of the libraries. If not all libraries are given here,
		// it can result in unlinked objects whose output data is different.
		libraries?: {
			// The top level key is the name of the source file where the library is used.
			// If remappings are used, this source file should match the global path
			// after remappings were applied.
			// If this key is an empty string, that refers to a global level.
			[file: string]: {
				[library: string]: `0x${string}`
			}
		}
		// Optional: Debugging settings
		debug?: {
			// How to treat revert (and require) reason strings. Settings are
			// "default", "strip", "debug" and "verboseDebug".
			// "default" does not inject compiler-generated revert strings and keeps user-supplied ones.
			// "strip" removes all revert strings (if possible, i.e. if literals are used) keeping side-effects
			// "debug" injects strings for compiler-generated internal reverts, implemented for ABI encoders V1 and V2 for now.
			// "verboseDebug" even appends further information to user-supplied revert strings (not yet implemented)
			revertStrings?: "default" | "strip" | "debug" | "verboseDebug"
			// Optional: How much extra debug information to include in comments in the produced EVM
			// assembly and Yul code. Available components are:
			// - `location`: Annotations of the form `@src <index>:<start>:<end>` indicating the
			//    location of the corresponding element in the original Solidity file, where:
			//     - `<index>` is the file index matching the `@use-src` annotation,
			//     - `<start>` is the index of the first byte at that location,
			//     - `<end>` is the index of the first byte after that location.
			// - `snippet`: A single-line code snippet from the location indicated by `@src`.
			//     The snippet is quoted and follows the corresponding `@src` annotation.
			// - `*`: Wildcard value that can be used to request everything.
			debugInfo?: ("location" | "snippet" | "*")[]
		}
		// The modelChecker object is experimental and subject to changes.
		modelChecker?: {
			// Chose which contracts should be analyzed as the deployed one.
			contracts: {
				[filename: string]: string[]
			}
			// Choose how division and modulo operations should be encoded.
			// When using `false` they are replaced by multiplication with slack
			// variables. This is the default.
			// Using `true` here is recommended if you are using the CHC engine
			// and not using Spacer as the Horn solver (using Eldarica, for example).
			// See the Formal Verification section for a more detailed explanation of this option.
			divModNoSlacks?: boolean
			// Choose which model checker engine to use: all (default), bmc, chc, none.
			engine?: "all" | "chc" | "bmc" | "none"
			// Choose whether external calls should be considered trusted in case the
			// code of the called function is available at compile-time.
			// For details see the SMTChecker section.
			extCalls?: "trusted" | "untrusted"
			// Choose which types of invariants should be reported to the user: contract, reentrancy.
			invariants: ("contract" | "reentrancy")[]
			// Choose whether to output all proved targets. The default is `false`.
			showProved?: boolean
			// Choose whether to output all unproved targets. The default is `false`.
			showUnproved?: boolean
			// Choose whether to output all unsupported language features. The default is `false`.
			showUnsupported?: boolean
			// Choose which solvers should be used, if available.
			// See the Formal Verification section for the solvers description.
			solvers?: ("cvc4" | "smtlib2" | "z3")[]
			// Choose which targets should be checked: constantCondition,
			// underflow, overflow, divByZero, balance, assert, popEmptyArray, outOfBounds.
			// If the option is not given all targets are checked by default,
			// except underflow/overflow for Solidity >=0.8.7.
			// See the Formal Verification section for the targets description.
			targets?: (
				| "underflow"
				| "constantCondition"
				| "overflow"
				| "assert"
				| "balance"
				| "popEmptyArray"
				| "outOfBounds"
				| "divByZero"
			)[]
			// Timeout for each SMT query in milliseconds.
			// If this option is not given, the SMTChecker will use a deterministic
			// resource limit by default.
			// A given timeout of 0 means no resource/time restrictions for any query.
			timeout?: number
		}
	}
}

export type SolcErrorType =
	| "JSONError"
	| "IOError"
	| "ParserError"
	| "DeclarationError"
	| "DocstringParsingError"
	| "SyntaxError"
	| "UnimplementedFeatureError"
	| "CompilerError"
	| "YulException"
	| "Warning"
	| "Info"
	| "FatalError"
	| "TypeError"
	| "InternalCompilerError"
	| "Exception"

export type SolcError = {
	// Optional: Location within the source file.
	sourceLocation?: {
		file: string
		start: number
		end: number
	}
	// Optional: Further locations (e.g. places of conflicting declarations)
	secondarySourceLocations?: {
		file: string
		start: number
		end: number
		message: string
	}[]
	// Mandatory: Error type, such as "TypeError", "InternalCompilerError", "Exception", etc.
	// See below for complete list of types.
	type: SolcErrorType
	// Mandatory: Component where the error originated, such as "general" etc.
	component: "general" | "ewasm" | "abi" | "parser" | "docstring" | "typecheck" | "lsp" | "solc" | "smtchecker"
	// Mandatory ("error", "warning" or "info", but please note that this may be extended in the future)
	severity: "error" | "warning" | "info"
	// Optional: unique code for the cause of the error
	errorCode?: `${number}`
	code?: `${number}`
	// Mandatory
	message: string
	// Optional: the message formatted with source location
	formattedMessage?: `${string}: ${string}`
}
type BytecodeOutput = {
	// Debugging data at the level of functions.
	functionDebugData: {
		// Now follows a set of functions including compiler-internal and
		// user-defined function. The set does not have to be complete.
		[func: string]: {
			// Internal name of the function
			entryPoint: number // Byte offset into the bytecode where the function starts (optional)
			id: number // AST ID of the function definition or null for compiler-internal functions (optional)
			parameterSlots: number // Number of EVM stack slots for the function parameters (optional)
			returnSlots: number // Number of EVM stack slots for the return values (optional)
		}
	}
	// The bytecode as a hex string.
	object: string
	// Opcodes list (string)
	opcodes: string
	// The source mapping as a string. See the source mapping definition.
	sourceMap: string
	// Array of sources generated by the compiler. Currently only
	// contains a single Yul file.
	generatedSources: [
		{
			// Yul AST
			ast: AST
			// Source file in its text form (may contain comments)
			contents: string
			// Source file ID, used for source references, same "namespace" as the Solidity source files
			id: number
			language: string
			name: string
		},
	]
	// If given, this is an unlinked object.
	linkReferences: {
		[file: string]: {
			// Byte offsets into the bytecode.
			// Linking replaces the 20 bytes located there.
			[libraryName: string]: { start: number; length: number }[]
		}
	}
}
export interface SolcOutput {
	// Optional: not present if no errors/warnings/infos were encountered
	errors: SolcError[]
	// This contains the file-level outputs.
	// It can be limited/filtered by the outputSelection settings.
	sources: {
		[filename: string]: {
			// Identifier of the source (used in source maps)
			id: number
			// The AST object
			ast: AST
		}
	}
	// This contains the contract-level outputs.
	// It can be limited/filtered by the outputSelection settings.
	contracts: {
		[fileName: string]: {
			// If the language used has no contract names, this field should equal to an empty string.
			[contractName: string]: {
				// The Ethereum Contract ABI. If empty, it is represented as an empty array.
				// See https://docs.soliditylang.org/en/develop/abi-spec.html
				abi: ABI
				// Intermediate representation before optimization (string)
				ir?: string
				// See the Metadata Output documentation (serialised JSON string)
				metadata?: string
				// User documentation (natspec)
				userdoc?: {
					kind: "devdoc"
					methods?: {
						[methodSignature: string]: {
							details: string
							params: {
								[param: string]: string
							}
							returns: {
								[returnParam: string]: string
							}
						}
					}
					version?: number
				}
				// Developer documentation (natspec)
				devdoc?: {
					kind: "userdoc"
					methods?: {
						[key: string]: {
							notice: {
								[key: string]: string
							}
						}
					}
					version?: number
				}
				// AST of intermediate representation before optimization
				irAst?: AST
				// Intermediate representation after optimization (string)
				irOptimized?: string
				// AST of intermediate representation after optimization
				irOptimizedAst?: AST
				// the Storage Layout documentation.
				storageLayout: {
					storage: any
					types: any
				}
				// EVM-related outputs
				evm: {
					// Assembly (string)
					assembly?: string
					// Old-style assembly (object)
					legacyAssembly?: any
					// Bytecode and related details.
					bytecode?: BytecodeOutput
					deployedBytecode?: BytecodeOutput & {
						/* ..., */ // The same layout as above.
						immutableReferences: {
							// There are two references to the immutable with AST ID 3, both 32 bytes long. One is
							// at bytecode offset 42, the other at bytecode offset 80.
							[key: string]: { start: number; length: number }[]
						}
					}
					// The list of function hashes
					methodIdentifiers: {
						[functionIdentifier: string]: string
					}
					// Function gas estimates
					gasEstimates: {
						// The gas estimate for a function call.
						[creationOrFuncType: string]: {
							[actionOrFuncName: string]: string
						}
					}
				}
			}
		}
	}
}
export interface SolcWrapper {
	/**
	 * Returns the complete license document.
	 */
	license(): string | undefined

	/**
	 * Returns the compiler version.
	 */
	version(): string

	/**
	 * Returns the compiler version as a semver version style.
	 */
	semver(): string

	/**
	 * Compile the provided input, using the best case implementation based on the
	 * current binary.
	 *
	 * @param input
	 * @param readCallback
	 */
	compile(input: string, readCallback?: Callbacks): string

	lowlevel: {
		compileSingle?: CompileJson
		compileMulti?: CompileJsonMulti
		compileCallback?: CompileJsonCallback
		compileStandard?: CompileJsonStandard
	}

	features: {
		legacySingleInput: boolean
		multipleInputs: boolean
		importCallback: boolean
		nativeStandardJSON: boolean
	}

	loadRemoteVersion(version: string, callback: (error: Error, solc: SolJson) => void): void

	setupMethods(soljson: SolJson): SolcWrapper
}
