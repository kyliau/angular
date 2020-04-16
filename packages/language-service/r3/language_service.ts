/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {TmplAstNode} from '@angular/compiler';
import {ComponentAnalysisData} from '@angular/compiler-cli/src/ngtsc/annotations/src/component';
import {TraitState} from '@angular/compiler-cli/src/ngtsc/transform';
import * as ts from 'typescript/lib/tsserverlibrary';

import {isExpressionNode, isR3Node, R3Visitor} from './ast_visitor';
import {getDefinitionAndBoundSpanForExternalTemplate} from './definition';
import {Compiler} from './compiler';
import {findTightestNode} from './utils';
import {getClassDeclFromDecoratorProp, getPropertyAssignmentFromValue} from './utils';


export class LanguageService {
  constructor(
    private readonly project: ts.server.Project,
    private readonly tsLS: ts.LanguageService,
  ) {}

  getSemanticDiagnostics(fileName: string): ts.Diagnostic[] {
    const compilation = this.host.analyzeSync();
    const sourceFile = this.host.getSourceFile(fileName);
    return this.host.getDiagnostics(compilation, sourceFile);
  }

  getDefinitionAndBoundSpan(fileName: string, position: number): ts.DefinitionInfoAndBoundSpan
      |undefined {
    const compilation = this.host.analyzeSync();
    if (!compilation) {
      return;
    }
    const sourceFile = this.host.getSourceFile(fileName);
    if (!sourceFile) {
      return;
    }
    const node = findTightestNode(sourceFile, position);
    if (!node) {
      return;
    }
    // Need to get inline or external template
    if (fileName.endsWith('.ts')) {
      const templateAssignment = getPropertyAssignmentFromValue(node);
      if (!templateAssignment || templateAssignment.name.getText() !== 'template') {
        return;
      }
      const classDecl = getClassDeclFromDecoratorProp(templateAssignment);
      if (!classDecl || !classDecl.name) {
        // Does not handle anonymous class
        return;
      }
      // TODO: Check if declaration is exported
      const record = this.host.getClassRecord(compilation, classDecl);
      if (!record) {
        return;
      }
      for (const trait of record.traits) {
        if (trait.state !== TraitState.RESOLVED) {
          continue;
        }
        // const {analysis, detected, handler, resolution} = trait;
        const analysis = trait.analysis as ComponentAnalysisData;
        // The template is parsed twice, once according to user's specifications
        // template.emitNodes, and second time for diagnostics in a manner that
        // preserves source map information. We use the latter.
        const templateAst: TmplAstNode[] = analysis.template.diagNodes;
        const visitor = new R3Visitor(position);
        visitor.visitAll(templateAst);
        const {path} = visitor;
        if (!path.length) {
          continue;
        }
        const last = path[path.length - 1];
        if (isExpressionNode(last)) {
          const name = (last as any).name;
          const tcf = this.host.getTcf(classDecl);
          if (!tcf) {
            continue;
          }
          const node = tcf.forEachChild(function find(node: ts.Node): ts.Identifier|undefined {
            if (ts.isIdentifier(node) && node.text === name) {
              return node;
            }
            return node.forEachChild(find);
          });
          if (node) {
            return this.host.getDefinitionAndBoundSpan(tcf!, node);
          }
        }
        if (isR3Node(last)) {
          const name = (last as any).name;
        }
      }

    } else {
      return getDefinitionAndBoundSpanForExternalTemplate();
    }
    return;
  }

  private analyze() {
    // This method plays the same role as `synchronizeHostData` in typescript.
  }
}
