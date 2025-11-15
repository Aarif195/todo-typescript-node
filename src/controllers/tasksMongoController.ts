import { IncomingMessage, ServerResponse } from "http";
import { getDb } from "../db/mongo";
import { ObjectId } from "mongodb";
import { authenticate } from "./authMongoController";
import { Todo, Reply, Comment } from "../types/todoMongo";
const db = getDb();
const tasksCollection = db.collection("tasks");

// Allowed values for tasks
const allowedPriorities = ["low", "medium", "high"];
const allowedStatuses = ["pending", "in-progress", "completed"];
const allowedLabels = ["work", "personal", "urgent", "misc"];

// Helper to send errors
export function sendError(res: ServerResponse, message: string): void {
  res.writeHead(400, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: message }));
}

interface User {
  _id?: ObjectId;
  username: string;
  email: string;
  password: string;
}


export function getTasksCollection() {
  return getDb().collection("tasks");
}

// CREATE TASK
export const createTask = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
  try {
    const user = await authenticate(req);
    if (!user) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Unauthorized" }));
      return;
    }

    let body = "";
    req.on("data", (chunk) => { body += chunk.toString(); });

    req.on("end", async () => {
      const { title, description, priority, status, labels, completed }: Partial<Todo> = JSON.parse(body);

      // VALIDATIONS
      if (!title?.trim()) return sendError(res, "Title is required.");
      if (!description?.trim()) return sendError(res, "Description is required.");
      if (!priority?.trim()) return sendError(res, "Priority is required.");
      if (!allowedPriorities.includes(priority)) return sendError(res, "Invalid priority provided.");
      if (!status?.trim()) return sendError(res, "Status is required.");
      if (!allowedStatuses.includes(status)) return sendError(res, "Invalid status provided.");
      if (!labels || !Array.isArray(labels) || labels.length === 0) return sendError(res, "At least one label is required.");
      if (!labels.every((label) => allowedLabels.includes(label))) return sendError(res, "Invalid label(s) provided.");
      if (typeof completed !== "boolean") return sendError(res, "Completed must be boolean");

      const tasksCol = getTasksCollection(); // MongoDB collection

      const newTask: Todo = {
        title: title.trim(),
        description: description.trim(),
        priority,
        status,
        labels,
        completed,
        userId: user._id, // MongoDB user id
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await tasksCol.insertOne(newTask);

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Task created successfully", task: { ...newTask, _id: result.insertedId } }));
    });

  } catch (err) {
    console.error(err);
    sendError(res, "Server error");
  }
};
