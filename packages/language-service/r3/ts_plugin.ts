/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as ts from 'typescript/lib/tsserverlibrary';
import {LanguageService} from './language_service'

export function create(info: ts.server.PluginCreateInfo): ts.LanguageService {
  const {project, languageService: tsLS, config} = info;
  // This plugin could operate under two different modes:
  // 1. TS + Angular
  //    Plugin augments TS language service to provide additional Angular
  //    information. This only works with inline templates and is meant to be
  //    used as a local plugin (configured via tsconfig.json)
  // 2. Angular only
  //    Plugin only provides information on Angular templates, no TS info at all.
  //    This effectively disables native TS features and is meant for internal
  //    use only.
  const angularOnly = config?.angularOnly === true;
  const ngLS = new LanguageService(project, tsLS);

  function getSemanticDiagnostics(fileName: string): ts.Diagnostic[] {
    const results: ts.Diagnostic[] = [];
    if (!angularOnly) {
      results.push(...tsLS.getSemanticDiagnostics(fileName));
    }
    // For semantic diagnostics we need to combine both TS + Angular results
    results.push(...ngLS.getSemanticDiagnostics(fileName));
    return results;
  }

  // function getDefinitionAndBoundSpan(
  //     fileName: string, position: number): ts.DefinitionInfoAndBoundSpan|undefined {
  //   if (!angularOnly) {
  //     const result = tsLS.getDefinitionAndBoundSpan(fileName, position);
  //     if (result) {
  //       // If TS could answer the query, then return results immediately.
  //       return result;
  //     }
  //   }
  //   return ngLS.getDefinitionAndBoundSpan(fileName, position);
  // }

  return {
    ...tsLS,
    getSemanticDiagnostics,
    // getDefinitionAndBoundSpan,
  };
}
