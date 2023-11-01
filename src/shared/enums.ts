export enum CompilerType {
	NPM = 0,
	Remote = 1,
	File = 2,
	Extension = 3,
}

export enum ExecStatus {
	Empty = 0,
	Restart = 1,
	Error = 2,
	CompilerError = 3,
	SetupFail = 4,
	Fail = 5,
	Pass = 6,
}

export enum ExpressionType {
	Call = 0,
	Identifier = 1,
}

export enum ContractType {
	Contract = 0,
	Interface = 1,
	Library = 2,
}
