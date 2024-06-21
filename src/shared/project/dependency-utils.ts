import { existsSync, readdirSync, statSync } from "node:fs"
import path from "path"
import { Package, createDefaultPackage } from "./package"

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
		const depPackage = createDefaultPackage(path.join(libPath, directory), undefined, projectPackage.build_dir)
		depPackage.sol_sources_alternative_directories = libSourcesLocations
		if (!libPackages.some((existingDepPack: Package) => existingDepPack.name === depPackage.name)) {
			libPackages.push(depPackage)

			createDependencies(rootPath, depPackage, libLocation, libSourcesLocations, libPackages)
		}
	}

	return libPackages
}

export function getDirectories(dirPath: string): string[] {
	return readdirSync(dirPath).filter(function (file) {
		const subdirPath = path.join(dirPath, file)
		return statSync(subdirPath).isDirectory()
	})
}
