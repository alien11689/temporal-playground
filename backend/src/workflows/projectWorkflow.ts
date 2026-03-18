import {
  condition,
  defineUpdate,
  defineQuery,
  setHandler,
  proxyActivities,
  workflowInfo,
  continueAsNew
} from '@temporalio/workflow';

const activities = proxyActivities({
  startToCloseTimeout: '10 minutes'
});

export const changeProjectStatus = defineUpdate('changeProjectStatus');
export const getProjectState = defineQuery('getProjectState');

interface ProjectState {
  projectId: string | null;
  projectName: string;
  status: string;
}

export async function projectWorkflow(
  state: ProjectState = { projectId: null, projectName: 'Unknown', status: 'ACTIVE' }
): Promise<void> {

  let { projectId, projectName, status } = state;
  let shouldContinueAsNew = false;

  setHandler(getProjectState, () => ({
    projectId,
    projectName,
    status
  }));

  setHandler(changeProjectStatus as any, async (newStatus: string) => {

    if (status === newStatus) {
      return { status };
    }

    await activities.saveProject(projectId!, projectName, newStatus);

    status = newStatus;

    if (status === 'INACTIVE') {
      const result = await activities.signalProjectIssues(projectId!);
      console.log(`[ProjectDeactivation] Batch operation for ${projectId} submitted with jobId: ${result.jobId}`);
    }

    if (workflowInfo().historyLength > 30) {
      shouldContinueAsNew = true;
    }

    console.log('History length is now ', workflowInfo().historyLength);

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
