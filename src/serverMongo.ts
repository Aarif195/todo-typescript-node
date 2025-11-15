import http from "http";
import { connectToMongo } from "./db/mongo";

import { register, login } from "./controllers/authMongoController";
import {  createTask, getTasks, getTaskById, updateTask, deleteTask, toggleTaskCompletion } from "./controllers/tasksMongoController";

const PORT = process.env.PORT || 8080;

console.log("ServerMongo is running...");
console.log("I am fine today");

const server = http.createServer((req, res) => {
  const url = req.url;
  const method = req.method;

  console.log("Incoming request:", req.url, req.method);

  // Register
  if (url === "/api/register" && method === "POST") {
    return register(req, res);
  }

  // Login
  if (url === "/api/login" && method === "POST") {
    return login(req, res);
    
  }


 // CREATE TASK
  else if (url === "/api/tasks" && method === "POST") {
    return createTask(req, res);
  }


// GET TASK BY ID
    else if (url?.startsWith("/api/tasks/") && method === "GET") {
      return getTaskById(req, res);
    }


   // GET TASKS
    else if (url && url.startsWith("/api/tasks") && method === "GET") {
      return getTasks(req, res);
    }

 // UPDATE TASK
  else if (url?.startsWith("/api/tasks/") && method === "PUT") {
    return updateTask(req, res);
  }

   // Mark task as completed
    else if (
      url?.startsWith("/api/tasks/") &&
      url.endsWith("/complete") &&
      method === "PATCH"
    ) {
      return toggleTaskCompletion(req, res);
    }
  
    // Mark task as incomplete
    else if (
      url?.startsWith("/api/tasks/") &&
      url.endsWith("/incomplete") &&
      method === "PATCH"
    ) {
      return toggleTaskCompletion(req, res);
    }

  // DELETE TASK
    else if (url?.startsWith("/api/tasks/") && method === "DELETE") {
      return deleteTask(req, res);
    }


});

connectToMongo().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
