import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface Params {
  params: {
    id: string;
  };
}

// Helper function to check for circular dependencies using DFS
async function hasCircularDependency(
  todoId: number,
  dependencyId: number,
  visited: Set<number> = new Set()
): Promise<boolean> {
  if (todoId === dependencyId) return true;
  if (visited.has(dependencyId)) return false;
  
  visited.add(dependencyId);
  
  // Get all dependencies of the dependency
  const dependencies = await prisma.todoDependency.findMany({
    where: { dependentId: dependencyId },
    select: { dependencyId: true },
  });
  
  for (const dep of dependencies) {
    if (await hasCircularDependency(todoId, dep.dependencyId, new Set(visited))) {
      return true;
    }
  }
  
  return false;
}

// Add a dependency
export async function POST(request: Request, { params }: Params) {
  const id = parseInt(params.id);
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    const { dependencyId } = await request.json();
    const depId = parseInt(dependencyId);
    
    if (isNaN(depId)) {
      return NextResponse.json({ error: 'Invalid dependency ID' }, { status: 400 });
    }
    
    if (id === depId) {
      return NextResponse.json({ error: 'A task cannot depend on itself' }, { status: 400 });
    }
    
    // Check for circular dependency
    if (await hasCircularDependency(id, depId)) {
      return NextResponse.json({ error: 'Circular dependency detected' }, { status: 400 });
    }
    
    // Check if dependency already exists
    const existing = await prisma.todoDependency.findUnique({
      where: {
        dependentId_dependencyId: {
          dependentId: id,
          dependencyId: depId,
        },
      },
    });
    
    if (existing) {
      return NextResponse.json({ error: 'Dependency already exists' }, { status: 400 });
    }
    
    const dependency = await prisma.todoDependency.create({
      data: {
        dependentId: id,
        dependencyId: depId,
      },
      include: {
        dependency: true,
      },
    });
    
    return NextResponse.json(dependency, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Dependency already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error adding dependency' }, { status: 500 });
  }
}

// Remove a dependency
export async function DELETE(request: Request, { params }: Params) {
  const id = parseInt(params.id);
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const dependencyId = parseInt(searchParams.get('dependencyId') || '');
    
    if (isNaN(dependencyId)) {
      return NextResponse.json({ error: 'Invalid dependency ID' }, { status: 400 });
    }
    
    await prisma.todoDependency.delete({
      where: {
        dependentId_dependencyId: {
          dependentId: id,
          dependencyId: dependencyId,
        },
      },
    });
    
    return NextResponse.json({ message: 'Dependency removed' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Error removing dependency' }, { status: 500 });
  }
}

