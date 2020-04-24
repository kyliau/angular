/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {CompilerOptions, createNgCompilerOptions} from '@angular/compiler-cli';
import {NgCompilerOptions} from '@angular/compiler-cli/src/ngtsc/core/api';
import * as ts from 'typescript/lib/tsserverlibrary';
import {Compiler} from './compiler/compiler';

export class LanguageService {
  private program: ts.Program;
  private readonly options: NgCompilerOptions;
  private readonly compiler: Compiler;

  constructor(
      project: ts.server.Project,
      private readonly tsLS: ts.LanguageService,
  ) {
    this.program = tsLS.getProgram()!;
    // TODO: Need to watch config file and listen for changes.
    this.options = parseNgCompilerOptions(project);
    this.compiler = new Compiler(project, this.program, this.options);
  }

  private getProgramWithTcf() {
    const program = this.tsLS.getProgram();
    if (!program) {
      throw new Error('Failed to get program');
    }
    const programWithTcf = this.compiler.analyze(program);
    if (!programWithTcf) {
      throw new Error('Failed to get program with type check file');
    }
    console.error(`There are ${programWithTcf.getSourceFiles().length} files`)
    for (const {fileName} of programWithTcf.getSourceFiles()) {
      console.error(fileName);
    }
    return programWithTcf;
  }

  getSemanticDiagnostics(fileName: string): ts.Diagnostic[] {
    const program = this.getProgramWithTcf();
    const sourceFile = program.getSourceFile(fileName);
    if (!sourceFile) {
      return [];
    }
    return this.compiler.getDiagnostics(sourceFile);
  }

  // getDefinitionAndBoundSpan(fileName: string, position: number): ts.DefinitionInfoAndBoundSpan
  //     |undefined {
  //   if (!fileName.endsWith('.ts')) {
  //     // Does not support external template for now
  //     return;
  //   }
  //   const compilation = this.host.analyzeSync();
  //   if (!compilation) {
  //     return;
  //   }
  //   const sourceFile = this.host.getSourceFile(fileName);
  //   if (!sourceFile) {
  //     return;
  //   }
  //   const node = findTightestNode(sourceFile, position);
  //   if (!node) {
  //     return;
  //   }
  //   const templateAssignment = getPropertyAssignmentFromValue(node);
  //   if (!templateAssignment || templateAssignment.name.getText() !== 'template') {
  //     return;
  //   }
  //   const classDecl = getClassDeclFromDecoratorProp(templateAssignment);
  //   if (!classDecl || !classDecl.name) {
  //     // Does not handle anonymous class
  //     return;
  //   }
  //   // TODO: Check if declaration is exported
  //   const record = this.host.getClassRecord(compilation, classDecl);
  //   if (!record) {
  //     return;
  //   }
  //   for (const trait of record.traits) {
  //     if (trait.state !== TraitState.RESOLVED) {
  //       continue;
  //     }
  //     // const {analysis, detected, handler, resolution} = trait;
  //     const analysis = trait.analysis as ComponentAnalysisData;
  //     // The template is parsed twice, once according to user's specifications
  //     // template.emitNodes, and second time for diagnostics in a manner that
  //     // preserves source map information. We use the latter.
  //     const templateAst: TmplAstNode[] = analysis.template.diagNodes;
  //     const visitor = new R3Visitor(position);
  //     visitor.visitAll(templateAst);
  //     const {path} = visitor;
  //     if (!path.length) {
  //       continue;
  //     }
  //     const last = path[path.length - 1];
  //     if (isExpressionNode(last)) {
  //       const name = (last as any).name;
  //       const tcf = this.host.getTcf(classDecl);
  //       if (!tcf) {
  //         continue;
  //       }
  //       const node = tcf.forEachChild(function find(node: ts.Node): ts.Identifier|undefined {
  //         if (ts.isIdentifier(node) && node.text === name) {
  //           return node;
  //         }
  //         return node.forEachChild(find);
  //       });
  //       if (node) {
  //         return this.host.getDefinitionAndBoundSpan(tcf!, node);
  //       }
  //     }
  //     if (isR3Node(last)) {
  //       const name = (last as any).name;
  //     }
  //   }
  // }
}

function parseNgCompilerOptions(project: ts.server.Project): CompilerOptions {
  let config = {};
  if (project instanceof ts.server.ConfiguredProject) {
    const configPath = project.getConfigFilePath();
    const result = ts.readConfigFile(configPath, (path: string) => project.readFile(path));
    if (result.error) {
      project.error(ts.flattenDiagnosticMessageText(result.error.messageText, '\n'));
    }
    if (result.config) {
      config = result.config;
    }
  }
  const basePath = project.getCurrentDirectory();
  return createNgCompilerOptions(basePath, config, project.getCompilationSettings());
}
