import type { ParsedCode } from "@server/code/ParsedCode"
import { ParsedContract } from "@server/code/ParsedContract"
import type { ParsedDocument } from "@server/code/ParsedDocument"
import { config, settings } from "@server/server-config"
import type { DocUtil } from "@server/utils/text-document"
import Fuse from "fuse.js"

export const fuzzySearchByName = (
	searchStr: string,
	from: ParsedContract | ParsedDocument,
	doc: DocUtil,
	unique = false,
	threshold = config.fuzzLevel.suggestions,
	wrappingNative?: boolean,
) => {
	const result: { match: ParsedCode; score: number }[] = []

	if (from instanceof ParsedContract) {
		result.push(...getMatches(searchStr, from, doc, threshold, unique, wrappingNative))
	} else {
		const selectedItem = from.getSelectedItem(doc.currentOffset)

		if (selectedItem.contract)
			return getMatches(searchStr, selectedItem.contract, doc, threshold, unique, wrappingNative)

		for (const contract of from.innerContracts) {
			const matches = getMatches(searchStr, contract, doc, threshold, unique, wrappingNative)
			if (matches.length > 0) {
				result.push(...matches)
			}
		}
	}

	return result
}

const getMatches = (
	searchStr: string,
	from: ParsedContract,
	doc: DocUtil,
	threshold: number,
	onlyUniqueNames = false,
	wrappingNative = false,
) => {
	try {
		const matches: { match: ParsedCode; score: number }[] = []
		const meta = doc.getLineMeta()
		const wrapsNative =
			meta.isWrapper("type") ||
			meta.isWrapper("address") ||
			meta.isWrapper("uint256") ||
			meta.isWrapper("bytes32") ||
			meta.isWrapper("bytes")
		const includeFuncs = !wrapsNative && !meta.isType && !meta.isStorageLocation
		const includeStateVariables =
			!wrapsNative && !meta.isType && !meta.isStorageLocation && !meta.isDotAccessBefore && !meta.isDotAccessAfter
		const includeErrors = !wrapsNative && meta.isRevert
		const includeEvents = !wrapsNative && meta.isEmit
		const includeEnums = !wrapsNative && !meta.isStorageLocation && !meta.isDotAccessAfter && !meta.isDotAccessBefore
		const includeStructs = !wrapsNative && !meta.isStorageLocation
		const includeStructMembers =
			!wrapsNative && (meta.isDotAccessAfter || meta.isDotAccessBefore) && !meta.isStorageLocation
		const includeEnumMembers =
			!wrapsNative && (meta.isDotAccessAfter || meta.isDotAccessBefore) && !meta.isStorageLocation
		const includeNativeMembers = !wrapsNative && meta.isDotAccessBefore && !meta.isStorageLocation && !meta.isType
		const includeNativeTypes = !wrapsNative && meta.isType && !meta.isStorageLocation
		const includeStorageTypes = !wrapsNative && meta.isStorageLocation

		const inherits = from.getExtendedContractsRecursive().flatMap((c) => {
			return [
				...(includeFuncs ? c.functions : []),
				...(includeStateVariables ? c.stateVariables : []),
				...(includeEnums ? c.enums : []),
				...(includeEnumMembers ? c.enums.flatMap((e) => e.items) : []),
				...(includeErrors ? c.errors : []),
				...(includeEvents ? c.events : []),
				...(includeStructs ? c.structs : []),
				...(includeStructMembers ? c.structs.flatMap((s) => s.getInnerMembers() as any[]) : []),
			]
		})

		const symbols = from.document.imports.flatMap((i) => i.symbols.map((s) => ({ name: s.name })))
		const items = from.functions
			.concat(includeFuncs ? from.functions : [])
			.concat(includeStructs ? (from.structs as any) : [])
			.concat(includeStateVariables ? from.stateVariables : ([] as any))
			.concat(includeEnums ? (from.enums as any) : [])
			.concat(includeEnumMembers ? from.enums.flatMap((e) => e.items as any) : [])
			.concat(includeStructs ? (symbols as any) : [])
			.concat(includeErrors ? (from.errors as any) : [])
			.concat(includeEvents ? (from.events as any) : [])
			.concat(!wrapsNative ? inherits : [])
			.concat(includeStructMembers ? from.structs.flatMap((s) => s.getInnerMembers() as any) : [])
			.concat(includeNativeTypes ? (types.map((n) => ({ name: n })) as any) : ([] as any))
			.concat(includeStorageTypes ? (storageLocs.map((n) => ({ name: n })) as any) : ([] as any))
			.concat(includeNativeMembers ? (nativeMembers.map((n) => ({ name: n })) as any) : ([] as any))
			.concat(wrapsNative ? (wrapperMembers.map((n) => ({ name: n })) as any) : ([] as any))

		const selectedFunction = from.getSelectedFunction(doc.currentOffset)
		if (selectedFunction) {
			items.push(
				...(includeStateVariables ? (selectedFunction.input as any) : []),
				...(includeStateVariables ? (selectedFunction.output as any) : []),
				...(includeStateVariables ? (selectedFunction.variables as any) : []),
			)
		}
		const fuse = new Fuse(
			items.map((m) => m.name),
			{
				isCaseSensitive: true,
				shouldSort: true,
				includeScore: true,
				threshold,
			},
		)

		let result = fuse.search(searchStr)
		if (!result.length) {
			result = new Fuse(
				items.map((m) => m.name),
				{
					isCaseSensitive: true,
					shouldSort: true,
					includeScore: true,
					threshold: config.fuzzLevel.suggestionsLoose,
				},
			).search(searchStr)
		}
		for (const item of result) {
			const found = items.find((i) => i.name === item.item)
			matches.push({ match: found, score: item.score })
		}

		return onlyUniqueNames
			? matches.filter((m, i, a) => a.findIndex((t) => t.match.name === m.match.name) === i)
			: matches
	} catch (e) {
		console.debug("Fuzz:", e.message)
	}
}

const types = [
	"address",
	"bytes4",
	"bytes8",
	"bytes16",
	"bytes32",
	"bytes",
	"uint8",
	"uint16",
	"uint32",
	"uint64",
	"uint96",
	"uint128",
	"uint196",
	"uint224",
	"uint256",
	"string",
	"bool",
	"int8",
	"int16",
	"int32",
	"int64",
	"int96",
	"int128",
	"int196",
	"int224",
	"int256",
]

const wrapperMembers = ["max", "min", "interfaceId", "selector", "balance", "length", "size", "code", "codehash"]
const nativeMembers = [
	"interfaceId",
	"selector",
	"balance",
	"length",
	"size",
	"code",
	"codehash",
	"origin",
	"sender",
	"concat",
	"encode",
	"decode",
	"encodePacked",
	"encodeWithSelector",
	"encodeWithSignature",
	"encodeCall",
	"sig",
]
const storageLocs = ["memory", "calldata", "storage"]
