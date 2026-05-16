import type { Request, Response } from 'express';
import pkg from 'express';
const { json } = pkg;
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { text } from 'node:stream/consumers';
dotenv.config();

const mongoClient = new MongoClient(process.env.MONGODB_URI as string);
const db = mongoClient.db('rag_db');
const chunksCollection = db.collection('chunks');

const app = pkg();
app.use(json());

const chatSessions: Record<string, any[]> = {};

const chunkText = (text: string, chunkSize: number = 200): string[] => {
    const words = text.split(' ');
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += chunkSize) {
        chunks.push(words.slice(i, i + chunkSize).join(' '));
    }
    return chunks;
};

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

app.post('/ingest', async (req: Request, res: Response) => {
    try {
        const { text, source } = req.body;
        const chunks = chunkText(text);

        const document = chunks.map((chunk, index) => ({
            text: chunk,
            source: source || 'unknown',
            chunkIndex: index,
            createdAt: new Date()
        }));

        await chunksCollection.insertMany(document);

        res.json({ message: 'Chunks ingested successfully', chunks: chunks.length, source });
    } catch (error) {
        console.error('Error ingesting chunks:', error);
        res.status(500).json({ error: 'Failed to ingest chunks' });
    }
});

app.post('/ask', async (req: Request, res: Response) => {
    try {
        let { question, source, model: modelName, systemInstruction, temperature } = req.body;
        if (!temperature) temperature = 0.7;
        if (!systemInstruction) systemInstruction = 'You are a helpful assistant. ';
        const selectModel = modelName || (await getModels())[0];

        const filter: any = { $text: { $search: question } };
        if (source) filter.source = source;

        const relevantChunks = await chunksCollection.find(filter).limit(3).toArray();
        if (relevantChunks.length === 0) {
            return res.json({ answer: 'No relevant information found in the knowledge base.' });
        }

        const context = relevantChunks.map(c => c.text).join('\n---\n');
        const prompt = `${systemInstruction}\n\nAnswer the question using ONLY the context provided below.
If the answer is not in the context, say "I don't know." \n\n Context:\n${context}\n\nQuestion: ${question}`;

        const model = genAI.getGenerativeModel({
            model: selectModel,
            systemInstruction,
            generationConfig: { temperature }
        });
        const result = await model.generateContent(prompt);
        res.json({
            answer: result.response.text(),
            chunksUsed: relevantChunks.length,
            sources: source ?? 'all'
        });
    } catch (error) {
        console.error('Error answering question:', error);
        res.status(500).json({ error: 'Failed to answer question' });
    }
});

const PORT = process.env.PORT || 3000;
async function main() {
    try {
        await mongoClient.connect();
        console.log('Connected to MongoDB');

        await chunksCollection.createIndex({ text: 'text' });
        console.log('Text index ready');


        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to connect to MongoDB:', error);
        process.exit(1);
    }
}

main();