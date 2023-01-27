const visitedNodes = new Set();
let mainProgram = null;
const computedPropsNames = new Set();
const array = new Set();
let useUnmountLifeSycle = false;
let setupStatementsDone = false;

module.exports = function (babel) {
  const { types: t } = babel;

  const removeDefaultExport = {
    ExportDefaultDeclaration(path) {
      path.remove();
    },
  };
  const addVueImports = (path, t) => {
    const importSpecifiers = [];

    if (useUnmountLifeSycle) {
      const onUnmountedImportIdentifier = t.identifier("onUnmounted");
      const onUnmountedImportSpecifier = t.importSpecifier(
        onUnmountedImportIdentifier,
        onUnmountedImportIdentifier
      );
      importSpecifiers.push(onUnmountedImportSpecifier);
    }

    if (array.size > 0) {
      const refImportIdentifier = t.identifier("ref");
      const refImportSpecifier = t.importSpecifier(
        refImportIdentifier,
        refImportIdentifier
      );
      importSpecifiers.push(refImportSpecifier);
    }

    const watchImportIdentifier = t.identifier("watch");
    const watchImportSpecifier = t.importSpecifier(
      watchImportIdentifier,
      watchImportIdentifier
    );

    const reactiveImportIdentifier = t.identifier("reactive");
    const reactiveImportSpecifier = t.importSpecifier(
      reactiveImportIdentifier,
      reactiveImportIdentifier
    );

    if (computedPropsNames.size > 0) {
      const computedImportIdentifier = t.identifier("computed");
      const computedImportSpecifier = t.importSpecifier(
        computedImportIdentifier,
        computedImportIdentifier
      );
      importSpecifiers.push(computedImportSpecifier);
    }

    importSpecifiers.push(reactiveImportSpecifier, watchImportSpecifier);

    path.node.body.unshift(
      t.importDeclaration(importSpecifiers, t.stringLiteral("vue"))
    );
  };
  const pullLifeSycles = {
    ObjectMethod(path) {
      if (path.node.key.name === "created") {
        path.node.body.body.forEach((statement) =>
          mainProgram.node.body.push(statement)
        );
      } else if (path.node.key.name === "unmounted") {
        useUnmountLifeSycle = true;
        const identifier = t.identifier("onUnmounted");
        const arrowFuncExpression = t.arrowFunctionExpression(
          [],
          path.node.body,
          path.node.async
        );
        const call = t.callExpression(identifier, [arrowFuncExpression]);
        mainProgram.node.body.push(call);
      }
    },
  };

  const pullStatementsInsideSetup = {
    ObjectMethod(path) {
      if (path.node.key.name !== "setup" || setupStatementsDone) return;
      // remove the return statement (it's the last item in array)
      const allStatements = path.node.body.body;
      const allStatementsExeptReturnStatement = allStatements.slice(0, -1);
      allStatementsExeptReturnStatement.forEach((statement) =>
        mainProgram.node.body.push(statement)
      );
      setupStatementsDone = true;
    },
  };

  const pullPropsInsideWatch = {
    ObjectProperty(path) {
      if (path.node.key.name !== "watch") return;
      const propsInsideWatch = path.node.value.properties;
      propsInsideWatch.forEach((prop) => {
        const toBeWatched = array.has(prop.key.value)
          ? t.identifier(prop.key.value || prop.key.name)
          : t.arrowFunctionExpression(
              [],
              t.identifier(prop.key.value || prop.key.name)
            );

        const newNode = t.callExpression(t.identifier("watch"), [
          toBeWatched,
          t.arrowFunctionExpression(prop.params, prop.body, prop.aysc),
        ]);
        mainProgram.node.body.push(newNode);
      });
    },
  };

  const countComputedProps = {
    ObjectProperty(path) {
      if (path.node.key.name !== "computed" || computedPropsNames.length > 0)
        return;
      const propsNamesInsideComputedProperty = path.node.value.properties.map(
        (prop) => prop.key.name
      );
      propsNamesInsideComputedProperty.forEach((name) =>
        computedPropsNames.add(name)
      );
    },
  };

  const removeThisKeyWordAndAddValueNotation = {
    ThisExpression(path) {
      // this expression represents the this and the property together
      const thisExpression = path.findParent((subPath) =>
        t.isMemberExpression(subPath)
      );
      if (
        array.has(thisExpression.node.property.name) ||
        computedPropsNames.has(thisExpression.node.property.name)
      ) {
        // add .value to the variables created with ref()
        const propWithDotValueAdded = t.memberExpression(
          thisExpression.node.property,
          t.identifier("value")
        );
        thisExpression.replaceWith(propWithDotValueAdded);
      } else {
        thisExpression.replaceWith(thisExpression.node.property);
      }
    },
  };

  const pullPropsInsideMethods = {
    ObjectProperty(path) {
      if (path.node.key.name !== "methods") return;
      const propsInsideMethods = path.node.value.properties;
      propsInsideMethods.forEach((methodPath) => {
        const newNode = t.variableDeclaration("const", [
          t.variableDeclarator(
            t.identifier(methodPath.key.name),
            t.arrowFunctionExpression(
              methodPath.params,
              methodPath.body,
              methodPath.async
            )
          ),
        ]);
        mainProgram.node.body.push(newNode);
      });
    },
  };

  const pullPropsInsideComputed = {
    ObjectProperty(path) {
      if (path.node.key.name !== "computed") return;
      const propsInsideComputed = path.node.value.properties;
      propsInsideComputed.forEach((computedProp) => {
        const newNode = t.variableDeclaration("const", [
          t.variableDeclarator(
            t.identifier(computedProp.key.name),
            t.callExpression(t.identifier("computed"), [
              t.arrowFunctionExpression(
                computedProp.params,
                computedProp.body,
                computedProp.async
              ),
            ])
          ),
        ]);
        mainProgram.node.body.push(newNode);
        //computedProps.add(computedProp.key.name)
      });
    },
  };

  return {
    name: "ast-transform", // not required
    visitor: {
      ObjectMethod(path) {
        if (path.node.key.name === "data") {
          const nodeAlreadyVisited = visitedNodes.has(path.node);
          if (nodeAlreadyVisited) return;

          const propsOfReturnStatement =
            path.node.body.body[0].argument.properties;
          mainProgram = path.findParent((path) => path.isProgram());

          propsOfReturnStatement.forEach((property) => {
            //TODO; add .value to the all references the are using ref
            const useReactive = t.isObjectExpression(property.value);

            const newNode = t.variableDeclaration("const", [
              t.variableDeclarator(
                t.identifier(property.key.name),
                t.callExpression(
                  t.identifier(useReactive ? "reactive" : "ref"),
                  [property.value]
                )
              ),
            ]);
            mainProgram.node.body.push(newNode);
            // todo

            if (!useReactive) {
              array.add(newNode.declarations[0].id.name);
            }
          });
          visitedNodes.add(path.node);
          mainProgram.traverse(countComputedProps);
          mainProgram.traverse(removeThisKeyWordAndAddValueNotation);
          mainProgram.traverse(pullStatementsInsideSetup);
          mainProgram.traverse(pullPropsInsideComputed);
          mainProgram.traverse(pullPropsInsideMethods);
          mainProgram.traverse(pullPropsInsideWatch);
          mainProgram.traverse(pullLifeSycles);
          addVueImports(mainProgram, t);
          mainProgram.traverse(removeDefaultExport);
        }
      },
    },
  };
};
