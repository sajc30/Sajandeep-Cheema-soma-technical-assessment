"use client"
import { useState, useEffect } from 'react';

interface Todo {
  id: number;
  title: string;
  dueDate: string | null;
  imageUrl: string | null;
  createdAt: string;
  dependencies: number[];
}

export default function Home() {
  const [newTodo, setNewTodo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loadingImages, setLoadingImages] = useState<Set<number>>(new Set());
  const [isCreatingTodo, setIsCreatingTodo] = useState(false);
  const [analysis, setAnalysis] = useState<{
    earliestStartDates: Record<number, string>;
    criticalPath: number[];
  } | null>(null);
  const [selectedTodo, setSelectedTodo] = useState<number | null>(null);
  const [showDependencyModal, setShowDependencyModal] = useState(false);
  const [showGraph, setShowGraph] = useState(false);

  useEffect(() => {
    fetchTodos();
    fetchAnalysis();
  }, []);

  const fetchTodos = async (preserveLoadingState = false) => {
    try {
      const res = await fetch('/api/todos');
      const data = await res.json();
      
      if (preserveLoadingState) {
        // Preserve loading state for existing todos that are already loaded
        setTodos(prevTodos => {
          const prevTodosMap = new Map(prevTodos.map(t => [t.id, t]));
          
          // Only set loading state for new todos or todos that got a new imageUrl
          data.forEach((todo: Todo) => {
            const prevTodo = prevTodosMap.get(todo.id);
            // Only set loading if:
            // 1. This is a new todo (didn't exist before), OR
            // 2. The imageUrl changed (was null/empty before, now has a value)
            if (todo.imageUrl && (!prevTodo || !prevTodo.imageUrl)) {
              setLoadingImages(prev => {
                // Don't reset if image was already loaded (not in loading set)
                if (!prev.has(todo.id)) {
                  return new Set(prev).add(todo.id);
                }
                return prev;
              });
            }
          });
          
          return data;
        });
      } else {
        // Initial load - set todos immediately
        setTodos(data);
        // Don't set loading state on initial load - images will render directly
        // Cached images will show immediately, others will load naturally
        // The onLoad handler will work for both cases
        // Loading state is only needed for newly created todos
      }
    } catch (error) {
      console.error('Failed to fetch todos:', error);
    }
  };

  const fetchAnalysis = async () => {
    try {
      const res = await fetch('/api/todos/analysis');
      const data = await res.json();
      setAnalysis(data);
    } catch (error) {
      console.error('Failed to fetch analysis:', error);
    }
  };

  const handleAddTodo = async () => {
    if (!newTodo.trim() || isCreatingTodo) return;
    setIsCreatingTodo(true);
    try {
      const response = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTodo, dueDate: dueDate || null }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to add todo:', error);
        alert(error.error || 'Failed to create todo');
        setIsCreatingTodo(false);
        return;
      }
      
      const newTodoData = await response.json();
      setNewTodo('');
      setDueDate('');
      
      // Add the new todo to the existing list immediately
      // The response already includes all the data we need
      const newTodoWithDeps: Todo = {
        ...newTodoData,
        dependencies: newTodoData.dependencies || [],
      };
      
      setTodos(prevTodos => [newTodoWithDeps, ...prevTodos]);
      
      // Set loading state for the new todo's image if it has one
      if (newTodoData.imageUrl) {
        setLoadingImages(prev => new Set(prev).add(newTodoData.id));
      }
      
      // Only refresh analysis (doesn't affect todos display)
      fetchAnalysis();
    } catch (error) {
      console.error('Failed to add todo:', error);
      alert('Failed to create todo. Please try again.');
    } finally {
      setIsCreatingTodo(false);
    }
  };

  const handleDeleteTodo = async (id: number) => {
    try {
      await fetch(`/api/todos/${id}`, {
        method: 'DELETE',
      });
      // Remove the todo from the list immediately
      setTodos(prevTodos => prevTodos.filter(todo => todo.id !== id));
      // Remove from loading images if present
      setLoadingImages(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      // Refresh analysis in the background
      fetchAnalysis();
    } catch (error) {
      console.error('Failed to delete todo:', error);
    }
  };

  const handleAddDependency = async (todoId: number, dependencyId: number) => {
    try {
      const res = await fetch(`/api/todos/${todoId}/dependencies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dependencyId }),
      });
      if (!res.ok) {
        const error = await res.json();
        alert(error.error || 'Failed to add dependency');
        return;
      }
      // Update only the specific todo's dependencies
      setTodos(prevTodos => 
        prevTodos.map(todo => 
          todo.id === todoId 
            ? { ...todo, dependencies: [...todo.dependencies, dependencyId] }
            : todo
        )
      );
      fetchAnalysis();
      setShowDependencyModal(false);
      setSelectedTodo(null);
    } catch (error) {
      console.error('Failed to add dependency:', error);
      alert('Failed to add dependency');
    }
  };

  const handleRemoveDependency = async (todoId: number, dependencyId: number) => {
    try {
      await fetch(`/api/todos/${todoId}/dependencies?dependencyId=${dependencyId}`, {
        method: 'DELETE',
      });
      // Update only the specific todo's dependencies
      setTodos(prevTodos => 
        prevTodos.map(todo => 
          todo.id === todoId 
            ? { ...todo, dependencies: todo.dependencies.filter(id => id !== dependencyId) }
            : todo
        )
      );
      fetchAnalysis();
    } catch (error) {
      console.error('Failed to remove dependency:', error);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    // Parse the date string - it comes from the database as an ISO string
    // Use UTC methods to extract the date components to avoid timezone shifts
    // This ensures the date displayed matches what was selected
    const date = new Date(dateString);
    // If the date string is in ISO format with time, use UTC to get the date parts
    // This prevents timezone conversion from shifting the date
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    // Return in a readable format
    return `${month}/${day}/${year}`;
  };

  const isOverdue = (dateString: string | null) => {
    if (!dateString) return false;
    // Compare dates at midnight UTC to avoid timezone issues
    const dueDate = new Date(dateString);
    const today = new Date();
    // Set both to midnight UTC for accurate comparison
    const dueDateUTC = new Date(Date.UTC(
      dueDate.getUTCFullYear(),
      dueDate.getUTCMonth(),
      dueDate.getUTCDate()
    ));
    const todayUTC = new Date(Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate()
    ));
    return dueDateUTC < todayUTC;
  };

  const getEarliestStartDate = (todoId: number) => {
    if (!analysis) return null;
    return analysis.earliestStartDates[todoId] || null;
  };

  const isOnCriticalPath = (todoId: number) => {
    if (!analysis) return false;
    return analysis.criticalPath.includes(todoId);
  };

  const renderDependencyGraph = () => {
    if (!showGraph || todos.length === 0) return null;

    // Simple force-directed layout
    const width = 800;
    const height = 600;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 3;

    const nodes = todos.map((todo, idx) => {
      const angle = (2 * Math.PI * idx) / todos.length;
      return {
        id: todo.id,
        label: todo.title,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      };
    });

    const edges: Array<{ from: number; to: number }> = [];
    todos.forEach(todo => {
      todo.dependencies.forEach(depId => {
        edges.push({ from: depId, to: todo.id });
      });
    });

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-5xl w-full max-h-[90vh] overflow-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-black">Dependency Graph</h2>
            <button
              onClick={() => setShowGraph(false)}
              className="text-black hover:text-gray-700 text-2xl"
            >
              ✕
            </button>
          </div>
          <div className="overflow-auto">
            <svg width={width} height={height} className="border border-gray-300 rounded">
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="10"
                  refX="9"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3, 0 6" fill="#3b82f6" />
                </marker>
              </defs>
              {/* Render edges */}
              {edges.map((edge, idx) => {
                const fromNode = nodes.find(n => n.id === edge.from);
                const toNode = nodes.find(n => n.id === edge.to);
                if (!fromNode || !toNode) return null;
                return (
                  <line
                    key={idx}
                    x1={fromNode.x}
                    y1={fromNode.y}
                    x2={toNode.x}
                    y2={toNode.y}
                    stroke={isOnCriticalPath(edge.to) && isOnCriticalPath(edge.from) ? "#ef4444" : "#3b82f6"}
                    strokeWidth="2"
                    markerEnd="url(#arrowhead)"
                  />
                );
              })}
              {/* Render nodes */}
              {nodes.map(node => (
                <g key={node.id}>
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r="35"
                    fill={isOnCriticalPath(node.id) ? "#ef4444" : "#3b82f6"}
                    stroke="#fff"
                    strokeWidth="3"
                  />
                  <text
                    x={node.x}
                    y={node.y - 45}
                    textAnchor="middle"
                    fontSize="11"
                    fill="#000000"
                    fontWeight="bold"
                  >
                    {node.label.length > 20 ? node.label.substring(0, 20) + '...' : node.label}
                  </text>
                  <text
                    x={node.x}
                    y={node.y + 5}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#fff"
                  >
                    #{node.id}
                  </text>
                </g>
              ))}
            </svg>
          </div>
          <div className="mt-4 flex gap-4 justify-center">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
              <span className="text-black">Normal Task</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded-full"></div>
              <span className="text-black">Critical Path</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-500 to-red-500 flex flex-col items-center p-4">
      <div className="w-full max-w-4xl">
        <h1 className="text-4xl font-bold text-center text-white mb-8">Things To Do App</h1>
        
        {/* Add Todo Form */}
        <div className="bg-white bg-opacity-90 p-4 rounded-lg shadow-lg mb-6">
          <div className="flex flex-col sm:flex-row gap-2 mb-2">
            <input
              type="text"
              className="flex-grow p-3 rounded-lg focus:outline-none text-gray-700 border border-gray-300"
              placeholder="Add a new todo"
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddTodo()}
            />
            <input
              type="date"
              className="p-3 rounded-lg focus:outline-none text-gray-700 border border-gray-300"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            <button
              onClick={handleAddTodo}
              disabled={isCreatingTodo}
              className="bg-indigo-600 text-white p-3 rounded-lg hover:bg-indigo-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[80px]"
            >
              {isCreatingTodo ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                'Add'
              )}
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-2 mb-4 justify-center">
          <button
            onClick={() => setShowGraph(true)}
            className="bg-white bg-opacity-90 px-4 py-2 rounded-lg hover:bg-opacity-100 transition text-black font-semibold"
          >
            Show Dependency Graph
          </button>
        </div>

        {/* Todo List */}
        <ul className="space-y-4">
          {todos.map((todo) => (
            <li
              key={todo.id}
              className={`bg-white bg-opacity-90 p-4 rounded-lg shadow-lg ${
                isOnCriticalPath(todo.id) ? 'ring-2 ring-red-500' : ''
              }`}
            >
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Image Preview */}
                <div className="flex-shrink-0 relative">
                  {todo.imageUrl ? (
                    <>
                      <img
                        src={todo.imageUrl}
                        alt={todo.title}
                        className="w-24 h-24 object-cover rounded-lg border border-gray-300"
                        onLoad={() => {
                          setLoadingImages(prev => {
                            const next = new Set(prev);
                            next.delete(todo.id);
                            return next;
                          });
                        }}
                        onError={(e) => {
                          console.error('Image load error for todo:', todo.id, todo.imageUrl);
                          setLoadingImages(prev => {
                            const next = new Set(prev);
                            next.delete(todo.id);
                            return next;
                          });
                          // Hide broken image
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      {loadingImages.has(todo.id) && (
                        <div className="w-24 h-24 bg-gray-200 bg-opacity-90 rounded-lg flex items-center justify-center border border-gray-300 absolute inset-0 z-10">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center border border-gray-300">
                      <span className="text-gray-400 text-xs text-center px-2">No image</span>
                    </div>
                  )}
                </div>

                {/* Todo Content */}
                <div className="flex-grow">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-800">{todo.title}</h3>
                    <button
                      onClick={() => handleDeleteTodo(todo.id)}
                      className="text-red-500 hover:text-red-700 transition duration-300 ml-2"
                    >
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>

                  {/* Due Date */}
                  {todo.dueDate && (
                    <div className="mb-2">
                      <span className="text-sm text-gray-600">Due: </span>
                      <span
                        className={`text-sm font-medium ${
                          isOverdue(todo.dueDate) ? 'text-red-600' : 'text-gray-800'
                        }`}
                      >
                        {formatDate(todo.dueDate)}
                      </span>
                    </div>
                  )}

                  {/* Earliest Start Date */}
                  {getEarliestStartDate(todo.id) && (
                    <div className="mb-2">
                      <span className="text-sm text-gray-600">Earliest Start: </span>
                      <span className="text-sm font-medium text-blue-600">
                        {formatDate(getEarliestStartDate(todo.id))}
                      </span>
                    </div>
                  )}

                  {/* Critical Path Indicator */}
                  {isOnCriticalPath(todo.id) && (
                    <div className="mb-2">
                      <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                        Critical Path
                      </span>
                    </div>
                  )}

                  {/* Dependencies */}
                  <div className="mb-2">
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-sm text-gray-600">Depends on: </span>
                      {todo.dependencies.length > 0 ? (
                        todo.dependencies.map((depId) => {
                          const depTodo = todos.find(t => t.id === depId);
                          return depTodo ? (
                            <span
                              key={depId}
                              className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded flex items-center gap-1"
                            >
                              {depTodo.title}
                              <button
                                onClick={() => handleRemoveDependency(todo.id, depId)}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                ✕
                              </button>
                            </span>
                          ) : null;
                        })
                      ) : (
                        <span className="text-xs text-gray-400">None</span>
                      )}
                    </div>
                  </div>

                  {/* Add Dependency Button */}
                  <button
                    onClick={() => {
                      setSelectedTodo(todo.id);
                      setShowDependencyModal(true);
                    }}
                    className="text-sm text-indigo-600 hover:text-indigo-800 mt-2"
                  >
                    + Add Dependency
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* Dependency Modal */}
        {showDependencyModal && selectedTodo && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-2xl font-bold mb-4 text-black">Add Dependency</h2>
              <p className="text-sm text-black mb-4">
                Select a task that this task depends on:
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {todos
                  .filter(t => t.id !== selectedTodo && !todos.find(td => td.id === selectedTodo)?.dependencies.includes(t.id))
                  .map((todo) => (
                    <button
                      key={todo.id}
                      onClick={() => handleAddDependency(selectedTodo, todo.id)}
                      className="w-full text-left p-2 hover:bg-gray-100 rounded border border-gray-200 text-black"
                    >
                      {todo.title}
                    </button>
                  ))}
              </div>
              <button
                onClick={() => {
                  setShowDependencyModal(false);
                  setSelectedTodo(null);
                }}
                className="mt-4 w-full bg-gray-200 text-black p-2 rounded hover:bg-gray-300 font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Dependency Graph */}
        {renderDependencyGraph()}
      </div>
    </div>
  );
}
