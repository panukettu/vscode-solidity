import { CompletionItem, CompletionItemKind } from "vscode-languageserver";
import { IParsedExpressionContainer } from "./IParsedExpressionContainer";
import { ParsedConstant } from "./ParsedConstant";
import { ParsedContractIs } from "./ParsedContractIs";
import { ParsedCustomType } from "./ParsedCustomType";
import { ParsedDocument } from "./ParsedDocument";
import { ParsedEnum } from "./ParsedEnum";
import { ParsedError } from "./ParsedError";
import { ParsedEvent } from "./ParsedEvent";
import { ParsedExpression } from "./ParsedExpression";
import { ParsedFunction } from "./ParsedFunction";
import { ParsedStateVariable } from "./ParsedStateVariable";
import { ParsedStruct } from "./ParsedStruct";
import { Element } from "./types";
import { ParsedCode } from "./ParsedCode";
import { ParsedDeclarationType } from "./ParsedDeclarationType";
import { ParsedUsing } from "./ParsedUsing";
import { TypeReference } from "../search/TypeReference";

export enum ContractType {
  contract,
  interface,
  library,
}

export class ParsedContract
  extends ParsedCode
  implements IParsedExpressionContainer
{
  public functions: ParsedFunction[] = [];
  public enums: ParsedEnum[] = [];
  public events: ParsedEvent[] = [];
  public stateVariables: ParsedStateVariable[] = [];
  public contractIsStatements: ParsedContractIs[] = [];
  public errors: ParsedError[] = [];
  public structs: ParsedStruct[] = [];
  public using: ParsedUsing[] = [];
  public customTypes: ParsedCustomType[] = [];
  public expressions: ParsedExpression[] = [];
  public contractElementType: string;
  public constructorFunction: ParsedFunction = null;
  public fallbackFunction: ParsedFunction = null;
  public receiveFunction: ParsedFunction = null;
  public id: any;

  public contractType: ContractType = ContractType.contract;
  public isAbstract: boolean;
  private completionItem: CompletionItem = null;
  public element: Element;

  public override getAllReferencesToSelected(
    offset: number,
    documents: ParsedDocument[]
  ): TypeReference[] {
    let results: TypeReference[] = [];
    if (this.isCurrentElementedSelected(offset)) {
      if (this.isElementedSelected(this.id, offset)) {
        return this.getAllReferencesToThis(documents);
      }

      this.functions.forEach(
        (x) =>
          (results = results.concat(
            x.getAllReferencesToSelected(offset, documents)
          ))
      );
      this.expressions.forEach(
        (x) =>
          (results = results.concat(
            x.getAllReferencesToSelected(offset, documents)
          ))
      );

      if (this.constructorFunction !== null) {
        results = this.mergeArrays(
          results,
          this.constructorFunction.getAllReferencesToSelected(offset, documents)
        );
      }
      if (this.fallbackFunction !== null) {
        results = this.mergeArrays(
          results,
          this.fallbackFunction.getAllReferencesToSelected(offset, documents)
        );
      }
      if (this.receiveFunction !== null) {
        results = this.mergeArrays(
          results,
          this.receiveFunction.getAllReferencesToSelected(offset, documents)
        );
      }

      this.stateVariables.forEach(
        (x) =>
          (results = results.concat(
            x.getAllReferencesToSelected(offset, documents)
          ))
      );
      this.enums.forEach(
        (x) =>
          (results = results.concat(
            x.getAllReferencesToSelected(offset, documents)
          ))
      );
      this.errors.forEach(
        (x) =>
          (results = results.concat(
            x.getAllReferencesToSelected(offset, documents)
          ))
      );
      this.structs.forEach(
        (x) =>
          (results = results.concat(
            x.getAllReferencesToSelected(offset, documents)
          ))
      );
      this.events.forEach(
        (x) =>
          (results = results.concat(
            x.getAllReferencesToSelected(offset, documents)
          ))
      );
      this.contractIsStatements.forEach(
        (x) =>
          (results = results.concat(
            x.getAllReferencesToSelected(offset, documents)
          ))
      );

      const structMembers = this.structs
        .map((s) => s.getInnerMembers())
        .flatMap((s) => s);

      const functionMembers = this.functions
        .map((f) => f.getAllItems())
        .flatMap((s) => s);

      structMembers.forEach(
        (x) =>
          (results = results.concat(
            x.getAllReferencesToSelected(offset, documents)
          ))
      );
      functionMembers.forEach(
        (x) =>
          (results = results.concat(
            x.getAllReferencesToSelected(offset, documents)
          ))
      );
    }
    return results;
  }

  public override getAllReferencesToObject(
    parsedCode: ParsedCode
  ): TypeReference[] {
    let results: TypeReference[] = [];
    if (this.isTheSame(parsedCode)) {
      results.push(this.createFoundReferenceLocationResult());
    }
    this.expressions.forEach(
      (x) => (results = results.concat(x.getAllReferencesToObject(parsedCode)))
    );
    this.functions.forEach(
      (x) => (results = results.concat(x.getAllReferencesToObject(parsedCode)))
    );

    if (this.constructorFunction !== null) {
      results = this.mergeArrays(
        results,
        this.constructorFunction.getAllReferencesToObject(parsedCode)
      );
    }
    if (this.fallbackFunction !== null) {
      results = this.mergeArrays(
        results,
        this.fallbackFunction.getAllReferencesToObject(parsedCode)
      );
    }
    if (this.receiveFunction !== null) {
      results = this.mergeArrays(
        results,
        this.receiveFunction.getAllReferencesToObject(parsedCode)
      );
    }

    this.stateVariables.forEach(
      (x) => (results = results.concat(x.getAllReferencesToObject(parsedCode)))
    );
    this.enums.forEach(
      (x) => (results = results.concat(x.getAllReferencesToObject(parsedCode)))
    );
    this.errors.forEach(
      (x) => (results = results.concat(x.getAllReferencesToObject(parsedCode)))
    );
    this.structs.forEach(
      (x) => (results = results.concat(x.getAllReferencesToObject(parsedCode)))
    );
    this.events.forEach(
      (x) => (results = results.concat(x.getAllReferencesToObject(parsedCode)))
    );
    this.contractIsStatements.forEach(
      (x) => (results = results.concat(x.getAllReferencesToObject(parsedCode)))
    );

    const structMembers = this.structs.map((s) => s.getInnerMembers()).flat();

    const functionMembers = this.functions.map((f) => f.getAllItems()).flat();

    structMembers.forEach(
      (x) => (results = results.concat(x.getAllReferencesToObject(parsedCode)))
    );
    functionMembers.forEach(
      (x) => (results = results.concat(x.getAllReferencesToObject(parsedCode)))
    );
    return results;
  }

  public override initialise(element: Element, document: ParsedDocument) {
    super.initialise(element, document, this);
    this.name = element.name;
    this.id = element.id;
    this.contractElementType = element.type;

    if (
      this.element.is_abstract !== undefined ||
      this.element.is_abstract !== null
    ) {
      this.isAbstract = this.element.is_abstract;
    } else {
      this.isAbstract = false;
    }

    if (element.type === "ContractStatement") {
      this.contractType = ContractType.contract;
    }

    if (element.type === "LibraryStatement") {
      this.contractType = ContractType.library;
    }

    if (element.type === "InterfaceStatement") {
      this.contractType = ContractType.interface;
    }
    this.contract = this;
    this.initialiseChildren();
    if (this.element !== undefined && this.element !== null) {
      this.initialiseVariablesMembersEtc(this.element, null, null);
    }
  }

  public getExtendContracts(): ParsedContract[] {
    const result: ParsedContract[] = [];
    if (this.contractIsStatements.length > 0) {
      this.contractIsStatements.forEach((isStatement) => {
        const contractReference = isStatement.getContractReference();
        if (contractReference !== undefined && contractReference !== null) {
          result.push(contractReference);
        }
      });
    }
    return result;
  }

  public initialiseExtendContracts() {
    if (this.contractIsStatements.length > 0) {
      this.contractIsStatements.forEach((isStatement) => {
        const contractReference = isStatement.initialiseContractReference();
      });
    }
  }

  public isConstructorSelected(offset: number) {
    if (this.constructorFunction === null) {
      return false;
    }
    const element = this.constructorFunction.element;
    return this.isElementedSelected(element, offset);
  }

  public isFallbackSelected(offset: number) {
    if (this.fallbackFunction === null) {
      return false;
    }
    const element = this.fallbackFunction.element;
    return this.isElementedSelected(element, offset);
  }

  public isReceivableSelected(offset: number) {
    if (this.receiveFunction === null) {
      return false;
    }
    const element = this.receiveFunction.element;
    return this.isElementedSelected(element, offset);
  }

  public getSelectedIsStatement(offset: number): ParsedContractIs {
    const foundContractIs = this.contractIsStatements.find((x) => {
      return x.isCurrentElementedSelected(offset);
    });
    return foundContractIs;
  }

  public getSelectedStructDeclaration(offset: number): ParsedStruct {
    const found = this.structs.find((x) => {
      return x.isCurrentElementedSelected(offset);
    });
    return found;
  }

  public override getSelectedTypeReferenceLocation(
    offset: number
  ): TypeReference[] {
    if (this.isCurrentElementedSelected(offset)) {
      let results: TypeReference[] = [];

      this.functions.forEach(
        (x) =>
          (results = this.mergeArrays(
            results,
            x.getSelectedTypeReferenceLocation(offset)
          ))
      );
      this.errors.forEach(
        (x) =>
          (results = this.mergeArrays(
            results,
            x.getSelectedTypeReferenceLocation(offset)
          ))
      );
      this.events.forEach(
        (x) =>
          (results = this.mergeArrays(
            results,
            x.getSelectedTypeReferenceLocation(offset)
          ))
      );
      this.stateVariables.forEach(
        (x) =>
          (results = this.mergeArrays(
            results,
            x.getSelectedTypeReferenceLocation(offset)
          ))
      );
      this.structs.forEach(
        (x) =>
          (results = this.mergeArrays(
            results,
            x.getSelectedTypeReferenceLocation(offset)
          ))
      );
      this.using.forEach(
        (x) =>
          (results = this.mergeArrays(
            results,
            x.getSelectedTypeReferenceLocation(offset)
          ))
      );
      this.customTypes.forEach(
        (x) =>
          (results = this.mergeArrays(
            results,
            x.getSelectedTypeReferenceLocation(offset)
          ))
      );
      this.contractIsStatements.forEach(
        (x) =>
          (results = this.mergeArrays(
            results,
            x.getSelectedTypeReferenceLocation(offset)
          ))
      );
      this.expressions.forEach(
        (x) =>
          (results = this.mergeArrays(
            results,
            x.getSelectedTypeReferenceLocation(offset)
          ))
      );
      const structMembers = this.structs
        .map((s) => s.getInnerMembers())
        .flatMap((s) => s);

      const functionMembers = this.functions
        .map((f) => f.getAllItems())
        .flatMap((s) => s);

      structMembers.forEach(
        (x) =>
          (results = this.mergeArrays(
            results,
            x.getSelectedTypeReferenceLocation(offset)
          ))
      );
      functionMembers.forEach(
        (x) =>
          (results = this.mergeArrays(
            results,
            x.getSelectedTypeReferenceLocation(offset)
          ))
      );
      if (this.constructorFunction !== null) {
        results = this.mergeArrays(
          results,
          this.constructorFunction.getSelectedTypeReferenceLocation(offset)
        );
      }
      if (this.fallbackFunction !== null) {
        results = this.mergeArrays(
          results,
          this.fallbackFunction.getSelectedTypeReferenceLocation(offset)
        );
      }
      if (this.receiveFunction !== null) {
        results = this.mergeArrays(
          results,
          this.receiveFunction.getSelectedTypeReferenceLocation(offset)
        );
      }

      const foundResult = TypeReference.filterFoundResults(results);
      if (foundResult.length > 0) {
        return foundResult;
      } else {
        return [this.createFoundReferenceLocationResultNoLocation()];
      }
    }
    return [this.createNotFoundReferenceLocationResult()];
  }
  public getAllItems(): ParsedCode[] {
    const structMembers = this.structs
      .map((s) => s.getInnerMembers())
      .flatMap((s) => s);
    const functionMembers = this.functions
      .map((f) => f.getAllItems())
      .flatMap((s) => s);
    return []
      .concat(this.functions)
      .concat(functionMembers)
      .concat(this.errors)
      .concat(this.events)
      .concat(this.structs)
      .concat(structMembers)
      .concat(this.stateVariables)
      .concat(this.customTypes)
      .concat(this.using)
      .concat(this.contractIsStatements)
      .concat(this.expressions)
      .concat(this.constructorFunction)
      .concat(this.fallbackFunction)
      .concat(this.receiveFunction);
  }
  public override getSelectedItem(offset: number): ParsedCode {
    let selectedItem: ParsedCode = null;
    if (this.isCurrentElementedSelected(offset)) {
      let allItems = this.getAllItems();

      for (const item of allItems) {
        if (item == null) continue;
        selectedItem = item.getSelectedItem(offset);
        if (selectedItem !== null) {
          return selectedItem;
        }
      }
      return this;
    }
    return selectedItem;
  }

  public findType(name: string): ParsedCode {
    let typesParsed: ParsedCode[] = [];
    typesParsed = typesParsed
      .concat(this.getAllConstants())
      .concat(this.getAllCustomTypes())
      .concat(this.getAllStructs())
      .concat(this.getAllEnums())
      .concat(this.document.getAllContracts());
    return (
      typesParsed.find((x) => x?.name === name) ||
      this.getAllItems().find((x) => x?.name === name)
    );
  }

  public override getInnerMembers(): ParsedCode[] {
    let typesParsed: ParsedCode[] = [];
    typesParsed = typesParsed
      .concat(this.getAllConstants())
      .concat(this.getAllStateVariables())
      .concat(this.getAllEnums())
      .concat(this.getAllCustomTypes());
    return typesParsed;
  }

  public findMembersInScope(name: string): ParsedCode[] {
    return this.getInnerMembers().filter((x) => x.name === name);
  }

  public override getInnerMethodCalls(
    includeExtendedMethods = false
  ): ParsedCode[] {
    let methodCalls: ParsedCode[] = [];
    methodCalls = methodCalls
      .concat(this.getAllFunctions(true, includeExtendedMethods))
      .concat(this.getAllEvents())
      .concat(this.getAllErrors())
      .concat(this.document.getAllContracts())
      .concat(this.getAllStructs());
    return methodCalls;
  }

  public findMethodCalls(
    name: string,
    includeExtendedMethods = false
  ): ParsedCode[] {
    return this.getInnerMethodCalls(includeExtendedMethods).filter(
      (x) => x.name === name
    );
  }

  public getSelectedFunction(
    offset: number,
    includeExtendedMethods = false
  ): ParsedFunction {
    let selectedFunction = this.functions.find((x) => {
      const element = x.element;
      if (element !== undefined || element !== null) {
        if (element.start <= offset && offset <= element.end) {
          return true;
        }
      }
      return false;
    });

    if (!selectedFunction) {
      selectedFunction = this.functions
        .filter((f) => f.output.length > 0)
        .flatMap(
          (f) =>
            f.output
              .filter((o) => !o.type.isValueType)
              .flatMap((o) =>
                o.type.getExtendedMethodCallsFromUsing()
              ) as ParsedFunction[]
        )
        .find((x) => {
          const element = x.element;
          6;
          if (element !== undefined || element !== null) {
            if (element.start <= offset && offset <= element.end) {
              return true;
            }
          }
        });
      if (!selectedFunction) {
        // nothing
        if (this.isConstructorSelected(offset)) {
          selectedFunction = this.constructorFunction;
        } else {
          if (this.isFallbackSelected(offset)) {
            selectedFunction = this.fallbackFunction;
          } else {
            if (this.isReceivableSelected(offset)) {
              selectedFunction = this.receiveFunction;
            }
          }
        }
      }
    }
    return selectedFunction;
  }

  public getAllFunctions(
    includeGlobal = true,
    includeExtendedMethods = false
  ): ParsedFunction[] {
    let returnItems: ParsedFunction[] = [];
    returnItems = returnItems.concat(this.functions);
    this.getExtendContracts().forEach((contract) => {
      returnItems = returnItems.concat(
        contract.getAllFunctions(true, includeExtendedMethods)
      );
    });
    if (includeGlobal) {
      returnItems = returnItems.concat(
        this.document.getAllGlobalFunctions(includeExtendedMethods)
      );
    }
    return returnItems;
  }

  public getAllStructs(includeGlobal = true): ParsedStruct[] {
    let returnItems: ParsedStruct[] = [];
    returnItems = returnItems.concat(this.structs);
    this.getExtendContracts().forEach((contract) => {
      returnItems = returnItems.concat(contract.getAllStructs());
    });
    if (includeGlobal) {
      returnItems = returnItems.concat(this.document.getAllGlobalStructs());
    }
    return returnItems;
  }

  public getAllErrors(includeGlobal = true): ParsedError[] {
    let returnItems: ParsedError[] = [];
    returnItems = returnItems.concat(this.errors);
    this.getExtendContracts().forEach((contract) => {
      returnItems = returnItems.concat(contract.getAllErrors());
    });
    if (includeGlobal) {
      returnItems = returnItems.concat(this.document.getAllGlobalErrors());
    }
    return returnItems;
  }

  public getAllEnums(includeGlobal = true): ParsedEnum[] {
    let returnItems: ParsedEnum[] = [];
    returnItems = returnItems.concat(this.enums);
    this.getExtendContracts().forEach((contract) => {
      returnItems = returnItems.concat(contract.getAllEnums());
    });
    if (includeGlobal) {
      returnItems = returnItems.concat(this.document.getAllGlobalEnums());
    }
    return returnItems;
  }

  public getAllCustomTypes(includeGlobal = true): ParsedCustomType[] {
    let returnItems: ParsedCustomType[] = [];
    returnItems = returnItems.concat(this.customTypes);
    this.getExtendContracts().forEach((contract) => {
      returnItems = returnItems.concat(contract.getAllCustomTypes());
    });
    if (includeGlobal) {
      returnItems = returnItems.concat(this.document.getAllGlobalCustomTypes());
    }
    return returnItems;
  }

  public getAllStateVariables(): ParsedStateVariable[] {
    let returnItems: ParsedStateVariable[] = [];
    returnItems = returnItems.concat(this.stateVariables);
    this.getExtendContracts().forEach((contract) => {
      returnItems = returnItems.concat(contract.getAllStateVariables());
    });
    return returnItems;
  }

  public getAllConstants(): ParsedConstant[] {
    return this.document.getAllGlobalConstants();
  }

  public getAllEvents(includeGlobal = true): ParsedEvent[] {
    let returnItems: ParsedEvent[] = [];
    returnItems = returnItems.concat(this.events);
    this.getExtendContracts().forEach((contract) => {
      returnItems = returnItems.concat(contract.getAllEvents());
    });
    if (includeGlobal) {
      returnItems = returnItems.concat(this.document.getAllGlobalEvents());
    }
    return returnItems;
  }

  public getAllUsing(type: ParsedDeclarationType): ParsedUsing[] {
    let returnItems: ParsedUsing[] = [];
    returnItems = returnItems.concat(
      this.using.filter((x) => {
        if (x.forStar === true) {
          return true;
        }
        if (x.for !== null) {
          let validTypeName = false;
          if (
            x.for.name === type.name ||
            (type.name === "address_payable" && x.for.name === "address")
          ) {
            validTypeName = true;
          }
          return (
            x.for.isArray === type.isArray &&
            validTypeName &&
            x.for.isMapping === type.isMapping
          );
        }
        return false;
      })
    );

    this.getExtendContracts().forEach((contract) => {
      returnItems = returnItems.concat(contract.getAllUsing(type));
    });

    returnItems = returnItems.concat(
      ParsedDocument.getAllGlobalUsing(this.document, type)
    );
    return returnItems.filter((v, i) => {
      return (
        returnItems.map((mapObj) => mapObj["name"]).indexOf(v["name"]) === i
      );
    });
  }

  public initialiseChildren() {
    if (typeof this.element.is !== "undefined" && this.element.is !== null) {
      this.element.is.forEach((isElement) => {
        const isStatement = new ParsedContractIs();
        isStatement.initialise(isElement, this.document, this, false);
        this.contractIsStatements.push(isStatement);
      });
    }

    if (
      typeof this.element.body !== "undefined" &&
      this.element.body !== null
    ) {
      this.element.body.forEach((contractElement) => {
        if (contractElement.type === "FunctionDeclaration") {
          const functionContract = new ParsedFunction();
          functionContract.initialise(
            contractElement,
            this.document,
            this,
            false
          );
          if (functionContract.name === functionContract.contract.name) {
            this.constructorFunction = functionContract;
          } else {
            this.functions.push(functionContract);
          }
        }

        if (contractElement.type === "ModifierDeclaration") {
          const functionContract = new ParsedFunction();
          functionContract.initialise(
            contractElement,
            this.document,
            this,
            false
          );
          functionContract.isModifier = true;
          this.functions.push(functionContract);
        }

        if (contractElement.type === "ConstructorDeclaration") {
          const functionContract = new ParsedFunction();
          functionContract.isConstructor = true;
          functionContract.initialise(
            contractElement,
            this.document,
            this,
            false
          );
          this.constructorFunction = functionContract;
        }

        if (contractElement.type === "FallbackDeclaration") {
          const functionContract = new ParsedFunction();
          functionContract.isFallback = true;
          functionContract.initialise(
            contractElement,
            this.document,
            this,
            false
          );
          this.fallbackFunction = functionContract;
        }

        if (contractElement.type === "ReceiveDeclaration") {
          const functionContract = new ParsedFunction();
          functionContract.isReceive = true;
          functionContract.initialise(
            contractElement,
            this.document,
            this,
            false
          );
          this.receiveFunction = functionContract;
        }

        if (contractElement.type === "EventDeclaration") {
          const eventContract = new ParsedEvent();
          eventContract.initialise(contractElement, this.document, this, false);
          this.events.push(eventContract);
        }

        if (contractElement.type === "StateVariableDeclaration") {
          const stateVariable = new ParsedStateVariable();
          stateVariable.initialise(contractElement, this.document, this);
          this.stateVariables.push(stateVariable);
        }

        if (contractElement.type === "EnumDeclaration") {
          const enumContract = new ParsedEnum();
          enumContract.initialise(contractElement, this.document, this, false);
          this.enums.push(enumContract);
        }

        if (contractElement.type === "StructDeclaration") {
          const struct = new ParsedStruct();
          struct.initialise(contractElement, this.document, this, false);
          this.structs.push(struct);
        }

        if (contractElement.type === "TypeDeclaration") {
          const customType = new ParsedCustomType();
          customType.initialise(contractElement, this.document, this, false);
          this.customTypes.push(customType);
        }

        if (contractElement.type === "ErrorDeclaration") {
          const error = new ParsedError();
          error.initialise(contractElement, this.document, this, false);
          this.errors.push(error);
        }

        if (contractElement.type === "UsingStatement") {
          const using = new ParsedUsing();
          using.initialise(contractElement, this.document, this, false);
          this.using.push(using);
        }
      });
    }
  }

  public createCompletionItem(): CompletionItem {
    if (this.completionItem === null) {
      const completionItem = this.initCompletionItem();
      if (this.contractType === ContractType.interface) {
        completionItem.kind = CompletionItemKind.Interface;
      } else {
        completionItem.kind = CompletionItemKind.Class;
      }

      completionItem.insertText = this.name;

      completionItem.detail =
        "(" +
        this.getContractTypeName(this.contractType) +
        " : " +
        this.name +
        ") in " +
        this.document.sourceDocument.absolutePath;
      this.completionItem = completionItem;
    }
    return this.completionItem;
  }

  public override getInfo(): string {
    return this.createInfo(
      "",
      this.name,
      `: ${this.document.sourceDocument.absolutePath}`,
      undefined,
      true,
      false
    );
  }

  public override getParsedObjectType(): string {
    return this.contract.getContractTypeName(this.contract.contractType);
  }

  public getAllFunctionCompletionItems(): CompletionItem[] {
    const completionItems: CompletionItem[] = [];
    this.getAllFunctions().forEach((x) =>
      completionItems.push(x.createCompletionItem())
    );
    return completionItems;
  }

  public getAllEventsCompletionItems(): CompletionItem[] {
    const completionItems: CompletionItem[] = [];
    this.getAllEvents().forEach((x) =>
      completionItems.push(x.createCompletionItem())
    );
    return completionItems;
  }

  public getAllErrorsCompletionItems(): CompletionItem[] {
    const completionItems: CompletionItem[] = [];
    this.getAllErrors().forEach((x) =>
      completionItems.push(x.createCompletionItem())
    );
    return completionItems;
  }

  public getAllStructsCompletionItems(): CompletionItem[] {
    const completionItems: CompletionItem[] = [];
    this.getAllStructs().forEach((x) =>
      completionItems.push(x.createCompletionItem())
    );
    return completionItems;
  }

  public getAllEnumsCompletionItems(): CompletionItem[] {
    const completionItems: CompletionItem[] = [];
    this.getAllEnums().forEach((x) =>
      completionItems.push(x.createCompletionItem())
    );
    return completionItems;
  }

  public getAllCustomTypesCompletionItems(): CompletionItem[] {
    const completionItems: CompletionItem[] = [];
    this.getAllCustomTypes().forEach((x) =>
      completionItems.push(x.createCompletionItem())
    );
    return completionItems;
  }

  public getAllConstantCompletionItems(): CompletionItem[] {
    const completionItems: CompletionItem[] = [];
    this.getAllConstants().forEach((x) =>
      completionItems.push(x.createCompletionItem())
    );
    return completionItems;
  }

  public getAllStateVariableCompletionItems(): CompletionItem[] {
    const completionItems: CompletionItem[] = [];
    this.getAllStateVariables().forEach((x) =>
      completionItems.push(x.createCompletionItem())
    );
    return completionItems;
  }

  public override getInnerCompletionItems(): CompletionItem[] {
    let completionItems: CompletionItem[] = [];
    completionItems = completionItems.concat(
      this.getAllFunctions(false).map((x) => x.createCompletionItem())
    );
    completionItems = completionItems.concat(
      this.getAllStateVariableCompletionItems()
    );
    completionItems = completionItems.concat(
      this.getAllErrors(false).map((x) => x.createCompletionItem())
    );
    completionItems = completionItems.concat(
      this.getAllStructs(false).map((x) => x.createCompletionItem())
    );
    completionItems = completionItems.concat(
      this.getAllEnums(false).map((x) => x.createCompletionItem())
    );
    return completionItems;
  }

  public getSelectedContractCompletionItems(offset: number): CompletionItem[] {
    let completionItems: CompletionItem[] = [];
    completionItems = completionItems.concat(
      this.getAllFunctionCompletionItems()
    );
    completionItems = completionItems.concat(
      this.getAllEventsCompletionItems()
    );
    completionItems = completionItems.concat(
      this.getAllStateVariableCompletionItems()
    );
    completionItems = completionItems.concat(
      this.getAllStructsCompletionItems()
    );
    completionItems = completionItems.concat(this.getAllEnumsCompletionItems());
    completionItems = completionItems.concat(
      this.getAllCustomTypesCompletionItems()
    );
    completionItems = completionItems.concat(
      this.getAllConstantCompletionItems()
    );
    completionItems = completionItems.concat(
      this.document.getAllGlobalContractsCompletionItems()
    );

    const selectedFunction = this.getSelectedFunction(offset);

    if (selectedFunction !== undefined) {
      selectedFunction.input.forEach((parameter) => {
        completionItems.push(
          parameter.createParamCompletionItem(
            "function parameter",
            selectedFunction.contract.name
          )
        );
      });
      selectedFunction.output.forEach((parameter) => {
        completionItems.push(
          parameter.createParamCompletionItem(
            "return parameter",
            selectedFunction.contract.name
          )
        );
      });

      const variablesInScope =
        selectedFunction.findVariableDeclarationsInScope(offset);
      variablesInScope.forEach((variable) => {
        completionItems.push(variable.createCompletionItem());
      });
    }
    return completionItems;
  }

  public getContractTypeName(contractType: ContractType) {
    switch (contractType) {
      case ContractType.contract:
        return "Contract";
      case ContractType.interface:
        return "Interface";
      case ContractType.library:
        return "Library";
      default:
        break;
    }
  }

  public initialiseVariablesMembersEtc(
    statement: any,
    parentStatement: any,
    child: ParsedExpression
  ) {
    if (!statement) return;
    try {
      if (statement.type != null) {
        switch (statement.type) {
          case "CallExpression": // e.g. Func(x, y)
            const callExpression = ParsedExpression.createFromElement(
              statement,
              this.document,
              this.contract,
              child,
              this
            );
            this.expressions.push(callExpression);
            break;
          case "MemberExpression": // e.g. x.y x.f(y) arr[1] map['1'] arr[i] map[k]
            const memberCreated = ParsedExpression.createFromMemberExpression(
              statement,
              this.document,
              this.contract,
              child,
              this
            );
            if (memberCreated !== undefined) {
              this.expressions.push(memberCreated);
            } else {
            }
            break;
          case "Identifier":
            const identifier = ParsedExpression.createFromElement(
              statement,
              this.document,
              this.contract,
              child,
              this
            );
            this.expressions.push(identifier);
            break;
          case "FunctionDeclaration":
            break;
          case "ConstructorDeclaration":
            break;
          case "FallbackDeclaration":
            break;
          case "ReceiveDeclaration":
            break;
          default:
            for (const key in statement) {
              if (statement.hasOwnProperty(key)) {
                const element = statement[key];
                if (element instanceof Array) {
                  // recursively drill down to collections e.g. statements, params
                  element.forEach((innerElement) => {
                    this.initialiseVariablesMembersEtc(
                      innerElement,
                      statement,
                      null
                    );
                  });
                } else if (element instanceof Object) {
                  // recursively drill down to elements with start/end e.g. literal type
                  if (
                    element.hasOwnProperty("start") &&
                    element.hasOwnProperty("end")
                  ) {
                    this.initialiseVariablesMembersEtc(
                      element,
                      statement,
                      null
                    );
                  }
                }
              }
            }
        }
      }
    } catch (error) {
      // console.log(JSON.stringify(error));
    }
  }
}
