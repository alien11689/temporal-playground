import express from "express";
import { v4 as uuidv4 } from "uuid";
import {
  Client,
  Connection,
  WithStartWorkflowOperation
} from "@temporalio/client";
import dotenv from "dotenv";

dotenv.config();

const connection = await Connection.connect({
  address: `${process.env.TEMPORAL_HOST || "localhost"}:${process.env.TEMPORAL_PORT || 7233}`
});

const client = new Client({
  connection,
  namespace: process.env.TEMPORAL_NAMESPACE || "issue-system"
});

const app = express();
app.use(express.json());

/*
────────────────────────────
ISSUES ENDPOINTS
────────────────────────────
*/

app.post("/issues", async (req, res) => {

  const workflowId = uuidv4();

  const startOp = new WithStartWorkflowOperation("issueWorkflow", {
    workflowId,
    taskQueue: "issues"
  });

  const result = await client.workflow.startUpdateWithStart("initIssue", {
    startWorkflowOperation: startOp,
    args: [req.body]
  });

  res.json({
    workflowId,
    result
  });
});

app.post("/issues/:id/comments", async (req, res) => {

  const handle = client.workflow.getHandle(req.params.id);

  const result = await handle.executeUpdate("addComment", {
    args: [req.body]
  });

  res.json(result);
});

app.post("/issues/:id/status", async (req, res) => {

  const handle = client.workflow.getHandle(req.params.id);

  const result = await handle.executeUpdate("changeStatus", {
    args: [req.body.status]
  });

  res.json({ status: result });
});

app.get("/issues/:id/status", async (req, res) => {

  const handle = client.workflow.getHandle(req.params.id);

  const result = await handle.query("getStatus");

  res.json({ status: result });
});

app.get("/issues/:id/comments", async (req, res) => {

  const handle = client.workflow.getHandle(req.params.id);

  const result = await handle.query("getComments");

  res.json({ comments: result });
});

/*
────────────────────────────
PROJECTS ENDPOINTS
────────────────────────────
*/

app.post("/projects", async (req, res) => {

  const projectId = uuidv4();

  await client.workflow.start("projectWorkflow", {
    workflowId: `project-${projectId}`,
    taskQueue: "projects",
    args: [{ projectId }]
  });

  res.json({
    projectId,
    workflowId: `project-${projectId}`
  });
});

app.post("/projects/:id/status", async (req, res) => {

  const handle = client.workflow.getHandle(`project-${req.params.id}`);

  const result = await handle.executeUpdate("changeProjectStatus", {
    args: [req.body.status]
  });

  res.json(result);
});

app.get("/projects/:id", async (req, res) => {

  const handle = client.workflow.getHandle(`project-${req.params.id}`);

  const state = await handle.query("getProjectState");

  res.json(state);
});

app.listen(3000, () => {
  console.log("API running on :3000");
});