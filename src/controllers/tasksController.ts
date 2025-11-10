import { IncomingMessage, ServerResponse } from "http";
import fs from "fs";
import path from "path";
import { Todo } from "../types/todo";
import { authenticate } from "./authController";

const file = path.join(__dirname, "../../tasks.json");

// Allowed values for tasks
const allowedPriorities = ["low", "medium", "high"];
const allowedStatuses = ["pending", "in-progress", "completed"];
const allowedLabels = ["work", "personal", "urgent", "misc"];

// Helper to send errors
function sendError(res: ServerResponse, message: string): void {
  res.writeHead(400, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: message }));
}

  // CREATE TASK
export const createTask = (req: IncomingMessage, res: ServerResponse): void => {
  const user = authenticate(req);
  if (!user) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Unauthorized" }));
    return;
  }

  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });

  req.on("end", () => {
    const { title, description, priority, status, labels }: Partial<Todo> =
      JSON.parse(body);

    // === VALIDATIONS ===
    if (!title?.trim()) return sendError(res, "Title is required.");
    if (!description?.trim()) return sendError(res, "Description is required.");

    if (!priority?.trim()) return sendError(res, "Priority is required.");
    if (!allowedPriorities.includes(priority))
      return sendError(res, "Invalid priority provided.");

    if (!status?.trim()) return sendError(res, "Status is required.");
    if (!allowedStatuses.includes(status))
      return sendError(res, "Invalid status provided.");

    if (!labels || !Array.isArray(labels) || labels.length === 0)
      return sendError(res, "At least one label is required.");

    if (!labels.every((label) => allowedLabels.includes(label)))
      return sendError(res, "Invalid label(s) provided.");

    const tasks: Todo[] = JSON.parse(fs.readFileSync(file, "utf8"));

    const newTask: Todo = {
      id: tasks.length ? tasks[tasks.length - 1].id + 1 : 1,
      title: title.trim(),
      description: description.trim(),
      priority,
      status,
      labels,
      userId: user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    tasks.push(newTask);
    fs.writeFileSync(file, JSON.stringify(tasks, null, 2));

    res.writeHead(201, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ message: "Task created successfully", task: newTask })
    );
  });
};
