import Groq from 'groq-sdk';

const apiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY;

if (!apiKey) {
  throw new Error('EXPO_PUBLIC_GROQ_API_KEY is missing from .env');
}

const groq = new Groq({
  apiKey,
  dangerouslyAllowBrowser: true,
});

export default groq;