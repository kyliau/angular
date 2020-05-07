/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as ts from 'typescript/lib/tsserverlibrary';

import {LanguageService} from '../language_service';

import {APP_COMPONENT, setup, PARSING_CASES} from './mock_host';

describe('quick info', () => {
  const {project, service, tsLS} = setup();
  const ngLS = new LanguageService(project, tsLS);

  beforeEach(() => {
    service.reset();
  });

  it('should not produce error for AppComponent', () => {
    const content = service.overwriteInlineTemplate(APP_COMPONENT, `{{ ti¦tle }}`);
    const position = service.getCursor(APP_COMPONENT);
    const quickInfo = ngLS.getQuickInfoAtPosition(APP_COMPONENT, position);
    expect(quickInfo).toBeDefined();
    const {start, length} = quickInfo!.textSpan;
    expect(toText(quickInfo)).toBe(`(property) AppComponent.title: string`);
    expect(content.substring(start, start + length)).toBe('title');
  });

  fit('sds', () => {
    const content = project.readFile(PARSING_CASES)!;
    const cursor = content.indexOf(`{{name}}`) + 2;
    const quickInfo = ngLS.getQuickInfoAtPosition(PARSING_CASES, cursor);
  });
});

function toText(quickInfo?: ts.QuickInfo): string {
  expect(quickInfo?.displayParts).toBeDefined();
  return quickInfo?.displayParts!.map(dp => dp.text).join('');
}
