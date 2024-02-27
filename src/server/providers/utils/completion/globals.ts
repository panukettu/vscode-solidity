import { CompletionItem, CompletionItemKind } from "vscode-languageserver"
import { CreateCompletionItem } from "../../completions"
import { isTriggeredByVariableName } from "./textMatchers"
export function GetCompletionTypes(): CompletionItem[] {
	const types = ["address", "string", "bytes", "byte", "int", "uint", "bool", "hash"]
	for (let index = 8; index <= 256; index += 8) {
		types.push(`int${index}`)
		types.push(`uint${index}`)
		types.push(`bytes${index / 8}`)
	}

	return types.map((type) => {
		const completionItem = CompletionItem.create(type)
		completionItem.kind = CompletionItemKind.Keyword
		completionItem.detail = `type: ${type}`
		return completionItem
	})
}

export function GetCompletionKeywords(): CompletionItem[] {
	const keywords = [
		"modifier",
		"mapping",
		"if",
		"break",
		"continue",
		"delete",
		"else",
		"for",
		"new",
		"switch",
		"return",
		"returns",
		"while",
		"assembly",
		"using",
		"private",
		"public",
		"external",
		"internal",
		"payable",
		"nonpayable",
		"view",
		"pure",
		"case",
		"do",
		"else",
		"in",
		"return",
		"throw",
		"try",
		"catch",
		"typeof",
		"virtual",
		"override",
	]
	const completionItems = keywords.map((unit) => {
		const completionItem = CompletionItem.create(unit)
		completionItem.kind = CompletionItemKind.Keyword
		completionItem.detail = `sol: ${unit}`
		return completionItem
	})
	keywords.forEach((unit) => {
		const completionItem = CompletionItem.create(unit)
		completionItem.kind = CompletionItemKind.Keyword
		completionItems.push(completionItem)
	})

	completionItems.push(CreateCompletionItem("contract", CompletionItemKind.Class, null))
	completionItems.push(CreateCompletionItem("library", CompletionItemKind.Class, null))
	completionItems.push(CreateCompletionItem("storage", CompletionItemKind.Field, null))
	completionItems.push(CreateCompletionItem("memory", CompletionItemKind.Field, null))
	completionItems.push(CreateCompletionItem("calldata", CompletionItemKind.Field, null))
	completionItems.push(CreateCompletionItem("var", CompletionItemKind.Field, null))
	completionItems.push(CreateCompletionItem("constant", CompletionItemKind.Constant, null))
	completionItems.push(CreateCompletionItem("immutable", CompletionItemKind.Keyword, null))
	completionItems.push(CreateCompletionItem("constructor", CompletionItemKind.Constructor, null))
	completionItems.push(CreateCompletionItem("event", CompletionItemKind.Event, null))
	completionItems.push(CreateCompletionItem("import", CompletionItemKind.Module, null))
	completionItems.push(CreateCompletionItem("enum", CompletionItemKind.Enum, null))
	completionItems.push(CreateCompletionItem("struct", CompletionItemKind.Struct, null))
	completionItems.push(CreateCompletionItem("function", CompletionItemKind.Function, null))

	return completionItems
}

export function GeCompletionUnits(): CompletionItem[] {
	const completionItems = []
	const etherUnits = ["wei", "gwei", "ether"]
	etherUnits.forEach((unit) => {
		const completionItem = CompletionItem.create(unit)
		completionItem.kind = CompletionItemKind.Unit
		completionItem.detail = `${unit}: ether unit`
		completionItems.push(completionItem)
	})

	const timeUnits = ["seconds", "minutes", "hours", "days", "weeks", "years"]
	timeUnits.forEach((unit) => {
		const completionItem = CompletionItem.create(unit)
		completionItem.kind = CompletionItemKind.Unit

		if (unit !== "years") {
			completionItem.detail = `${unit}: time unit`
		} else {
			completionItem.detail = `DEPRECATED: ${unit}: time unit`
		}
		completionItems.push(completionItem)
	})

	return completionItems
}

const visibility = ["internal", "external"].map((i) => ({
	name: i,
	type: "modifier",
	modifier: "visibility.".concat(i),
}))
const payable = ["payable", "virtual", "override"].map((i) => ({ name: i, type: "modifier", modifier: i }))
const state = ["view", "pure"].map((i) => ({ name: i, type: "modifier", modifier: "mutability.".concat(i) }))
const ret = ["returns"].map((i) => ({ name: i, type: "keyword", modifier: i }))
const keywords = ["length", "selector", "interfaceId", "min", "max"].map((i) => ({
	name: i,
	type: "property",
	modifier: i,
}))

export const globalNames = (): { type: string; name: string; modifier?: string }[] =>
	GetGlobalVariables()
		.map((item) => ({
			type: "variable",
			name: item.label,
		}))
		.concat(
			GetGlobalFunctions().map((item) => ({
				type: "function",
				name: item.label,
			})),
		)
		.concat(
			getBlockCompletionItems().map((item) => ({
				type: "property",
				modifier: "block",
				name: item.label,
			})),
		)
		.concat(
			getMsgCompletionItems().map((item) => ({
				type: "property",
				modifier: "transaction",
				name: item.label,
			})),
		)
		.concat(
			getTxCompletionItems().map((item) => ({
				type: "property",
				modifier: "transaction",
				name: item.label,
			})),
		)
		.concat(
			getAbiCompletionItems().map((item) => ({
				type: "function",
				modifier: "abi",
				name: item.label,
			})),
		)
		.concat(visibility)
		.concat(payable)
		.concat(state)
		.concat(ret)
		.concat(keywords)

export function GetGlobalVariables(): CompletionItem[] {
	return [
		{
			detail: "Current block",
			kind: CompletionItemKind.Variable,
			label: "block",
		},
		{
			detail: "Current Message",
			kind: CompletionItemKind.Variable,
			label: "msg",
		},
		{
			detail: "(uint): DEPRECATED in 0.7.0, current block timestamp (alias for block.timestamp)",
			kind: CompletionItemKind.Variable,
			label: "now",
		},
		{
			detail: "Current transaction",
			kind: CompletionItemKind.Variable,
			label: "tx",
		},
		{
			detail: "ABI encoding / decoding",
			kind: CompletionItemKind.Variable,
			label: "abi",
		},
	]
}

export function GetGlobalFunctions(): CompletionItem[] {
	return [
		{
			detail: "assert(bool condition): assert important invariants that should never fail.",
			insertText: "assert(${1:condition});",
			insertTextFormat: 2,
			kind: CompletionItemKind.Function,
			label: "assert",
		},
		{
			detail: "gasleft(): returns the remaining gas",
			insertText: "gasleft();",
			insertTextFormat: 2,
			kind: CompletionItemKind.Function,
			label: "gasleft",
		},
		{
			detail: "unicode: converts string into unicode",
			insertText: 'unicode"${1:text}"',
			insertTextFormat: 2,
			kind: CompletionItemKind.Function,
			label: "unicode",
		},
		{
			detail:
				"blockhash(uint blockNumber): hash of the given block - only works for 256 most recent, excluding current, blocks",
			insertText: "blockhash(${1:blockNumber});",
			insertTextFormat: 2,
			kind: CompletionItemKind.Function,
			label: "blockhash",
		},
		{
			detail:
				"require(bool condition): reverts if the condition is not met - to be used for errors in inputs or external components.",
			insertText: "require(${1:condition});",
			insertTextFormat: 2,
			kind: CompletionItemKind.Method,
			label: "require",
		},
		{
			// tslint:disable-next-line:max-line-length
			detail:
				"require(bool condition, string message): reverts if the condition is not met - to be used for errors in inputs or external components. Also provides an error message.",
			insertText: "require(${1:condition}, ${2:message});",
			insertTextFormat: 2,
			kind: CompletionItemKind.Method,
			label: "require",
		},
		{
			detail: "revert Error(..): abort execution with custom error",
			insertText: "revert ${1:Error};",
			insertTextFormat: 2,
			kind: CompletionItemKind.Method,
			label: "revert",
		},
		{
			detail: "revert(): abort execution and revert state changes",
			insertText: "revert();",
			insertTextFormat: 2,
			kind: CompletionItemKind.Method,
			label: "revert",
		},
		{
			detail: "revert(string reason): abort execution and revert state changes",
			insertText: "revert(${1:reason});",
			insertTextFormat: 2,
			kind: CompletionItemKind.Method,
			label: "revert",
		},
		{
			detail:
				"addmod(uint x, uint y, uint k) returns (uint):" +
				"compute (x + y) % k where the addition is performed with arbitrary precision and does not wrap around at 2**256",
			insertText: "addmod(${1:x}, ${2:y}, ${3:k})",
			insertTextFormat: 2,
			kind: CompletionItemKind.Method,
			label: "addmod",
		},
		{
			detail:
				"mulmod(uint x, uint y, uint k) returns (uint):" +
				"compute (x * y) % k where the multiplication is performed with arbitrary precision and does not wrap around at 2**256",
			insertText: "mulmod(${1:x}, ${2:y}, ${3:k})",
			insertTextFormat: 2,
			kind: CompletionItemKind.Method,
			label: "mulmod",
		},
		{
			detail: "keccak256(...) returns (bytes32):" + "keccak-256 hash of the (packed) arguments",
			insertText: "keccak256(${1:x})",
			insertTextFormat: 2,
			kind: CompletionItemKind.Method,
			label: "keccak256",
		},
		{
			detail: "sha256(...) returns (bytes32):" + "SHA-256 hash of the (packed) arguments",
			insertText: "sha256(${1:x})",
			insertTextFormat: 2,
			kind: CompletionItemKind.Method,
			label: "sha256",
		},
		{
			detail: "ripemd160(...) returns (bytes20):" + "RIPEMD-160 hash of the (packed) arguments",
			insertText: "ripemd160(${1:x})",
			insertTextFormat: 2,
			kind: CompletionItemKind.Method,
			label: "ripemd160",
		},
		{
			detail:
				"ecrecover(bytes32 hash, uint8 v, bytes32 r, bytes32 s) returns (address):" +
				"Recover the address associated with the public key from elliptic curve signature. Returns address(0) on error.",
			insertText: "ecrecover(${1:hash}, ${2:v}, ${3:r}, ${4:s})",
			insertTextFormat: 2,
			kind: CompletionItemKind.Method,
			label: "ecrecover",
		},
	]
}

export function getGlobalKeywordCompletions(lineText: string, wordEndPosition: number): CompletionItem[] {
	if (isTriggeredByVariableName("block", lineText, wordEndPosition)) {
		return getBlockCompletionItems()
	}
	if (isTriggeredByVariableName("msg", lineText, wordEndPosition)) {
		return getMsgCompletionItems()
	}
	if (isTriggeredByVariableName("tx", lineText, wordEndPosition)) {
		return getTxCompletionItems()
	}
	if (isTriggeredByVariableName("abi", lineText, wordEndPosition)) {
		return getAbiCompletionItems()
	}
	return []
}

export function getBlockCompletionItems(): CompletionItem[] {
	return [
		{
			detail: "(address): Current block miner’s address",
			kind: CompletionItemKind.Property,
			label: "coinbase",
		},
		{
			detail:
				"(bytes32): DEPRECATED In 0.4.22 use blockhash(uint) instead. Hash of the given block - only works for 256 most recent blocks excluding current",
			insertText: "blockhash(${1:blockNumber});",
			insertTextFormat: 2,
			kind: CompletionItemKind.Method,
			label: "blockhash",
		},
		{
			detail: "(uint256): SOL >=0.8.18, previous randomness value from the beacon chain.",
			kind: CompletionItemKind.Property,
			label: "prevrandao",
		},
		{
			detail: "(uint256): DEPRECATED, returns prevrandao.",
			kind: CompletionItemKind.Property,
			label: "difficulty",
		},
		{
			detail: "(uint): current block gaslimit",
			kind: CompletionItemKind.Property,
			label: "gaslimit",
		},
		{
			detail: "(uint): current block number",
			kind: CompletionItemKind.Property,
			label: "number",
		},
		{
			detail: "(uint): chain id",
			kind: CompletionItemKind.Property,
			label: "chainid",
		},
		{
			detail: "(uint): current block timestamp as seconds since unix epoch",
			kind: CompletionItemKind.Property,
			label: "timestamp",
		},
	]
}

function getTxCompletionItems(): CompletionItem[] {
	return [
		{
			detail: "(uint): gas price of the transaction",
			kind: CompletionItemKind.Property,
			label: "gas",
		},
		{
			detail: "(address): sender of the transaction (full call chain)",
			kind: CompletionItemKind.Property,
			label: "origin",
		},
	]
}

function getMsgCompletionItems(): CompletionItem[] {
	return [
		{
			detail: "(bytes): complete calldata",
			kind: CompletionItemKind.Property,
			label: "data",
		},
		{
			detail: "(uint): remaining gas DEPRECATED in 0.4.21 use gasleft()",
			kind: CompletionItemKind.Property,
			label: "gas",
		},
		{
			detail: "(address): sender of the message (current call)",
			kind: CompletionItemKind.Property,
			label: "sender",
		},
		{
			detail: "(bytes4): first four bytes of the calldata (i.e. function identifier)",
			kind: CompletionItemKind.Property,
			label: "sig",
		},
		{
			detail: "(uint): number of wei sent with the message",
			kind: CompletionItemKind.Property,
			label: "value",
		},
	]
}

export function getAbiCompletionItems(): CompletionItem[] {
	return [
		{
			detail: "encode(..) returns (bytes): ABI-encodes the given arguments",
			insertText: "encode(${1:arg});",
			insertTextFormat: 2,
			kind: CompletionItemKind.Method,
			label: "encode",
		},
		{
			detail: "encodePacked(..) returns (bytes): Performs packed encoding of the given arguments",
			insertText: "encodePacked(${1:arg});",
			insertTextFormat: 2,
			kind: CompletionItemKind.Method,
			label: "encodePacked",
		},
		{
			detail:
				"encodeWithSelector(bytes4,...) returns (bytes): ABI-encodes the given arguments starting from the second and prepends the given four-byte selector",
			insertText: "encodeWithSelector(${1:bytes4}, ${2:arg});",
			insertTextFormat: 2,
			kind: CompletionItemKind.Method,
			label: "encodeWithSelector",
		},
		{
			detail:
				"encodeWithSignature(string,...) returns (bytes): Equivalent to abi.encodeWithSelector(bytes4(keccak256(signature), ...)`",
			insertText: "encodeWithSignature(${1:signatureString}, ${2:arg});",
			insertTextFormat: 2,
			kind: CompletionItemKind.Method,
			label: "encodeWithSignature",
		},
	]
}
