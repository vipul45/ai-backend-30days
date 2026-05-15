import type { Request, Response } from 'express';
import pkg from 'express';
const { json } = pkg;
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';
dotenv.config();

const app = pkg();
app.use(json());

const chatSessions: Record<string, any[]> = {};

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY as string);
const getModels = async (): Promise<string[]> => {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GOOGLE_API_KEY}`);
    const data = await res.json() as { models: { name: string }[] };
    return data.models.map((m) => m.name.replace('models/', ''));
}

app.get('/models', async (req: Request, res: Response) => {
    try {
        const models = await getModels();
        res.json({ models });
    } catch (error) {
        console.error('Error fetching models:', error);
        res.status(500).json({ error: 'Failed to fetch models' });
    }
});
app.post('/generate', async (req: Request, res: Response) => {
    try {
        const { prompt, model: modelName, systemInstruction, temperature } = req.body;
        const selectModel = modelName || (await getModels())[0];
        const model = genAI.getGenerativeModel({
            model: selectModel,
            systemInstruction: systemInstruction || 'You are a helpful assistant. ',
            generationConfig: { temperature }
        });
        const result = await model.generateContent(prompt);
        res.json({ response: result.response.text() });
    } catch (error) {
        console.error('Error generating content:', error);
        res.status(500).json({ error: 'Failed to generate content' });
    }
});

app.post('/chat', async (req: Request, res: Response) => {
    try {
        let { sessionId, message, model: modelName, systemInstruction, temperature } = req.body;

        if (!sessionId) {
            sessionId = randomUUID();
            chatSessions[sessionId] = [];
        }
        const selectModel = modelName || (await getModels())[0];

        const model = genAI.getGenerativeModel({
            model: selectModel,
            systemInstruction: systemInstruction || 'You are a helpful assistant. ',
            generationConfig: { temperature }
        });

        const chat = model.startChat({
            history: chatSessions[sessionId]
        });

        const result = await chat.sendMessage(message);
        const response = result.response.text();
        chatSessions[sessionId].push(
            { role: 'user', parts: [{ text: message }] },
            { role: 'model', parts: [{ text: response }] }
        );
        res.json({ sessionId, response });
    } catch (error) {
        console.error('Error in chat:', error);
        res.status(500).json({ error: 'Chat failed' });
    }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});