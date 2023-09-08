import * as vscode from "vscode-languageserver";
import { CodeWalkerService } from "./parsedCodeModel/codeWalkerService";
import { ParsedCode } from "./parsedCodeModel/parsedCode";
import { locate } from "./parsedCodeModel/ParsedExpression";
import { ParsedUsing } from "./parsedCodeModel/parsedUsing";

export class SolidityHoverProvider {
  public provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    walker: CodeWalkerService
  ): vscode.Hover | undefined {
    // const offset = document.offsetAt(position);
    // const documentContractSelected = walker.getSelectedDocument(
    //   document,
    //   position
    // );

    // const item = documentContractSelected.getSelectedItem(offset);
    // if (item !== null) {
    //   const res = item.getHover();
    //   return res;
    // }
    return undefined;
  }
}

export class SolidityReferencesProvider {
  public static provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
    walker: CodeWalkerService
  ): vscode.Location[] {
    const offset = document.offsetAt(position);
    walker.initialiseChangedDocuments();
    const documentContractSelected = walker.getSelectedDocument(
      document,
      position
    );

    const references = documentContractSelected.getAllReferencesToSelected(
      offset,
      [].concat(documentContractSelected, walker.parsedDocumentsCache)
    );

    const foundLocations = references
      .filter((x) => x != null && x.location !== null)
      .map((x) => x.location);

    return <vscode.Location[]>foundLocations;
  }

  public static removeDuplicates(foundLocations: any[], keys: string[]) {
    return Object.values(
      foundLocations.reduce((r, o: any) => {
        const key = keys.map((k) => o[k]).join("|");
        // tslint:disable-next-line:curly
        if (r[key]) r[key].condition = [].concat(r[key].condition, o.condition);
        // tslint:disable-next-line:curly
        else r[key] = { ...o };
        return r;
      }, {})
    );
  }
}
// const getExtendeds = (usings: ParsedUsing[], document: ParsedDocument, element: any) => {
//   usings.forEach((usingItem) => {
//     const foundLibrary = this.document
//       .getAllContracts()
//       .find((x) => x.name === usingItem.name);
//     if (foundLibrary !== undefined) {
//       const allfunctions = foundLibrary.getAllFunctions();
//       const filteredFunctions = allfunctions.filter((x) => {
//         if (x.input.length > 0) {
//           const typex = x.input[0].type;
//           let validTypeName = false;
//           if (
//             typex.name === this.name ||
//             (this.name === "address_payable" && typex.name === "address")
//           ) {
//             validTypeName = true;
//           }
//           return (
//             typex.isArray === this.isArray &&
//             validTypeName &&
//             typex.isMapping === this.isMapping
//           );
//         }
//         return false;
//       });
//       result = result.concat(filteredFunctions);
//     }
//   });
// }
export class SolidityDefinitionProvider {
  public static currentOffset: number = 0;
  public static currentItem: ParsedCode | null = null;

  public static provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    walker: CodeWalkerService
  ): Thenable<vscode.Location | vscode.Location[]> {
    this.currentOffset = document.offsetAt(position);
    const documentContractSelected = walker.getSelectedDocument(
      document,
      position
    );
    this.currentItem = documentContractSelected.getSelectedItem(
      this.currentOffset
    );
    const references =
      documentContractSelected.getSelectedTypeReferenceLocation(
        this.currentOffset
      );
    const foundLocations = references
      .filter((x) => x.location !== null)
      .map((x) => x.location);
    const keys = ["range", "uri"];
    const result = this.removeDuplicates(foundLocations, keys);
    this.currentOffset = 0;
    this.currentItem = null;

    return Promise.resolve(<vscode.Location[]>result);
  }

  public static removeDuplicates(foundLocations: any[], keys: string[]) {
    return Object.values(
      foundLocations.reduce((r, o: any) => {
        const key = keys.map((k) => o[k]).join("|");
        // tslint:disable-next-line:curly
        if (r[key]) r[key].condition = [].concat(r[key].condition, o.condition);
        // tslint:disable-next-line:curly
        else r[key] = { ...o };
        return r;
      }, {})
    );
  }
}

// export class SolidityDefinitionProviderOld {
//   private rootPath: string;
//   private packageDefaultDependenciesDirectory: string[];
//   private packageDefaultDependenciesContractsDirectory: string;
//   private project: Project;
//   private remappings: string[];

//   constructor(
//     rootPath: string,
//     packageDefaultDependenciesDirectory: string[],
//     packageDefaultDependenciesContractsDirectory: string,
//     remappings: string[]
//   ) {
//     this.rootPath = rootPath;
//     this.packageDefaultDependenciesDirectory =
//       packageDefaultDependenciesDirectory;
//     this.packageDefaultDependenciesContractsDirectory =
//       packageDefaultDependenciesContractsDirectory;
//     this.remappings = remappings;

//     if (this.rootPath !== "undefined" && this.rootPath !== null) {
//       this.project = initialiseProject(
//         this.rootPath,
//         this.packageDefaultDependenciesDirectory,
//         this.packageDefaultDependenciesContractsDirectory,
//         this.remappings
//       );
//     }
//   }

//   /**
//    * Provide definition for cursor position in Solidity codebase. It calculate offset from cursor position and find the
//    * most precise statement in solparse AST that surrounds the cursor. It then deduces the definition of the element based
//    * on the statement type.
//    *
//    * @param {vscode.TextDocument} document
//    * @param {vscode.Position} position
//    * @returns {(Thenable<vscode.Location | vscode.Location[]>)}
//    * @memberof SolidityDefinitionProvider
//    */
//   public provideDefinition(
//     document: vscode.TextDocument,
//     position: vscode.Position
//   ): Thenable<vscode.Location | vscode.Location[]> {
//     const documentText = document.getText();
//     const contractPath = URI.parse(document.uri).fsPath;

//     const contracts = new SourceDocumentCollection();
//     if (this.project !== undefined) {
//       contracts.addSourceDocumentAndResolveImports(
//         contractPath,
//         documentText,
//         this.project
//       );
//     }
//     // this contract
//     const contract = contracts.documents[0];

//     const offset = document.offsetAt(position);

//     const result = solparse.parse(documentText);

//     const element = this.findElementByOffset(result.body, offset);

//     if (element !== undefined) {
//       switch (element.type) {
//         case "ImportStatement":
//           return Promise.resolve(
//             vscode.Location.create(
//               URI.file(
//                 this.resolveImportPath(element.from, contract)
//               ).toString(),
//               vscode.Range.create(0, 0, 0, 0)
//             )
//           );
//         case "ContractStatement": {
//           // find definition for inheritance
//           const isBlock = this.findElementByOffset(element.is, offset);
//           if (isBlock !== undefined) {
//             let directImport = this.findDirectImport(
//               document,
//               result.body,
//               isBlock.name,
//               "ContractStatement",
//               contracts
//             );

//             if (directImport.location === undefined) {
//               directImport = this.findDirectImport(
//                 document,
//                 result.body,
//                 isBlock.name,
//                 "InterfaceStatement",
//                 contracts
//               );
//             }
//             return Promise.resolve(directImport.location);
//           }

//           // find definition in contract body recursively
//           const statement = this.findElementByOffset(element.body, offset);
//           if (statement !== undefined) {
//             return this.provideDefinitionInStatement(
//               document,
//               result.body,
//               statement,
//               element,
//               offset,
//               contracts
//             );
//           }
//           break;
//         }
//         case "LibraryStatement": {
//           // find definition in library body recursively
//           const statement = this.findElementByOffset(element.body, offset);
//           if (statement !== undefined) {
//             return this.provideDefinitionInStatement(
//               document,
//               result.body,
//               statement,
//               element,
//               offset,
//               contracts
//             );
//           }
//           break;
//         }
//         case "InterfaceStatement": {
//           // find definition in interface body recursively
//           const statement = this.findElementByOffset(element.body, offset);
//           if (statement !== undefined) {
//             return this.provideDefinitionInStatement(
//               document,
//               result.body,
//               statement,
//               element,
//               offset,
//               contracts
//             );
//           }
//           break;
//         }
//         default:
//           break;
//       }
//     }
//   }

//   /**
//    * Provide definition for anything other than `import`, and `is` statements by recursively searching through
//    * statement and its children.
//    *
//    * @private
//    * @param {vscode.TextDocument} document text document, where statement belongs, used to convert position to/from offset
//    * @param {Array<any>} documentStatements array of statements found in the current document
//    * @param {*} statement current statement which contains the cursor offset
//    * @param {*} parentStatement parent of the current statement
//    * @param {number} offset cursor offset of the element we need to provide definition for
//    * @param {SourceDocumentCollection} contracts collection of contracts resolved by current contract
//    * @returns {(Thenable<vscode.Location | vscode.Location[]>)}
//    * @memberof SolidityDefinitionProvider
//    */
//   private provideDefinitionInStatement(
//     document: vscode.TextDocument,
//     documentStatements: Array<any>,
//     statement: any,
//     parentStatement: any,
//     offset: number,
//     contracts: SourceDocumentCollection
//   ): Thenable<vscode.Location | vscode.Location[]> {
//     switch (statement.type) {
//       case "UsingStatement":
//         if (offset < statement.for.start) {
//           // definition of the library itself i.e. using **Library** for xxxx
//           return Promise.resolve(
//             this.findDirectImport(
//               document,
//               documentStatements,
//               statement.library,
//               "LibraryStatement",
//               contracts
//             ).location
//           );
//         } else {
//           // definition of the using statement target i.e. using Library for **DataType**
//           return this.provideDefinitionForType(
//             document,
//             documentStatements,
//             statement.for,
//             contracts
//           );
//         }
//       case "Type":
//         // handle nested type and resolve to inner type when applicable e.g. mapping(uint => Struct)
//         if (
//           statement.literal instanceof Object &&
//           statement.literal.start <= offset &&
//           offset <= statement.literal.end
//         ) {
//           return this.provideDefinitionInStatement(
//             document,
//             documentStatements,
//             statement.literal,
//             statement,
//             offset,
//             contracts
//           );
//         } else {
//           return this.provideDefinitionForType(
//             document,
//             documentStatements,
//             statement,
//             contracts
//           );
//         }
//       case "Identifier":
//         switch (parentStatement.type) {
//           case "CallExpression": // e.g. Func(x, y)
//             if (parentStatement.callee === statement) {
//               // TODO: differentiate function, event, and struct construction
//               return this.provideDefinitionForCallee(contracts, statement.name);
//             }
//             break;
//           case "MemberExpression": // e.g. x.y x.f(y) arr[1] map['1'] arr[i] map[k]
//             if (parentStatement.object === statement) {
//               // NB: it is possible to have f(x).y but the object statement would not be an identifier
//               // therefore we can safely assume this is a variable instead
//               return this.provideDefinitionForVariable(
//                 contracts,
//                 statement.name
//               );
//             } else if (parentStatement.property === statement) {
//               return Promise.all([
//                 // TODO: differentiate better between following possible cases

//                 // TODO: provide field access definition, which requires us to know the type of object
//                 // Consider find the definition of object first and recursive upward till declarative expression for type inference

//                 // array or mapping access via variable i.e. arr[i] map[k]
//                 this.provideDefinitionForVariable(contracts, statement.name),
//                 // func call in the form of obj.func(arg)
//                 this.provideDefinitionForCallee(contracts, statement.name),
//               ]).then((locationsArray) =>
//                 Array.prototype.concat.apply([], locationsArray)
//               );
//             }
//             break;
//           default:
//             return this.provideDefinitionForVariable(contracts, statement.name);
//         }
//         break;
//       default:
//         for (const key in statement) {
//           if (statement.hasOwnProperty(key)) {
//             const element = statement[key];
//             if (element instanceof Array) {
//               // recursively drill down to collections e.g. statements, params
//               const inner = this.findElementByOffset(element, offset);
//               if (inner !== undefined) {
//                 return this.provideDefinitionInStatement(
//                   document,
//                   documentStatements,
//                   inner,
//                   statement,
//                   offset,
//                   contracts
//                 );
//               }
//             } else if (element instanceof Object) {
//               // recursively drill down to elements with start/end e.g. literal type
//               if (
//                 element.hasOwnProperty("start") &&
//                 element.hasOwnProperty("end") &&
//                 element.start <= offset &&
//                 offset <= element.end
//               ) {
//                 return this.provideDefinitionInStatement(
//                   document,
//                   documentStatements,
//                   element,
//                   statement,
//                   offset,
//                   contracts
//                 );
//               }
//             }
//           }
//         }

//         // handle modifier last now that params have not been selected
//         if (statement.type === "ModifierArgument") {
//           return this.provideDefinitionForCallee(contracts, statement.name);
//         }
//         break;
//     }
//   }

//   /**
//    * Provide definition for a callee which can be a function, event, struct, or contract
//    *
//    * e.g. f(x), emit Event(x), Struct(x), Contract(address)
//    *
//    * @private
//    * @param {SourceDocumentCollection} contracts collection of contracts resolved by current contract
//    * @param {string} name name of the variable
//    * @returns {Promise<vscode.Location[]>}
//    * @memberof SolidityDefinitionProvider
//    */
//   private provideDefinitionForCallee(
//     contracts: SourceDocumentCollection,
//     name: string
//   ): Promise<vscode.Location[]> {
//     return this.provideDefinitionForContractMember(
//       contracts,
//       name,
//       (element) => {
//         const elements = element.body.filter(
//           (contractElement) =>
//             contractElement.name === name &&
//             (contractElement.type === "FunctionDeclaration" ||
//               contractElement.type === "EventDeclaration" ||
//               contractElement.type === "StructDeclaration" ||
//               contractElement.type === "EnumDeclaration")
//         );

//         if (element.type === "ContractStatement" && element.name === name) {
//           elements.push(element);
//         }

//         return elements;
//       }
//     );
//   }

//   /**
//    * Provide definition for a variable which can be contract storage variable, constant, local variable (including parameters)
//    *
//    * TODO: find local variable reference (locally defined, parameters and return parameters)
//    * @private
//    * @param {SourceDocumentCollection} contracts collection of contracts resolved by current contract
//    * @param {string} name name of the variable
//    * @returns {Promise<vscode.Location[]>}
//    * @memberof SolidityDefinitionProvider
//    */
//   private provideDefinitionForVariable(
//     contracts: SourceDocumentCollection,
//     name: string
//   ): Promise<vscode.Location[]> {
//     return this.provideDefinitionForContractMember(contracts, name, (element) =>
//       element.body.filter(
//         (contractElement) =>
//           contractElement.name === name &&
//           contractElement.type === "StateVariableDeclaration"
//       )
//     );
//   }

//   /**
//    * Provide definition for a contract member
//    *
//    * @private
//    * @param {SourceDocumentCollection} contracts collection of contracts resolved by current contract
//    * @param {string} extractElements extract all relevant elements from a contract or library statement
//    * @returns {Promise<vscode.Location[]>}
//    * @memberof SolidityDefinitionProvider
//    */
//   private provideDefinitionForContractMember(
//     contracts: SourceDocumentCollection,
//     literalFallbackName: string,
//     extractElements: (any) => Array<any>
//   ): Promise<vscode.Location[]> {
//     const locations = [];
//     for (const contract of contracts.documents) {
//       const uri = URI.file(contract.absolutePath).toString();
//       const document = vscode.TextDocument.create(
//         uri,
//         null,
//         null,
//         contract.code
//       );
//       try {
//         const result = solparse.parse(contract.code);

//         const elements = Array.prototype.concat.apply(
//           [],
//           result.body.map((element) => {
//             if (
//               element.type === "ContractStatement" ||
//               element.type === "LibraryStatement"
//             ) {
//               if (
//                 typeof element.body !== "undefined" &&
//                 element.body !== null
//               ) {
//                 return extractElements(element);
//               }
//             }
//             return [];
//           })
//         );

//         elements.forEach((contractElement) =>
//           locations.push(
//             vscode.Location.create(
//               uri,
//               vscode.Range.create(
//                 document.positionAt(contractElement.start),
//                 document.positionAt(contractElement.end)
//               )
//             )
//           )
//         );
//       } catch {
//         // FALLBACK WORKAROUND ON ERROR PARSING this could be a custom parser
//         // remove all comments with spaces
//         const code = this.replaceCommentsWithSpacesPreservingLines(
//           contract.code
//         );
//         // we find functions, structs, enums and contracts name
//         // tslint:disable-next-line:max-line-length
//         const regexWord = new RegExp(
//           "^\\s*(function|event)\\s+(" +
//             literalFallbackName +
//             ")\\s*\\(|\\s*(struct|contract|enum|library)\\s+(" +
//             literalFallbackName +
//             ")\\s*{",
//           "gm"
//         );
//         // find the first declaration
//         let pos = this.regexIndexOf(code, regexWord, 0);
//         if (pos > -1) {
//           // we want to get position of the name, not the start of the match
//           pos = code.indexOf(literalFallbackName, pos);
//           if (pos > -1) {
//             // making sure..
//             locations.push(
//               vscode.Location.create(
//                 uri,
//                 vscode.Range.create(
//                   document.positionAt(pos),
//                   document.positionAt(pos + literalFallbackName.length)
//                 )
//               )
//             );
//           }
//         }
//       }
//     }
//     return Promise.resolve(locations);
//   }

//   private replaceCommentsWithSpacesPreservingLines(code: string): string {
//     // https://stackoverflow.com/questions/5989315/regex-for-match-replacing-javascript-comments-both-multiline-and-inline
//     return code.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, this.replacer);
//   }

//   private regexIndexOf(string, regex, startpos): number {
//     const indexOf = string.substring(startpos || 0).search(regex);
//     return indexOf >= 0 ? indexOf + (startpos || 0) : indexOf;
//   }

//   private replacer(match: string): string {
//     const lines = match.split(/\r?\n/g);
//     const hasrn = match.indexOf("\r\n") > -1;
//     for (let index = 0; index < lines.length; index++) {
//       lines[index] = "".padStart(lines[index].length, " ");
//     }
//     if (hasrn) {
//       return lines.join("\r\n");
//     } else {
//       return lines.join("\n");
//     }
//   }

//   /**
//    * Provide definition for a type. A type can either be simple e.g. `Struct` or scoped `MyContract.Struct`.
//    * For the scoped type, we recurse with the type member as a simple type in the scoped document.
//    *
//    * @private
//    * @param {vscode.TextDocument} document text document, where statement belongs, used to convert position to/from offset
//    * @param {Array<any>} documentStatements array of statements found in the current document
//    * @param {*} literal type literal object
//    * @param {SourceDocumentCollection} contracts collection of contracts resolved by current contract
//    * @returns {(Thenable<vscode.Location | vscode.Location[]>)}
//    * @memberof SolidityDefinitionProvider
//    */
//   private provideDefinitionForType(
//     document: vscode.TextDocument,
//     documentStatements: Array<any>,
//     literal: any,
//     contracts: SourceDocumentCollection
//   ): Thenable<vscode.Location | vscode.Location[]> {
//     if (literal.members.length > 0) {
//       // handle scoped type by looking for scoping Contract or Library e.g. MyContract.Struct
//       let literalDocument = this.findDirectImport(
//         document,
//         documentStatements,
//         literal.literal,
//         "ContractStatement",
//         contracts
//       );
//       if (literalDocument.location === undefined) {
//         literalDocument = this.findDirectImport(
//           document,
//           documentStatements,
//           literal.literal,
//           "LibraryStatement",
//           contracts
//         );
//       }

//       if (literalDocument.location !== undefined) {
//         return this.provideDefinitionForType(
//           literalDocument.document,
//           literalDocument.statements,
//           // a fake literal that uses the inner name and set start to the contract location
//           {
//             literal: literal.members[0],
//             members: [],
//             start: literalDocument.document.offsetAt(
//               literalDocument.location.range.start
//             ),
//           },
//           contracts
//         );
//       }
//     } else {
//       const contractStatement = this.findElementByOffset(
//         documentStatements,
//         literal.start
//       );
//       const structLocation = this.findStatementLocationByNameType(
//         document,
//         contractStatement.body,
//         literal.literal,
//         "StructDeclaration"
//       );
//       if (structLocation !== undefined) {
//         return Promise.resolve(structLocation);
//       }

//       const enumLocation = this.findStatementLocationByNameType(
//         document,
//         contractStatement.body,
//         literal.literal,
//         "EnumDeclaration"
//       );
//       if (enumLocation !== undefined) {
//         return Promise.resolve(enumLocation);
//       }

//       // TODO: only search inheritance chain
//       return this.provideDefinitionForContractMember(
//         contracts,
//         literal.literal,
//         (element) =>
//           element.body.filter(
//             (contractElement) =>
//               contractElement.name === literal.literal &&
//               (contractElement.type === "StructDeclaration" ||
//                 contractElement.type === "EnumDeclaration")
//           )
//       );
//     }
//   }

//   /**
//    * Find the first statement by name and type in current document and its direct imports.
//    *
//    * This is used to find either Contract or Library statement to define `is`, `using`, or member accessor.
//    *
//    * @private
//    * @param {vscode.TextDocument} document document where statements belong, used to convert offset to position
//    * @param {Array<any>} statements list of statements to search through
//    * @param {string} name name of statement to find
//    * @param {string} type type of statement to find
//    * @param {SourceDocumentCollection} contracts collection of contracts resolved by current contract
//    * @returns location of the statement and its document and document statements
//    * @memberof SolidityDefinitionProvider
//    */
//   private findDirectImport(
//     document: vscode.TextDocument,
//     statements: Array<any>,
//     name: string,
//     type: string,
//     contracts: SourceDocumentCollection
//   ) {
//     // find in the current file
//     let location = this.findStatementLocationByNameType(
//       document,
//       statements,
//       name,
//       type
//     );

//     // find in direct imports if not found in file
//     const contract = contracts.documents[0];
//     // TODO: when importing contracts with conflict names, which one will Solidity pick? first or last? or error?
//     for (
//       let i = 0;
//       location === undefined && i < contract.imports.length;
//       i++
//     ) {
//       const importPath = this.resolveImportPath(contract.imports[i], contract);
//       const importContract = contracts.documents.find(
//         (e) => e.absolutePath === importPath
//       );
//       const uri = URI.file(importContract.absolutePath).toString();
//       document = vscode.TextDocument.create(
//         uri,
//         null,
//         null,
//         importContract.code
//       );
//       try {
//         statements = solparse.parse(importContract.code).body;
//       } catch {
//         statements = [];
//       }
//       location = this.findStatementLocationByNameType(
//         document,
//         statements,
//         name,
//         type
//       );
//     }

//     return {
//       document,
//       location,
//       statements,
//     };
//   }

//   /**
//    * Find the first statement by its name and type
//    *
//    * @private
//    * @param {vscode.TextDocument} document document where statements belong, used to convert offset to position
//    * @param {Array<any>} statements list of statements to search through
//    * @param {string} name name of statement to find
//    * @param {string} type type of statement to find
//    * @returns {vscode.Location} the location of the found statement
//    * @memberof SolidityDefinitionProvider
//    */
//   private findStatementLocationByNameType(
//     document: vscode.TextDocument,
//     statements: Array<any>,
//     name: string,
//     type: string
//   ): vscode.Location {
//     const localDef = statements.find((e) => e.type === type && e.name === name);
//     if (localDef !== undefined) {
//       return vscode.Location.create(
//         document.uri,
//         vscode.Range.create(
//           document.positionAt(localDef.start),
//           document.positionAt(localDef.end)
//         )
//       );
//     }
//   }

//   /**
//    * Find the first element that surrounds offset
//    *
//    * @private
//    * @param {Array<any>} elements list of elements that has `start` and `end` member
//    * @param {number} offset cursor offset
//    * @returns {*} the first element where offset \in [start, end]
//    * @memberof SolidityDefinitionProvider
//    */
//   private findElementByOffset(elements: Array<any>, offset: number): any {
//     return elements.find(
//       (element) => element.start <= offset && offset <= element.end
//     );
//   }

//   /**
//    * Resolve import statement to absolute file path
//    *
//    * @private
//    * @param {string} importPath import statement in *.sol contract
//    * @param {SourceDocument} contract the contract where the import statement belongs
//    * @returns {string} the absolute path of the imported file
//    * @memberof SolidityDefinitionProvider
//    */
//   private resolveImportPath(
//     importPath: string,
//     contract: SourceDocument
//   ): string {
//     if (contract.isImportLocal(importPath)) {
//       return contract.formatDocumentPath(
//         path.resolve(path.dirname(contract.absolutePath), importPath)
//       );
//     } else if (this.project !== undefined && this.project !== null) {
//       const remapping = this.project.findImportRemapping(importPath);
//       if (remapping !== undefined && remapping != null) {
//         return contract.formatDocumentPath(remapping.resolveImport(importPath));
//       } else {
//         const depPack = this.project.findDependencyPackage(importPath);
//         if (depPack !== undefined) {
//           return contract.formatDocumentPath(depPack.resolveImport(importPath));
//         }
//       }
//     }
//     return importPath;
//   }
// }
