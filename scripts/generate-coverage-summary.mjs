import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  existsSync,
} from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const PACKAGES_DIR = path.join(ROOT_DIR, 'packages');
const OUTPUT_DIR = path.join(ROOT_DIR, '.coverage-reports');

const BASE_THRESHOLDS = {
  branches: 80,
  functions: 90,
};

const TARGET_THRESHOLDS = {
  branches: BASE_THRESHOLDS.branches + 5,
  functions: BASE_THRESHOLDS.functions + 5,
};

function pct(value) {
  if (value === null || Number.isNaN(value)) {
    return 'n/a';
  }
  return `${value.toFixed(2)}%`;
}

function readPackageInfos() {
  const entries = readdirSync(PACKAGES_DIR, { withFileTypes: true });
  const infos = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const packageDir = path.join(PACKAGES_DIR, entry.name);
    const packageJsonPath = path.join(packageDir, 'package.json');
    if (!existsSync(packageJsonPath)) {
      continue;
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    infos.push({
      dirName: entry.name,
      relativePath: path.join('packages', entry.name),
      packageName:
        typeof packageJson.name === 'string' ? packageJson.name : entry.name,
      packageDir,
    });
  }

  infos.sort((a, b) => a.packageName.localeCompare(b.packageName));
  return infos;
}

function runCoverage(info) {
  const packageOutputDir = path.join(OUTPUT_DIR, info.dirName);
  mkdirSync(packageOutputDir, { recursive: true });

  const args = [
    '--dir',
    info.packageDir,
    'exec',
    'vitest',
    'run',
    '--coverage',
    '--coverage.reporter=json-summary',
    '--coverage.reportsDirectory',
    packageOutputDir,
    '--passWithNoTests',
  ];

  const result = spawnSync('pnpm', args, {
    cwd: ROOT_DIR,
    encoding: 'utf8',
  });

  const log = [
    `Command: pnpm ${args.join(' ')}`,
    `Exit code: ${result.status ?? 'unknown'}`,
    '',
    '--- STDOUT ---',
    result.stdout ?? '',
    '',
    '--- STDERR ---',
    result.stderr ?? '',
  ].join('\n');

  mkdirSync(packageOutputDir, { recursive: true });
  writeFileSync(path.join(packageOutputDir, 'vitest.log'), log, 'utf8');

  const summaryPath = path.join(packageOutputDir, 'coverage-summary.json');
  let branchesPct = null;
  let functionsPct = null;
  let branchesCovered = 0;
  let branchesTotal = 0;
  let functionsCovered = 0;
  let functionsTotal = 0;

  if (existsSync(summaryPath)) {
    const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
    const total = summary.total;
    if (total?.branches && total?.functions) {
      branchesPct = Number(total.branches.pct);
      functionsPct = Number(total.functions.pct);
      branchesCovered = Number(total.branches.covered) || 0;
      branchesTotal = Number(total.branches.total) || 0;
      functionsCovered = Number(total.functions.covered) || 0;
      functionsTotal = Number(total.functions.total) || 0;
    }
  }

  return {
    ...info,
    exitCode: result.status ?? 1,
    branchesPct,
    functionsPct,
    branchesCovered,
    branchesTotal,
    functionsCovered,
    functionsTotal,
    outputDir: packageOutputDir,
  };
}

function isAboveThresholds(branchesPct, functionsPct, thresholds) {
  if (branchesPct === null || functionsPct === null) {
    return false;
  }
  return (
    branchesPct > thresholds.branches && functionsPct > thresholds.functions
  );
}

function generateSummary(results) {
  let totalBranchesCovered = 0;
  let totalBranchesTotal = 0;
  let totalFunctionsCovered = 0;
  let totalFunctionsTotal = 0;

  for (const result of results) {
    totalBranchesCovered += result.branchesCovered;
    totalBranchesTotal += result.branchesTotal;
    totalFunctionsCovered += result.functionsCovered;
    totalFunctionsTotal += result.functionsTotal;
  }

  const totalBranchesPct =
    totalBranchesTotal > 0
      ? (totalBranchesCovered / totalBranchesTotal) * 100
      : null;
  const totalFunctionsPct =
    totalFunctionsTotal > 0
      ? (totalFunctionsCovered / totalFunctionsTotal) * 100
      : null;

  const lines = [];
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(
    '| Status | Package | Branches | Functions | +5 Target | Test Run |',
  );
  lines.push('| --- | --- | ---: | ---: | --- | --- |');

  for (const result of results) {
    const meetsBase = isAboveThresholds(
      result.branchesPct,
      result.functionsPct,
      BASE_THRESHOLDS,
    );
    const meetsTarget = isAboveThresholds(
      result.branchesPct,
      result.functionsPct,
      TARGET_THRESHOLDS,
    );

    const status = meetsBase ? '🟢' : '🔴';
    const target = meetsTarget ? 'YES' : 'NO';
    const testRun =
      result.exitCode === 0 ? 'PASS' : `FAIL (${result.exitCode})`;
    lines.push(
      `| ${status} | ${result.packageName} | ${pct(result.branchesPct)} | ${pct(result.functionsPct)} | ${target} | ${testRun} |`,
    );
  }

  const totalMeetsBase = isAboveThresholds(
    totalBranchesPct,
    totalFunctionsPct,
    BASE_THRESHOLDS,
  );
  const totalMeetsTarget = isAboveThresholds(
    totalBranchesPct,
    totalFunctionsPct,
    TARGET_THRESHOLDS,
  );

  lines.push(
    `| ${totalMeetsBase ? '🟢' : '🔴'} | TOTAL | ${pct(totalBranchesPct)} | ${pct(totalFunctionsPct)} | ${totalMeetsTarget ? 'YES' : 'NO'} | n/a |`,
  );

  writeFileSync(
    path.join(OUTPUT_DIR, 'summary.md'),
    `${lines.join('\n')}\n`,
    'utf8',
  );
}

function main() {
  rmSync(OUTPUT_DIR, { recursive: true, force: true });
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const packageInfos = readPackageInfos();
  const results = packageInfos.map(runCoverage);
  generateSummary(results);

  const hasFailures = results.some((result) => result.exitCode !== 0);
  process.exitCode = hasFailures ? 1 : 0;
}

main();
