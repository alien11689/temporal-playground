import {
  defineQuery,
  defineSignal,
  defineUpdate,
  setHandler,
  condition,
  upsertSearchAttributes,
  workflowInfo,
  continueAsNew
} from "@temporalio/workflow";

export const initIssue = defineUpdate("initIssue");
export const addComment = defineUpdate("addComment");
export const changeStatus = defineUpdate("changeStatus");

export const closeIssue = defineSignal("closeIssue");

export const getStatus = defineQuery("getStatus");
export const getComments = defineQuery("getComments");

export async function issueWorkflow(state = {
  issue: null,
  comments: [],
  status: "OPEN"
}) {

  let { issue, comments, status } = state;

  setHandler(getStatus, () => status);
  setHandler(getComments, () => comments);

  setHandler(initIssue, async (data) => {

    if (issue) throw new Error("Issue already initialized");

    issue = data;

    upsertSearchAttributes({
      IssueAuthor: [data.author],
      IssueStatus: [status],
      ProjectId: [data.projectId]
    });

    return { ok: true };
  });

  setHandler(addComment, async (comment) => {
    comments.push(comment);
    return { ok: true };
  });

  setHandler(changeStatus, async (newStatus) => {
    console.log("Received status update: ", newStatus);
    status = newStatus;

    upsertSearchAttributes({
      IssueStatus: [status]
    });

    return status;
  });

  setHandler(closeIssue, async (newStatus) => {
    console.log("Received close issue signal: ", newStatus);
    status = newStatus;

    upsertSearchAttributes({
      IssueStatus: [status]
    });
  });

  await condition(() => issue !== null);

  const finished = await condition(
    () => status === "FINISHED" || status === "REJECTED",
    "10 minutes"
  );

  if (!finished) {

    status = "TIMEOUTED";

    upsertSearchAttributes({
      IssueStatus: [status]
    });
  }

  if (workflowInfo().historyLength > 400) {
    await continueAsNew({
      issue,
      comments,
      status
    });
  }

  return status;
}