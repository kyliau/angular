/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as api from '@angular/compiler-cli/src/ngtsc/imports/api';
import * as tss from 'typescript/lib/tsserverlibrary';


/**
 * Used by `RouterEntryPointManager` and `NgModuleRouteAnalyzer` (which is in turn is used by
 * `NgModuleDecoratorHandler`) for resolving the module source-files references in lazy-loaded
 * routes (relative to the source-file containing the `NgModule` that provides the route
 * definitions).
 */
export class ModuleResolver implements api.ModuleResolver {
  private readonly moduleResolutionCache: tss.ModuleResolutionCache;

  constructor(private readonly project: tss.server.Project) {
    this.moduleResolutionCache = tss.createModuleResolutionCache(
        project.getCurrentDirectory(),
        project.projectService.toCanonicalFileName,
        project.getCompilationSettings(),
    );
  }

  resolveModule(moduleName: string, containingFile: string): tss.SourceFile|null {
    // TODO: How is this different from calling project.resolveModuleNames?
    // project.resolveModuleNames resolve **only** from the cache.
    const {resolvedModule} = tss.resolveModuleName(
        moduleName, containingFile, this.project.getCompilationSettings(), this.project,
        this.moduleResolutionCache);
    if (!resolvedModule) {
      return null;
    }
    const resolvedPath = this.project.projectService.toPath(resolvedModule.resolvedFileName);
    return this.project.getSourceFile(resolvedPath) || null;
  }
}
