import {
  defineQuery,
  defineSignal,
  defineUpdate,
  setHandler,
  condition,
  upsertSearchAttributes,
  workflowInfo,
  continueAsNew
} from '@temporalio/workflow';

export const initIssue = defineUpdate('initIssue');
export const addComment = defineUpdate('addComment');
export const changeStatus = defineUpdate('changeStatus');

export const closeIssue = defineSignal('closeIssue');

export const getStatus = defineQuery('getStatus');
export const getComments = defineQuery('getComments');

interface IssueState {
  issue: { title: string; author: string; projectId: string } | null;
  comments: Array<{ author: string; message: string }>;
  status: string;
}

export async function issueWorkflow(
  state: IssueState = { issue: null, comments: [], status: 'OPEN' }
): Promise<string> {

  let { issue, comments, status } = state;

  setHandler(getStatus, () => status);
  setHandler(getComments, () => comments);

  setHandler(initIssue as any, async (data: { title: string; author: string; projectId: string }) => {

    if (issue) throw new Error('Issue already initialized');

    issue = data;

    upsertSearchAttributes({
      IssueAuthor: [data.author],
      IssueStatus: [status],
      ProjectId: [data.projectId]
    });

    return { ok: true };
  });

  setHandler(addComment as any, async (comment: { author: string; message: string }) => {
    comments.push(comment);
    return { ok: true };
  });

  setHandler(changeStatus as any, async (newStatus: string) => {
    console.log('Received status update: ', newStatus);
    status = newStatus;

    upsertSearchAttributes({
      IssueStatus: [status]
    });

    return status;
  });

  setHandler(closeIssue, async (newStatus?: string) => {
    const finalStatus = newStatus !== undefined ? newStatus : 'REJECTED';
    console.log('Received close issue signal with status: ', finalStatus);
    status = finalStatus;

    upsertSearchAttributes({
      IssueStatus: [status]
    });
  });

  await condition(() => issue !== null);

  const finished = await condition(
    () => status === 'FINISHED' || status === 'REJECTED',
    '10 minutes'
  );

  if (!finished) {

    status = 'TIMEOUTED';

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
