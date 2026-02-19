# catachat

Frontend for catachat — a messaging platform hosted at [catachat.catachess.com](https://catachat.catachess.com).

## Stack

- React + TypeScript + Vite
- Tailwind CSS

## Backend API

Hosted as a module of the catachess backend. Base URL: `/api/catchat`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/conversations` | List my conversations |
| POST | `/conversations` | Open or retrieve a conversation |
| GET | `/conversations/{id}/messages` | Paginated message history |
| POST | `/conversations/{id}/messages` | Send a message |
| GET | `/broadcasts` | List broadcasts |
| POST | `/broadcasts` | Send broadcast (admin only) |
