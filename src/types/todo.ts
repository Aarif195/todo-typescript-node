// src/types/todo.ts
// export type Todo = {
//   id: string;
//   title: string;
//   completed: boolean;
// };

export type Todo = {
  id: number;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  status: "pending" | "in-progress" | "completed";
  labels: string[];
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  userId: number;
  isLiked?: boolean;     
  likesCount?: number;
};
