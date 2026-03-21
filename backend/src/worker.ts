import { Worker } from '@temporalio/worker';
import { pool } from './db/index.ts';
import * as activities from './activities.ts';
import dotenv from 'dotenv';

dotenv.config();

console.log('TEMPORAL_HOST:', process.env.TEMPORAL_HOST);
console.log('TEMPORAL_PORT:', process.env.TEMPORAL_PORT);
console.log('TEMPORAL_NAMESPACE:', process.env.TEMPORAL_NAMESPACE);

activities.initializeDbPool(pool);

pool.on('error', (error) => {
  console.error('Unexpected error on idle client', error);
});

async function run(): Promise<void> {
  
  const address = `${process.env.TEMPORAL_HOST || 'localhost'}:${process.env.TEMPORAL_PORT || 7233}`;
  console.log('Connecting to Temporal at:', address);
  
  let retries = 0;
  const maxRetries = 30;
  let issuesWorker: Worker | undefined;
  let projectWorker: Worker | undefined;

  const shutdownWorkers = async () => {
    console.log('Shutting down workers...');
    if (issuesWorker) await issuesWorker.shutdown();
    if (projectWorker) await projectWorker.shutdown();
    await pool.end();
    console.log('Shutdown complete.');
    process.exit(0);
  };

  process.on('SIGINT', shutdownWorkers);
  process.on('SIGTERM', shutdownWorkers);
  
  while (retries < maxRetries) {
    try {
      issuesWorker = await Worker.create({
        workflowsPath: new URL('./workflows/issueWorkflow.ts', import.meta.url).pathname,
        taskQueue: 'issues',
        namespace: process.env.TEMPORAL_NAMESPACE || 'issue-system',
        gracefulShutdownTimeout: 1
      });
      console.log('Connected to Temporal successfully!');
      break;
    } catch (err) {
      retries++;
      console.log(`Attempt ${retries}/${maxRetries} failed, retrying in 2s...`, (err as Error).message);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  if (!issuesWorker) {
    throw new Error('Failed to connect to Temporal after retries');
  }

  projectWorker = await Worker.create({
    workflowsPath: new URL('./workflows/projectWorkflow.ts', import.meta.url).pathname,
    activities,
    taskQueue: 'projects',
    namespace: process.env.TEMPORAL_NAMESPACE || 'issue-system',
    gracefulShutdownTimeout: 5000
  });

  await Promise.all([
    issuesWorker.run(),
    projectWorker.run()
  ]);
}

run().catch((err) => {
  console.error(err);
  pool.end();
  process.exit(1);
});
