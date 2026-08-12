<div align="center">

# ⚖️ VIREO Server
### AI-Powered Project Management Backend

<p align="center">
RESTful API service for the VIREO project management platform built with Express 5, Prisma ORM, and MongoDB. Provides boards, workspaces, tasks, and real-time collaboration.
</p>

![Node.js](https://img.shields.io/badge/Node.js-20-green?style=for-the-badge&logo=node.js)
![Express](https://img.shields.io/badge/Express-5-orange?style=for-the-badge&logo=express)
![Prisma](https://img.shields.io/badge/Prisma-7-blue?style=for-the-badge&logo=prisma)
![MongoDB](https://img.shields.io/badge/MongoDB-8DBFFC?style=for-the-badge&logo=mongodb)
![Stripe](https://img.shields.io/badge/Stripe-Payment-635BFF?style=for-the-badge&logo=stripe)
![Custom Auth](https://img.shields.io/badge/Auth-Custom-blue?style=for-the-badge)

</div>

---
# 🌐 Live Demo

🔗 **https://vireo-server.vercel.app/api/**

---

# 📂 Source Code

[![Server Repository](https://img.shields.io/badge/Server-Repository-181717?style=for-the-badge&logo=github)](https://github.com/rohan-bhau/Vireo-server)

[![Client Repository](https://img.shields.io/badge/Client-Repository-181717?style=for-the-badge&logo=github)](https://github.com/rohan-bhau/Vireo)


---

# 📖 Project Overview

**VIREO Server** is the backend API service for the VIREO project management platform. Built with Express 5, it provides RESTful APIs for project management including boards, workspaces, tasks, and real-time collaboration features.

The API supports role-based access control for workspaces and boards, with custom JWT authentication.

---

# ✨ Core Features

## 🔐 Authentication

- JWT Access & Refresh Tokens (Custom)
- Google OAuth Integration
- GitHub OAuth Integration
- JWT Protected Routes
- Secure Session Management
- Role-Based Authorization (workspace/board level)
- Token Auto-refresh on 401 response
- Token management via localStorage (client) and cookies (server)

## 📡 Real-time

- Socket.io with JWT authentication
- Rooms per user/conversation/board
- Web event broadcasting

## 📦 Resource APIs

### Workspaces

- `GET/POST /api/workspaces` - Create & manage workspaces
- `GET/PUT /api/workspaces/:id` - Workspace details & updates
- Workspace member management

### Boards (Kanban)

- `GET/POST /api/boards` - Create & manage boards
- `GET/PUT /api/boards/:id` - Board details & column management
- Column reordering & card management
- Board member permissions

### Tasks

- `GET/POST /api/tasks` - Create & manage tasks
- `GET/PUT /api/tasks/:id` - Task details & updates
- Task assignment & status tracking
- Task filtering & search

### Dashboards

- `GET /api/dashboard/overview` - Summary statistics
- `GET /api/dashboard/analytics` - Charts & metrics
- Recent activity feed

### Notifications

- `GET/POST /api/notifications` - Manage notifications
- Mark as read / unread
- Real-time push via Socket.io

### Stripe Integration

- `POST /api/webhooks/stripe` - Webhook handler
- Payment session creation
- Transaction tracking

---

# 🚀 API Endpoints Summary

| Category | Endpoints |
|----------|-----------|
| **Auth** | `/api/auth/*` - Register, login, refresh, OAuth |
| **Workspaces** | `/api/workspaces*` - CRUD, members |
| **Boards** | `/api/boards*` - CRUD, columns, cards |
| **Tasks** | `/api/tasks*` - CRUD, assignment, status |
| **Dashboard** | `/api/dashboard/*` - Analytics, overview |
| **Notifications** | `/api/notifications*` - CRUD, read status |
| **Stripe** | `/api/webhooks/stripe*` - Payment webhooks |

---

# 📦 Key Dependencies

- `express@^5.2.1` - Express 5 framework
- `@prisma/client@^7.8.0` - Prisma ORM for PostgreSQL & MongoDB
- `mongoose@^9.7.4` - MongoDB ODM (if using Mongo)
- `socket.io@^4.8.3` - Real-time bi-directional event-based communication
- `jsonwebtoken@^9.0.3` - JWT token creation and verification
- `stripe@^22.3.2` - Payment processing
- `cloudinary@^2.10.0` - Image and file upload management

---

# 🔒 Environment Variables

Create a `.env` file in the server directory.

```env
PORT=5000
NODE_ENV=development

MONGODB_URI=your_mongodb_connection_string
DATABASE_URL=your_postgresql_connection_string

JWT_ACCESS_SECRET=your_jwt_access_secret
JWT_REFRESH_SECRET=your_jwt_refresh_secret

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

STRIPE_SECRET_KEY=your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_next_public_key
```

---

# ⚙️ Installation

Clone the repository

```bash
git clone https://github.com/rohan-bhau/Vireo-server.git
```

Move into the project

```bash
cd Vireo-server
```

Install dependencies

```bash
npm install
```

Run prisma generate

```bash
npm run prisma:generate
```

Run migrations

```bash
npm run prisma:push
```

Run the development server

```bash
npm run dev
```

Build for production

```bash
npm run build
```

Start production server

```bash
npm start
```

---

# 🎯 Future Improvements

- Real-time Chat with WebSockets
- Video Consultation API
- Lawyer/Project Availability Calendar
- Email Notifications Service
- Advanced Analytics Dashboard
- AI Project Assistant Integration
- Multi-tenant Enhancements
- Rate Limiting & Throttling
- Enhanced Search & Filtering

---

# 👨‍💻 Author

## MD Rohan Mia

**Backend Developer**

### GitHub

https://github.com/rohan-bhau

---

# 🌟 Support

If you like this project, don't forget to ⭐ the repository.

---

<div align="center">

### Built with ❤️ using Express 5, Prisma, MongoDB & Custom JWT Auth

</div>
