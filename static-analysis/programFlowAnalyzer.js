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

  console.log(
    "--- Program-Flow Static Analysis Report (programFlowAnalyzer.js) ---"
  );

  files.forEach((filePath) => {
    try {
      analyzeFile(filePath);
    } catch (err) {
      console.error(`\n❌ Failed to analyze ${filePath}: ${err.message}`);
    }
  });
  console.log("\n\n--- End of Report ---");
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

  console.log(
    `\n\n================================================================`
  );
  console.log(`📄 FILE: ${path.relative(process.cwd(), filePath)}`);
  console.log(
    `================================================================`
  );

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
    .filter(
      (node) => node.nodeType === "VariableDeclaration" && node.stateVariable
    )
    .map((node) => ({
      name: node.name,
      type: node.typeDescriptions?.typeString || "",
      isOwnerLike: OWNER_KEYWORDS.some((keyword) =>
        node.name.toLowerCase().includes(keyword)
      ),
    }));

  const ownerVars = stateVariables
    .filter((v) => v.isOwnerLike)
    .map((v) => v.name);

  const functions = contractNode.nodes.filter(
    (node) =>
      node.nodeType === "FunctionDefinition" &&
      node.implemented &&
      node.kind !== "constructor"
  );

  const functionReports = functions.map((fn) =>
    analyzeFunction(fn, source, ownerVars)
  );

  const vulnerabilities = functionReports.flatMap((report) =>
    detectVulnerabilities(report, filePath, source)
  );

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

  const sensitiveOperations = extractSensitiveOperations(snippet);
  const stateMutation =
    fnNode.stateMutability !== "view" &&
    fnNode.stateMutability !== "pure" &&
    snippet.match(/(=|\+\+|--)/);

  const hasAccessControl = usesOwnerModifier || hasOwnerRequire;

  return {
    name:
      fnNode.name ||
      (fnNode.kind === "receive" ? "receive" : fnNode.kind || "anonymous"),
    visibility: fnNode.visibility,
    mutability: fnNode.stateMutability,
    entryPoint,
    snippet,
    src: fnNode.src,
    sensitiveOperations,
    stateMutation: Boolean(stateMutation),
    hasAccessControl,
    accessControlHints: {
      usesOwnerModifier,
      hasOwnerRequire,
      ownerVars,
    },
  };
}

function extractSensitiveOperations(snippet) {
  const operations = [];
  const patterns = [
    {
      regex: /\.transfer\s*\(/g,
      type: "ETHER_TRANSFER",
      detail: "uses .transfer()",
    },
    { regex: /\.send\s*\(/g, type: "ETHER_TRANSFER", detail: "uses .send()" },
    {
      regex: /\.call\{[^}]*value/gs,
      type: "EXTERNAL_CALL",
      detail: "uses low-level call with value",
    },
    {
      regex: /\.call\.value/gs,
      type: "EXTERNAL_CALL",
      detail: "uses .call.value()",
    },
    {
      regex: /\.delegatecall\s*\(/g,
      type: "DELEGATECALL",
      detail: "uses delegatecall",
    },
    {
      regex: /selfdestruct\s*\(/g,
      type: "SELFDESTRUCT",
      detail: "can destroy contract",
    },
  ];

  patterns.forEach(({ regex, type, detail }) => {
    if (regex.test(snippet)) {
      operations.push({ type, detail });
    }
  });

  return operations;
}

function detectVulnerabilities(functionReport, filePath, source) {
  const vulnerabilities = [];
  if (!functionReport.entryPoint) {
    return vulnerabilities;
  }

  const { line, column, code } = formatLocation(
    functionReport.src,
    filePath,
    source
  );

  if (
    (functionReport.stateMutation ||
      functionReport.sensitiveOperations.length) &&
    !functionReport.hasAccessControl
  ) {
    vulnerabilities.push({
      id: "UNRESTRICTED_ENTRY_POINT",
      title: "Unrestricted State-Changing Entry Point",
      description:
        "A public/external function that modifies contract state or performs a sensitive action lacks access control, allowing any user to call it.",
      remediation:
        "Implement `onlyOwner` or role-based modifiers, or add `require` checks to validate `msg.sender`.",
      function: functionReport.name,
      line,
      column,
      code,
      severity: "High",
    });
  }

  const hasExternalValueTransfer = functionReport.sensitiveOperations.some(
    (op) => op.type === "ETHER_TRANSFER" || op.type === "EXTERNAL_CALL"
  );
  if (hasExternalValueTransfer && !functionReport.hasAccessControl) {
    vulnerabilities.push({
      id: "UNGUARDED_ETHER_FLOW",
      title: "Unguarded Ether/Token Flow",
      description: `This function moves funds but does not verify the caller's authorization, creating a risk of fund theft.`,
      remediation:
        "Ensure all fund-transferring functions are protected with strong access control.",
      function: functionReport.name,
      line,
      column,
      code,
      severity: "Critical",
    });
  }

  // Deduplicate
  return vulnerabilities.filter(
    (v, i, a) => a.findIndex((t) => t.line === v.line && t.id === v.id) === i
  );
}

function formatLocation(src, filePath, source) {
  const { start } = parseSrc(src);
  const { line, column } = getLineAndColumn(source, start);
  const code = source.split("\n")[line - 1].trim();
  return { line, column, code };
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
  console.log(`\n  --------------------------------------------------`);
  console.log(`  🏛️  CONTRACT: ${report.name}`);
  console.log(`  --------------------------------------------------`);
  if (report.stateVariables.length) {
    console.log(
      `     - State Variables: ${report.stateVariables
        .map((v) => `${v.name}${v.isOwnerLike ? " (owner-like)" : ""}`)
        .join(", ")}`
    );
  }

  if (report.vulnerabilities.length === 0) {
    console.log(`\n     ✅ No obvious control-flow vulnerabilities detected.`);
  } else {
    console.log(`\n     🚨 VULNERABILITIES FOUND:`);
    report.vulnerabilities.forEach((vuln) => {
      console.log(`\n       ...................................`);
      console.log(`       - ID:          [${vuln.id}]`);
      console.log(`       - Severity:    ${vuln.severity}`);
      console.log(`       - Title:       ${vuln.title}`);
      console.log(`       - Function:    ${vuln.function}`);
      console.log(`       - Location:    Line ${vuln.line}`);
      console.log(`       - Code:        \`${vuln.code}\``);
      console.log(`       - Description: ${vuln.description}`);
      console.log(`       - Suggestion:  ${vuln.remediation}`);
    });
  }
}

main();

