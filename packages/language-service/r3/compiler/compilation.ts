import {ComponentDecoratorHandler, DirectiveDecoratorHandler, InjectableDecoratorHandler, NgModuleDecoratorHandler, NoopReferencesRegistry, PipeDecoratorHandler} from '@angular/compiler-cli/src/ngtsc/annotations';
import {NgCompilerOptions} from '@angular/compiler-cli/src/ngtsc/core/api';
import {CycleAnalyzer, ImportGraph} from '@angular/compiler-cli/src/ngtsc/cycles';
import {ReferenceGraph} from '@angular/compiler-cli/src/ngtsc/entry_point';
import {AbsoluteModuleStrategy, AliasingHost, DefaultImportTracker, LocalIdentifierStrategy, PrivateExportAliasingHost, ReferenceEmitStrategy, ReferenceEmitter, RelativePathStrategy} from '@angular/compiler-cli/src/ngtsc/imports';
import {IncrementalDriver} from '@angular/compiler-cli/src/ngtsc/incremental';
import {CompoundMetadataReader, CompoundMetadataRegistry, DtsMetadataReader, InjectableClassRegistry, LocalMetadataRegistry, MetadataReader} from '@angular/compiler-cli/src/ngtsc/metadata';
import {ModuleWithProvidersScanner} from '@angular/compiler-cli/src/ngtsc/modulewithproviders';
import {PartialEvaluator} from '@angular/compiler-cli/src/ngtsc/partial_evaluator';
import {NOOP_PERF_RECORDER} from '@angular/compiler-cli/src/ngtsc/perf';
import {TypeScriptReflectionHost} from '@angular/compiler-cli/src/ngtsc/reflection/src/typescript';
import {HostResourceLoader} from '@angular/compiler-cli/src/ngtsc/resource';
import {NgModuleRouteAnalyzer} from '@angular/compiler-cli/src/ngtsc/routing';
import {ComponentScopeReader, LocalModuleScopeRegistry, MetadataDtsModuleScopeResolver} from '@angular/compiler-cli/src/ngtsc/scope';
import {DecoratorHandler, DtsTransformRegistry, TraitCompiler} from '@angular/compiler-cli/src/ngtsc/transform';
import {getRootDirs} from '@angular/compiler-cli/src/ngtsc/util/src/typescript';

import {ModuleResolver} from './module_resolver'

// import {LogicalFileSystem} from '@angular/compiler-cli/src/ngtsc/file_system';

export function makeCompilation(
    program: ts.Program, options: NgCompilerOptions, project: ts.server.Project,
    incrementalDriver: IncrementalDriver): LazyCompilationState {
  const checker = program.getTypeChecker();
  const closureCompilerEnabled = !!options.annotateForClosureCompiler;
  const reflector = new TypeScriptReflectionHost(checker);

  const moduleResolver = new ModuleResolver(project);
  const resourceManager = new HostResourceLoader(project, options);
  const cycleAnalyzer = new CycleAnalyzer(new ImportGraph(moduleResolver));

  // Construct the ReferenceEmitter.
  // No entrypoint is present and deep re-exports were requested, so configure the aliasing
  // system to generate them.
  const aliasingHost = new PrivateExportAliasingHost(reflector);

  let localImportStrategy: ReferenceEmitStrategy;
  // The strategy used for local, in-project imports depends on whether TS has been configured
  // with rootDirs. If so, then multiple directories may be mapped in the same "module
  // namespace" and the logic of `LogicalProjectStrategy` is required to generate correct
  // imports which may cross these multiple directories. Otherwise, plain relative imports are
  // sufficient.
  // if (options.rootDir !== undefined ||
  //     (options.rootDirs !== undefined && options.rootDirs.length > 0)) {
  //   // rootDirs logic is in effect - use the `LogicalProjectStrategy` for in-project relative
  //   // imports.
  //   const rootDirs = getRootDirs(program, options);
  //   localImportStrategy =
  //       new LogicalProjectStrategy(reflector, new LogicalFileSystem(rootDirs));
  // } else {
  // Plain relative imports are all that's needed.
  localImportStrategy = new RelativePathStrategy(reflector);
  // }

  // The CompilerHost doesn't have fileNameToModuleName, so build an NPM-centric reference
  // resolution strategy.
  const refEmitter = new ReferenceEmitter([
    // First, try to use local identifiers if available.
    new LocalIdentifierStrategy(),
    // Next, attempt to use an absolute import.
    new AbsoluteModuleStrategy(program, checker, moduleResolver, reflector),
    // Finally, check if the reference is being written into a file within the project's .ts
    // sources, and use a relative import if so. If this fails, ReferenceEmitter will throw
    // an error.
    localImportStrategy,
  ]);

  const evaluator = new PartialEvaluator(reflector, checker, incrementalDriver.depGraph);
  const dtsReader = new DtsMetadataReader(checker, reflector);
  const localMetaRegistry = new LocalMetadataRegistry();
  const localMetaReader: MetadataReader = localMetaRegistry;
  const depScopeReader = new MetadataDtsModuleScopeResolver(dtsReader, aliasingHost);
  const scopeRegistry =
      new LocalModuleScopeRegistry(localMetaReader, depScopeReader, refEmitter, aliasingHost);
  const scopeReader: ComponentScopeReader = scopeRegistry;
  const metaRegistry = new CompoundMetadataRegistry([localMetaRegistry, scopeRegistry]);
  const injectableRegistry = new InjectableClassRegistry(reflector);

  const metaReader = new CompoundMetadataReader([localMetaReader, dtsReader]);


  // If a flat module entrypoint was specified, then track references via a `ReferenceGraph` in
  // order to produce proper diagnostics for incorrectly exported directives/pipes/etc. If there
  // is no flat module entrypoint then don't pay the cost of tracking references.
  const referencesRegistry = new NoopReferencesRegistry();
  const exportReferenceGraph: ReferenceGraph|null = null;

  const routeAnalyzer = new NgModuleRouteAnalyzer(moduleResolver, evaluator);

  const dtsTransforms = new DtsTransformRegistry();

  const mwpScanner = new ModuleWithProvidersScanner(reflector, evaluator, refEmitter);

  const isCore = false;

  const defaultImportTracker = new DefaultImportTracker();

  // Set up the IvyCompilation, which manages state for the Ivy transformer.
  const handlers: DecoratorHandler<unknown, unknown, unknown>[] = [
    new ComponentDecoratorHandler(
        reflector, evaluator, metaRegistry, metaReader, scopeReader, scopeRegistry, isCore,
        resourceManager, getRootDirs(program, options), options.preserveWhitespaces || false,
        options.i18nUseExternalIds !== false, options.enableI18nLegacyMessageIdFormat !== false,
        moduleResolver, cycleAnalyzer, refEmitter, defaultImportTracker, incrementalDriver.depGraph,
        injectableRegistry, closureCompilerEnabled),
    // TODO(alxhub): understand why the cast here is necessary (something to do with `null`
    // not being assignable to `unknown` when wrapped in `Readonly`).
    // clang-format off
    new DirectiveDecoratorHandler(
        reflector, evaluator, metaRegistry, scopeRegistry, metaReader,
        defaultImportTracker, injectableRegistry, isCore, closureCompilerEnabled
    ) as Readonly<DecoratorHandler<unknown, unknown, unknown>>,
    // clang-format on
    // Pipe handler must be before injectable handler in list so pipe factories are printed
    // before injectable factories (so injectable factories can delegate to them)
    new PipeDecoratorHandler(
        reflector, evaluator, metaRegistry, scopeRegistry, defaultImportTracker, injectableRegistry,
        isCore),
    new InjectableDecoratorHandler(
        reflector, defaultImportTracker, isCore, options.strictInjectionParameters || false,
        injectableRegistry),
    new NgModuleDecoratorHandler(
        reflector, evaluator, metaReader, metaRegistry, scopeRegistry, referencesRegistry, isCore,
        routeAnalyzer, refEmitter, null /* factoryTracker */, defaultImportTracker,
        closureCompilerEnabled, injectableRegistry, options.i18nInLocale),
  ];

  const traitCompiler = new TraitCompiler(
      handlers, reflector, NOOP_PERF_RECORDER, incrementalDriver,
      options.compileNonExportedClasses !== false, dtsTransforms);

  return {
    isCore,
    traitCompiler,
    reflector,
    scopeRegistry,
    dtsTransforms,
    exportReferenceGraph,
    routeAnalyzer,
    mwpScanner,
    metaReader,
    defaultImportTracker,
    aliasingHost,
    refEmitter,
  };
}

/**
 * State information about a compilation which is only generated once some data is requested from
 * the `NgCompiler` (for example, by calling `getDiagnostics`).
 */
export interface LazyCompilationState {
  isCore: boolean;
  traitCompiler: TraitCompiler;
  reflector: TypeScriptReflectionHost;
  metaReader: MetadataReader;
  scopeRegistry: LocalModuleScopeRegistry;
  exportReferenceGraph: ReferenceGraph|null;
  routeAnalyzer: NgModuleRouteAnalyzer;
  dtsTransforms: DtsTransformRegistry;
  mwpScanner: ModuleWithProvidersScanner;
  defaultImportTracker: DefaultImportTracker;
  aliasingHost: AliasingHost|null;
  refEmitter: ReferenceEmitter;
}
