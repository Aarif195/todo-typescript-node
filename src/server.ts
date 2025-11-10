import http from "http";

import { Todo } from "./types/todo";

const PORT = process.env.PORT || 8080;

import { register, login } from "./controllers/authController";

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



  

});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} `);
});
