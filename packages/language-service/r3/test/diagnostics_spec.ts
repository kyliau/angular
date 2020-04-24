/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {MockTypescriptHost} from '../../test/test_utils';
import { LanguageService } from '../language_service';
import * as ts from 'typescript/lib/tsserverlibrary';

const APP_COMPONENT = '/app/app.component.ts';
const PARSING_CASES = '/app/parsing-cases.ts';
const TEST_TEMPLATE = '/app/test.ng'

const logger: ts.server.Logger = {
  close(): void {},
  hasLevel(level: ts.server.LogLevel): boolean { return true; },
  loggingEnabled(): boolean { return false; },
  perftrc(s: string): void {},
  info(s: string): void {},
  startGroup(): void {},
  endGroup(): void {},
  msg(s: string, type?: ts.server.Msg): void {},
  getLogFileName(): string | undefined { return; },
};

describe('diagnostics', () => {
  // const mockHost = new MockTypescriptHost([APP_COMPONENT]);
  // const tsLS = ts.createLanguageService(mockHost);
  // const project = mockHost as never as ts.server.Project;
  const ps = new ts.server.ProjectService({
    host: ts.sys,
    logger: logger,
    cancellationToken: ts.server.nullCancellationToken,
    useSingleInferredProject: true,
    useInferredProjectPerProjectRoot: true,
    typingsInstaller: ts.server.nullTypingsInstaller,
  } as any);
  const runfiles = require("");

  const configPath = ts.server.toNormalizedPath(
    runfiles.resolveWorkspaceRelative('packages/language-service/test/project/tsconfig.json'));
  const project: ts.server.ConfiguredProject = (ps as any).createAndLoadConfiguredProject(configPath);
  const tsLS = project.getLanguageService();
  const ngLS = new LanguageService(project, tsLS);

  fit('should report error for unexpected end of expression', () => {
    // mockHost.override(TEST_TEMPLATE, `{{ 5 / }}`);
    const diags = ngLS.getSemanticDiagnostics(APP_COMPONENT);
    console.error(diags);
  });
});
