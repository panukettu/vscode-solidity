import { existsSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { Package } from "./package"
import type { Project } from "./project"

export function createLibPackages(project: Project) {
	return project.libs.flatMap((libDir) => createDependencies(project, project.rootPath, libDir, project.projectPackage))
}
export function createDependencies(
	project: Project,
	prevRoot: string,
	dir: string,
	parent: Package,
	pkgs: Package[] = [],
) {
	const fullPath = path.join(prevRoot, dir)
	if (!existsSync(fullPath)) return pkgs

	for (const installedLib of getDirectories(fullPath)) {
		const packagePath = path.join(fullPath, installedLib)
		const pkg = new Package(project, packagePath, parent)

		if (!pkgs.some((existing) => existing.name === pkg.name)) {
			pkgs.push(pkg)
			project.libs.flatMap((nestedDir) => createDependencies(project, packagePath, dir, pkg, pkgs))
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
