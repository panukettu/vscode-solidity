export type ABIType = 'function' | 'constructor' | 'event' | 'fallback' | 'error' | 'receive';

export type ABIArg = { internalType: string; name: string; type: string; components?: ABIArg[] };

type ABICtor = {
	inputs: ABIArg[];
	stateMutability: 'payable' | 'nonpayable';
	type: 'constructor';
};
type ABIReceive = {
	stateMutability: 'payable';
	type: 'receive';
};
type ABIFallback = {
	stateMutability: 'payable';
	type: 'fallback';
};

export type ABIFunction = {
	type: 'function' | 'constructor' | 'fallback';
	inputs: ABIArg[];
	outputs: ABIArg[];
	name: string;
	stateMutability: 'pure' | 'view' | 'nonpayable' | 'payable';
};

export type ABIEvent = {
	type: 'event';
	inputs: ABIArg[];
	name: string;
	anonymous: boolean;
};
export type ABIError = {
	type: 'error';
	inputs: ABIArg[];
	name: string;
};

export type ABIEntry = ABIFunction | ABICtor | ABIEvent | ABIError | ABIReceive | ABIFallback;
export type ABI = ABIEntry[];
export type LooseABI = LooseABIEntry[];

export type LooseABIEntry<Type extends ABIType = ABIType> = {
	type: Type;
	inputs: ABIArg[];
	outputs: ABIArg[];
	name: string;
	anonymous?: boolean;
	stateMutability?: 'pure' | 'view' | 'nonpayable' | 'payable';
};

export type InnerNodeTypes =
	| 'FunctionDefinition'
	| 'UsingForDirective'
	| 'ContractDefinition'
	| 'StructDefinition'
	| 'EventDefinition'
	| 'ErrorDefinition'
	| 'VariableDefinition'
	| 'VariableDeclaration';

export type FileLevelTypes =
	| 'SourceUnit'
	| 'PragmaDirective'
	| 'StructDefinition'
	| 'UsingForDirective'
	| 'ImportDirective'
	| 'VariableDeclaration'
	| 'ContractDefinition'
	| 'FunctionDefinition'
	| 'ErrorDefinition'
	| 'EventDefinition';
type LibraryName = {
	id: number;
	name: string;
	nameLocations: SourceLocation[];
	nodeType: 'IdentifierPath';
	referencedDeclaration: number;
	src: SourceLocation;
};

type Member = {
	constant?: boolean;
	id: number;
	mutability: 'mutable' | 'immutable';
	name: string;
	nameLocation: SourceLocation;
	nodeType: 'VariableDeclaration';
	scope: number;
	src: SourceLocation;
	stateVariable: boolean;
	storageLocation: string;
	visibility: 'public' | 'internal' | 'private' | 'external';
	typeDescriptions: TypeDescriptions;
	typeName: TypeName;
};

type TypeDescriptions = {
	typeString: string;
	typeIdentifier: string;
};

type TypeName = {
	id: number;
	name: string;
	nodeType: 'ElementaryTypeName' | 'UserDefinedTypeName';
	src: SourceLocation;
	referenceDeclaration: number;
	pathNode: {
		id: number;
		name: string;
		nodeType: 'IdentifierPath';
		src: SourceLocation;
		referencedDeclaration: number;
		nameLocations: SourceLocation[];
	};
	typeDescriptions: TypeDescriptions;
	valueType?: {
		baseType?: {
			id: number;
			name: string;
			nodeType: 'ElementaryTypeName' | 'UserDefinedTypeName';
			src: SourceLocation;
			stateMutability: 'nonpayable' | 'payable' | 'pure' | 'view';
			typeDescriptions: TypeDescriptions;
		};
		id: number;
		nodeType: string;
		src: SourceLocation;
		typeDescriptions: TypeDescriptions;
	};
	valueName?: string;
	valueNameLocation?: SourceLocation;
};
type SourceLocation = `${number}:${number}:${number}`;
type ASTParameters = {
	id: number;
	nodeType: 'ParameterList';
	src: string;
	parameters: any[];
	typeDescriptions: Partial<TypeDescriptions>;
};
type SymbolAlias = {
	foreign: {
		id: number;
		name: string;
		nodeType: 'Identifier';
		overloadedDeclarations: any[];
		referencedDeclaration: number;
		src: SourceLocation;
		typeDescriptions: Partial<TypeDescriptions>;
	};
	nameLocation: SourceLocation;
};

type ASTModifiers = {
	id: number;
	kind: 'modifierInvocation';
	modifierName: {
		id: number;
		name: string;
		nameLocations: SourceLocation[];
		nodeType: 'IdentifierPath';
		referencedDeclaration: number;
		src: SourceLocation;
	};
	nodeType: 'ModifierInvocation';
	src: SourceLocation;
}[];
type ASTDoc = {
	id: number;
	nodeType: 'StructuredDocumentation';
	src: SourceLocation;
	text: string;
};
export type ASTInnerLevel = {
	nodeType: InnerNodeTypes;
	name: string;
	members?: Member[];
	nameLocation: SourceLocation;
	scope: number;
	kind?: 'constructor' | 'function';
	functionSelector?: string;
	implemented?: boolean;
	documentation?: ASTDoc;
	literals: string[];
	libraryName: LibraryName;
	typeName: TypeName;
	modifiers?: ASTModifiers[];
	global?: boolean;
	parameters?: ASTParameters;
	stateMutability?: 'payable' | 'nonpayable' | 'pure' | 'view';
	virtual?: boolean;
	visibility: 'public' | 'internal' | 'private' | 'external';
	returnParameters?: ASTParameters;
};

type ASTBaseContract = {
	baseName: {
		id: number;
		name: string;
		nameLocations: SourceLocation[];
		nodeType: 'IdentifierPath';
		referencedDeclaration: number;
		src: SourceLocation;
	};
	id: 104215;
	nodeType: 'InheritanceSpecifier';
	src: SourceLocation;
};
export type ASTFileLevel = {
	id: number;
	nodeType: FileLevelTypes;
	name?: string;
	scope?: number;
	documentation?: ASTDoc;
	nameLocation?: SourceLocation;
	abstract?: boolean;
	src: SourceLocation;
	absolutePath?: string;
	errorSelector?: string;
	baseContracts?: ASTBaseContract[];
	canonicalName?: string;
	contractKind?: 'contract' | 'interface' | 'library' | 'abstract';
	fullyImplemented?: boolean;
	contractDependencies: number[];
	unitAlias?: string;
	linearizedBaseContracts?: number[];
	usedErrors?: number[];
	usedEvents?: number[];
	symbolAliases?: SymbolAlias[];
	nodes: ASTInnerLevel[];
	file?: string;
	literals?: string[];
};
export type AST = {
	absolutePath: string;
	id: number;
	exportedSymbols: {
		[exportedSymbol: string]: number[];
	};
	src: SourceLocation;
	nodeType: 'SourceUnit';
	nodes: ASTFileLevel[];
	license?: string;
};
