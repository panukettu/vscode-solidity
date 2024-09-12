import { existsSync } from "node:fs"
import type { ParsedCode } from "@server/code/ParsedCode"
import type { ParsedImport } from "@server/code/ParsedImport"

type ImportPath = string

type Source = string

const cache = {
	all: new Set<Source>(),
	project: new Set<Source>(),
	libs: new Set<Source>(),
	resolved: new Map<ImportPath, Source>(),
	imports: new WeakMap<ParsedImport, ParsedCode[]>(),
}

export const filesCache = {
	...cache,
	lastSize: 0,
	resolver:
		(importPath: ImportPath) =>
		(...resolved: Source[]) => {
			const result = resolved.find((res) => res?.length && existsSync(res))
			if (!result) return null

			cache.resolved.set(importPath, result)
			return result
		},
	tryResolve: (importPath: ImportPath) => {
		const source = cache.resolved.get(importPath)
		if (source) return source

		return filesCache.resolver(importPath)
	},
	find: (str: Source, partial = false) => {
		for (const item of cache.all) if (item === str || (partial && item.includes(str))) return item
	},
	clearAll: () => {
		cache.all.clear()
		cache.project.clear()
		cache.libs.clear()
		cache.resolved.clear()
		cache.imports = new WeakMap<ParsedImport, ParsedCode[]>()
	},
}

export type CacheKey = Exclude<keyof typeof cache, "resolved" | "imports">
export function found(res: ReturnType<typeof filesCache.tryResolve>) {
	return typeof res === "string"
}

export function toCache(files: Source[], scope?: CacheKey) {
	files.forEach((file) => {
		filesCache.all.add(file)
		if (scope) filesCache[scope].add(file)
	})
	filesCache.lastSize = filesCache.all.size
	return files
}

export const importCache = {
	get: (id: ParsedImport) => {
		return cache.imports.get(id)
	},
	visit: (item: ParsedImport) => {
		if (cache.imports.has(item)) return cache.imports.get(item)

		if (!item.documentReference) {
			cache.imports.set(item, [])
			return []
		}
		const items = item.documentReference
			.getAllImportables((i) => !cache.imports.has(i) && !!item.symbols?.find((s) => s.name === i.name))
			.filter((s, i, v) => !!s && v.indexOf(s) === i)
		cache.imports.set(item, items)
		return items
	},
}
