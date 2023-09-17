"use strict";
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { Compiler } from "./compiler";
import { SourceDocumentCollection } from "../common/model/sourceDocumentCollection";
import { initialiseProject } from "../common/projectService";
import { formatPath, isPathSubdirectory } from "../common/util";
import * as workspaceUtil from "./workspaceUtil";
import { SettingsService } from "./settingsService";
import { SolidityConfig } from "../server/types";

export function compileAllContracts(
  compiler: Compiler,
  diagnosticCollection: vscode.DiagnosticCollection
) {
  // Check if is folder, if not stop we need to output to a bin folder on rootPath
  if (workspaceUtil.getCurrentWorkspaceRootFolder() === undefined) {
    vscode.window.showWarningMessage(
      "Please open a folder in Visual Studio Code as a workspace"
    );
    return;
  }
  const rootPath = workspaceUtil.getCurrentProjectInWorkspaceRootFsPath();
  const compilationOptimisation = SettingsService.getCompilerOptimisation();
  const remappings = workspaceUtil.getSolidityRemappings();

  const sources = SettingsService.getSources();
  const { libs, libSources } = SettingsService.getLibs();
  const contractsCollection = new SourceDocumentCollection();
  const project = initialiseProject(rootPath, {
    libs,
    libSources,
    sources,
    remappings,
  } as SolidityConfig).project;

  // Process open Text Documents first as it is faster (We might need to save them all first? Is this assumed?)
  vscode.workspace.textDocuments.forEach((document) => {
    if (isPathSubdirectory(rootPath, document.fileName)) {
      if (path.extname(document.fileName) === ".sol") {
        const contractPath = document.fileName;
        const contractCode = document.getText();
        contractsCollection.addSourceDocumentAndResolveImports(
          contractPath,
          contractCode,
          project
        );
      }
    }
  });

  const documents = project.getProjectSolFiles();

  documents.forEach((document) => {
    const contractPath = document;
    if (!contractsCollection.containsSourceDocument(contractPath)) {
      const contractCode = fs.readFileSync(contractPath, "utf8");
      contractsCollection.addSourceDocumentAndResolveImports(
        contractPath,
        contractCode,
        project
      );
    }
  });
  const sourceDirPath = formatPath(
    project.projectPackage.getSolSourcesAbsolutePath()
  );
  const packagesPath: string[] = [];
  if (project.libs.length > 0) {
    project.libs.forEach((x) => packagesPath.push(formatPath(x)));
  }

  compiler.compile(
    contractsCollection.getDefaultSourceDocumentsForCompilation(
      compilationOptimisation
    ),
    diagnosticCollection,
    project.projectPackage.build_dir,
    project.projectPackage.absoluletPath,
    sourceDirPath,
    packagesPath
  );
}
