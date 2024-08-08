import {
	type Hex,
	decodeAbiParameters,
	encodeAbiParameters,
	isHex,
	keccak256,
	numberToHex,
	parseAbiParameters,
	toBytes,
	toFunctionSelector,
} from "viem"

export const hash = (input: unknown) => {
	const parsed = parseInput(input)
	const hex = isHex(parsed)
	return { hash: keccak256(parsed), hex }
}

const parseInput = (input: unknown) => {
	if (typeof input === "number") return numberToHex(input)
	if (typeof input === "bigint") return numberToHex(input)
	if (typeof input === "string") return toBytes(input)
	if (typeof input === "boolean") return toBytes(input)
	if (typeof input === "object") return toBytes(JSON.stringify(input))

	throw new Error(`Invalid input: ${input}`)
}

export const getSelector = (item?: { getSelector: () => string } | string) => {
	if (typeof item === "string") return toFunctionSelector(item)
	if (item && "getSelector" in item) return toFunctionSelector(item.getSelector())
}

export const encode = (args: [types: string, values: string]) => {
	try {
		const [type, value] = args
		return encodeAbiParameters<any>(
			parseAbiParameters(type),
			value.split(",").map((x) => x.trim()),
		)
	} catch (e) {
		throw new Error(`encode fail: ${e.message}`)
	}
}

export const decode = (args: [types: string, value: Hex]) => {
	try {
		const [type, value] = args
		return decodeAbiParameters<any>(parseAbiParameters(type), value).join(", ")
	} catch (e) {
		throw new Error(`encode fail: ${e.message}`)
	}
}
