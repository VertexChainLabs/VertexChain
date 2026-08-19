# VertexChain Frontend

This is the **VertexChain web frontend**, built with **Next.js**, responsible for:
- Displaying nearby gists on a map
- Allowing users to drop anonymous gists
- Interacting with the VertexChain backend API

This app is for **end users** who want to explore and contribute hyperlocal content.

---

## 🧰 Tech Stack

- Next.js (App Router)
- TypeScript
- Leaflet + react-leaflet (interactive map)
- react-leaflet-cluster (marker clustering)
- VertexChain backend API (gists anchored on Stellar/Soroban server-side)

---

## ⚙️ Setup Instructions

### Requirements

- Node.js ≥ 18
- npm / yarn / pnpm / bun

### Install

```bash
npm install
```

### Environment variables

| Variable              | Default                | Description                                        |
| --------------------- | ---------------------- | -------------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3000` | Base URL of the VertexChain backend API            |

> The frontend defaults to `http://localhost:3000`, which is the backend's default port. If the backend runs on a different port, set `NEXT_PUBLIC_API_URL` accordingly.

### Run locally

```bash
npm run dev
```

### Scripts

| Script             | Description                                    |
| ------------------ | ---------------------------------------------- |
| `npm run dev`      | Start the Next.js dev server                   |
| `npm run build`    | Production build (`output: "standalone"`)      |
| `npm run start`    | Serve the production build                     |
| `npm run lint`     | Run ESLint                                     |
| `npm test`         | Run the Vitest suite with coverage             |
