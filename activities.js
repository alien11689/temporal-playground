import { Client } from "@temporalio/client";

export async function updateProjectStatus(projectId, status) {

  console.log("Updating project", projectId, status);

  // tu normalnie byłby update w DB
  return { ok: true };
}

export async function signalProjectIssues(projectId) {

  const client = new Client({
    namespace: "issue-system"
  });

  const query =
    `ProjectId="${projectId}" AND ` +
    `IssueStatus!="FINISHED" AND IssueStatus!="REJECTED"`;

  const workflows = client.workflow.list({ query });

  for await (const wf of workflows) {

    try {

      const handle = client.workflow.getHandle(wf.workflowId);

      console.log("Sending change status to REJECTED to ", wf.workflowId);
      await handle.signal("closeIssue", "REJECTED");
      console.log("Sent");

    } catch (err) {
      console.log("signal failed", err.message);
    }
  }
}