const { prBuildRuns, prSelfCheck, prFlowCheck } = require('../payroll.js');
const runs = prBuildRuns();
const result = prSelfCheck(runs);
const flow = prFlowCheck(runs);
if (!result.ok || !flow.ok) {
  console.error('PAYROLL CHECK FAILED', result, flow);
  process.exit(1);
}
console.log('OK', result.net, result.gross, result.ded, result.statutory, result.lop, result.n, flow.jan);
