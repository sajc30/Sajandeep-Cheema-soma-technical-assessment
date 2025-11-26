import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    // Transform the data to include dependencies as an array of IDs
    const todosWithDependencies = todos.map(todo => ({
      ...todo,
      dependencies: todo.dependsOn.map(d => d.dependencyId),
    }));
    
    return NextResponse.json(todosWithDependencies);
  } catch (error) {
    return NextResponse.json({ error: 'Error fetching todos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { title, dueDate } = await request.json();
    if (!title || title.trim() === '') {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    
    // Fetch image from Pexels API
    let imageUrl = null;
    // Support both PEXELS_API_KEY and PEXEL_API_KEY for backwards compatibility
    const pexelsApiKey = (process.env.PEXELS_API_KEY || process.env.PEXEL_API_KEY)?.trim();
    if (pexelsApiKey) {
      try {
        const searchQuery = title.trim();
        const pexelsResponse = await fetch(
          `https://api.pexels.com/v1/search?query=${encodeURIComponent(searchQuery)}&per_page=1`,
          {
            headers: {
              'Authorization': pexelsApiKey,
            },
          }
        );
        
        if (pexelsResponse.ok) {
          const pexelsData = await pexelsResponse.json();
          console.log(`Pexels API response for "${searchQuery}":`, {
            totalResults: pexelsData.total_results,
            photosCount: pexelsData.photos?.length || 0,
          });
          
          if (pexelsData.photos && pexelsData.photos.length > 0 && pexelsData.photos[0].src) {
            // Use medium size for better quality and performance
            const photo = pexelsData.photos[0];
            imageUrl = photo.src?.medium || photo.src?.large || photo.src?.original || photo.src?.small;
            console.log(`Image URL found for "${searchQuery}":`, imageUrl);
            console.log(`Available image sizes:`, {
              small: photo.src?.small,
              medium: photo.src?.medium,
              large: photo.src?.large,
              original: photo.src?.original,
            });
          } else {
            console.log(`No photos found for query: ${searchQuery}`);
          }
        } else {
          const errorText = await pexelsResponse.text();
          console.error(`Pexels API error (${pexelsResponse.status}) for "${searchQuery}":`, errorText);
          // Log the response headers for debugging
          console.error('Response headers:', Object.fromEntries(pexelsResponse.headers.entries()));
        }
      } catch (error) {
        console.error('Error fetching image from Pexels:', error);
        // Continue without image if Pexels API fails
      }
    } else {
      console.warn('PEXELS_API_KEY not set in environment variables');
    }
    
    // Parse due date at UTC midnight to avoid timezone issues
    // This ensures the date stored matches exactly what the user selected
    let parsedDueDate: Date | null = null;
    if (dueDate) {
      // Date string from input is in format YYYY-MM-DD
      // Create date at UTC midnight to preserve the selected date exactly
      // This prevents timezone conversion from shifting the date
      const [year, month, day] = dueDate.split('-').map(Number);
      parsedDueDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    }
    
    const todo = await prisma.todo.create({
      data: {
        title,
        dueDate: parsedDueDate,
        imageUrl,
      },
    });
    
    console.log(`Todo created with ID ${todo.id}, imageUrl:`, todo.imageUrl || 'null');
    return NextResponse.json(todo, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Error creating todo' }, { status: 500 });
  }
}