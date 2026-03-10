import { Worker } from "@temporalio/worker";
import * as activities from "./activities.js";

async function run() {

  const issuesWorker = await Worker.create({
    workflowsPath: new URL("./issueWorkflow.js", import.meta.url).pathname,
    taskQueue: "issues",
    namespace: "issue-system"
  });

  const projectWorker = await Worker.create({
    workflowsPath: new URL("./projectWorkflow.js", import.meta.url).pathname,
    activities,
    taskQueue: "projects",
    namespace: "issue-system"
  });

  await Promise.all([
    issuesWorker.run(),
    projectWorker.run()
  ]);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});