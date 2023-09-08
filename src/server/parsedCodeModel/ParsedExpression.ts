import { registerClassTypes, setConfig } from "@enio.ai/data-ferret";
import { CompletionItem } from "vscode-languageserver";
import { SolidityDefinitionProvider } from "../definitionProvider";
import { IParsedExpressionContainer } from "./IParsedExpressionContainer";
import { ParsedDocument } from "./ParsedDocument";
import { ParsedEnum } from "./ParsedEnum";
import { ParsedFunction } from "./ParsedFunction";
import { ParsedStruct } from "./ParsedStruct";
import { ParsedVariable } from "./ParsedVariable";
import { FindTypeReferenceLocationResult, ParsedCode } from "./parsedCode";
import { ParsedContract } from "./parsedContract";
import { ParsedDeclarationType } from "./parsedDeclarationType";
export enum ExpressionType {
  Call,
  Identifier,
}

registerClassTypes(ParsedCode, ParsedFunction, ParsedStruct, ParsedContract);

export class ParsedExpression extends ParsedCode {
  public parent: ParsedExpression = null;
  public child: ParsedExpression = null;
  public expressionObjectType: ExpressionType;
  public reference: ParsedCode = null;
  public expressionType: ParsedDeclarationType = null;
  public expressionContainer: IParsedExpressionContainer = null;

  public static createFromMemberExpression(
    element: any,
    document: ParsedDocument,
    contract: ParsedContract,
    child: ParsedExpression,
    expressionContainer: IParsedExpressionContainer
  ): ParsedExpression {
    if (element.type === "MemberExpression") {
      if (element.isArray === false) {
        let memberChildObject: ParsedExpression = null;
        if (element.property !== undefined && element.property !== null) {
          memberChildObject = this.createFromElement(
            element.property,
            document,
            contract,
            child,
            expressionContainer
          );
          if (child !== null) {
            child.parent = memberChildObject;
          }
        }
        let memberParentProperty: ParsedExpression = null;
        if (element.object !== undefined && element.object !== null) {
          memberParentProperty = this.createFromElement(
            element.object,
            document,
            contract,
            memberChildObject,
            expressionContainer
          );
          if (memberChildObject !== null) {
            memberChildObject.parent = memberParentProperty;
          }
        }
        return memberChildObject;
      } else {
        let memberChildObject: ParsedExpression = null;
        if (element.object !== undefined && element.object !== null) {
          memberChildObject = this.createFromElement(
            element.object,
            document,
            contract,
            child,
            expressionContainer
          );
          if (child !== null) {
            child.parent = memberChildObject;
          }
        }

        if (element.property !== undefined && element.property !== null) {
          if (Array.isArray(element.property)) {
            element.array.forEach((item) => {
              expressionContainer.initialiseVariablesMembersEtc(
                item,
                element,
                null
              );
            });
          } else {
            expressionContainer.initialiseVariablesMembersEtc(
              element.property,
              element,
              null
            );
          }
        }
        return memberChildObject;
      }
    }
  }

  public static createFromElement(
    element: any,
    document: ParsedDocument,
    contract: ParsedContract,
    child: ParsedExpression,
    expressionContainer: IParsedExpressionContainer
  ): ParsedExpression {
    if (element.type !== undefined && element.type !== null) {
      switch (element.type) {
        case "CallExpression":
          const callExpression = new ParsedExpressionCall();
          callExpression.initialiseExpression(
            element,
            document,
            contract,
            child,
            expressionContainer
          );
          if (child !== null) {
            child.parent = callExpression;
          }
          return callExpression;
          break;
        case "MemberExpression": // e.g. x.y x.f(y) arr[1] map['1'] arr[i] map[k]
          return this.createFromMemberExpression(
            element,
            document,
            contract,
            child,
            expressionContainer
          );
          break;
        case "Identifier":
          const expressionIdentifier = new ParsedExpressionIdentifier();
          expressionIdentifier.initialiseExpression(
            element,
            document,
            contract,
            child,
            expressionContainer
          );
          if (child !== null) {
            child.parent = expressionIdentifier;
          }
          return expressionIdentifier;
          break;
      }
    }
    return null;
  }

  // tslint:disable-next-line:member-ordering
  public initialiseExpression(
    element: any,
    document: ParsedDocument,
    contract: ParsedContract,
    parent: ParsedExpression,
    expressionContainer: IParsedExpressionContainer
  ) {
    this.name = element.name;
    this.parent = parent;
    this.initialise(element, document, contract);
    this.expressionContainer = expressionContainer;
  }

  protected initialiseVariablesMembersEtc(
    statement: any,
    parentStatement: any
  ) {
    if (statement.type !== undefined && statement.type !== null) {
      switch (statement.type) {
        case "CallExpression": // e.g. Func(x, y)
          ParsedExpression.createFromElement(
            statement,
            this.document,
            this.contract,
            this,
            this.expressionContainer
          );
          break;
        case "MemberExpression": // e.g. x.y x.f(y) arr[1] map['1'] arr[i] map[k]
          ParsedExpression.createFromElement(
            statement,
            this.document,
            this.contract,
            this,
            this.expressionContainer
          );
          break;
        case "Identifier":
          ParsedExpression.createFromElement(
            statement,
            this.document,
            this.contract,
            this,
            this.expressionContainer
          );
          break;
        default:
          for (const key in statement) {
            if (statement.hasOwnProperty(key)) {
              const element = statement[key];
              if (element instanceof Array) {
                // recursively drill down to collections e.g. statements, params
                element.forEach((innerElement) => {
                  this.initialiseVariablesMembersEtc(innerElement, statement);
                });
              } else if (element instanceof Object) {
                // recursively drill down to elements with start/end e.g. literal type
                if (
                  element.hasOwnProperty("start") &&
                  element.hasOwnProperty("end")
                ) {
                  this.initialiseVariablesMembersEtc(element, statement);
                }
              }
            }
          }
      }
    }
  }
}

export class ParsedExpressionCall extends ParsedExpression {
  public arguments: ParsedExpression[];
  // tslint:disable-next-line:member-ordering
  public override initialiseExpression(
    element: any,
    document: ParsedDocument,
    contract: ParsedContract,
    child: ParsedExpression,
    expressionContainer: IParsedExpressionContainer
  ) {
    this.element = element;
    this.child = child;
    this.document = document;
    this.contract = contract;
    this.expressionObjectType = ExpressionType.Call;
    this.expressionContainer = expressionContainer;

    if (this.element.callee.type === "Identifier") {
      this.name = this.element.callee.name;
    }
    if (this.element.callee.type === "MemberExpression") {
      if (this.element.callee.property.type === "Identifier") {
        this.name = this.element.callee.property.name;
      }
      this.initialiseVariablesMembersEtc(
        this.element.callee.object,
        this.element
      );
    }

    if (
      this.element.arguments !== undefined &&
      this.element.arguments !== null
    ) {
      this.element.arguments.forEach((arg) => {
        this.expressionContainer.initialiseVariablesMembersEtc(
          arg,
          this.element,
          null
        );
      });
    }
  }

  public override getAllReferencesToSelected(
    offset: number,
    documents: ParsedDocument[]
  ): FindTypeReferenceLocationResult[] {
    this.initReference();
    this.initExpressionType();
    const results: FindTypeReferenceLocationResult[] = [];
    if (this.isCurrentElementedSelected(offset)) {
      if (this.isElementedSelected(this.element.callee, offset)) {
        if (this.parent !== null) {
          if (this.parent.isCurrentElementedSelected(offset)) {
            return results.concat(
              this.parent.getAllReferencesToSelected(offset, documents)
            );
          }
        }
        if (this.reference !== null) {
          return results.concat(
            this.reference.getAllReferencesToThis(documents)
          );
        }
        return results;
      }
    }
    return results;
  }

  public override getSelectedItem(offset: number): ParsedCode {
    if (this.isCurrentElementedSelected(offset)) {
      if (this.isElementedSelected(this.element.callee, offset)) {
        if (this.parent !== null) {
          if (this.parent.isCurrentElementedSelected(offset)) {
            return this.parent.getSelectedItem(offset);
          }
        }
        return this;
      }
    }
    return null;
  }

  public override getAllReferencesToObject(
    parsedCode: ParsedCode
  ): FindTypeReferenceLocationResult[] {
    this.initReference();
    this.initExpressionType();
    let results: FindTypeReferenceLocationResult[] = [];
    if (this.reference !== null && this.reference.isTheSame(parsedCode)) {
      results.push(this.createFoundReferenceLocationResult());
    }
    if (this.parent !== null) {
      results = results.concat(
        this.parent.getAllReferencesToObject(parsedCode)
      );
    }
    return results;
  }

  public override getInnerMembers(): ParsedCode[] {
    this.initReference();
    this.initExpressionType();
    if (this.expressionType !== null) {
      return this.expressionType.getInnerMembers();
    }
    return [];
  }

  public override getInnerCompletionItems(): CompletionItem[] {
    this.initReference();
    this.initExpressionType();
    if (this.expressionType !== null) {
      return this.expressionType.getInnerCompletionItems();
    }
    return [];
  }

  public override getInnerMethodCalls(): ParsedCode[] {
    this.initReference();
    this.initExpressionType();

    if (this.expressionType !== null) {
      return this.expressionType.getInnerMethodCalls();
    }
    return [];
  }

  public override getInfo(): string {
    this.initReference();
    this.initExpressionType();
    if (this.reference !== null) {
      return this.reference.getInfo();
    }
    return "";
  }

  public initReference() {
    if (this.reference == null) {
      if (this.parent === null) {
        const foundResults = this.findMethodsInScope(this.name);
        if (foundResults.length > 0) {
          this.reference = foundResults[0];
        }
      } else {
        const name =
          SolidityDefinitionProvider.currentOffset > 0
            ? SolidityDefinitionProvider.currentItem.name
            : this.name;

        try {
          this.reference = locate(
            this.parent.document,
            "getAllContracts",
            (item) => item.getInnerMethodCalls().find((c) => c.name === name),
            this.parent.document?.innerContracts
          );
        } catch (e) {
          console.debug(e.message);
          try {
            const found =
              // @ts-expect-error
              SolidityDefinitionProvider.currentItem.parent.findMethodsInScope(
                name
              );
            if (found.length > 0) {
              this.reference = found[0];
            } else {
              throw Error("Nope");
            }
          } catch (e) {
            const found = this.parent.findMethodsInScope(name);
            if (found.length > 0) {
              this.reference = found[0];
            }
          }
        }
      }
    }
  }

  public initExpressionType() {
    if (this.expressionType === null) {
      if (this.reference !== null) {
        if (this.reference instanceof ParsedFunction) {
          const functionReference: ParsedFunction = <ParsedFunction>(
            this.reference
          );
          if (
            functionReference.output !== undefined &&
            functionReference.output.length > 0
          ) {
            this.expressionType = functionReference.output[0].type;
          }
        }
        if (
          this.reference instanceof ParsedContract ||
          this.reference instanceof ParsedStruct
        ) {
          const contractExpressionType = new ParsedDeclarationType();
          contractExpressionType.contract = this.contract;
          contractExpressionType.document = this.document;
          contractExpressionType.type = this.reference;
          this.expressionType = contractExpressionType;
        }
      }
    }
  }

  public getSelectedTypeReferenceLocation(
    offset: number
  ): FindTypeReferenceLocationResult[] {
    this.initReference();
    this.initExpressionType();
    if (this.isCurrentElementedSelected(offset)) {
      if (this.isElementedSelected(this.element.callee, offset)) {
        if (this.parent !== null) {
          if (this.parent.isCurrentElementedSelected(offset)) {
            return this.parent.getSelectedTypeReferenceLocation(offset);
          }
        }
        if (this.reference !== null) {
          return [
            FindTypeReferenceLocationResult.create(
              true,
              this.reference.getLocation()
            ),
          ];
        }
        return [FindTypeReferenceLocationResult.create(true)];
      }
    }
    return [FindTypeReferenceLocationResult.create(false)];
  }
}

export class ParsedExpressionIdentifier extends ParsedExpression {
  // tslint:disable-next-line:member-ordering
  public override initialiseExpression(
    element: any,
    document: ParsedDocument,
    contract: ParsedContract,
    child: ParsedExpression,
    expressionContainer: IParsedExpressionContainer
  ) {
    this.element = element;
    this.child = child;
    this.document = document;
    this.contract = contract;
    this.expressionObjectType = ExpressionType.Identifier;
    this.expressionContainer = expressionContainer;
    this.name = this.element.name;
  }

  public override getAllReferencesToSelected(
    offset: number,
    documents: ParsedDocument[]
  ): FindTypeReferenceLocationResult[] {
    this.initReference();
    this.initExpressionType();
    const results: FindTypeReferenceLocationResult[] = [];
    if (this.isCurrentElementedSelected(offset)) {
      if (this.parent !== null) {
        if (this.parent.isCurrentElementedSelected(offset)) {
          return results.concat(
            this.parent.getAllReferencesToSelected(offset, documents)
          );
        }
      }
      if (this.reference !== null) {
        return results.concat(this.reference.getAllReferencesToThis(documents));
      }
      return [this.createFoundReferenceLocationResult()];
    } else {
      // in case the parent is a member and not part of the element
      if (this.parent !== null) {
        if (this.parent.isCurrentElementedSelected(offset)) {
          return results.concat(
            this.parent.getAllReferencesToSelected(offset, documents)
          );
        }
      }
    }
    return results;
  }

  public override getSelectedItem(offset: number): ParsedCode {
    if (this.isCurrentElementedSelected(offset)) {
      if (this.parent !== null) {
        if (this.parent.isCurrentElementedSelected(offset)) {
          return this.parent.getSelectedItem(offset);
        }
      }
      return this;
    } else {
      // in case the parent is a member and not part of the element
      if (this.parent !== null) {
        if (this.parent.isCurrentElementedSelected(offset)) {
          return this.parent.getSelectedItem(offset);
        }
      }
    }
    return null;
  }

  public override getAllReferencesToObject(
    parsedCode: ParsedCode
  ): FindTypeReferenceLocationResult[] {
    this.initReference();
    this.initExpressionType();
    let results: FindTypeReferenceLocationResult[] = [];

    if (this.reference !== null && this.reference.isTheSame(parsedCode)) {
      results.push(this.createFoundReferenceLocationResult());
    }
    if (this.parent !== null) {
      results = results.concat(
        this.parent.getAllReferencesToObject(parsedCode)
      );
    }
    return results;
  }

  public override getInnerCompletionItems(): CompletionItem[] {
    this.initReference();
    this.initExpressionType();
    if (this.expressionType !== null) {
      return this.expressionType.getInnerCompletionItems();
    }
    return [];
  }

  public override getInnerMembers(): ParsedCode[] {
    this.initReference();
    this.initExpressionType();
    if (this.expressionType !== null) {
      return this.expressionType.getInnerMembers();
    }
    return [];
  }

  public override getInnerMethodCalls(): ParsedCode[] {
    this.initReference();
    this.initExpressionType();
    if (this.expressionType !== null) {
      return this.expressionType.getInnerMethodCalls();
    }
    return [];
  }

  public initReference() {
    if (this.reference == null) {
      if (this.parent === null) {
        let foundResults = this.expressionContainer.findMembersInScope(
          this.name
        );
        foundResults = foundResults.concat(
          this.document.getAllContracts().filter((x) => x.name === this.name)
        );
        if (foundResults.length > 0) {
          this.reference = foundResults[0];
        }
      } else {
        const foundResults = this.parent
          .getInnerMembers()
          .filter((x) => x.name === this.name);
        if (foundResults.length > 0) {
          this.reference = foundResults[0];
        }
      }
    }
  }

  public override isCurrentElementedSelected(offset: number): boolean {
    return (
      super.isCurrentElementedSelected(offset) ||
      this.parent?.isCurrentElementedSelected(offset)
    );
  }

  public initExpressionType() {
    if (this.expressionType === null) {
      if (this.reference !== null) {
        const variable: ParsedVariable = <ParsedVariable>this.reference;
        if (variable.type !== undefined) {
          this.expressionType = variable.type;
        } else {
          if (
            this.reference instanceof ParsedContract ||
            this.reference instanceof ParsedEnum
          ) {
            const contractExpressionType = new ParsedDeclarationType();
            contractExpressionType.contract = this.contract;
            contractExpressionType.document = this.document;
            contractExpressionType.type = this.reference;
            this.expressionType = contractExpressionType;
          }
        }
      }
    }
  }

  public override getInfo(): string {
    this.initReference();
    this.initExpressionType();
    if (this.reference !== null) {
      return this.reference.getInfo();
    }
    return "";
  }

  public getSelectedTypeReferenceLocation(
    offset: number
  ): FindTypeReferenceLocationResult[] {
    try {
      this.initReference();
      this.initExpressionType();
      if (this.isCurrentElementedSelected(offset)) {
        if (this.parent !== null) {
          if (this.parent.isCurrentElementedSelected(offset)) {
            return this.parent.getSelectedTypeReferenceLocation(offset);
          }
        }
        if (this.reference !== null) {
          return [
            FindTypeReferenceLocationResult.create(
              true,
              this.reference.getLocation()
            ),
          ];
        }
        return [FindTypeReferenceLocationResult.create(true)];
      } else {
        // in case the parent is a member and not part of the element
        if (this.parent !== null) {
          if (this.parent.isCurrentElementedSelected(offset)) {
            return this.parent.getSelectedTypeReferenceLocation(offset);
          }
        }
      }
      return [FindTypeReferenceLocationResult.create(false)];
    } catch (error) {
      return [FindTypeReferenceLocationResult.create(false)];
    }
  }
}

type Keys = keyof ParsedDocument;
export function locate<Item, Result>(
  document: ParsedDocument,
  importDataSelector: Keys,
  check: (item: Item) => Result,
  quickList?: Item[]
): Result {
  if (quickList?.length > 0) {
    for (const item of quickList) {
      const result = check(item);
      if (result) {
        return result;
      }
    }
  }
  for (const item of document.getAllContracts()) {
    const result = check(item as Item);
    if (result) {
      return result;
    }
  }

  // fallback
  for (const imported of document.importedDocuments) {
    const data = imported[importDataSelector];
    for (const item of typeof data === "function" ? data() : data) {
      const result = check(item);
      if (result) {
        return result;
      }
    }
  }

  return undefined;
}
