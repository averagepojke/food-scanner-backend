// server.js
// --- SETUP INSTRUCTIONS ---
// 1. npm install express cors express-rate-limit dotenv openai form-data node-fetch
// 2. Create .env file with your API keys
// 3. Set OCR_SPACE_API_KEY in .env or use the default free key
// 4. Optional: Set OPENAI_API_KEY for AI categorization
// 5. Optional: Set SPOONACULAR_API_KEY for recipe search

require('dotenv').config();
console.log('🔧 Environment loaded, API keys configured:', process.env.OPENAI_API_KEY ? '✅' : '❌');

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const FormData = require('form-data');
const { OpenAI } = require('openai');
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const app = express();
app.set('trust proxy', 1); // Trust first proxy (Railway)
app.use(cors());
app.use(express.json({ limit: '20mb' }));

// Basic rate limiting with proper proxy config
const limiter = rateLimit({ 
  windowMs: 60 * 1000, 
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Optional bearer auth for production environments
const API_BEARER = process.env.API_BEARER_TOKEN;
app.use((req, res, next) => {
  if (!API_BEARER) return next();
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (token === API_BEARER) return next();
  return res.status(401).json({ ok: false, error: 'Unauthorized' });
});

// --- CONFIGURATION ---
const OCR_SPACE_API_KEY = process.env.OCR_SPACE_API_KEY;
if (!OCR_SPACE_API_KEY) {
  console.error('❌ OCR_SPACE_API_KEY not set in environment variables. Please get an API key from https://ocr.space/ocrapi and set it in your .env file.');
  process.exit(1);
}
const PORT = process.env.PORT || 3001;

// --- LOG CONFIG ON STARTUP ---
console.log('🚀 Server starting up...');
console.log('📋 Configuration:');
console.log('   OCR.space API Key:', OCR_SPACE_API_KEY ? `✅ (${OCR_SPACE_API_KEY.substring(0, 10)}...)` : '❌');
console.log('   OpenAI API Key:', openai ? '✅' : '❌');
console.log('   Port:', PORT);

// --- ENDPOINTS ---
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'OCR.space Receipt Parser' });
});

app.get('/welcome', (req, res) => {
  console.log(`Request received: ${req.method} ${req.path}`);
  res.json({ message: 'Welcome to the Food Scanner API!' });
});

// --- External Recipes Aggregator ---
const getFetch = () => (typeof fetch !== 'undefined' ? fetch : (...args) => import('node-fetch').then(({ default: f }) => f(...args)));

function extractHostname(urlString) {
  try {
    const u = new URL(urlString);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function mapMealDbToRecipe(meal) {
  const ingredients = [];
  for (let i = 1; i <= 20; i++) {
    const ing = meal[`strIngredient${i}`];
    if (ing && ing.trim()) ingredients.push(ing.trim());
  }
  const category = (meal.strCategory || '').toLowerCase();
  const url = meal.strSource || (meal.idMeal ? `https://www.themealdb.com/meal/${meal.idMeal}` : null);
  return {
    id: `mealdb-${meal.idMeal}`,
    name: meal.strMeal || 'Recipe',
    category: category === 'breakfast' ? 'breakfast' :
      (['lunch', 'side'].includes(category) ? 'lunch' :
        (['beef', 'chicken', 'goat', 'lamb', 'miscellaneous', 'pasta', 'pork', 'seafood', 'vegan', 'vegetarian'].includes(category) ? 'dinner' :
          (category === 'dessert' ? 'snack' : 'dinner'))),
    subcategories: [],
    ingredients,
    instructions: meal.strInstructions || '',
    prepTime: '15 min',
    cookTime: '20 min',
    difficulty: 'Easy',
    imageUrl: meal.strMealThumb || null,
    source: url ? extractHostname(url) || 'themealdb.com' : 'themealdb.com',
    url: url || null,
  };
}

function mapDishTypesToCategory(dishTypes) {
  const types = Array.isArray(dishTypes) ? dishTypes.map(t => String(t).toLowerCase()) : [];
  if (types.includes('breakfast')) return 'breakfast';
  if (types.includes('lunch') || types.includes('salad') || types.includes('sandwich') || types.includes('soup')) return 'lunch';
  if (types.includes('dessert') || types.includes('snack')) return 'snack';
  return 'dinner';
}

const RECIPE_FREE_ONLY = String(process.env.RECIPE_FREE_ONLY || '').trim() === '1';
const recipeCache = new Map();
const RECIPE_CACHE_TTL_MS = 1000 * 60 * 60 * 12;

function makeRecipeCacheKey(params) {
  try {
    return JSON.stringify(params);
  } catch {
    return String(params.q || '') + '|' + String(params.category || '') + '|' + String(params.subcategory || '') + '|' + String(params.ingredients || '') + '|' + String(params.limit || '');
  }
}

app.get('/api/recipes/search', async (req, res) => {
  try {
    const fetch = getFetch();
    const { q = '', category = '', subcategory = '', limit = '12', ingredients = '' } = req.query;
    
    let term = '';
    if (q) {
      term = String(q).trim();
    } else if (subcategory && category) {
      const subcategorySearchMap = {
        'sweet': 'pancake waffle french toast',
        'savory': 'egg bacon omelet toast',
        'high-protein': 'protein egg greek yogurt',
        'overnight': 'overnight oats chia pudding',
        '5-ingredients': 'simple easy quick breakfast',
        'sandwich': 'sandwich wrap panini',
        'salad': 'salad caesar greek cobb',
        'soup': 'soup broth bisque chowder',
        'meal-prep': 'bowl prep container batch',
        'vegetarian': 'vegetarian veggie plant based',
        'one-pot': 'one pot skillet casserole stew',
        'chicken': 'chicken poultry',
        'pasta': 'pasta spaghetti penne linguine',
        'quick': 'quick fast 30 minute easy',
        'chocolatey': 'chocolate brownie cocoa dessert',
        'healthy': 'healthy fruit nuts yogurt smoothie',
        'no-bake': 'no bake refrigerator chilled dessert',
      };
      term = subcategorySearchMap[subcategory] || `${subcategory} ${category}`;
    } else if (category) {
      term = category;
    }
    
    const max = Math.max(1, Math.min(50, Number(limit) || 12));

    const cacheKey = makeRecipeCacheKey({ q: term, category, subcategory, ingredients, limit: max });
    const cached = recipeCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return res.json({ ok: true, recipes: cached.data, source: 'cache' });
    }

    const spoonKey = process.env.SPOONACULAR_API_KEY || process.env.SPOON_API_KEY;
    if (spoonKey && !RECIPE_FREE_ONLY) {
      try {
        const params = new URLSearchParams();
        if (term) params.set('query', term);
        if (ingredients) params.set('includeIngredients', String(ingredients));
        if (subcategory === 'vegetarian') params.set('diet', 'vegetarian');
        if (subcategory === 'healthy') params.set('diet', 'whole30');
        if (subcategory === 'high-protein') params.set('minProtein', '20');
        params.set('number', String(max));
        params.set('addRecipeInformation', 'true');
        params.set('instructionsRequired', 'true');
        params.set('fillIngredients', 'true');
        params.set('apiKey', spoonKey);
        const spoonUrl = `https://api.spoonacular.com/recipes/complexSearch?${params.toString()}`;
        const resp = await fetch(spoonUrl);
        if (!resp.ok) throw new Error(`Spoonacular error ${resp.status}`);
        const json = await resp.json();
        const results = Array.isArray(json.results) ? json.results : [];
        const mapped = results.map((r) => {
          const ingredientsList = Array.isArray(r.extendedIngredients)
            ? r.extendedIngredients.map((i) => String(i.name || '').trim()).filter(Boolean)
            : [];
          const categoryGuess = mapDishTypesToCategory(r.dishTypes);
          const instructions = Array.isArray(r.analyzedInstructions) && r.analyzedInstructions[0]?.steps
            ? r.analyzedInstructions[0].steps.map((s) => s.step).join('\n')
            : '';
          const url = r.sourceUrl || (r.spoonacularSourceUrl || null);
          return {
            id: `spoon-${r.id}`,
            name: r.title || 'Recipe',
            category: categoryGuess,
            subcategories: Array.isArray(r.dishTypes) ? r.dishTypes : [],
            ingredients: ingredientsList,
            instructions,
            prepTime: r.readyInMinutes ? `${Math.max(5, Math.round(r.readyInMinutes * 0.4))} min` : '10 min',
            cookTime: r.readyInMinutes ? `${Math.max(5, Math.round(r.readyInMinutes * 0.6))} min` : '20 min',
            difficulty: 'Easy',
            imageUrl: r.image || null,
            source: url ? extractHostname(url) || 'spoonacular.com' : 'spoonacular.com',
            url: url || null,
          };
        });
        const seen = new Set();
        const unique = mapped.filter((r) => {
          const key = r.name.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }).slice(0, max);
        recipeCache.set(cacheKey, { data: unique, expiresAt: Date.now() + RECIPE_CACHE_TTL_MS });
        return res.json({ ok: true, recipes: unique, source: 'spoonacular' });
      } catch (e) {
        console.warn('Spoonacular failed, falling back to TheMealDB:', e.message);
      }
    }

    const results = [];
    async function fetchDetailsByIds(ids) {
      const out = [];
      for (const id of ids.slice(0, max)) {
        const detailResp = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${encodeURIComponent(id)}`);
        const detailJson = await detailResp.json();
        const meal = detailJson.meals && detailJson.meals[0];
        if (meal) out.push(mapMealDbToRecipe(meal));
      }
      return out;
    }

    if (term) {
      const searchTerms = [term];
      if (subcategory) {
        const additionalTerms = {
          'chocolatey': ['chocolate', 'brownie', 'cocoa', 'fudge'],
          'healthy': ['fruit', 'salad', 'yogurt', 'smoothie'],
          'high-protein': ['chicken', 'egg', 'protein', 'quinoa'],
          'vegetarian': ['vegetarian', 'veggie', 'plant'],
          'no-bake': ['pudding', 'parfait', 'smoothie'],
          'quick': ['quick', 'easy', 'simple'],
          'one-pot': ['stew', 'casserole', 'skillet'],
          'sweet': ['cake', 'cookie', 'dessert', 'sweet'],
          'savory': ['egg', 'cheese', 'bacon'],
          'sandwich': ['sandwich', 'wrap', 'panini'],
          'salad': ['salad', 'caesar', 'greek'],
          'soup': ['soup', 'broth', 'chowder'],
          'pasta': ['pasta', 'spaghetti', 'linguine'],
          'chicken': ['chicken', 'poultry'],
        };
        if (additionalTerms[subcategory]) {
          searchTerms.push(...additionalTerms[subcategory]);
        }
      }
      for (const searchTerm of searchTerms) {
        if (results.length >= max) break;
        const resp = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(searchTerm)}`);
        const data = await resp.json();
        if (data.meals) {
          data.meals.slice(0, max - results.length).forEach((m) => {
            const recipe = mapMealDbToRecipe(m);
            if (!results.some(r => r.name.toLowerCase() === recipe.name.toLowerCase())) {
              results.push(recipe);
            }
          });
        }
      }
    }

    if (results.length === 0 && category) {
      const catMap = {
        breakfast: 'Breakfast',
        snack: 'Dessert',
        lunch: 'Miscellaneous',
        dinner: 'Beef',
      };
      if (subcategory) {
        const subcatCategoryMap = {
          'vegetarian': 'Vegetarian',
          'chicken': 'Chicken',
          'pasta': 'Pasta',
          'chocolatey': 'Dessert',
          'healthy': 'Miscellaneous',
          'no-bake': 'Dessert',
          'sweet': 'Dessert',
          'soup': 'Side',
        };
        if (subcatCategoryMap[subcategory]) {
          catMap[category] = subcatCategoryMap[subcategory];
        }
      }
      const mapped = catMap[String(category).toLowerCase()] || 'Beef';
      const listResp = await fetch(`https://www.themealdb.com/api/json/v1/1/filter.php?c=${encodeURIComponent(mapped)}`);
      const listJson = await listResp.json();
      if (listJson.meals) {
        const ids = listJson.meals.map((m) => m.idMeal);
        const detailed = await fetchDetailsByIds(ids);
        results.push(...detailed);
      }
    }

    const seen = new Set();
    const unique = results.filter((r) => {
      const key = r.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, max);

    recipeCache.set(cacheKey, { data: unique, expiresAt: Date.now() + RECIPE_CACHE_TTL_MS });
    res.json({ ok: true, recipes: unique, source: 'web' });
  } catch (e) {
    console.error('Recipe search failed:', e);
    res.status(500).json({ ok: false, error: 'Recipe search failed' });
  }
});

// Support request ingestion
app.post('/api/support-request', async (req, res) => {
  try {
    const { name, email, history } = req.body || {};
    if (!name || !email || !Array.isArray(history)) {
      return res.status(400).json({ error: 'Missing name, email, or history' });
    }
    const payload = {
      receivedAt: new Date().toISOString(),
      name,
      email,
      lastMessage: history[history.length - 1]?.text || '',
      messageCount: history.length,
    };
    fs.appendFileSync('support_requests.log', JSON.stringify(payload) + '\n');
    res.json({ ok: true });
  } catch (e) {
    console.error('Failed to ingest support request:', e);
    res.status(500).json({ error: 'Failed to ingest support request' });
  }
});

// --- Food Search API ---
app.get('/api/food/search', async (req, res) => {
  try {
    const { q = '' } = req.query;
    if (!q || q.trim().length < 2) {
      return res.json({ ok: true, foods: [] });
    }

    console.log('🔍 Searching for food:', q);
    
    const searchUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=20&fields=product_name,brands,categories,nutrition_grades,nutriments,image_url,code,serving_size,serving_quantity`;
    
    const response = await fetch(searchUrl);
    if (!response.ok) {
      throw new Error(`Open Food Facts API error: ${response.status}`);
    }
    
    const data = await response.json();
    const products = data.products || [];
    
    const foods = products
      .filter(product => product.product_name && product.nutriments)
      .map(product => {
        const parseServingSize = () => {
          if (product.serving_quantity && !isNaN(parseFloat(product.serving_quantity))) {
            const val = parseFloat(product.serving_quantity);
            return Math.round(val);
          }
          
          const txt = (product.serving_size || '').toLowerCase();
          const patterns = [
            /(\d+(?:\.\d+)?)\s*g/,
            /(\d+(?:\.\d+)?)\s*gram/,
            /(\d+(?:\.\d+)?)\s*grams/,
            /(\d+(?:\.\d+)?)\s*ml/,
            /(\d+(?:\.\d+)?)\s*milliliter/,
            /(\d+(?:\.\d+)?)\s*milliliters/,
            /(\d+(?:\.\d+)?)\s*oz/,
            /(\d+(?:\.\d+)?)\s*ounce/,
            /(\d+(?:\.\d+)?)\s*ounces/,
            /(\d+(?:\.\d+)?)\s*lb/,
            /(\d+(?:\.\d+)?)\s*pound/,
            /(\d+(?:\.\d+)?)\s*pounds/,
            /(\d+(?:\.\d+)?)\s*kg/,
            /(\d+(?:\.\d+)?)\s*kilogram/,
            /(\d+(?:\.\d+)?)\s*kilograms/,
            /(\d+(?:\.\d+)?)\s*/,
          ];
          
          for (const pattern of patterns) {
            const m = txt.match(pattern);
            if (m) {
              const val = parseFloat(m[1]);
              if (!isNaN(val) && val > 0) {
                let grams = val;
                if (pattern.source.includes('oz') || pattern.source.includes('ounce')) {
                  grams = val * 28.35;
                } else if (pattern.source.includes('lb') || pattern.source.includes('pound')) {
                  grams = val * 453.59;
                } else if (pattern.source.includes('kg') || pattern.source.includes('kilogram')) {
                  grams = val * 1000;
                }
                return Math.round(grams);
              }
            }
          }
          return null;
        };

        return {
          id: `api-${product.code || Date.now()}-${Math.random()}`,
          name: product.product_name,
          brand: product.brands || '',
          category: product.categories ? product.categories.split(',')[0] : 'Food',
          calories: product.nutriments?.['energy-kcal_100g'] || product.nutriments?.['energy-kcal'] || 0,
          protein: product.nutriments?.proteins_100g || product.nutriments?.proteins || 0,
          carbs: product.nutriments?.carbohydrates_100g || product.nutriments?.carbohydrates || 0,
          fat: product.nutriments?.fat_100g || product.nutriments?.fat || 0,
          fiber: product.nutriments?.fiber_100g || product.nutriments?.fiber || 0,
          calories_per_serving: product.nutriments?.['energy-kcal_serving'] || null,
          serving_size_text: product.serving_size || '',
          serving_size_g: parseServingSize(),
          serving: '100g',
          nutrition_grade: product.nutrition_grades || '',
          image_url: product.image_url || null,
          barcode: product.code || '',
          source: 'api',
          isApiResult: true
        };
      })
      .filter(food => food.calories > 0);

    console.log(`✅ Found ${foods.length} foods for query: ${q}`);
    res.json({ ok: true, foods });
    
  } catch (error) {
    console.error('❌ Food search error:', error);
    res.status(500).json({ ok: false, error: 'Food search failed' });
  }
});

// --- AI Meal Suggestions ---
app.post('/api/meal-suggest', async (req, res) => {
  try {
    const { query = '', inventory = [], preferences = {} } = req.body || {};
    const simplifiedInventory = Array.isArray(inventory) ? inventory.slice(0, 200).map(item => ({
      name: String(item.name || '').slice(0, 80),
      category: String(item.category || ''),
      quantity: Number(item.quantity || 1),
      expiry: String(item.expiry || ''),
    })) : [];

    const system = `You are a helpful meal planning assistant. You suggest practical meal ideas that prioritize using items on hand and items expiring soon. You return JSON only.`;
    const user = `User prompt: ${query || 'Suggest 3 meals I can make now.'}

Inventory (JSON): ${JSON.stringify(simplifiedInventory)}

Preferences (JSON): ${JSON.stringify(preferences)}

Rules:
- Prefer using items that exist in inventory; minimize missing items
- If an item is expiring within 3 days, prioritize recipes that use it
- Keep suggestions realistic and simple to cook
- Return 3-5 suggestions
- For each suggestion, include: name, category (breakfast|lunch|dinner|snack), ingredients (array of strings), missingIngredients (array), instructions (short, 3-6 steps), prepTime, cookTime, difficulty (Easy|Medium|Hard)
- JSON array only, no extra text`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.4,
    });

    const content = response.choices?.[0]?.message?.content || '[]';
    const match = content.match(/\[.*\]/s);
    const jsonText = match ? match[0] : content;
    let suggestions = [];
    try {
      suggestions = JSON.parse(jsonText);
    } catch (e) {
      suggestions = [];
    }
    if (!Array.isArray(suggestions)) suggestions = [];

    const normalized = suggestions.map((s, idx) => ({
      id: `ai-${Date.now()}-${idx}`,
      name: String(s.name || 'Meal Idea'),
      category: String(s.category || 'dinner').toLowerCase(),
      ingredients: Array.isArray(s.ingredients) ? s.ingredients.map(x => String(x)) : [],
      missingIngredients: Array.isArray(s.missingIngredients) ? s.missingIngredients.map(x => String(x)) : [],
      instructions: String(s.instructions || ''),
      prepTime: String(s.prepTime || '10 min'),
      cookTime: String(s.cookTime || '20 min'),
      difficulty: String(s.difficulty || 'Easy'),
    })).slice(0, 5);

    res.json({ ok: true, suggestions: normalized });
  } catch (e) {
    console.error('Meal suggest error:', e);
    res.status(500).json({ ok: false, error: 'Failed to generate suggestions' });
  }
});

// Helper: categorize items using OpenAI
async function categorizeLineItemsWithAI(lineItems) {
  if (!Array.isArray(lineItems) || lineItems.length === 0) return [];
  if (!openai) {
    return lineItems.map(item => ({ ...item, category: 'other' }));
  }
  const prompt = `Categorize each item below into a food category (e.g. dairy, meat, fish, vegetables, fruits, bread, canned-goods, dry-goods, beverages, frozen, snacks, condiments, bakery, household, other).\nReturn a JSON array with objects: {"name": string, "category": string}.\nItems:\n${lineItems.map(i => i.description || i.name || '').join('\n')}`;
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    });
    const content = response.choices[0].message.content;
    const match = content.match(/\[.*\]/s);
    if (match) {
      const categories = JSON.parse(match[0]);
      return lineItems.map((item, idx) => ({ ...item, category: categories[idx]?.category || 'other' }));
    }
  } catch (e) {
    console.error('AI categorization failed:', e);
  }
  return lineItems.map(item => ({ ...item, category: 'other' }));
}

// --- RECEIPT PARSING WITH OCR.SPACE ---
app.post('/api/parse-receipt', async (req, res) => {
  const { base64Image, mimeType: clientMimeType } = req.body;
  if (!base64Image) {
    return res.status(400).json({ error: 'Missing base64Image' });
  }

  // Clean base64 (strip data URL prefix if present)
  let cleanBase64 = base64Image;
  if (base64Image.startsWith('data:image/')) {
    cleanBase64 = base64Image.split(',')[1];
  }

  // Infer mime type
  let mimeType = clientMimeType || 'image/jpeg';
  if (!clientMimeType) {
    if (base64Image.startsWith('data:image/png')) mimeType = 'image/png';
    else if (base64Image.startsWith('data:image/jpeg') || base64Image.startsWith('data:image/jpg')) mimeType = 'image/jpeg';
  }

  // Debug: Save image (only in development)
  if (process.env.NODE_ENV === 'development') {
    const testFileName = mimeType === 'image/png' ? 'test_upload.png' : 'test_upload.jpg';
    try {
      fs.writeFileSync(testFileName, Buffer.from(cleanBase64, 'base64'));
      console.log('🖼️ Saved test image as', testFileName);
    } catch (e) {
      console.error('⚠️ Failed to save test image:', e);
    }
  }

  try {
    console.log('📄 Processing document with OCR.space API');
    console.log('🖼️ Mime type:', mimeType);
    
    const imageBuffer = Buffer.from(cleanBase64, 'base64');
    const imageSizeMB = imageBuffer.length / 1024 / 1024;
    console.log(`📊 Image size: ${imageSizeMB.toFixed(2)}MB`);

    // Check size limit (OCR.space free tier = 1MB)
    if (imageSizeMB > 1) {
      console.warn('⚠️ Image exceeds 1MB limit for free tier');
    }

    // --- OCR.space API Request ---
// Replace everything from line 575 to line 650 with this single clean version:

    // --- OCR.space API Request with FILE UPLOAD ---
    const filename = mimeType === 'image/png' ? 'receipt.png' : 'receipt.jpg';

    async function submitOcrAttempt({ endpoint, engine, useBase64, label }) {
      const formData = new FormData();
      formData.append('apikey', OCR_SPACE_API_KEY);
      formData.append('language', 'eng');
      formData.append('isOverlayRequired', 'false');
      formData.append('detectOrientation', 'true');
      formData.append('scale', 'true');
      formData.append('OCREngine', engine);
      if (useBase64) {
        formData.append('base64Image', `data:${mimeType};base64,${cleanBase64}`);
      } else {
        formData.append('file', imageBuffer, {
          filename,
          contentType: mimeType
        });
      }

      console.log('📤 Sending OCR request:', label, {
        endpoint,
        engine,
        mode: useBase64 ? 'base64' : 'file',
        size: `${imageSizeMB.toFixed(2)}MB`,
        contentType: mimeType,
        apiKeyPrefix: OCR_SPACE_API_KEY.substring(0, 10)
      });

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        headers: formData.getHeaders(),
      });
      console.log('📝 OCR.space HTTP status:', response.status);
      const responseText = await response.text();
      console.log('📝 OCR.space raw response (first 500 chars):', responseText.substring(0, 500));
      if (!response.ok) {
        throw new Error(responseText || `HTTP ${response.status}`);
      }
      if (!responseText.trim().startsWith('{') && !responseText.trim().startsWith('[')) {
        throw new Error(responseText);
      }
      const parsed = JSON.parse(responseText);
      if (parsed.OCRExitCode > 1) {
        const message = parsed.ErrorMessage?.[0] || 'Unknown OCR error';
        throw new Error(message);
      }
      if (parsed.IsErroredOnProcessing) {
        const message = parsed.ErrorMessage?.[0] || parsed.ErrorDetails || 'Unknown OCR error';
        throw new Error(message);
      }
      return parsed;
    }

    const attempts = [
      { endpoint: 'https://api.ocr.space/parse/image', engine: '2', useBase64: false, label: 'file-engine2' },
      { endpoint: 'https://api.ocr.space/parse/image', engine: '1', useBase64: false, label: 'file-engine1' },
      { endpoint: 'https://api.ocr.space/parse/image', engine: '2', useBase64: true, label: 'base64-engine2' },
      { endpoint: 'https://api.ocr.space/parse/image', engine: '1', useBase64: true, label: 'base64-engine1' },
      { endpoint: 'https://apipro1.ocr.space/parse/image', engine: '2', useBase64: false, label: 'file-engine2-proxy1' },
      { endpoint: 'https://apipro1.ocr.space/parse/image', engine: '1', useBase64: true, label: 'base64-engine1-proxy1' },
    ];

    let ocrResult;
    let lastError;

    for (const attempt of attempts) {
      try {
        ocrResult = await submitOcrAttempt(attempt);
        if (ocrResult) {
          break;
        }
      } catch (err) {
        lastError = err;
        console.warn('⚠️ OCR attempt failed:', attempt.label, err.message);
      }
    }

    if (!ocrResult) {
      console.error('❌ OCR.space failed after retries:', lastError?.message || lastError);
      return res.status(502).json({
        error: 'OCR processing failed',
        details: lastError?.message || 'OCR provider error'
      });
    }

    if (!ocrResult.ParsedResults || ocrResult.ParsedResults.length === 0) {
      return res.status(500).json({
        error: 'OCR processing failed',
        details: 'No text could be extracted from the image'
      });
    }

    const text = ocrResult.ParsedResults[0].ParsedText || '';
    console.log('✅ OCR successful, extracted text length:', text.length);

    // Parse line items from OCR text
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    let lineItems = parseReceiptLinesRuleBased(lines);
    
    // AI categorization if OpenAI is available
    if (openai) {
      try {
        lineItems = await categorizeLineItemsWithAI(lineItems);
      } catch (e) {
        console.warn('AI categorization failed, continuing with basic categories:', e.message);
      }
    }

    res.json({
      success: true,
      text,
      lineItems,
      confidence: ocrResult.ParsedResults[0].TextOverlay?.Lines ? 0.8 : 0.7
    });

  } catch (err) {
    console.error('❌ OCR.space error:', err.message);
    res.status(500).json({
      error: 'OCR processing failed',
      details: err.message
    });
  }
});

// Helper function: Parse receipt lines using rule-based approach
function parseReceiptLinesRuleBased(lines) {
  const items = [];
  const priceRegex = /[£€$]\s?(\d+\.\d{2})/;
  const quantityRegex = /^(\d+)\s*M?\s+/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip obvious non-item lines
    if (!line || /^\d{2}\/\d{2}\/\d{2,4}/.test(line) || /^\d{2}:\d{2}/.test(line) ||
        /^total/i.test(line) || /^subtotal/i.test(line) || /^balance/i.test(line) ||
        /^discount/i.test(line) || /^change/i.test(line) || /^payment/i.test(line) ||
        /^cash/i.test(line) || /^card/i.test(line) || /^visa/i.test(line) ||
        /^mastercard/i.test(line) || /^contactless/i.test(line) || /^thank/i.test(line) ||
        /^receipt/i.test(line) || /^vat/i.test(line) || /^tax/i.test(line) ||
        /^www\./i.test(line) || /\.com/i.test(line) || /^tel:/i.test(line) ||
        /^store/i.test(line) || /^manager/i.test(line) || /^since/i.test(line) ||
        /^description/i.test(line) || /^price/i.test(line) || /^qty/i.test(line) ||
        /^[*\-=_\s]+$/.test(line) || /^aid/i.test(line) || /^pan/i.test(line) ||
        /^amount/i.test(line) || /^card/i.test(line) || /^contactless/i.test(line) ||
        /^m\s+pasta\s+offer/i.test(line) || /^balance\s+due/i.test(line) ||
        /^more\s+discount/i.test(line) || /^visa\s+payment/i.test(line)) {
      continue;
    }

    const priceMatch = line.match(priceRegex);
    if (priceMatch) {
      const price = parseFloat(priceMatch[1]);

      let name = '';
      let quantity = 1;

      // Look to the previous line for the name
      if (i > 0) {
        const prevLine = lines[i - 1].trim();
        if (prevLine && !prevLine.match(priceRegex) && /[A-Za-z]/.test(prevLine)) {
          const qtyMatch = prevLine.match(quantityRegex);
          if (qtyMatch) {
            quantity = parseInt(qtyMatch[1], 10);
            name = prevLine.slice(qtyMatch[0].length).trim();
          } else {
            name = prevLine;
          }
        }
      }

      // If no name from previous, try same line before price
      if (!name) {
        const priceIndex = line.indexOf(priceMatch[0]);
        if (priceIndex > 0) {
          const namePart = line.slice(0, priceIndex).trim();
          const qtyMatch = namePart.match(quantityRegex);
          if (qtyMatch) {
            quantity = parseInt(qtyMatch[1], 10);
            name = namePart.slice(qtyMatch[0].length).trim();
          } else {
            name = namePart;
          }
        }
      }

      // Clean up the name
      if (name) {
        name = name.replace(/[^A-Za-z0-9 '£€$\-&]/g, ' ').replace(/\s+/g, ' ').trim();

        // Validate name
        if (name.length > 2 && /[A-Za-z]{2,}/.test(name) && price > 0) {
          items.push({ quantity, name, price });
        }
      }
    }
  }

  // Remove duplicates
  const seen = new Set();
  return items.filter(item => {
    const key = `${item.name.toLowerCase()}-${item.price.toFixed(2)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// --- START SERVER ---
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT} with OCR.space`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`📄 Parse endpoint: http://localhost:${PORT}/api/parse-receipt`);
});