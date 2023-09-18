import { compilerType } from "../common/solcCompiler";

import * as vscode from "vscode-languageserver";
import { replaceRemappings } from "../common/util";
import { connection } from "../server";
import { startValidation } from "./compiler";
import SolhintService from "./linter/solhint";
import { ExtendedSettings, SolidityConfig } from "./types";
import { SERVER_COMMANDS_LIST } from "./providers/command";
import packageJson from "../../package.json";
function defaultConfig(): SolidityConfig<any> {
  let result = {} as SolidityConfig<any>;
  Object.entries(packageJson.contributes.configuration.properties).forEach(
    ([key, value]) => {
      const keys = key.split(".");
      if (keys.length === 2 && keys[0] === "solidity") {
        result[keys[1]] = value.default;
      }
    }
  );

  return {
    ...result,
    defaultCompiler: compilerType[result.defaultCompiler],
  };
}
export const settings: ExtendedSettings = {
  hasWorkspaceFolderCapability: false,
  workspaceFolders: [],
  linter: null,
  rootPath: "",
};

export let config = defaultConfig();

export const handleConfigChange = async (
  change: vscode.DidChangeConfigurationParams
) => {
  updateConfig({
    ...config,
    ...(await requestConfig()),
  });
};
export function handleInitialize(
  params: vscode.InitializeParams
): vscode.InitializeResult {
  settings.rootPath = params.rootPath;
  const capabilities = params.capabilities;

  settings.hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );

  if (params.workspaceFolders) {
    settings.workspaceFolders = params.workspaceFolders;
  }

  const result: vscode.InitializeResult = {
    capabilities: {
      completionProvider: {
        resolveProvider: false,
        triggerCharacters: [".", "/", '"', "'"],
      },
      definitionProvider: true,
      referencesProvider: true,
      hoverProvider: true,
      signatureHelpProvider: {
        workDoneProgress: false,
        triggerCharacters: ["(", ","],
      },
      textDocumentSync: vscode.TextDocumentSyncKind.Full,
      executeCommandProvider: {
        commands: Object.values(SERVER_COMMANDS_LIST),
      },
    },
  };

  if (settings.hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true,
      },
    };
  }

  return result;
}
export async function handleInitialized() {
  updateConfig(await requestConfig());

  if (!settings.hasWorkspaceFolderCapability) return;

  connection.workspace.onDidChangeWorkspaceFolders((_event) => {
    if (!connection.workspace) return;
    connection.workspace.onDidChangeWorkspaceFolders((event) => {
      event.removed.forEach((workspaceFolder) => {
        const index = settings.workspaceFolders.findIndex(
          (folder) => folder.uri === workspaceFolder.uri
        );
        if (index !== -1) {
          settings.workspaceFolders.splice(index, 1);
        }
      });

      settings.workspaceFolders.push(...event.added);
    });
  });
}

export function updateConfig(
  soliditySettings: SolidityConfig<keyof compilerType>
) {
  config = {
    ...soliditySettings,
    defaultCompiler: compilerType[soliditySettings.defaultCompiler],
    remappings: replaceRemappings(
      soliditySettings.remappings,
      process.platform === "win32"
        ? soliditySettings.remappingsWindows
        : soliditySettings.remappingsUnix
    ),
  };
  if (config.linter === "solhint") {
    settings.linter = new SolhintService(
      settings.rootPath,
      config.solhintRules
    );
    settings.linter.setIdeRules(config.solhintRules);
  }

  startValidation();
}
async function requestConfig() {
  try {
    const params: vscode.ConfigurationParams = {
      items: [{ section: "solidity" }],
    };
    const [solidityConfig] = (await connection.sendRequest(
      "workspace/configuration",
      params
    )) as [SolidityConfig<keyof compilerType>];
    return solidityConfig;
  } catch (e) {
    console.log("Error getting config, using defaults..", e.message);
    return defaultConfig();
  }
}