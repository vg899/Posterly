import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

interface FirebaseConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route - Firebase Client Config
  app.get("/api/firebase-config", (req, res) => {
    try {
      const configPath = path.join(process.cwd(), "firebase-applet-config.json");
      if (fs.existsSync(configPath)) {
        const configRaw = fs.readFileSync(configPath, "utf-8");
        const config = JSON.parse(configRaw) as FirebaseConfig;
        res.json(config);
      } else {
        // Fallback placeholder to prevent app crash
        res.json({
          projectId: "still-plane-08gvj",
          appId: "1:34557050985:web:b60f9afb3dfd54b8ee22f8",
          apiKey: "AIzaSyBBhcxAjDMaixI2a8RKrscKcMrRMe8bwSA",
          authDomain: "still-plane-08gvj.firebaseapp.com",
          storageBucket: "still-plane-08gvj.firebasestorage.app",
          messagingSenderId: "34557050985"
        });
      }
    } catch (error) {
      console.error("Error reading firebase config:", error);
      res.status(500).json({ error: "Could not retrieve Firebase configuration" });
    }
  });

  // API Route - AI Quote Generator using Gemini API
  app.post("/api/generate-quote", async (req, res) => {
    const { category, language } = req.body;
    const selectedCategory = category || "Motivation";
    const selectedLanguage = language || "English";

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      // Graceful fallback with premium hand-crafted quotes if Gemini API is not yet loaded
      const mockQuotes: Record<string, string[]> = {
        "Motivation": [
          "Do not count the days, make the days count. The journey is yours.",
          "Your vision is your limit. Rise above, strive further, and conquer.",
          "Be so good they cannot ignore you. Excellence is a daily choice."
        ],
        "Success": [
          "The best way to predict the future is to create it.",
          "Success is not for the chosen few; it is for those who choose to fight.",
          "Success is the sum of small effort, repeated day in and day out."
        ],
        "Love": [
          "Where there is love, there is life and hope.",
          "Love is the master key that opens the gates of happiness.",
          "In the garden of life, love is the most premium flower."
        ],
        "Sad": [
          "Behind every sweet smile, there is a silent story of struggle.",
          "Great art is always born from our deep, unspoken moments of grief.",
          "Grief is the price we pay for love, but it makes us resilient."
        ],
        "Hindi Shayari": [
          "Zindagi haseen hai isse pyaar karo, Har raat ke baad naye sawale ka intezaar karo.",
          "Koshish aisi karo ki har muskhil aasan ho jaye, Kadmo mein tere sara jahan ho jaye.",
          "Safar mein dhoop toh hogi jo chal sako toh chalo, Sabhi hain bheed mein tum bhi nikal sako toh chalo."
        ]
      };

      const quotesList = mockQuotes[selectedCategory] || mockQuotes["Motivation"];
      const randomMock = quotesList[Math.floor(Math.random() * quotesList.length)];
      return res.json({
        text: randomMock,
        author: "AI Creator Bot (Local)",
        category: selectedCategory,
        fallback: true
      });
    }

    try {
      // Lazy initialization of GoogleGenAI SDK to prevent startup crashes
      const ai = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          }
        }
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Generate a single premium, engaging, and inspiring quote for category '${selectedCategory}' in language '${selectedLanguage}'. Ensure it is short, compact, high-impact, and fits nicely on a festival banner, card, or motivational poster. Present the result as a clean JSON object containing 'text', 'author', and 'category'.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING, description: "The content of the quote" },
              author: { type: Type.STRING, description: "The author or credit of the quote" },
              category: { type: Type.STRING, description: "The category slug of the quote" }
            },
            required: ["text", "author", "category"]
          }
        }
      });

      if (response && response.text) {
        const jsonResult = JSON.parse(response.text.trim());
        res.json(jsonResult);
      } else {
        throw new Error("Empty response from AI model");
      }
    } catch (error) {
      console.error("Gemini Generation Error:", error);
      res.status(500).json({ error: "Failed to generate AI quote. Try again later." });
    }
  });

  // Setup UI Entry Point Routing (Vite Middleware in Dev, Static serve in Prod)
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });

    // Custom router to serve HTML directly with Vite transforming support
    app.get("/", async (req, res, next) => {
      try {
        const htmlPath = path.resolve(process.cwd(), "user.html");
        if (fs.existsSync(htmlPath)) {
          let html = fs.readFileSync(htmlPath, "utf-8");
          html = await vite.transformIndexHtml(req.url, html);
          res.setHeader("Content-Type", "text/html");
          return res.status(200).send(html);
        } else {
          return res.status(404).send("user.html not found");
        }
      } catch (e) {
        return next(e);
      }
    });

    app.get("/admin", async (req, res, next) => {
      try {
        const htmlPath = path.resolve(process.cwd(), "admin.html");
        if (fs.existsSync(htmlPath)) {
          let html = fs.readFileSync(htmlPath, "utf-8");
          html = await vite.transformIndexHtml(req.url, html);
          res.setHeader("Content-Type", "text/html");
          return res.status(200).send(html);
        } else {
          return res.status(404).send("admin.html not found");
        }
      } catch (e) {
        return next(e);
      }
    });

    app.get("/admin.html", (req, res) => {
      res.redirect("/admin");
    });

    app.use(vite.middlewares);
  } else {
    // Production Routing
    const distPath = path.join(process.cwd(), "dist");
    
    app.get("/", (req, res) => {
      res.sendFile(path.join(distPath, "user.html"));
    });

    app.get("/admin", (req, res) => {
      res.sendFile(path.join(distPath, "admin.html"));
    });

    app.get("/admin.html", (req, res) => {
      res.redirect("/admin");
    });

    app.use(express.static(distPath));

    app.get("*", (req, res) => {
      // SPA fallback
      res.sendFile(path.join(distPath, "user.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AI Creator Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
