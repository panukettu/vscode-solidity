import { ParsedContract } from "./ParsedContract";
import { ParsedCode } from "./ParsedCode";
import { ParsedParameter } from "./ParsedParameter";
import { ParsedDocument } from "./ParsedDocument";
import { CompletionItem, CompletionItemKind } from "vscode-languageserver";
import { Element } from "./types";
import { TypeReference } from "../search/TypeReference";

export class ParsedEvent extends ParsedCode {
  public input: ParsedParameter[] = [];
  public contract: ParsedContract;
  public isGlobal: boolean;
  public id: any;
  private completionItem: CompletionItem = null;
  public element: Element;

  public override initialise(
    element: any,
    document: ParsedDocument,
    contract: ParsedContract,
    isGlobal = false
  ) {
    super.initialise(element, document, contract, isGlobal);
    this.name = element.name;
    this.id = element.id;
    this.initialiseParamters();
  }

  public initialiseParamters() {
    this.input = ParsedParameter.extractParameters(
      this.element.params,
      this.contract,
      this.document,
      this,
      true,
      false
    );
  }

  public override createCompletionItem(
    skipFirstParamSnipppet = false
  ): CompletionItem {
    if (this.completionItem === null) {
      const completionItem = CompletionItem.create(this.name);
      completionItem.kind = CompletionItemKind.Event;
      const paramsSnippet = ParsedParameter.createFunctionParamsSnippet(
        this.element.params,
        skipFirstParamSnipppet
      );
      completionItem.insertTextFormat = 2;
      completionItem.insertText = this.name + "(" + paramsSnippet + ");";
      completionItem.documentation = this.getMarkupInfo();
      this.completionItem = completionItem;
    }
    return this.completionItem;
  }

  public override getSelectedTypeReferenceLocation(
    offset: number
  ): TypeReference[] {
    if (this.isCurrentElementedSelected(offset)) {
      let results: TypeReference[] = [];
      this.input.forEach(
        (x) =>
          (results = this.mergeArrays(
            results,
            x.getSelectedTypeReferenceLocation(offset)
          ))
      );
      const foundResult = TypeReference.filterFoundResults(results);
      if (foundResult.length > 0) {
        return foundResult;
      } else {
        return [TypeReference.create(true)];
      }
    }
    return [TypeReference.create(false)];
  }

  public override getSelectedItem(offset: number): ParsedCode {
    let selectedItem: ParsedCode = null;
    if (this.isCurrentElementedSelected(offset)) {
      let allItems: ParsedCode[] = [];
      allItems = allItems.concat(this.input);
      selectedItem = allItems.find((x) => x.getSelectedItem(offset));
      if (selectedItem !== undefined && selectedItem !== null) {
        return selectedItem;
      }
      return this;
    }
    return selectedItem;
  }

  public override getParsedObjectType(): string {
    return "Event";
  }

  public getElementInfo(): string {
    const paramsInfo = ParsedParameter.createParamsInfo(this.element.params);
    return this.name + "(" + paramsInfo + ")";
  }
  public override getInfo(): string {
    return this.createInfo(
      this.getRootName(),
      "",
      `${this.getElementInfo()}`,
      undefined,
      true,
      false
    );
    // return (
    //   "### " +
    //   elementType +
    //   ": " +
    //   this.name +
    //   "\n" +
    //   "#### " +
    //   this.getContractNameOrGlobal() +
    //   "\n" +
    //   "\t" +
    //   this.getSignature() +
    //   " \n\n" +
    //   this.getComment()
    // );
  }

  public getDeclaration(): string {
    return "event";
  }
  public getSignature(): string {
    const paramsInfo = ParsedParameter.createParamsInfo(this.element.params);
    return (
      this.getDeclaration() + " " + this.name + "(" + paramsInfo + ") \n\t\t"
    );
  }
}
