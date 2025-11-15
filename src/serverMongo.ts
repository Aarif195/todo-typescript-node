import http from "http";
import { connectToMongo } from "./db/mongo";

import { register, login } from "./controllers/authMongoController";
// import { getTasks, createTask } from "./controllers/tasksMongoController";

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
});



connectToMongo().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
