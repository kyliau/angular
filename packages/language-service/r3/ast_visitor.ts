import {AbsoluteSourceSpan, AST, ParseSourceSpan, RecursiveAstVisitor} from '@angular/compiler';
import * as r3 from '@angular/compiler/src/render3/r3_ast';

export class R3Visitor implements r3.Visitor {
  readonly path: Array<r3.Node|AST> = [];

  constructor(private readonly position: number) {
    console.error('position =', position);
  }

  visit(node: r3.Node) {
    const {start, end} = spanOf(node);
    if (start <= this.position && this.position <= end) {
      console
          .error(`Visiting ${node.constructor.name}, name = ${(node as any).name}, start = ${
              start}, end = ${end}`);
              this.path.push(node);
      node.visit(this);
    } else {
      console.error(`Not visiting ${node.constructor.name}, name = ${(node as any).name}, start = ${
          start}, end = ${end}`)
    }
  }

  visitElement(element: r3.Element) {
    this.visitAll(element.attributes);
    this.visitAll(element.inputs);
    this.visitAll(element.outputs);
    this.visitAll(element.children);
    this.visitAll(element.references);
  }
  visitTemplate(template: r3.Template) {
    this.visitAll(template.attributes);
    this.visitAll(template.inputs);
    this.visitAll(template.outputs);
    this.visitAll(template.templateAttrs);
    this.visitAll(template.children);
    this.visitAll(template.references);
    this.visitAll(template.variables);
  }
  visitContent(content: r3.Content) {
    // content.attributes is of type TextAttribute which has no expressions
    // r3.visitAll(this, content.attributes);
  }
  visitVariable(variable: r3.Variable) {
    // Variable has no expressions
  }
  visitReference(reference: r3.Reference) {
    // Reference has no expressions
  }
  visitTextAttribute(attribute: r3.TextAttribute) {
    // Text attribute has no expressions
  }
  visitBoundAttribute(attribute: r3.BoundAttribute) {
    const visitor = new ExpressionVisitor(this.position);
    visitor.visit(attribute.value, this.path);
  }
  visitBoundEvent(attribute: r3.BoundEvent) {
    const visitor = new ExpressionVisitor(this.position);
    visitor.visit(attribute.handler, this.path);
  }
  visitText(text: r3.Text) {
    // Text has no expressions
  }
  visitBoundText(text: r3.BoundText) {
    const visitor = new ExpressionVisitor(this.position);
    visitor.visit(text.value, this.path);
  }
  visitIcu(icu: r3.Icu) {
    for (const boundText of Object.values(icu.vars)) {
      this.visit(boundText);
    }
    for (const boundTextOrText of Object.values(icu.placeholders)) {
      this.visit(boundTextOrText);
    }
  }
  visitAll(nodes: r3.Node[]) {
    for (const node of nodes) {
      this.visit(node);
    }
  }
}

export class ExpressionVisitor extends RecursiveAstVisitor {
  constructor(private readonly position: number) {
    super();
  }

  visit(node: AST, path: Array<r3.Node|AST>) {
    const {start, end} = node.sourceSpan;
    if (start <= this.position && this.position <= end) {
      console.error(`Visiting ${node.constructor.name}, name = ${(node as any).name}, start = ${
          start}, end = ${end}`)
      path.push(node);
      node.visit(this, path);
    } else {
      console.error(`Not visting ${node.constructor.name}, name = ${(node as any).name}, start = ${
          start}, end = ${end}`)
    }
  }
}

export function isR3Node(node: r3.Node|AST): node is r3.Node {
  return node.sourceSpan instanceof ParseSourceSpan;
}

export function isExpressionNode(node: r3.Node|AST): node is AST {
  return node.sourceSpan instanceof AbsoluteSourceSpan;
}

function spanOf(ast: r3.Node) {
  const result = {
    start: ast.sourceSpan.start.offset,
    end: ast.sourceSpan.end.offset,
  };
  if (ast instanceof r3.Element && ast.endSourceSpan) {
    result.end = ast.endSourceSpan.end.offset;
  }
  return result;
}
