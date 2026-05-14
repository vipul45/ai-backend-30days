# AI Backend — 30 Days

Building an AI-integrated backend in Node.js + TypeScript over 30 days, exploring Gemini API integration with dynamic model selection.

## Stack
- Node.js + TypeScript
- Express.js
- Google Gemini API (`@google/generative-ai`)
- Nodemon + ts-node (dev)

## Project Structure
ai-backend-30days/
├── index.ts          # main server
├── .env              # environment variables (not committed)
├── .env.example      # env template
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md

## Get Your API Key
1. Go to [Google AI Studio](https://aistudio.google.com)
2. Sign in with your Google account
3. Click **Get API Key** → **Create API Key**
4. Copy the key and paste it in `.env` as `GOOGLE_API_KEY`

## Setup
```bash
# clone the repo
git clone https://github.com/vipul45/ai-backend-30days.git
cd ai-backend-30days

# install dependencies
npm install

# setup env
cp .env.example .env
# add your GOOGLE_API_KEY in .env

# run dev server
npm run dev
```

## API Endpoints

### GET /models
Returns all available Gemini models.
```bash
curl http://localhost:3000/models
```
**Response**
```json
{
  "models": ["gemini-1.5-flash", "gemini-1.5-pro", "..."]
}
```

### POST /generate
Generate a response from a prompt. Model is optional — defaults to first available model.
```bash
curl -X POST http://localhost:3000/generate \
-H "Content-Type: application/json" \
-d '{"prompt": "What is Node.js in one line?"}'
```
**With specific model**
```bash
curl -X POST http://localhost:3000/generate \
-H "Content-Type: application/json" \
-d '{"prompt": "What is Node.js in one line?", "model": "gemini-1.5-flash"}'
```
**Response**
```json
{
  "model": "gemini-1.5-flash",
  "response": "Node.js is a runtime environment..."
}
```

## Environment Variables
| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_API_KEY` | Google AI Studio API key | Yes |
| `PORT` | Server port (default: 3000) | No |

## Author
Vipul Kumar Jha — [GitHub](https://github.com/vipul45) · [LinkedIn](https://www.linkedin.com/in/vipul-kumar-jha-56a0661b7/)