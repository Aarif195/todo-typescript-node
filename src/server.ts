import http from "http";
import { Todo } from './types/todo';

const PORT = process.env.PORT || 8080;


const server = http.createServer((req, res) => {
  const url = req.url;
  const method = req.method;

  if (url === "/" && method === "GET") {
    res.end("Hello TypeScript Node");
  }
});


server.listen(PORT, () => {
    console.log(`Server running on port ${PORT} `);
});
