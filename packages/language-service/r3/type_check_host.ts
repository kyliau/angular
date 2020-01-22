import {Reference, ReferenceEmitter} from '@angular/compiler-cli/src/ngtsc/imports';
import {ClassDeclaration, ReflectionHost} from '@angular/compiler-cli/src/ngtsc/reflection';
import {ExternalTypeCheckFile, InlineTypeCheckFile, R3TypeCheckHost, TypeCheckFile, TypeCheckingConfig} from '@angular/compiler-cli/src/ngtsc/typecheck'
import * as ts from 'typescript/lib/tsserverlibrary';

type ClassDeclRef = Reference<ClassDeclaration<ts.ClassDeclaration>>;

export function getShadowName(fileName: string): string {
  return fileName.replace(/(\.d)?(.ts$)/, '__shadow$1$2');
}

export function getTypeCheckFileName(fileName: string): string {
  return fileName.replace(/(\.d)?(.ts$)/, '__tcf$1$2');
}

export class TypeCheckHost implements R3TypeCheckHost {
  private readonly inlineRegistry = new Map<string, InlineTypeCheckFile>();
  private readonly externalRegistry = new Map<string, ExternalTypeCheckFile>();

  constructor(
      private readonly config: TypeCheckingConfig,
      private readonly refEmitter: ReferenceEmitter,
      private readonly reflector: ReflectionHost,
      private readonly project: ts.server.Project,
  ) {}

  getExternalTypeCheckFileFor(ref: ClassDeclRef): ExternalTypeCheckFile {
    const sourceFile = ref.node.getSourceFile();
    const typeCheckFileName = getTypeCheckFileName(sourceFile.fileName);
    let tcf = this.externalRegistry.get(typeCheckFileName);
    if (!tcf) {
      tcf = new ExternalTypeCheckFile(
          typeCheckFileName, this.config, this.refEmitter, this.reflector);
      this.externalRegistry.set(typeCheckFileName, tcf);
    }
    return tcf;
  }

  getInlineTypeCheckFileFor(ref: ClassDeclRef): InlineTypeCheckFile {
    const sourceFile = ref.node.getSourceFile();
    const shadowFileName = getShadowName(sourceFile.fileName);
    let tcf = this.inlineRegistry.get(shadowFileName);
    if (!tcf) {
      tcf = new InlineTypeCheckFile(shadowFileName, sourceFile);
    }
    return tcf;
  }

  getProgram(tcfs: TypeCheckFile[], program: ts.Program): ts.Program {
    if (tcfs.length === 0) {
      return program;
    }
    for (const tcf of tcfs) {
      const scriptInfo = this.getOrCreateScriptInfo(tcf.fileName, tcf.renderText());
      if (!this.project.containsScriptInfo(scriptInfo)) {
        this.project.addRoot(scriptInfo);
      }
    }
    const newProgram = this.project.getLanguageService().getProgram();
    if (newProgram === program) {
      throw new Error('Expected new program to be different from original program, but it is not!')
    }
    if (!newProgram) {
      throw new Error('Shadow program does not exist!');
    }
    for (const {fileName} of tcfs) {
      if (!newProgram.getSourceFile(fileName)) {
        throw new Error(`${fileName} is missing in the program`);
      }
    }
    return newProgram;
  }

  renderAll(): TypeCheckFile[] {
    return [
      ...this.inlineRegistry.values(),
      ...this.externalRegistry.values(),
    ];
  }

  private getOrCreateScriptInfo(fileName: string, content: string): ts.server.ScriptInfo {
    let scriptInfo = this.project.getScriptInfo(fileName);
    if (scriptInfo) {
      // Update existing script info
      const ss = scriptInfo.getSnapshot();
      scriptInfo.editContent(0, ss.getLength(), content);
      return scriptInfo;
    }
    const {projectService} = this.project;
    scriptInfo = projectService.getOrCreateScriptInfoForNormalizedPath(
        ts.server.toNormalizedPath(fileName),
        true, /* openedByClient */
        content,
        ts.ScriptKind.TS,
        false, /* hasMixedContent */
    );
    if (!scriptInfo) {
      throw new Error(`Failed to create new script info for ${fileName}`);
    }
    return scriptInfo;
  }
}
