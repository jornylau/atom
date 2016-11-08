'use strict'

const fs = require('fs')
const path = require('path')
const recast = require('recast')
const CONFIG = require('../config')

module.exports = function () {
  const filePath = path.join(CONFIG.intermediateAppPath, 'src', 'atom-environment.js')
  const fileContents = fs.readFileSync(filePath, 'utf8')
  const ast = recast.parse(fileContents)
  const programHasClosureWrapper =
    ast.program.body.length === 1 &&
    ast.program.body[0].type === 'ExpressionStatement' &&
    ast.program.body[0].expression.type === 'CallExpression' &&
    ast.program.body[0].expression.arguments[0].type === 'ThisExpression' &&
    ast.program.body[0].expression.callee.object.type === 'FunctionExpression'
  const b = recast.types.builders

  const variablesWithRequireAssignment = new Set()
  recast.types.visit(ast, {
    visitCallExpression: function (path) {
      const node = path.node
      if (node.callee.name === 'require' && node.arguments.length === 1 && node.arguments[0].type === 'Literal' && this.isTopLevelPath(path)) {
        if (node.arguments[0].value === 'grim') {
          console.log(path.parent.parent.node);
        }
        let parentPath = path.parent
        while (parentPath != null) {
          const parentNode = parentPath.node
          if (parentNode.type === 'AssignmentExpression') {
            variablesWithRequireAssignment.add(parentNode.left.name)
            parentPath.replace(b.functionDeclaration(b.identifier(`get_${parentNode.left.name}`), [], b.blockStatement([
              b.returnStatement(
                b.assignmentExpression('=', parentNode.left, b.logicalExpression('||', parentNode.left, node))
              )
            ])))
            break
          }
          parentPath = parentPath.parent
        }
      }
      this.traverse(path);
    },
    visitAssignmentExpression: function (path) {
      // const node = path.node
      // if (node.right.type === 'MemberExpression' && node.right.object.type === 'Identifier' && variablesWithRequireAssignment.has(node.right.object.name) && this.isTopLevelPath(path)) {
      //   console.log(`${node.left.name} = ${node.right.object.name}.${node.right.property.name}'`);
      // }
      this.traverse(path)
    },
    isTopLevelPath: function (path) {
      return path.scope.isGlobal || (programHasClosureWrapper && path.scope.depth === 1)
    }
  })

  // console.log(recast.print(ast).code);
}
