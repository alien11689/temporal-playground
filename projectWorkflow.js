import {
  condition,  
  defineUpdate,
  defineQuery,
  setHandler,
  proxyActivities,
  workflowInfo,
  continueAsNew
} from "@temporalio/workflow";

const activities = proxyActivities({
  startToCloseTimeout: "10 minutes"
});

export const changeProjectStatus = defineUpdate("changeProjectStatus");
export const getProjectState = defineQuery("getProjectState");

export async function projectWorkflow(state = {
  projectId: null,
  projectName: "Unknown",
  status: "ACTIVE"
}) {

  let { projectId, projectName, status } = state;
  let shouldContinueAsNew = false;

  setHandler(getProjectState, () => ({
    projectId,
    projectName,
    status
  }));

  setHandler(changeProjectStatus, async (newStatus) => {

    if (status === newStatus) {
      return { status };
    }

    await activities.saveProject(projectId, projectName, newStatus);

    status = newStatus;

    if (status === "INACTIVE") {
      await activities.signalProjectIssues(projectId);
    }

    if (workflowInfo().historyLength > 30) {
      shouldContinueAsNew = true;
    }

    console.log("History length is now ", workflowInfo().historyLength);

    return { status };
  });

  while (true) {

    await condition(() => shouldContinueAsNew);
    
    shouldContinueAsNew = false;

    await continueAsNew({
        projectId,
        projectName,
        status,
      });
  }
}