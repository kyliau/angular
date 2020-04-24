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

describe('diagnostics', () => {
  const mockHost = new MockTypescriptHost([APP_COMPONENT]);
  const tsLS = ts.createLanguageService(mockHost);
  // const project = mockHost as never as ts.server.Project;
  // const project = new ts.server.ConfiguredProject(
  //   's',
  //   'b',
  //   'c',
  //   'd'
  // );
  const ngLS = new LanguageService(project, tsLS);

  fit('should report error for unexpected end of expression', () => {
    mockHost.override(TEST_TEMPLATE, `{{ 5 / }}`);
    const diags = ngLS.getSemanticDiagnostics(TEST_TEMPLATE);
    console.error(diags);
  });
});
