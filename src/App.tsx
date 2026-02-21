import React, { useState, useEffect } from "react";

// TypeScript Interfaces
interface Task {
  id: number;
  title: string;
  description: string;
  completed: boolean;
  priority: "low" | "medium" | "high";
  createdAt: Date;
}

interface NewTaskForm {
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
}

interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
}

// Mock API Functions
const mockApiDelay = (): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, 500));
};

const fetchTasks = async (): Promise<ApiResponse<Task[]>> => {
  await mockApiDelay();

  const mockTasks: Task[] = [
    {
      id: 1,
      title: "Learn TypeScript",
      description: "Understand interfaces, types, and generics",
      completed: false,
      priority: "high",
      createdAt: new Date("2024-02-10"),
    },
    {
      id: 2,
      title: "Build React App",
      description: "Create a task manager with TypeScript",
      completed: true,
      priority: "medium",
      createdAt: new Date("2024-02-11"),
    },
    {
      id: 3,
      title: "Practice Typed Functions",
      description: "Use typed parameters and return types",
      completed: false,
      priority: "low",
      createdAt: new Date("2024-02-12"),
    },
  ];

  return {
    data: mockTasks,
    status: 200,
    message: "Tasks fetched successfully",
  };
};

const createTask = async (
  taskData: NewTaskForm,
): Promise<ApiResponse<Task>> => {
  await mockApiDelay();

  const newTask: Task = {
    id: Date.now(),
    title: taskData.title,
    description: taskData.description,
    completed: false,
    priority: taskData.priority,
    createdAt: new Date(),
  };

  return {
    data: newTask,
    status: 201,
    message: "Task created successfully",
  };
};

const updateTaskStatus = async (
  taskId: number,
  completed: boolean,
): Promise<ApiResponse<Task>> => {
  await mockApiDelay();

  return {
    data: { id: taskId, completed } as Task,
    status: 200,
    message: "Task updated successfully",
  };
};

// Helper Functions with TypeScript
const filterTasksByPriority = (
  tasks: Task[],
  priority: Task["priority"],
): Task[] => {
  return tasks.filter((task) => task.priority === priority);
};

const getCompletedTasks = (tasks: Task[]): Task[] => {
  return tasks.filter((task) => task.completed);
};

const getPendingTasksCount = (tasks: Task[]): number => {
  return tasks.filter((task) => !task.completed).length;
};

const sortTasksByDate = (tasks: Task[], order: "asc" | "desc"): Task[] => {
  return [...tasks].sort((a, b) => {
    const comparison = a.createdAt.getTime() - b.createdAt.getTime();
    return order === "asc" ? comparison : -comparison;
  });
};

const getPriorityColor = (priority: Task["priority"]): string => {
  const colors: Record<Task["priority"], string> = {
    low: "#4CAF50",
    medium: "#FF9800",
    high: "#F44336",
  };
  return colors[priority];
};

// Main Component
const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "completed" | "pending">("all");
  const [priorityFilter, setPriorityFilter] = useState<
    Task["priority"] | "all"
  >("all");

  const [formData, setFormData] = useState<NewTaskForm>({
    title: "",
    description: "",
    priority: "medium",
  });

  // Fetch tasks on component mount
  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async (): Promise<void> => {
    try {
      setLoading(true);
      const response = await fetchTasks();
      setTasks(response.data);
      setError(null);
    } catch (err) {
      setError("Failed to load tasks");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (
    e: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    e.preventDefault();

    if (!formData.title.trim()) {
      alert("Please enter a task title");
      return;
    }

    try {
      const response = await createTask(formData);
      setTasks((prevTasks) => [...prevTasks, response.data]);

      // Reset form
      setFormData({
        title: "",
        description: "",
        priority: "medium",
      });
    } catch (err) {
      setError("Failed to create task");
      console.error(err);
    }
  };

  const handleToggleTask = async (taskId: number): Promise<void> => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    try {
      await updateTaskStatus(taskId, !task.completed);
      setTasks((prevTasks) =>
        prevTasks.map((t) =>
          t.id === taskId ? { ...t, completed: !t.completed } : t,
        ),
      );
    } catch (err) {
      setError("Failed to update task");
      console.error(err);
    }
  };

  const handleDeleteTask = (taskId: number): void => {
    setTasks((prevTasks) => prevTasks.filter((t) => t.id !== taskId));
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ): void => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Filter tasks based on completion status and priority
  const getFilteredTasks = (): Task[] => {
    let filtered = tasks;

    // Filter by completion status
    if (filter === "completed") {
      filtered = getCompletedTasks(filtered);
    } else if (filter === "pending") {
      filtered = filtered.filter((task) => !task.completed);
    }

    // Filter by priority
    if (priorityFilter !== "all") {
      filtered = filterTasksByPriority(filtered, priorityFilter);
    }

    return sortTasksByDate(filtered, "desc");
  };

  const filteredTasks = getFilteredTasks();
  const pendingCount = getPendingTasksCount(tasks);

  if (loading) {
    return <div>Loading tasks...</div>;
  }

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
      <h1>TypeScript Task Manager</h1>

      {error && (
        <div style={{ color: "red", marginBottom: "10px" }}>{error}</div>
      )}

      <div style={{ marginBottom: "20px" }}>
        <h3>Statistics</h3>
        <p>Total Tasks: {tasks.length}</p>
        <p>Pending: {pendingCount}</p>
        <p>Completed: {getCompletedTasks(tasks).length}</p>
      </div>

      <form
        onSubmit={handleCreateTask}
        style={{
          marginBottom: "30px",
          border: "1px solid #ccc",
          padding: "15px",
        }}
      >
        <h3>Add New Task</h3>

        <div style={{ marginBottom: "10px" }}>
          <input
            type="text"
            name="title"
            placeholder="Task title"
            value={formData.title}
            onChange={handleInputChange}
            style={{ width: "100%", padding: "8px" }}
          />
        </div>

        <div style={{ marginBottom: "10px" }}>
          <textarea
            name="description"
            placeholder="Task description"
            value={formData.description}
            onChange={handleInputChange}
            style={{ width: "100%", padding: "8px", minHeight: "60px" }}
          />
        </div>

        <div style={{ marginBottom: "10px" }}>
          <select
            name="priority"
            value={formData.priority}
            onChange={handleInputChange}
            style={{ padding: "8px" }}
          >
            <option value="low">Low Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="high">High Priority</option>
          </select>
        </div>

        <button type="submit" style={{ padding: "10px 20px" }}>
          Add Task
        </button>
      </form>

      <div style={{ marginBottom: "20px" }}>
        <h3>Filters</h3>
        <div style={{ marginBottom: "10px" }}>
          <button
            onClick={() => setFilter("all")}
            style={{ marginRight: "5px" }}
          >
            All
          </button>
          <button
            onClick={() => setFilter("pending")}
            style={{ marginRight: "5px" }}
          >
            Pending
          </button>
          <button onClick={() => setFilter("completed")}>Completed</button>
        </div>

        <div>
          <select
            value={priorityFilter}
            onChange={(e) =>
              setPriorityFilter(e.target.value as Task["priority"] | "all")
            }
            style={{ padding: "8px" }}
          >
            <option value="all">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>

      <div>
        <h3>Tasks ({filteredTasks.length})</h3>
        {filteredTasks.length === 0 ? (
          <p>No tasks found</p>
        ) : (
          filteredTasks.map((task: Task) => (
            <div
              key={task.id}
              style={{
                border: "1px solid #ddd",
                padding: "15px",
                marginBottom: "10px",
                backgroundColor: task.completed ? "#f0f0f0" : "white",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "start",
                }}
              >
                <div style={{ flex: 1 }}>
                  <h4
                    style={{
                      margin: "0 0 5px 0",
                      textDecoration: task.completed ? "line-through" : "none",
                    }}
                  >
                    {task.title}
                  </h4>
                  <p style={{ margin: "0 0 5px 0", color: "#666" }}>
                    {task.description}
                  </p>
                  <div style={{ fontSize: "12px", color: "#999" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        backgroundColor: getPriorityColor(task.priority),
                        color: "white",
                        borderRadius: "3px",
                        marginRight: "10px",
                      }}
                    >
                      {task.priority.toUpperCase()}
                    </span>
                    Created: {task.createdAt.toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <button
                    onClick={() => handleToggleTask(task.id)}
                    style={{ marginRight: "5px", padding: "5px 10px" }}
                  >
                    {task.completed ? "Undo" : "Complete"}
                  </button>
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    style={{ padding: "5px 10px" }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default App;
