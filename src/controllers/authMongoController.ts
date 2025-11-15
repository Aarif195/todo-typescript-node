import { ServerResponse, IncomingMessage } from "http";
import crypto from "crypto";
import { getDb } from "../db/mongo";
import { ObjectId } from "mongodb";
import { hashPassword } from "./authController";
import { sendError } from "./tasksMongoController";

interface User {
  _id?: ObjectId;
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
  req.on("data", (chunk) => {
    body += chunk.toString();
  });

  req.on("end", async () => {
    try {
      const {
        username,
        email,
        password,
      }: { username: string; email: string; password: string } =
        JSON.parse(body);

      // Validation (same as before)
      if (!username || !email || !password)
        return sendError(res, "All fields are required");

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email))
        return sendError(res, "Invalid email format");

      const passwordRegex =
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
      if (!passwordRegex.test(password))
        return sendError(
          res,
          "Password must be at least 8 characters and include uppercase, lowercase, number, and special character"
        );

      const usersCol = getUsersCollection();
      console.log("USERS COLLECTION CONNECTED");

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

      // await usersCol.insertOne(newUser);
      const result = await usersCol.insertOne(newUser);
      console.log("Inserted user ID:", result.insertedId);
      console.log("INSERTING USER:", newUser);
      console.log("USER INSERTED"); // Optional, after insert

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          message: "User registered successfully",
          user: {
            id: result.insertedId,
            username: newUser.username,
            email: newUser.email,
          },
        })
      );
    } catch (err) {
      console.error(err);
      sendError(res, "Server error");
    }
  });
}

export async function login(req: IncomingMessage, res: ServerResponse) {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });

  req.on("end", async () => {
    try {
      const { email, password }: { email: string; password: string } =
        JSON.parse(body);

      // Validate required fields
      if (!email || !password)
        return sendError(res, "Email and password are required");

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email))
        return sendError(res, "Invalid email format");

      const usersCol = getUsersCollection();

      // Find user by email
      const user = await usersCol.findOne({ email });

      if (!user || user.password !== hashPassword(password)) {
        res.writeHead(401, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ message: "Invalid credentials" }));
      }

      // Generate a new token for current login
      const token = crypto.randomBytes(24).toString("hex");

      // Update token in MongoDB
      await usersCol.updateMany({}, { $unset: { token: "" } }); // remove old tokens
      await usersCol.updateOne({ _id: user._id }, { $set: { token } }); // set new token for current user

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          message: "Login successful",
          token,
          user: { id: user._id, username: user.username, email: user.email },
        })
      );
    } catch (err) {
      console.error(err);
      sendError(res, "Server error");
    }
  });
}

// connectToMongo();

// server.listen(PORT, () => {
//   console.log(`Server running on port ${PORT} `);
// });
