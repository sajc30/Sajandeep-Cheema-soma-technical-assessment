import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Calculate earliest start date for each task based on dependencies
function calculateEarliestStartDates(
  todos: any[],
  dependencies: Map<number, number[]>
): Map<number, Date> {
  const earliestStartDates = new Map<number, Date>();
  const visited = new Set<number>();
  
  function dfs(todoId: number): Date {
    if (visited.has(todoId)) {
      return earliestStartDates.get(todoId) || new Date();
    }
    visited.add(todoId);
    
    const todo = todos.find(t => t.id === todoId);
    if (!todo) return new Date();
    
    const deps = dependencies.get(todoId) || [];
    let maxEndDate = new Date();
    
    for (const depId of deps) {
      const depEndDate = dfs(depId);
      const depTodo = todos.find(t => t.id === depId);
      if (depTodo?.dueDate) {
        const depDueDate = new Date(depTodo.dueDate);
        if (depDueDate > depEndDate) {
          if (depDueDate > maxEndDate) {
            maxEndDate = depDueDate;
          }
        } else {
          if (depEndDate > maxEndDate) {
            maxEndDate = depEndDate;
          }
        }
      } else {
        if (depEndDate > maxEndDate) {
          maxEndDate = depEndDate;
        }
      }
    }
    
    earliestStartDates.set(todoId, maxEndDate);
    return maxEndDate;
  }
  
  todos.forEach(todo => {
    if (!visited.has(todo.id)) {
      dfs(todo.id);
    }
  });
  
  return earliestStartDates;
}

// Calculate critical path using topological sort and longest path
function calculateCriticalPath(
  todos: any[],
  dependencies: Map<number, number[]>
): number[] {
  const inDegree = new Map<number, number>();
  const graph = new Map<number, number[]>();
  
  todos.forEach(todo => {
    inDegree.set(todo.id, 0);
    graph.set(todo.id, []);
  });
  
  dependencies.forEach((deps, todoId) => {
    deps.forEach(depId => {
      if (!graph.has(depId)) {
        graph.set(depId, []);
      }
      graph.get(depId)!.push(todoId);
      inDegree.set(todoId, (inDegree.get(todoId) || 0) + 1);
    });
  });
  
  const queue: number[] = [];
  inDegree.forEach((degree, id) => {
    if (degree === 0) {
      queue.push(id);
    }
  });
  
  const distances = new Map<number, number>();
  const predecessors = new Map<number, number>();
  
  todos.forEach(todo => {
    distances.set(todo.id, 0);
  });
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = graph.get(current) || [];
    
    neighbors.forEach(neighbor => {
      const todo = todos.find(t => t.id === neighbor);
      const weight = todo?.dueDate ? 1 : 1; // Weight based on due date
      const newDist = (distances.get(current) || 0) + weight;
      
      if (newDist > (distances.get(neighbor) || 0)) {
        distances.set(neighbor, newDist);
        predecessors.set(neighbor, current);
      }
      
      const newDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDegree);
      
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    });
  }
  
  // Find the longest path
  let maxDist = 0;
  let endNode = -1;
  distances.forEach((dist, id) => {
    if (dist > maxDist) {
      maxDist = dist;
      endNode = id;
    }
  });
  
  // If no dependencies exist, return empty array
  if (endNode === -1 || maxDist === 0) {
    return [];
  }
  
  // Reconstruct the path
  const path: number[] = [];
  let current = endNode;
  const visited = new Set<number>();
  while (current !== -1 && !visited.has(current)) {
    visited.add(current);
    path.unshift(current);
    current = predecessors.get(current) || -1;
  }
  
  return path;
}

export async function GET() {
  try {
    const todos = await prisma.todo.findMany({
      include: {
        dependsOn: {
          include: {
            dependency: true,
          },
        },
      },
    });
    
    // Build dependency map
    const dependencies = new Map<number, number[]>();
    todos.forEach(todo => {
      dependencies.set(
        todo.id,
        todo.dependsOn.map(d => d.dependencyId)
      );
    });
    
    // Calculate earliest start dates
    const earliestStartDates = calculateEarliestStartDates(todos, dependencies);
    
    // Calculate critical path
    const criticalPath = calculateCriticalPath(todos, dependencies);
    
    // Convert dates to strings for JSON response
    const earliestStartDatesObj: Record<number, string> = {};
    earliestStartDates.forEach((date, id) => {
      earliestStartDatesObj[id] = date.toISOString();
    });
    
    return NextResponse.json({
      earliestStartDates: earliestStartDatesObj,
      criticalPath,
    });
  } catch (error) {
    console.error('Error calculating analysis:', error);
    return NextResponse.json({ error: 'Error calculating analysis' }, { status: 500 });
  }
}

