import { keccak256, toBytes } from "viem";
import { ParsedExpressionIdentifier } from "../code/ParsedExpression";
import { CodeWalkerService } from "../code/walker/codeWalkerService";
import { Hover } from "vscode";
import * as vscode from "vscode-languageserver";
import { connection } from "../../server";
import { useProviderHelper } from "./utils/common";
import { isComment, keccak256Regexp } from "./utils/matchers";

export class SolidityHoverProvider {
  public static provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    walker: CodeWalkerService
  ): vscode.Hover | undefined {
    try {
      const { range, offset, documentContractSelected, reset } =
        useProviderHelper("hover", document, position, walker);

      const text = document.getText(range);
      if (keccak256Regexp().test(text)) {
        reset();
        return {
          contents: {
            kind: vscode.MarkupKind.Markdown,
            value: `### ${keccak256(toBytes(keccak256Regexp().exec(text)[0]))}`,
          },
        };
      } else if (isComment(text)) {
        reset();
        return null;
      } else if (documentContractSelected != null) {
        const selectedFunction =
          documentContractSelected.getSelectedFunction(offset);
        const item = documentContractSelected.getSelectedItem(
          offset
        ) as ParsedExpressionIdentifier;

        if (item.name === "length") {
          return {
            contents: {
              kind: vscode.MarkupKind.Markdown,
              value: [
                "```solidity",
                "(array property) " +
                  (item.parent?.name ? item.parent.name + "." : "") +
                  "length: uint256",
                "```",
              ].join("\n"),
            },
          };
        }
        if (!item) {
          reset();
          return null;
        }
        const res = item.getHover();
        // @ts-expect-error
        if (!!res.contents?.value) {
          reset();
          return res;
        } else if (item.parent) {
          const parentMapping =
            // @ts-expect-error
            item.parent?.reference?.element?.literal?.literal?.to?.literal;
          const allFound = documentContractSelected.brute(item.name, true);

          if (allFound.length === 0) {
            reset();
            return null;
          }

          for (const found of allFound) {
            // @ts-expect-error
            if (found.struct && found.struct?.name === parentMapping) {
              const res = found.getHover();
              // @ts-expect-error
              if (!!res.contents?.value) {
                reset();
                return res;
              }
            } else {
              const parentInScope = selectedFunction.findTypeInScope(
                // @ts-expect-error
                found.parent?.name
              );
              if (!!parentInScope) {
                reset();
                return found.getHover();
              }
            }
          }
        }
      }
      reset();
      return null;
    } catch (e) {
      // console.debug("hover", e);
    }
  }
}
