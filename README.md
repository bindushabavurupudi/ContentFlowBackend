## Project Title: 
- ContentFlow-A Social Media Content Scheduler
## Project Description: 
- Social Media Content Scheduler is a centralized platform designed to help social media managers efficiently plan, schedule, and track content across multiple platforms. It allows users to automate post publishing, view campaigns through a visual content calendar, monitor engagement with real-time analytics, and collaborate with team members. With features like trending hashtag suggestions  and cross-platform insights, the system ensures consistent posting, improved audience engagement, and significant time savings.

## Tech Stack Used
 - Frontend: React, TypeScript, ShadCN, Tailwind CSS
 - Backend: Express.js, Node.js
 - Database: Supabase

## Installation Steps
1. Clone the Repository
2. Backend Setup
    - Step 1: Navigate to Backend Folder(cd backend)
    - Step 2: Install Dependencies(npm install)
    - Step 3: Create Environment File
        - Create a .env file inside the backend folder and add:
        - PORT=8081
        - SUPABASE_URL=your_supabase_url
        - SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
    - Step 4: Start Backend Server(npm run dev)
        - Backend will run on: http://localhost:8082
3. Frontend Setup
    - Step 1: Navigate to Frontend Folder
        - Open a new terminal and run:
        - cd frontend
    - Step 2: Install Dependencies(npm install)
    - Step 3: Configure API URL
        - Create a .env file inside the frontend folder and add:
        - VITE_API_URL=http://localhost:8081
    - Step 4: Start Frontend Server
        - npm run dev
        - Frontend will run on:
        - http://localhost:8081  

## Deployment Link
- https://contentflowbackend.onrender.com/