/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {CompilerOptions, createNgCompilerOptions} from '@angular/compiler-cli';
import * as ts from 'typescript/lib/tsserverlibrary';

import {Compiler} from './compiler/compiler';
import {findTightestTemplateNode, isR3Node} from './r3_utils';
import {findTightestNode, getClassDeclFromDecoratorProp, getPropertyAssignmentFromValue} from './ts_utils';

export class LanguageService {
  private options: CompilerOptions;
  private readonly compiler: Compiler;

  constructor(project: ts.server.Project, private readonly tsLS: ts.LanguageService) {
    this.options = parseNgCompilerOptions(project);
    this.watchConfigFile(project);
    this.compiler = new Compiler(project, this.options);
  }

  getSemanticDiagnostics(fileName: string): ts.Diagnostic[] {
    const program = this.compiler.analyze();
    if (!program) {
      return [];
    }
    const sourceFile = program.getSourceFile(fileName);
    if (!sourceFile) {
      return [];
    }
    return this.compiler.getDiagnostics(sourceFile);
  }

  getQuickInfoAtPosition(fileName: string, position: number): ts.QuickInfo|undefined {
    if (!fileName.endsWith('.ts')) {
      // TODO: Does not support .html for now
      return;
    }
    const program = this.compiler.analyze();
    if (!program) {
      return;
    }
    const sourceFile = program.getSourceFile(fileName);
    if (!sourceFile) {
      return;
    }
    const node = findTightestNode(sourceFile, position);
    if (!node) {
      return;
    }
    const templateAssignment = getPropertyAssignmentFromValue(node);
    if (!templateAssignment || templateAssignment.name.getText() !== 'template') {
      return;
    }
    const classDecl = getClassDeclFromDecoratorProp(templateAssignment);
    if (!classDecl || !classDecl.name) {
      return;
    }
    const templateAst = this.compiler.getTemplateAst(classDecl);
    if (!templateAst) {
      return;
    }
    const templateNode = findTightestTemplateNode(templateAst, position);
    if (!templateNode) {
      return;
    }
    if (isR3Node(templateNode)) {
      // TODO: No support for HTML entities (e.g. selectors) yet.
      return;
    }
    const identifier = (templateNode as any).name;
    const tcf = this.compiler.typeCheckFileFor(classDecl);
    if (!tcf) {
      return;
    }
    console.error(tcf.text);
    debugger;
    ts.forEachTrailingCommentRange(tcf.text, 0, (pos: number, end:number, kind: ts.CommentKind) => {
      console.error("CALLED")
      if (kind !== ts.SyntaxKind.MultiLineCommentTrivia) {
        return;
      }
      console.error(tcf.text.substring(pos, end));
    });


    // TODO: Get proper source mapping. Use dummy name matching for now.
    function findName(node: ts.Node): ts.Identifier|undefined {
      if (ts.isIdentifier(node) && node.text === identifier) {
        return node;
      }
      return node.forEachChild(findName);
    }
    const matched = findName(tcf);
    if (!matched) {
      return;
    }
    const quickInfo = this.tsLS.getQuickInfoAtPosition(tcf.fileName, matched.getStart());
    if (!quickInfo) {
      return;
    }
    quickInfo.textSpan.start = templateNode.sourceSpan.start;
    quickInfo.textSpan.length = templateNode.sourceSpan.end - templateNode.sourceSpan.start;
    return quickInfo;
  }

  private watchConfigFile(project: ts.server.Project) {
    // TODO: Check the case when the project is disposed. An InferredProject
    // could be disposed when a tsconfig.json is added to the workspace,
    // in which case it becomes a ConfiguredProject (or vice-versa).
    // We need to make sure that the FileWatcher is closed.
    if (!(project instanceof ts.server.ConfiguredProject)) {
      return;
    }
    const {host} = project.projectService;
    host.watchFile(
        project.getConfigFilePath(), (fileName: string, eventKind: ts.FileWatcherEventKind) => {
          project.log(`Config file changed: ${fileName}`);
          if (eventKind === ts.FileWatcherEventKind.Changed) {
            this.options = parseNgCompilerOptions(project);
            this.compiler.setCompilerOptions(this.options);
          }
        });
  }
}

export function parseNgCompilerOptions(project: ts.server.Project): CompilerOptions {
  let config = {};
  if (project instanceof ts.server.ConfiguredProject) {
    const configPath = project.getConfigFilePath();
    const result = ts.readConfigFile(configPath, path => project.readFile(path));
    if (result.error) {
      project.error(ts.flattenDiagnosticMessageText(result.error.messageText, '\n'));
    }
    config = result.config || config;
  }
  const basePath = project.getCurrentDirectory();
  return createNgCompilerOptions(basePath, config, project.getCompilationSettings());
}
