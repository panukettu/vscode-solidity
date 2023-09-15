"use strict";
import * as vscode from "vscode";
import * as path from "path";
import { Compiler } from "./compiler";
import { SourceDocumentCollection } from "../common/model/sourceDocumentCollection";
import { initialiseProject } from "../common/projectService";
import { formatPath } from "../common/util";
import { compilerType } from "../common/solcCompiler";
import * as workspaceUtil from "./workspaceUtil";
import { SettingsService } from "./settingsService";
import { SoliditySettings } from "../server";

let diagnosticCollection: vscode.DiagnosticCollection;

export function initDiagnosticCollection(
  diagnostics: vscode.DiagnosticCollection
) {
  diagnosticCollection = diagnostics;
}

export function compileActiveContract(
  compiler: Compiler,
  overrideDefaultCompiler: compilerType = null
): Promise<Array<string>> {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    return; // We need something open
  }

  if (path.extname(editor.document.fileName) !== ".sol") {
    vscode.window.showWarningMessage("This not a solidity file (*.sol)");
    return;
  }

  // Check if is folder, if not stop we need to output to a bin folder on rootPath
  if (workspaceUtil.getCurrentWorkspaceRootFolder() === undefined) {
    vscode.window.showWarningMessage(
      "Please open a folder in Visual Studio Code as a workspace"
    );
    return;
  }

  try {
    const contractsCollection = new SourceDocumentCollection();
    const contractCode = editor.document.getText();
    const contractPath = editor.document.fileName;

    const sources = SettingsService.getSources();
    const { libs, libSources } = SettingsService.getLibs();
    const compilationOptimisation = SettingsService.getCompilerOptimisation();
    const remappings = workspaceUtil.getSolidityRemappings();
    const project = initialiseProject(
      workspaceUtil.getCurrentProjectInWorkspaceRootFsPath(),
      { sources, libs, libSources, remappings } as SoliditySettings
    ).project;

    const contract = contractsCollection.addSourceDocumentAndResolveImports(
      contractPath,
      contractCode,
      project
    );
    const packagesPath: string[] = [];
    if (project.libs.length > 0) {
      project.libs.forEach((x) => packagesPath.push(formatPath(x)));
    }
    return compiler.compile(
      contractsCollection.getDefaultSourceDocumentsForCompilation(
        compilationOptimisation
      ),
      diagnosticCollection,
      project.projectPackage.build_dir,
      project.projectPackage.absoluletPath,
      null,
      packagesPath,
      contract.absolutePath,
      overrideDefaultCompiler
    );
  } catch (e) {
    console.debug(e.message);
  }
}
