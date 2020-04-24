import {NgCompilerOptions} from '@angular/compiler-cli/src/ngtsc/core/api';
import {TypeCheckingConfig} from '@angular/compiler-cli/src/ngtsc/typecheck';

export function getTypeCheckConfig(options: Readonly<NgCompilerOptions>) {
  // Determine the strictness level of type checking based on compiler options. As
  // `strictTemplates` is a superset of `fullTemplateTypeCheck`, the former implies the latter.
  // Also see `verifyCompatibleTypeCheckOptions` where it is verified that `fullTemplateTypeCheck`
  // is not disabled when `strictTemplates` is enabled.
  const strictTemplates = !!options.strictTemplates;
  const fullTemplateTypeCheck = strictTemplates || !!options.fullTemplateTypeCheck;
  const typeCheckingConfig: TypeCheckingConfig = fullTemplateTypeCheck ?
      {
        applyTemplateContextGuards: strictTemplates,
        checkQueries: false,
        checkTemplateBodies: true,
        checkTypeOfInputBindings: strictTemplates,
        strictNullInputBindings: strictTemplates,
        checkTypeOfAttributes: strictTemplates,
        // Even in full template type-checking mode, DOM binding checks are not quite ready yet.
        checkTypeOfDomBindings: false,
        checkTypeOfOutputEvents: strictTemplates,
        checkTypeOfAnimationEvents: strictTemplates,
        // Checking of DOM events currently has an adverse effect on developer experience,
        // e.g. for `<input (blur)="update($event.target.value)">` enabling this check results in:
        // - error TS2531: Object is possibly 'null'.
        // - error TS2339: Property 'value' does not exist on type 'EventTarget'.
        checkTypeOfDomEvents: strictTemplates,
        checkTypeOfDomReferences: strictTemplates,
        // Non-DOM references have the correct type in View Engine so there is no strictness flag.
        checkTypeOfNonDomReferences: true,
        // Pipes are checked in View Engine so there is no strictness flag.
        checkTypeOfPipes: true,
        strictSafeNavigationTypes: strictTemplates,
        useContextGenericType: strictTemplates,
        strictLiteralTypes: true,
      } :
      {
        applyTemplateContextGuards: false,
        checkQueries: false,
        checkTemplateBodies: false,
        checkTypeOfInputBindings: false,
        strictNullInputBindings: false,
        checkTypeOfAttributes: false,
        checkTypeOfDomBindings: false,
        checkTypeOfOutputEvents: false,
        checkTypeOfAnimationEvents: false,
        checkTypeOfDomEvents: false,
        checkTypeOfDomReferences: false,
        checkTypeOfNonDomReferences: false,
        checkTypeOfPipes: false,
        strictSafeNavigationTypes: false,
        useContextGenericType: false,
        strictLiteralTypes: false,
      };


  // Apply explicitly configured strictness flags on top of the default configuration
  // based on "fullTemplateTypeCheck".
  if (options.strictInputTypes !== undefined) {
    typeCheckingConfig.checkTypeOfInputBindings = options.strictInputTypes;
    typeCheckingConfig.applyTemplateContextGuards = options.strictInputTypes;
  }
  if (options.strictNullInputTypes !== undefined) {
    typeCheckingConfig.strictNullInputBindings = options.strictNullInputTypes;
  }
  if (options.strictOutputEventTypes !== undefined) {
    typeCheckingConfig.checkTypeOfOutputEvents = options.strictOutputEventTypes;
    typeCheckingConfig.checkTypeOfAnimationEvents = options.strictOutputEventTypes;
  }
  if (options.strictDomEventTypes !== undefined) {
    typeCheckingConfig.checkTypeOfDomEvents = options.strictDomEventTypes;
  }
  if (options.strictSafeNavigationTypes !== undefined) {
    typeCheckingConfig.strictSafeNavigationTypes = options.strictSafeNavigationTypes;
  }
  if (options.strictDomLocalRefTypes !== undefined) {
    typeCheckingConfig.checkTypeOfDomReferences = options.strictDomLocalRefTypes;
  }
  if (options.strictAttributeTypes !== undefined) {
    typeCheckingConfig.checkTypeOfAttributes = options.strictAttributeTypes;
  }
  if (options.strictContextGenerics !== undefined) {
    typeCheckingConfig.useContextGenericType = options.strictContextGenerics;
  }
  if (options.strictLiteralTypes !== undefined) {
    typeCheckingConfig.strictLiteralTypes = options.strictLiteralTypes;
  }
  return typeCheckingConfig;
}
