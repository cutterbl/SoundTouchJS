// This file has been removed as Nx Cloud CI is not used.
    }
    return output({
      allowed: true,
      envRerunCount: count + 1,
      message: null,
    });
  }

  output({ allowed: false, message: `Unknown gate type: ${gateType}` });
}

// --- post-action ---
// Compute next state after an action is taken.
// Returns wait mode params and whether the action was agent-triggered.

function postAction() {
  const action = getArg('--action');
  const cipeUrl = getArg('--cipe-url');
  const commitSha = getArg('--commit-sha');

  // MCP-triggered or auto-applied: track by cipeUrl
  const cipeUrlActions = ['fix-auto-applying', 'apply-mcp', 'env-rerun'];
  // Local push: track by commitSha
  const commitShaActions = [
    'apply-local-push',
    'reject-fix-push',
    'local-fix-push',
    'auto-fix-push',
    'empty-commit-push',
  ];

  const trackByCipeUrl = cipeUrlActions.includes(action);
  const trackByCommitSha = commitShaActions.includes(action);

  if (!trackByCipeUrl && !trackByCommitSha) {
    return output({ error: `Unknown action: ${action}` });
  }

  // fix-auto-applying: self-healing did it, NOT the monitor
  const agentTriggered = action !== 'fix-auto-applying';

  output({
    waitMode: true,
    pollCount: 0,
    lastCipeUrl: trackByCipeUrl ? cipeUrl : null,
    expectedCommitSha: trackByCommitSha ? commitSha : null,
    agentTriggered,
  });
}

// --- cycle-check ---
// Cycle classification + counter resets when a new "done" code is received.
// Called at the start of handling each actionable code.

function cycleCheck() {
  const status = getArg('--code');
  const wasAgentTriggered = getFlag('--agent-triggered');
  let cycleCount = parseInt(getArg('--cycle-count') || '0', 10);
  const maxCycles = parseInt(getArg('--max-cycles') || '10', 10);
  let envRerunCount = parseInt(getArg('--env-rerun-count') || '0', 10);

  // Cycle classification: if previous cycle was agent-triggered, count it
  if (wasAgentTriggered) cycleCount++;

  // Reset env_rerun_count on non-environment status
  if (status !== 'environment_issue') envRerunCount = 0;

  // Approaching limit gate
  const approachingLimit = cycleCount >= maxCycles - 2;

  output({
    cycleCount,
    agentTriggered: false,
    envRerunCount,
    approachingLimit,
    message: approachingLimit
      ? `Approaching cycle limit (${cycleCount}/${maxCycles})`
      : null,
  });
}

// --- Dispatch ---

switch (command) {
  case 'gate':
    gate();
    break;
  case 'post-action':
    postAction();
    break;
  case 'cycle-check':
    cycleCheck();
    break;
  default:
    output({ error: `Unknown command: ${command}` });
}
