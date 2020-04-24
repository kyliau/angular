import {getParseErrors, isSyntaxError, ParseError, ParseErrorLevel} from '@angular/compiler';
import {Reference} from '@angular/compiler-cli/src/ngtsc/imports';
import {IncrementalDriver} from '@angular/compiler-cli/src/ngtsc/incremental';
import {ClassRecord} from '@angular/compiler-cli/src/ngtsc/transform';
import {isTemplateDiagnostic, TypeCheckContext} from '@angular/compiler-cli/src/ngtsc/typecheck';
import * as ts from 'typescript/lib/tsserverlibrary';

import {LazyCompilationState, makeCompilation} from './compilation';
import {getTypeCheckConfig} from './type_check_config';
import {getTypeCheckFileName, TypeCheckHost} from './type_check_host';
import { NgCompilerOptions } from '@angular/compiler-cli/src/ngtsc/core/api';
import { PerfRecorder, NOOP_PERF_RECORDER } from '@angular/compiler-cli/src/ngtsc/perf';

export class Compiler {
  private diagnostics: ts.Diagnostic[] = [];
  private incrementalDriver: IncrementalDriver;
  private compilation: LazyCompilationState;
  private readonly perfRecorder: PerfRecorder = NOOP_PERF_RECORDER;

  constructor(
      private readonly project: ts.server.Project,
      private program: ts.Program,
      private readonly options: NgCompilerOptions
  ) {
    this.incrementalDriver = IncrementalDriver.fresh(program);
    this.compilation = makeCompilation(program, options, project, this.incrementalDriver);
  }

  // getClassRecord(compilation: LazyCompilationState, clazz: ts.ClassDeclaration): ClassRecord|null {
  //   const {reflector, traitCompiler} = compilation;
  //   if (!reflector.isClass(clazz)) {
  //     return null;
  //   }
  //   return traitCompiler.recordFor(clazz);
  // }

  // getTcf(clazz: ts.ClassDeclaration): ts.SourceFile|undefined {
  //   const fileName = clazz.getSourceFile().fileName;
  //   const tcf = getTypeCheckFileName(fileName);
  //   return this.program.getSourceFile(tcf);
  // }

  analyze(newProgram: ts.Program): ts.Program|undefined {
    this.diagnostics = [];
    const oldProgram = this.program;
    const oldDriver = this.incrementalDriver;
    const modifiedResourceFiles = null;
    this.incrementalDriver = IncrementalDriver.reconcile(
        oldProgram, oldDriver, newProgram, modifiedResourceFiles);

    const analyzeSpan = this.perfRecorder.start('analyze');
    this.compilation =
        makeCompilation(this.program, this.options, this.project, this.incrementalDriver);
    const {traitCompiler} = this.compilation;

    for (const sf of this.program.getSourceFiles()) {
      console.error(sf.fileName)
      const analyzeFileSpan = this.perfRecorder.start('analyzeFile', sf);
      try {
        traitCompiler.analyzeSync(sf);
      } catch (e) {
        console.error(e)
        if (isSyntaxError(e)) {
          const parseErrors = getParseErrors(e);
          this.diagnostics = parseErrors.map(parseErrorToTsDiagnostic);
          console.error(this.diagnostics);
        }
        return;
      }
      // this.scanForMwp(sf);
      this.perfRecorder.stop(analyzeFileSpan);
    }
    this.perfRecorder.stop(analyzeSpan);
    console.error('try to resolve trait compiler')
    try {
      traitCompiler.resolve();
    } catch (e) {
      console.error(e.message);
      return;
    }

    this.recordNgModuleScopeDependencies();

    // At this point, analysis is complete and the compiler can now calculate which files need to
    // be emitted, so do that.
    this.incrementalDriver.recordSuccessfulAnalysis(traitCompiler);

    // HACK: Update the typecheck files and set new program with updated tcfs
    this.getTemplateDiagnostics();

    return this.program;
  }

  private recordNgModuleScopeDependencies() {
    const recordSpan = this.perfRecorder.start('recordDependencies');
    const depGraph = this.incrementalDriver.depGraph;
    const {scopeRegistry, metaReader} = this.compilation;
    for (const scope of scopeRegistry.getCompilationScopes()) {
      const file = scope.declaration.getSourceFile();
      const ngModuleFile = scope.ngModule.getSourceFile();

      // A change to any dependency of the declaration causes the declaration to be invalidated,
      // which requires the NgModule to be invalidated as well.
      depGraph.addTransitiveDependency(ngModuleFile, file);

      // A change to the NgModule file should cause the declaration itself to be invalidated.
      depGraph.addDependency(file, ngModuleFile);

      const meta = metaReader.getDirectiveMetadata(new Reference(scope.declaration));
      if (meta !== null && meta.isComponent) {
        // If a component's template changes, it might have affected the import graph, and thus the
        // remote scoping feature which is activated in the event of potential import cycles. Thus,
        // the module depends not only on the transitive dependencies of the component, but on its
        // resources as well.
        depGraph.addTransitiveResources(ngModuleFile, file);

        // A change to any directive/pipe in the compilation scope should cause the component to be
        // invalidated.
        for (const directive of scope.directives) {
          // When a directive in scope is updated, the component needs to be recompiled as e.g. a
          // selector may have changed.
          depGraph.addTransitiveDependency(file, directive.ref.node.getSourceFile());
        }
        for (const pipe of scope.pipes) {
          // When a pipe in scope is updated, the component needs to be recompiled as e.g. the
          // pipe's name may have changed.
          depGraph.addTransitiveDependency(file, pipe.ref.node.getSourceFile());
        }
      }
    }
    this.perfRecorder.stop(recordSpan);
  }

  private getTemplateDiagnostics(): ReadonlyArray<ts.Diagnostic> {
    // Determine the strictness level of type checking based on compiler options. As
    // `strictTemplates` is a superset of `fullTemplateTypeCheck`, the former implies the latter.
    // Also see `verifyCompatibleTypeCheckOptions` where it is verified that `fullTemplateTypeCheck`
    // is not disabled when `strictTemplates` is enabled.
    const strictTemplates = !!this.options.strictTemplates;
    const fullTemplateTypeCheck = strictTemplates || !!this.options.fullTemplateTypeCheck;

    // Skip template type-checking if it's disabled.
    if (this.options.ivyTemplateTypeCheck === false && !fullTemplateTypeCheck) {
      return [];
    }

    // Run template type-checking.
    // First select a type-checking configuration, based on whether full template type-checking is
    // requested.
    const typeCheckConfig = getTypeCheckConfig(this.options);

    // Execute the typeCheck phase of each decorator in the program.
    const prepSpan = this.perfRecorder.start('typeCheckPrep');
    const {refEmitter, reflector, traitCompiler} = this.compilation;
    const host = new TypeCheckHost(
        typeCheckConfig, refEmitter, reflector, this.project);
    const ctx =
        new TypeCheckContext(typeCheckConfig, refEmitter, reflector, host);

    // TODO: We are currently typechecking the entire program. Make it possible
    // to typecheck a particular component / template only.
    traitCompiler.typeCheck(ctx);
    this.perfRecorder.stop(prepSpan);

    // Get the diagnostics.
    const typeCheckSpan = this.perfRecorder.start('typeCheckDiagnostics');
    const {diagnostics, program} = ctx.calculateTemplateDiagnostics(this.program);
    this.program = program;
    this.perfRecorder.stop(typeCheckSpan);

    // We don't have to do this because we have both the old and new program
    // setIncrementalDriver(program, this.incrementalDriver);

    return diagnostics;
  }

  /**
   * Get all Angular-related diagnostics for this compilation.
   *
   * If a `ts.SourceFile` is passed, only diagnostics related to that file are returned.
   */
  getDiagnostics(file?: ts.SourceFile): ts.Diagnostic[] {
    if (this.diagnostics.length) {
      return this.diagnostics;
    }
    const {traitCompiler} = this.compilation;
    const diagnostics =
        [...traitCompiler.diagnostics, ...this.getTemplateDiagnostics()];

    if (file === undefined) {
      return diagnostics;
    } else {
      return diagnostics.filter(diag => {
        if (diag.file === file) {
          return true;
        } else if (isTemplateDiagnostic(diag) && diag.componentFile === file) {
          // Template diagnostics are reported when diagnostics for the component file are
          // requested (since no consumer of `getDiagnostics` would ever ask for diagnostics from
          // the fake ts.SourceFile for templates).
          return true;
        } else {
          return false;
        }
      });
    }
  }
}

function parseErrorToTsDiagnostic(error: ParseError): ts.Diagnostic {
  return {
    category: error.level === ParseErrorLevel.ERROR ? ts.DiagnosticCategory.Error :
                                                      ts.DiagnosticCategory.Warning,
    code: 0,
    file: undefined,
    start: error.span.start.offset,
    length: error.span.end.offset - error.span.start.offset,
    messageText: error.contextualMessage(),
  };
}
