import * as ts from 'typescript';

import {Reference} from '../../imports';
import {ClassDeclaration} from '../../reflection';

import {TypeCheckProgramHost} from './host';
import {ExternalTypeCheckFile, InlineTypeCheckFile, TypeCheckFile} from './type_check_file';

type ClassDeclRef = Reference<ClassDeclaration<ts.ClassDeclaration>>;

export interface R3TypeCheckHost {
  getExternalTypeCheckFileFor(ref: ClassDeclRef): ExternalTypeCheckFile;
  getInlineTypeCheckFileFor(ref: ClassDeclRef): InlineTypeCheckFile;
  getProgram(tcfs: TypeCheckFile[], program: ts.Program): ts.Program;
  renderAll(): TypeCheckFile[];
}

export class TypeCheckHost implements R3TypeCheckHost {
  private readonly inlineRegistry = new Map<string, InlineTypeCheckFile>();

  constructor(
      private readonly typeCheckFile: ExternalTypeCheckFile,
      private readonly tsHost: ts.CompilerHost,
  ) {}

  getExternalTypeCheckFileFor(ref: Reference<ClassDeclaration<ts.ClassDeclaration>>):
      ExternalTypeCheckFile {
    return this.typeCheckFile;
  }

  getInlineTypeCheckFileFor(ref: Reference<ClassDeclaration<ts.ClassDeclaration>>):
      InlineTypeCheckFile {
    const sourceFile = ref.node.getSourceFile();
    const {fileName} = sourceFile;
    let tcf = this.inlineRegistry.get(fileName);
    if (!tcf) {
      tcf = new InlineTypeCheckFile(fileName, sourceFile);
      this.inlineRegistry.set(fileName, tcf);
    }
    return tcf;
  }

  getProgram(modifiedFiles: TypeCheckFile[], program: ts.Program): ts.Program {
    const sfMap = new Map(modifiedFiles.map((tcf) => {
      const sourceFile = ts.createSourceFile(
          tcf.fileName, tcf.renderText(), ts.ScriptTarget.Latest, true /* setParentNodes */,
          ts.ScriptKind.TS);
      return [tcf.fileName, sourceFile];
    }));
    return ts.createProgram({
      host: new TypeCheckProgramHost(sfMap, this.tsHost),
      options: program.getCompilerOptions(),
      oldProgram: program,
      rootNames: program.getRootFileNames(),
    });
  }

  renderAll() {
    return [
      this.typeCheckFile,
      ...this.inlineRegistry.values(),
    ];
  }
}
