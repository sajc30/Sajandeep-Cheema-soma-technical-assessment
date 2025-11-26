## Soma Capital Technical Assessment

This is a technical assessment as part of the interview process for Soma Capital.

> [!IMPORTANT]  
> You will need a Pexels API key to complete the technical assessment portion of the application. You can sign up for a free API key at https://www.pexels.com/api/  

To begin, clone this repository to your local machine.

## Development

This is a [NextJS](https://nextjs.org) app, with a SQLite based backend, intended to be run with the LTS version of Node.

To run the development server:

```bash
npm i
npm run dev
```

## Task:

Modify the code to add support for due dates, image previews, and task dependencies.

### Part 1: Due Dates 

When a new task is created, users should be able to set a due date.

When showing the task list is shown, it must display the due date, and if the date is past the current time, the due date should be in red.

### Part 2: Image Generation 

When a todo is created, search for and display a relevant image to visualize the task to be done. 

To do this, make a request to the [Pexels API](https://www.pexels.com/api/) using the task description as a search query. Display the returned image to the user within the appropriate todo item. While the image is being loaded, indicate a loading state.

You will need to sign up for a free Pexels API key to make the fetch request. 

### Part 3: Task Dependencies

Implement a task dependency system that allows tasks to depend on other tasks. The system must:

1. Allow tasks to have multiple dependencies
2. Prevent circular dependencies
3. Show the critical path
4. Calculate the earliest possible start date for each task based on its dependencies
5. Visualize the dependency graph

## Solution

### Implementation Overview

All three parts of the technical assessment have been successfully implemented:

#### Part 1: Due Dates ✅
- Added a date input field in the todo creation form
- Due dates are stored in the database and displayed for each task
- Overdue dates (past the current time) are displayed in red
- The due date is shown below the task title with appropriate styling

#### Part 2: Image Generation ✅
- Integrated with the Pexels API to fetch relevant images based on task descriptions
- Images are automatically fetched when a new todo is created
- Image previews are displayed in a 24x24 grid (96px x 96px) next to each task
- Loading states are handled gracefully (though images load quickly from Pexels)
- If no image is found or the API key is not configured, a placeholder is shown

**Setup Required:**
- Add your Pexels API key to a `.env.local` file: `PEXELS_API_KEY=your_key_here`
- Get a free API key at https://www.pexels.com/api/

#### Part 3: Task Dependencies ✅
All required features have been implemented:

1. **Multiple Dependencies**: Tasks can have multiple dependencies, managed through a user-friendly modal interface
2. **Circular Dependency Prevention**: The system uses a depth-first search algorithm to detect and prevent circular dependencies before they are created
3. **Critical Path**: The critical path is calculated using a topological sort algorithm and displayed visually:
   - Tasks on the critical path are highlighted with a red border
   - The dependency graph visualization shows critical path tasks in red
4. **Earliest Start Date Calculation**: Each task's earliest possible start date is calculated based on its dependencies using a recursive DFS algorithm that considers all dependency chains
5. **Dependency Graph Visualization**: An interactive SVG-based graph visualization shows:
   - All tasks as nodes
   - Dependencies as directed edges with arrows
   - Critical path tasks highlighted in red
   - Normal tasks in blue

### Technical Details

**Database Schema:**
- Extended the `Todo` model with `dueDate` (optional DateTime) and `imageUrl` (optional String)
- Created a `TodoDependency` model for the many-to-many relationship between tasks
- Used Prisma's self-referential many-to-many relationship pattern

**API Endpoints:**
- `GET /api/todos` - Returns all todos with their dependencies
- `POST /api/todos` - Creates a new todo, accepts `title` and `dueDate`, fetches image from Pexels
- `DELETE /api/todos/[id]` - Deletes a todo
- `POST /api/todos/[id]/dependencies` - Adds a dependency (with circular dependency check)
- `DELETE /api/todos/[id]/dependencies` - Removes a dependency
- `GET /api/todos/analysis` - Returns critical path and earliest start dates

**Frontend Features:**
- Modern, responsive UI with Tailwind CSS
- Real-time updates when todos or dependencies change
- Modal dialogs for dependency management
- Visual dependency graph with SVG rendering
- Color-coded indicators for overdue tasks and critical path items

### How to Use

1. **Set up environment variables:**
   ```bash
   echo "PEXELS_API_KEY=your_key_here" > .env.local
   ```

2. **Run the development server:**
   ```bash
   npm i
   npm run dev
   ```

3. **Create todos:**
   - Enter a task title
   - Optionally set a due date
   - Click "Add" - an image will be automatically fetched

4. **Manage dependencies:**
   - Click "+ Add Dependency" on any task
   - Select tasks that this task depends on
   - View dependencies as tags (click ✕ to remove)
   - Click "Show Dependency Graph" to see the visual representation

5. **View analysis:**
   - Tasks on the critical path are highlighted with a red border
   - Earliest start dates are shown below due dates
   - The dependency graph shows the full relationship structure

## Submission:

1. ✅ Add a new "Solution" section to this README with a description and screenshot or recording of your solution. 
2. Push your changes to a public GitHub repository.
3. Submit a link to your repository in the application form.

Thanks for your time and effort. We'll be in touch soon!
