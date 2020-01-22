import * as ts from 'typescript';

export interface ModuleResolver {
  resolveModule(moduleName: string, containingFile: string): ts.SourceFile|null;
}
