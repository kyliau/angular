import * as ts from 'typescript/lib/tsserverlibrary';

export class LanguageServiceHost implements ts.CompilerHost {
  readonly realpath?: (path: string) => string;

  constructor(
      private readonly project: ts.server.Project,
      private readonly languageService: ts.LanguageService) {
    if (project.realpath) {
      // Resolve a symbolic link.
      // see https://nodejs.org/api/fs.html#fs_fs_realpathsync_path_options
      this.realpath = project.realpath;
    }
  }

  fileExists(fileName: string): boolean {
    return this.project.fileExists(fileName);
  }

  readFile(fileName: string): string|undefined {
    return this.project.readFile(fileName);
  }

  trace(s: string): void {
    return this.project.trace?.(s);
  }

  directoryExists(directoryName: string): boolean {
    return this.project.directoryExists(directoryName);
  }

  getDirectories(path: string): string[] {
    return this.project.getDirectories(path);
  }

  getSourceFile(
      fileName: string, languageVersion: ts.ScriptTarget, onError?: (message: string) => void,
      shouldCreateNewSourceFile?: boolean): ts.SourceFile|undefined {
    const path = this.project.projectService.toPath(fileName);
    return this.project.getSourceFile(path);
  }

  getSourceFileByPath(
      fileName: string, path: ts.Path, languageVersion: ts.ScriptTarget,
      onError?: (message: string) => void, shouldCreateNewSourceFile?: boolean): ts.SourceFile
      |undefined {
    return this.project.getSourceFile(path);
  }

  // getCancellationToken?(): ts.CancellationToken {
  //   return this.project.getCancellationToken();
  // }

  getDefaultLibFileName(options: ts.CompilerOptions): string {
    return this.project.getDefaultLibFileName();
  }

  // getDefaultLibLocation(): string {
  // }

  writeFile(
      fileName: string, data: string, writeByteOrderMark: boolean,
      onError?: (message: string) => void, sourceFiles?: readonly ts.SourceFile[]) {
    this.project.writeFile(fileName, data);
  }

  getCurrentDirectory(): string {
    return this.project.getCurrentDirectory();
  }

  getCanonicalFileName(fileName: string): string {
    return this.project.projectService.toCanonicalFileName(fileName);
  }

  useCaseSensitiveFileNames(): boolean {
    return this.project.useCaseSensitiveFileNames();
  }

  getNewLine(): string {
    return this.project.getNewLine();
  }

  readDirectory(
      rootDir: string, extensions: readonly string[], excludes: readonly string[]|undefined,
      includes: readonly string[], depth?: number): string[] {
    return this.project.readDirectory(rootDir, extensions, excludes, includes, depth);
  }

  resolveModuleNames?
      (moduleNames: string[], containingFile: string, reusedNames: string[]|undefined,
       redirectedReference: ts.ResolvedProjectReference|undefined,
       options: ts.CompilerOptions): (ts.ResolvedModule|undefined)[] {
    return this.project.resolveModuleNames(
        moduleNames, containingFile, reusedNames, redirectedReference);
  }

  /**
   * This method is a companion for 'resolveModuleNames' and is used to resolve 'types' references
   * to actual type declaration files
   */
  resolveTypeReferenceDirectives?
      (typeReferenceDirectiveNames: string[], containingFile: string,
       redirectedReference: ts.ResolvedProjectReference|undefined,
       options: ts.CompilerOptions): (ts.ResolvedTypeReferenceDirective|undefined)[] {
    return this.project.resolveTypeReferenceDirectives(
        typeReferenceDirectiveNames, containingFile, redirectedReference);
  }

  // getEnvironmentVariable?(name: string): string | undefined {
  // }

  // createHash?(data: string): string {
  // }

  // getParsedCommandLine?(fileName: string): ParsedCommandLine | undefined {
  // }
}
