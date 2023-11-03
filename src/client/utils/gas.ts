type GasCache = {
	first: number
	previous: number
	current: number
}
type Gas = {
	id: string
	value: number
	difference: number
	summary: string
}
const cache = new Map<string, GasCache>()

const clear = () => cache.clear()

const save = (id: string, value: number): Gas => {
	const prev = cache.get(id)
	let difference = 0
	if (!prev) {
		cache.set(id, { first: value, previous: value, current: value })
	} else {
		difference = value - prev.current
		cache.set(id, { ...prev, previous: prev.current, current: value })
	}
	const diffText = difference > 0 ? `+${difference}` : `${difference}`
	return {
		id,
		value,
		difference,
		summary: `Gas: ${value}` + (difference !== 0 ? ` (${diffText})` : ""),
	}
}

export const gasCache = {
	save,
	clear,
}
