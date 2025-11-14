import { ServerResponse, IncomingMessage } from "http";
import { getDb } from "../db/mongo";
import { hashPassword } from "./authController"; 
import { sendError } from "./tasksMongoController"; 

interface User {
  _id?: string;
  username: string;
  email: string;
  password: string;
}


function getUsersCollection() {
  const db = getDb();
  return db.collection<User>("users"); // MongoDB collection is named "users"
}


export async function register(req: IncomingMessage, res: ServerResponse) {
  let body = "";
  req.on("data", (chunk) => { body += chunk.toString(); });

  req.on("end", async () => {
    try {
      const { username, email, password }: { username: string; email: string; password: string } = JSON.parse(body);

      // Validation (same as before)
      if (!username || !email || !password) return sendError(res, "All fields are required");

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) return sendError(res, "Invalid email format");

      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
      if (!passwordRegex.test(password)) return sendError(res, "Password must be at least 8 characters and include uppercase, lowercase, number, and special character");

      const usersCol = getUsersCollection();

      // Unique email check
      const emailExists = await usersCol.findOne({ email });
      if (emailExists) return sendError(res, "Email already exists");

      // Unique username check
      const usernameExists = await usersCol.findOne({ username });
      if (usernameExists) return sendError(res, "Username already exists");

      // Create new user
      const newUser: User = {
        username,
        email,
        password: hashPassword(password),
      };

      await usersCol.insertOne(newUser);

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "User registered successfully" }));

    } catch (err) {
      console.error(err);
      sendError(res, "Server error");
    }
  });
}
