import { existsSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { Package, createDefaultPackage } from "./package"
import type { Remapping } from "./remapping"

export function createLibPackages(
	remappings: Remapping[],
	parentRoot: string,
	libs: string[],
	parent: Package,
	sources: string[],
) {
	return libs.flatMap((libDir) => createDependencies(remappings, parentRoot, parent, libDir, sources))
}
export function createDependencies(
	remappings: Remapping[],
	parentRoot: string,
	parent: Package,
	libDir: string,
	solSources: string[],
	pkgs: Array<Package> = new Array<Package>(),
) {
	const libPath = path.join(parentRoot, libDir)
	if (!existsSync(libPath)) return pkgs

	for (const lib of getDirectories(libPath)) {
		const libRoot = path.join(libPath, lib)
		const sources = solSources.filter((source) => existsSync(path.join(libRoot, source)))
		const pkg = new Package(
			remappings,
			lib,
			libRoot,
			sources.length ? sources[0] : undefined,
			parent.libs,
			parent.outDir,
			parent,
		)

		if (!pkgs.some((existing) => existing.name === pkg.name)) {
			pkgs.push(pkg)
			parent.libs.flatMap((nestedDir) => createDependencies(remappings, libRoot, pkg, nestedDir, solSources, pkgs))
		}
	}

	return pkgs
}

export function getDirectories(dirPath: string): string[] {
	return readdirSync(dirPath).filter((file) => {
		const subdirPath = path.join(dirPath, file)
		return statSync(subdirPath).isDirectory()
	})
}
