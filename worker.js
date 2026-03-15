import { Worker } from "@temporalio/worker";
import { Pool } from "pg";
import dotenv from "dotenv";
import * as activities from "./activities.js";

dotenv.config();

console.log("TEMPORAL_HOST:", process.env.TEMPORAL_HOST);
console.log("TEMPORAL_PORT:", process.env.TEMPORAL_PORT);
console.log("TEMPORAL_NAMESPACE:", process.env.TEMPORAL_NAMESPACE);

// Set up the database pool
const dbPool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME || "temporal_demo",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres"
});

// Wire the pool into activities
activities.initializeDbPool(dbPool);

// Catch any pool errors
dbPool.on("error", (error) => {
  console.error("Unexpected error on idle client", error);
});

async function run() {
  
  const address = `${process.env.TEMPORAL_HOST || "localhost"}:${process.env.TEMPORAL_PORT || 7233}`;
  console.log("Connecting to Temporal at:", address);
  
  // Retry logic - wait for Temporal to be ready
  let retries = 0;
  const maxRetries = 30;
  let issuesWorker, projectWorker;
  
  while (retries < maxRetries) {
    try {
      issuesWorker = await Worker.create({
        workflowsPath: new URL("./issueWorkflow.js", import.meta.url).pathname,
        taskQueue: "issues",
        namespace: process.env.TEMPORAL_NAMESPACE || "issue-system"
      });
      console.log("Connected to Temporal successfully!");
      break;
    } catch (err) {
      retries++;
      console.log(`Attempt ${retries}/${maxRetries} failed, retrying in 2s...`, err.message);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  if (!issuesWorker) {
    throw new Error("Failed to connect to Temporal after retries");
  }

  projectWorker = await Worker.create({
    workflowsPath: new URL("./projectWorkflow.js", import.meta.url).pathname,
    activities,
    taskQueue: "projects",
    namespace: process.env.TEMPORAL_NAMESPACE || "issue-system"
  });

  await Promise.all([
    issuesWorker.run(),
    projectWorker.run()
  ]);
}

run().catch((err) => {
  console.error(err);
  dbPool.end();
  process.exit(1);
});

// Clean shutdown on signal
process.on("SIGINT", async () => {
  console.log("Shutting down worker...");
  await dbPool.end();
  process.exit(0);
});
