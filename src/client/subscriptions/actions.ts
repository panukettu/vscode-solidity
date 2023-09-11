import * as vscode from "vscode";
import { EtherscanContractDownloader } from "../../common/sourceCodeDownloader/etherscanSourceCodeDownloader";
import {
  AddressChecksumCodeActionProvider,
  ChangeCompilerVersionActionProvider,
  SPDXCodeActionProvider,
} from "../codeActionProviders/addressChecksumActionProvider";

export function actionSubscriptions(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "solidity.downloadVerifiedSmartContractEtherscan",
      async () => {
        await EtherscanContractDownloader.downloadContractWithPrompts();
      }
    )
  );

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      "solidity",
      new AddressChecksumCodeActionProvider(),
      {
        providedCodeActionKinds:
          AddressChecksumCodeActionProvider.providedCodeActionKinds,
      }
    )
  );

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      "solidity",
      new SPDXCodeActionProvider(),
      {
        providedCodeActionKinds: SPDXCodeActionProvider.providedCodeActionKinds,
      }
    )
  );

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      "solidity",
      new ChangeCompilerVersionActionProvider(),
      {
        providedCodeActionKinds:
          ChangeCompilerVersionActionProvider.providedCodeActionKinds,
      }
    )
  );
}
