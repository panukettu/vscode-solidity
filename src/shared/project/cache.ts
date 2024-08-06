import { existsSync } from "node:fs"

type ImportPath = string
type Source = string

const cache = {
	all: new Set<Source>(),
	project: new Set<Source>(),
	libs: new Set<Source>(),
	resolved: new Map<ImportPath, Source>(),
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
	},
}

export type CacheKey = Exclude<keyof typeof cache, "resolved">
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
