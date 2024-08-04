import { existsSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { type Package, createDefaultPackage } from "./package"

export function createLibPackages(libs: string[], rootPath: string, projectPackage: Package, sources: string[]) {
	return libs.flatMap((libDir) => createDependencies(rootPath, projectPackage, libDir, sources))
}
export function createDependencies(
	rootPath: string,
	projectPackage: Package,
	libLocation: string,
	libSourcesLocations: string[],
	libPackages: Array<Package> = new Array<Package>(),
) {
	const libPath = path.join(projectPackage.absolutePath, libLocation)

	if (!existsSync(libPath)) return libPackages

	for (const directory of getDirectories(libPath)) {
		const sources = libSourcesLocations.filter((source) => existsSync(path.join(libPath, directory, source)))
		const depPackage = createDefaultPackage(
			path.join(libPath, directory),
			sources.length ? sources[0] : undefined,
			projectPackage.build_dir,
			libSourcesLocations,
		)

		if (!libPackages.some((existingDepPack: Package) => existingDepPack.name === depPackage.name)) {
			libPackages.push(depPackage)

			createDependencies(rootPath, depPackage, libLocation, libSourcesLocations, libPackages)
		}
	}

	return libPackages
}

export function getDirectories(dirPath: string): string[] {
	return readdirSync(dirPath).filter((file) => {
		const subdirPath = path.join(dirPath, file)
		return statSync(subdirPath).isDirectory()
	})
}
