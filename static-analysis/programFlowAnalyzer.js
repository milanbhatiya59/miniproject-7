#!/usr/bin/env node

/**
 * Program Flow Static Analyzer
 *
 * This script performs lightweight static analysis on Solidity contracts by
 * building an approximate control/data-flow summary for every public or
 * external function. It flags potentially dangerous flows such as
 * unprotected state mutations, unrestricted ether transfers, and external
 * calls without access-control hints. The goal is to surface common
 * vulnerability patterns early, even as new vulnerable contracts are added.
 *
 * Usage:
 *   node static-analysis/programFlowAnalyzer.js [path ...]
 *
 * If no paths are provided, the script scans the default `contracts/`
 * directory. Paths can be files or directories. Directories are scanned
 * recursively for `.sol` files.
 *
 * NOTE: The analyzer relies entirely on static reasoning; it does not deploy
 * or execute contracts.
 */

const fs = require("fs");
const path = require("path");
const solc = require("solc");

const OWNER_KEYWORDS = ["owner", "admin", "governor", "controller"];
const ACCESS_CONTROL_MODIFIERS = ["onlyOwner", "onlyAdmin", "adminOnly"];

function main() {
  const targets = process.argv.slice(2);
  const searchRoots = targets.length
    ? targets.map((t) => path.resolve(process.cwd(), t))
    : [path.resolve(process.cwd(), "contracts")];

  const files = collectSolidityFiles(searchRoots);
  if (files.length === 0) {
    console.error("No Solidity files found for analysis.");
    process.exit(1);
  }

  console.log("🔎 Program-Flow Static Analysis\n");

  files.forEach((filePath) => {
    try {
      analyzeFile(filePath);
    } catch (err) {
      console.error(`\n❌ Failed to analyze ${filePath}: ${err.message}`);
    }
  });
}

function collectSolidityFiles(pathsInput) {
  const results = [];
  for (const target of pathsInput) {
    if (!fs.existsSync(target)) continue;
    const stats = fs.statSync(target);
    if (stats.isDirectory()) {
      const entries = fs.readdirSync(target);
      const subpaths = entries.map((entry) => path.join(target, entry));
      results.push(...collectSolidityFiles(subpaths));
    } else if (stats.isFile() && target.endsWith(".sol")) {
      results.push(target);
    }
  }
  return results;
}

function analyzeFile(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const ast = compileAndGetAst(filePath, source);

  console.log(`📄 ${path.relative(process.cwd(), filePath)}`);

  const contracts = ast.nodes.filter((node) => node.nodeType === "ContractDefinition");
  if (contracts.length === 0) {
    console.log("   No contracts defined in this file.");
    return;
  }

  contracts.forEach((contractNode) => {
    const contractReport = analyzeContract(contractNode, source, filePath);
    renderContractReport(contractReport);
  });
}

function compileAndGetAst(filePath, source) {
  const input = {
    language: "Solidity",
    sources: {
      [filePath]: {
        content: source,
      },
    },
    settings: {
      outputSelection: {
        "*": {
          "": ["ast"],
        },
      },
    },
  };

  const output = JSON.parse(
    solc.compile(JSON.stringify(input), {
      import: (dependencyPath) => resolveImport(filePath, dependencyPath),
    })
  );
  if (output.errors) {
    const fatal = output.errors.filter((e) => e.severity === "error");
    if (fatal.length) {
      const messages = fatal.map((e) => e.formattedMessage).join("\n");
      throw new Error(messages);
    }
  }

  const sourceAst = output.sources[filePath];
  if (!sourceAst || !sourceAst.ast) {
    throw new Error("AST not returned by solc.");
  }
  return sourceAst.ast;
}

function resolveImport(parentFile, dependencyPath) {
  try {
    const resolvedPath = resolveImportPath(parentFile, dependencyPath);
    const contents = fs.readFileSync(resolvedPath, "utf8");
    return { contents };
  } catch (err) {
    return { error: `File import callback error: ${err.message}` };
  }
}

function resolveImportPath(parentFile, dependencyPath) {
  if (dependencyPath.startsWith(".")) {
    return path.resolve(path.dirname(parentFile), dependencyPath);
  }

  const fallbackPaths = [path.dirname(parentFile), process.cwd()];
  for (const base of fallbackPaths) {
    try {
      return require.resolve(dependencyPath, { paths: [base] });
    } catch (err) {
      // continue
    }
  }

  throw new Error(`Unable to resolve import: ${dependencyPath}`);
}

function analyzeContract(contractNode, source, filePath) {
  const stateVariables = contractNode.nodes
    .filter((node) => node.nodeType === "VariableDeclaration" && node.stateVariable)
    .map((node) => ({
      name: node.name,
      type: node.typeDescriptions?.typeString || "",
      isOwnerLike: OWNER_KEYWORDS.some((keyword) => node.name.toLowerCase().includes(keyword)),
    }));

  const ownerVars = stateVariables.filter((v) => v.isOwnerLike).map((v) => v.name);

  const functions = contractNode.nodes.filter(
    (node) =>
      node.nodeType === "FunctionDefinition" &&
      node.implemented &&
      node.kind !== "constructor" &&
      node.kind !== "fallback" &&
      node.kind !== "receive"
  );

  const specialFunctions = contractNode.nodes.filter(
    (node) =>
      node.nodeType === "FunctionDefinition" &&
      node.implemented &&
      (node.kind === "fallback" || node.kind === "receive")
  );

  const functionReports = [
    ...functions.map((fn) => analyzeFunction(fn, source, ownerVars)),
    ...specialFunctions.map((fn) => analyzeFunction(fn, source, ownerVars)),
  ];

  const vulnerabilities = functionReports.flatMap((report) => detectVulnerabilities(report, filePath));

  return {
    name: contractNode.name,
    stateVariables,
    functions: functionReports,
    vulnerabilities,
  };
}

function analyzeFunction(fnNode, source, ownerVars) {
  const { start, length } = parseSrc(fnNode.src);
  const snippet = source.slice(start, start + length);

  const entryPoint = ["public", "external"].includes(fnNode.visibility);
  const usesOwnerModifier = fnNode.modifiers?.some((mod) =>
    ACCESS_CONTROL_MODIFIERS.includes(mod.modifierName?.name)
  );
  const hasOwnerRequire = OWNER_KEYWORDS.some((keyword) => {
    const regex = new RegExp(`require\\s*\\([^)]*${keyword}[^)]*\\)`, "i");
    return regex.test(snippet);
  });

  const parameters =
    fnNode.parameters?.parameters?.map((param) => ({
      name: param.name,
      type: param.typeDescriptions?.typeString || "",
    })) || [];

  const flowAnalysis = analyzeFlow(snippet, parameters);
  const sensitiveOperations = extractSensitiveOperations(snippet);
  const stateMutation =
    fnNode.stateMutability !== "view" &&
    fnNode.stateMutability !== "pure" &&
    snippet.match(/(=|\+\+|--)/);

  const hasAccessControl = usesOwnerModifier || hasOwnerRequire;

  return {
    name: fnNode.name || (fnNode.kind === "receive" ? "receive" : fnNode.kind || "anonymous"),
    visibility: fnNode.visibility,
    mutability: fnNode.stateMutability,
    entryPoint,
    snippet,
    src: fnNode.src,
    parameters,
    sensitiveOperations,
    stateMutation: Boolean(stateMutation),
    hasAccessControl,
    flowAnalysis,
    accessControlHints: {
      usesOwnerModifier,
      hasOwnerRequire,
      ownerVars,
    },
  };
}

function analyzeFlow(snippet, parameters) {
  const flow = {
    hasUncheckedBlock: false,
    uncheckedWithArithmetic: false,
    arithmeticOps: [],
    externalCallsBeforeState: false,
    hasInputValidation: {},
    parameterUsage: {},
  };

  const uncheckedBlockRegex = /unchecked\s*\{([^}]*)\}/gs;
  const uncheckedMatches = [...snippet.matchAll(uncheckedBlockRegex)];
  if (uncheckedMatches.length > 0) {
    flow.hasUncheckedBlock = true;
    uncheckedMatches.forEach((match) => {
      const uncheckedContent = match[1];
      if (uncheckedContent.match(/(\+\+|\-\-|\+=|\-=|\*=|\/=|\+\s+|\-\s+|=\s*\w+\s*[\+\-])/)) {
        flow.uncheckedWithArithmetic = true;
        const arithMatches = uncheckedContent.match(/(\w+\s*[\+\-\*\/]=|\w+\+\+|\w+\-\-|\w+\s*[\+\-]\s*\w+)/g);
        if (arithMatches) {
          flow.arithmeticOps.push(...arithMatches.map((op) => ({ operation: op.trim(), inUnchecked: true })));
        }
      }
    });
  }

  const normalArithRegex = /(\w+\s*[\+\-\*\/]=|\w+\+\+|\w+\-\-)/g;
  const normalMatches = [...snippet.matchAll(normalArithRegex)];
  normalMatches.forEach((match) => {
    const op = match[0];
    const opIndex = snippet.indexOf(op);
    const beforeOp = snippet.slice(0, opIndex);
    const uncheckedBlockStartsBefore = [...beforeOp.matchAll(/unchecked\s*\{/g)].length;
    const uncheckedBlockEndsBefore = [...beforeOp.matchAll(/\}/g)].length;
    const isInUnchecked = uncheckedBlockStartsBefore > uncheckedBlockEndsBefore;
    if (!isInUnchecked) {
      flow.arithmeticOps.push({ operation: op.trim(), inUnchecked: false });
    }
  });

  parameters.forEach((param) => {
    const paramName = param.name;
    if (!paramName) return;
    const paramUsed = new RegExp(`\\b${paramName}\\b`).test(snippet);
    flow.parameterUsage[paramName] = paramUsed;

    if (paramUsed) {
      const paramValidationPatterns = [
          new RegExp(`require\\s*\\([^)]*${paramName}[^)]*!=\\s*address\\(0\\)[^)]*\\)`, "i"),
          new RegExp(`require\\s*\\([^)]*${paramName}[^)]*!=.*0x0[^)]*\\)`, "i"),
          new RegExp(`require\\s*\\([^)]*${paramName}[^)]*>\\s*0[^)]*\\)`, "i"),
          new RegExp(`require\\s*\\([^)]*${paramName}[^)]*[<>=][^)]*\\)`, "i"),
          new RegExp(`require\\s*\\([^)]*${paramName}[^)]*<\\s*\\w+\\.length[^)]*\\)`, "i"),
      ];
  
      // NEW LOGIC:
      // Validation can appear anywhere in the function body
      const hasValidation = paramValidationPatterns.some((pattern) => pattern.test(snippet));
  
      flow.hasInputValidation[paramName] = hasValidation;
   }
  
  });

  const externalCallPattern = /(\.call\{|\.call\.|\.transfer\(|\.send\(|\.delegatecall\()/g;
  const stateMutationPattern = /(\w+\s*=\s*[^;]+;|\w+\s*[\+\-\*\/]=[^;]+;|\w+\+\+|\w+\-\-)/g;

  const callMatches = [...snippet.matchAll(externalCallPattern)];
  const mutationMatches = [...snippet.matchAll(stateMutationPattern)];

  if (callMatches.length && mutationMatches.length) {
    callMatches.forEach((callMatch) => {
      const callIndex = callMatch.index;
      mutationMatches.forEach((mutationMatch) => {
        const mutationIndex = mutationMatch.index;
        if (callIndex < mutationIndex) {
          flow.externalCallsBeforeState = true;
        }
      });
    });
  }

  return flow;
}

function extractSensitiveOperations(snippet) {
  const operations = [];
  const patterns = [
    { regex: /\.transfer\s*\(/g, type: "ETHER_TRANSFER", detail: "uses .transfer()" },
    { regex: /\.send\s*\(/g, type: "ETHER_TRANSFER", detail: "uses .send()" },
    { regex: /\.call\{[^}]*value/gs, type: "EXTERNAL_CALL", detail: "uses low-level call with value" },
    { regex: /\.call\.value/gs, type: "EXTERNAL_CALL", detail: "uses .call.value()" },
    { regex: /\.delegatecall\s*\(/g, type: "DELEGATECALL", detail: "uses delegatecall" },
    { regex: /selfdestruct\s*\(/g, type: "SELFDESTRUCT", detail: "can destroy contract" },
  ];

  patterns.forEach(({ regex, type, detail }) => {
    if (regex.test(snippet)) {
      operations.push({ type, detail });
    }
  });

  return operations;
}

function detectVulnerabilities(functionReport, filePath) {
  const vulnerabilities = [];
  if (!functionReport.entryPoint) {
    return vulnerabilities;
  }

  const location = formatLocation(functionReport.src, filePath);
  const flow = functionReport.flowAnalysis || {};

  if ((functionReport.stateMutation || functionReport.sensitiveOperations.length) && !functionReport.hasAccessControl) {
    vulnerabilities.push({
      type: "UNRESTRICTED_ENTRY_POINT",
      message: "Public/external function mutates state or performs sensitive operations without access control.",
      function: functionReport.name,
      location,
      sensitiveOperations: functionReport.sensitiveOperations,
    });
  }

  const hasExternalValueTransfer = functionReport.sensitiveOperations.some(
    (op) => op.type === "ETHER_TRANSFER" || op.type === "EXTERNAL_CALL"
  );
  if (hasExternalValueTransfer && !functionReport.hasAccessControl) {
    vulnerabilities.push({
      type: "UNGUARDED_ETHER_FLOW",
      message: "Funds can be moved to arbitrary callers without any authorization checks.",
      function: functionReport.name,
      location,
      sensitiveOperations: functionReport.sensitiveOperations,
    });
  }

  const hasDelegateCall = functionReport.sensitiveOperations.some((op) => op.type === "DELEGATECALL");
  if (hasDelegateCall) {
    vulnerabilities.push({
      type: "DELEGATECALL_RISK",
      message: "Delegatecall introduces code execution risk. Ensure strict target validation and access control.",
      function: functionReport.name,
      location,
    });
  }

  if (flow.uncheckedWithArithmetic) {
    const operations = flow.arithmeticOps.filter((op) => op.inUnchecked).map((op) => op.operation);
    vulnerabilities.push({
      type: "INTEGER_OVERFLOW_UNDERFLOW",
      message: "Arithmetic inside unchecked block can overflow/underflow.",
      function: functionReport.name,
      location,
      details: `Unchecked operations: ${operations.join(", ")}`,
    });
  }

  functionReport.parameters?.forEach((param) => {
    const paramName = param.name;
    if (!paramName) return;
    const isUsed = flow.parameterUsage?.[paramName];
    const hasValidation = flow.hasInputValidation?.[paramName];
    if (isUsed && !hasValidation) {
      const paramType = param.type || "";
      const needsZeroAddressCheck = paramType.includes("address");
      const needsValueCheck = paramType.includes("uint") || paramType.includes("int");

      if (needsZeroAddressCheck) {
        vulnerabilities.push({
          type: "LACK_OF_INPUT_VALIDATION",
          message: `Address parameter '${paramName}' is used without zero-address validation.`,
          function: functionReport.name,
          location,
          details: `Parameter '${paramName}' (${paramType}) feeds state/sensitive ops without require(address != 0).`,
        });
      } else if (needsValueCheck && functionReport.stateMutation) {
        vulnerabilities.push({
          type: "LACK_OF_INPUT_VALIDATION",
          message: `Numeric parameter '${paramName}' lacks bounds checking before state mutation.`,
          function: functionReport.name,
          location,
          details: `Parameter '${paramName}' (${paramType}) should be range-checked before updating state.`,
        });
      }
    }
  });

  if (flow.externalCallsBeforeState && hasExternalValueTransfer) {
    vulnerabilities.push({
      type: "REENTRANCY",
      message: "External call occurs before state update (Checks-Effects-Interactions violation).",
      function: functionReport.name,
      location,
      details: "Update contract state before external calls to prevent reentrancy.",
    });
  }

  return vulnerabilities;
}

function formatLocation(src, filePath) {
  const { start } = parseSrc(src);
  const source = fs.readFileSync(filePath, "utf8");
  const { line, column } = getLineAndColumn(source, start);
  return `${path.relative(process.cwd(), filePath)}:${line}:${column}`;
}

function parseSrc(src) {
  if (!src) return { start: 0, length: 0, fileIndex: 0 };
  const [start, length, fileIndex] = src.split(":").map((n) => parseInt(n, 10));
  return { start, length, fileIndex };
}

function getLineAndColumn(source, startIndex) {
  const untilStart = source.slice(0, startIndex);
  const lines = untilStart.split(/\r?\n/);
  const line = lines.length;
  const column = lines[lines.length - 1].length + 1;
  return { line, column };
}

function renderContractReport(report) {
  console.log(`\n   🏛️  Contract: ${report.name}`);
  if (report.stateVariables.length) {
    console.log(
      `      State vars: ${report.stateVariables
        .map((v) => `${v.name}${v.isOwnerLike ? " (owner-like)" : ""}`)
        .join(", ")}`
    );
  }

  if (report.vulnerabilities.length === 0) {
    console.log("      ✅ No obvious entry-point flow issues detected.");
  } else {
    console.log("      ⚠️  Potential vulnerabilities:");
    report.vulnerabilities.forEach((vuln, idx) => {
      console.log(`         ${idx + 1}. [${vuln.type}] ${vuln.message}`);
      console.log(`            Function: ${vuln.function}`);
      console.log(`            Location: ${vuln.location}`);
      if (vuln.sensitiveOperations?.length) {
        console.log(
          `            Sensitive ops: ${vuln.sensitiveOperations.map((op) => op.detail || op.type).join(", ")}`
        );
      }
      if (vuln.details) {
        console.log(`            Details: ${vuln.details}`);
      }
    });
  }
}

main();

