import http from "http";

import { Todo } from "./types/todo";

const PORT = process.env.PORT || 8080;

import { register, login } from "./controllers/authController";

import { createTask , getTasks, toggleTaskCompletion,getTaskById} from "./controllers/tasksController";

const server = http.createServer((req, res) => {
  const url = req.url;
  const method = req.method;

  if (url === "/" && method === "GET") {
    res.end(JSON.stringify({ message: "Hello TypeScript Node" }));
  }

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
else if (url && url.startsWith("/api/tasks") && method === "GET")
 {
  return getTasks(req, res);
}

// Mark task as completed
else if (url?.startsWith("/api/tasks/") && url.endsWith("/complete") && method === "PATCH") {
    return toggleTaskCompletion(req, res);
}

// Mark task as incomplete
else if (url?.startsWith("/api/tasks/") && url.endsWith("/incomplete") && method === "PATCH") {
    return toggleTaskCompletion(req, res);
}




});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} `);
});
