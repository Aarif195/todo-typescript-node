import { ObjectId } from "mongodb";

export type Todo = {
  _id?: ObjectId;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  status: "pending" | "in-progress" | "completed";
  labels: string[];
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  userId: ObjectId; 
  isLiked?: boolean;
  likesCount?: number;
  comments?: Comment[];
};


export type Reply = {
  _id?: ObjectId;       // Mongo-generated ID
  userId: ObjectId;     // reference to User._id
  username: string;
  text: string;
  date: string;
  updatedAt?: string;
};

export type Comment = {
  _id?: ObjectId;       // Mongo-generated ID
  userId: ObjectId;     // reference to User._id
  username: string;
  text: string;
  date: string;
  updatedAt?: string;
  replies: Reply[];
};