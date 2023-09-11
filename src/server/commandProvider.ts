import { getFunctionSelector, keccak256, toBytes, toHex } from "viem";
import { ExecuteCommandParams, Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { CodeWalkerService } from "./parsedCodeModel/codeWalkerService";
export const SERVER_COMMANDS_LIST = {
  funcSig: "solidity.server.lens.funcSig",
  keccak256: "solidity.server.lens.keccak256",
};

export class ExecuteCommandProvider {
  public static executeCommand(
    params: ExecuteCommandParams,
    document: TextDocument,
    range: Range,
    walker: CodeWalkerService
  ) {
    return commandMap[params.command](params, document, range, walker);
  }
}

const funcSig = (
  params: ExecuteCommandParams,
  document: TextDocument,
  range: Range,
  walker: CodeWalkerService
) => {
  try {
    const selected = walker.getSelectedDocument(document, range.start);
    const item = selected.getSelectedItem(document.offsetAt(range.start));

    // @ts-expect-error
    return getFunctionSelector(item.getSelector());
  } catch (e) {
    throw new Error("funcSig failed");
  }
};
export const hash = (
  params: ExecuteCommandParams,
  document: TextDocument,
  range: Range,
  walker: CodeWalkerService
) => {
  try {
    const text = document.getText(range);
    return keccak256(toBytes(text));
  } catch (e) {
    throw new Error("hash failed");
  }
};

const commandMap = {
  [SERVER_COMMANDS_LIST.funcSig]: funcSig,
  [SERVER_COMMANDS_LIST.keccak256]: hash,
};

type ExecutionArgs = {
  params: ExecuteCommandParams;
  document: TextDocument;
  position: Range;
  walker: CodeWalkerService;
};
