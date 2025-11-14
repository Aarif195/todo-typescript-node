import {  ServerResponse } from "http";
import { getDb } from "../db/mongo";
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