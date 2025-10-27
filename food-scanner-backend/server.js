// server.js
// --- SETUP INSTRUCTIONS ---
// 1. Place your Google Cloud service account JSON in this folder.
// 2. Set the correct path below (or use GOOGLE_APPLICATION_CREDENTIALS env var).
// 3. Create a Document AI processor in Google Cloud Console (type: Receipt Parser or Document OCR).
// 4. Set PROJECT_ID, LOCATION, and PROCESSOR_ID below.
// 5. Enable Document AI API and assign 'Document AI API User' role to your service account.

require('dotenv').config();
// 🔐 SECURITY: Never log sensitive API keys or tokens
console.log('🔧 Environment loaded, API keys configured:', process.env.OPENAI_API_KEY ? '✅' : '❌');

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const { OpenAI } = require('openai');
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;


const app = express();
app.use(cors()); // Allow all origins for local dev
app.use(express.json({ limit: '20mb' }));

// Basic rate limiting
const limiter = rateLimit({ windowMs: 60 * 1000, max: 60 });
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
const OCR_SPACE_API_KEY = process.env.OCR_SPACE_API_KEY || 'K81014695188957'; // Your OCR.space API key
const PORT = process.env.PORT || 3001;

// --- LOG CONFIG ON STARTUP ---
console.log('🚀 Server starting up...');
console.log('📋 Configuration:');
console.log('   OCR.space API Key:', OCR_SPACE_API_KEY ? '✅' : '❌');
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
// Prefers Spoonacular when an API key is configured, falls back to TheMealDB
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

// Free-only mode to skip paid/limited APIs
const RECIPE_FREE_ONLY = String(process.env.RECIPE_FREE_ONLY || '').trim() === '1';

// Simple in-memory cache for recipe searches to reduce external calls
const recipeCache = new Map(); // key -> { data, expiresAt }
const RECIPE_CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

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
    
    // Enhanced search term construction for all subcategories
    let term = '';
    if (q) {
      term = String(q).trim();
    } else if (subcategory && category) {
      // Comprehensive subcategory mapping
      const subcategorySearchMap = {
        // Breakfast subcategories
        'sweet': 'pancake waffle french toast',
        'savory': 'egg bacon omelet toast',
        'high-protein': 'protein egg greek yogurt',
        'overnight': 'overnight oats chia pudding',
        '5-ingredients': 'simple easy quick breakfast',
        
        // Lunch subcategories
        'sandwich': 'sandwich wrap panini',
        'salad': 'salad caesar greek cobb',
        'soup': 'soup broth bisque chowder',
        'meal-prep': 'bowl prep container batch',
        'vegetarian': 'vegetarian veggie plant based',
        
        // Dinner subcategories
        'one-pot': 'one pot skillet casserole stew',
        'chicken': 'chicken poultry',
        'pasta': 'pasta spaghetti penne linguine',
        'quick': 'quick fast 30 minute easy',
        
        // Snack subcategories
        'chocolatey': 'chocolate brownie cocoa dessert',
        'healthy': 'healthy fruit nuts yogurt smoothie',
        'no-bake': 'no bake refrigerator chilled dessert',
      };
      
      term = subcategorySearchMap[subcategory] || `${subcategory} ${category}`;
    } else if (category) {
      term = category;
    }
    
    const max = Math.max(1, Math.min(50, Number(limit) || 12));

    // Cache check
    const cacheKey = makeRecipeCacheKey({ q: term, category, subcategory, ingredients, limit: max });
    const cached = recipeCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return res.json({ ok: true, recipes: cached.data, source: 'cache' });
    }

    // Try Spoonacular first when API key is available
    const spoonKey = process.env.SPOONACULAR_API_KEY || process.env.SPOON_API_KEY;
    if (spoonKey && !RECIPE_FREE_ONLY) {
      try {
        const params = new URLSearchParams();
        if (term) params.set('query', term);
        if (ingredients) params.set('includeIngredients', String(ingredients));
        
        // Add specific dietary restrictions for subcategories
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
        // Deduplicate by name
        const seen = new Set();
        const unique = mapped.filter((r) => {
          const key = r.name.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }).slice(0, max);
        // Cache and return
        recipeCache.set(cacheKey, { data: unique, expiresAt: Date.now() + RECIPE_CACHE_TTL_MS });
        return res.json({ ok: true, recipes: unique, source: 'spoonacular' });
      } catch (e) {
        console.warn('Spoonacular failed, falling back to TheMealDB:', e.message);
        // Continue to TheMealDB fallback
      }
    }

    // --- Enhanced TheMealDB fallback ---
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

    // Enhanced search with multiple terms for subcategories
    if (term) {
      const searchTerms = [term];
      
      // Add specific search terms based on subcategory
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
            // Avoid duplicates
            if (!results.some(r => r.name.toLowerCase() === recipe.name.toLowerCase())) {
              results.push(recipe);
            }
          });
        }
      }
    }

    // If still empty, try category filter when possible
    if (results.length === 0 && category) {
      // Enhanced category mapping
      const catMap = {
        breakfast: 'Breakfast',
        snack: 'Dessert',
        lunch: 'Miscellaneous',
        dinner: 'Beef',
      };
      
      // Special category mapping for subcategories
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

    // Enhanced web scraping with better search terms for all subcategories
    async function scrapeFromSites(term, remaining) {
      if (!term) return [];
      
      // Use better search terms for all subcategories
      let searchTerm = term;
      const subcategorySearchTerms = {
        'chocolatey': 'chocolate dessert recipe',
        'healthy': 'healthy recipe',
        'high-protein': 'high protein recipe',
        'vegetarian': 'vegetarian recipe',
        'no-bake': 'no bake dessert recipe',
        'quick': 'quick easy recipe',
        'one-pot': 'one pot recipe',
        'sweet': 'sweet dessert recipe',
        'savory': category === 'snack' ? 'savory snack recipe' : 'savory recipe',
        'sandwich': 'sandwich recipe',
        'salad': 'salad recipe',
        'soup': 'soup recipe',
        'pasta': 'pasta recipe',
        'chicken': 'chicken recipe',
        'meal-prep': 'meal prep recipe',
        'overnight': 'overnight oats recipe',
        '5-ingredients': 'simple easy recipe',
      };
      
      if (subcategory && subcategorySearchTerms[subcategory]) {
        searchTerm = subcategorySearchTerms[subcategory];
      }
      
      const queries = [
        { name: 'allrecipes', search: `https://www.allrecipes.com/search?q=${encodeURIComponent(searchTerm)}`, pattern: /https?:\/\/www\.allrecipes\.com\/recipe\/[A-Za-z0-9\-_%/]+/g },
        { name: 'bbcgoodfood', search: `https://www.bbcgoodfood.com/search/recipes?q=${encodeURIComponent(searchTerm)}`, pattern: /https?:\/\/www\.bbcgoodfood\.com\/recipes\/[A-Za-z0-9\-_%/]+/g },
        { name: 'eatingwell', search: `https://www.eatingwell.com/search?q=${encodeURIComponent(searchTerm)}`, pattern: /https?:\/\/www\.eatingwell\.com\/recipe\/[A-Za-z0-9\-_%/]+/g },
        { name: 'minimalistbaker', search: `https://minimalistbaker.com/?s=${encodeURIComponent(searchTerm)}`, pattern: /https?:\/\/minimalistbaker\.com\/[A-Za-z0-9\-_%/]+/g },
        { name: 'seriouseats', search: `https://www.seriouseats.com/search?q=${encodeURIComponent(searchTerm)}`, pattern: /https?:\/\/www\.seriouseats\.com\/[A-Za-z0-9\-_%/]+/g },
      ];
      const foundUrls = new Set();
      for (const site of queries) {
        try {
          const html = await fetchText(site.search);
          const matches = html.match(site.pattern) || [];
          matches.forEach((u) => foundUrls.add(u.split('"')[0].split("'")[0]));
          if (foundUrls.size >= remaining * 3) break;
        } catch (e) {
          console.warn(`Failed to scrape ${site.name}:`, e.message);
        }
      }
      const urls = Array.from(foundUrls).slice(0, remaining * 2);
      const out = [];
      await Promise.all(urls.map(async (u) => {
        try {
          const html = await fetchText(u);
          const blocks = collectJsonLdBlocks(html);
          for (const raw of blocks) {
            const json = tryParseJsonLd(raw);
            if (!json) continue;
            const flattened = flattenJsonLd(json);
            const recipeNode = flattened.find((obj) => {
              const t = obj['@type'];
              if (!t) return false;
              const types = Array.isArray(t) ? t : [t];
              return types.map((x) => String(x).toLowerCase()).includes('recipe');
            });
            if (recipeNode) {
              const mapped = mapJsonLdRecipe(recipeNode, u);
              if (mapped.ingredients.length > 0 && mapped.instructions) {
                out.push(mapped);
                break;
              }
            }
          }
        } catch (e) {
          // ignore individual failures
        }
      }));
      return out.slice(0, remaining);
    }

    let remaining = Math.max(0, max - results.length);
    if (remaining > 0) {
      const web = await scrapeFromSites(term || `${category} ${subcategory}`.trim(), remaining);
      results.push(...web);
    }

    // Deduplicate by name and trim to max
    const seen = new Set();
    const unique = results.filter((r) => {
      const key = r.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, max);

    // Cache and return
    recipeCache.set(cacheKey, { data: unique, expiresAt: Date.now() + RECIPE_CACHE_TTL_MS });
    res.json({ ok: true, recipes: unique, source: 'web' });
  } catch (e) {
    console.error('Recipe search failed:', e);
    res.status(500).json({ ok: false, error: 'Recipe search failed' });
  }
});

// Support request ingestion (simple logging endpoint)
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
    // For now, write to a local file; in production, integrate email/helpdesk
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
    
    // Use Open Food Facts search API
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
        // Parse serving size
        const parseServingSize = () => {
          // First try serving_quantity field (common in Open Food Facts)
          if (product.serving_quantity && !isNaN(parseFloat(product.serving_quantity))) {
            const val = parseFloat(product.serving_quantity);
            console.log('Found serving_quantity:', { val, original: product.serving_quantity });
            return Math.round(val);
          }
          
          // Then try serving_size field with improved parsing
          const txt = (product.serving_size || '').toLowerCase();
          console.log('Parsing serving size:', { txt, original: product.serving_size });
          
          // Try multiple patterns to catch different formats
          const patterns = [
            /(\d+(?:\.\d+)?)\s*g/,           // "25g", "25.5g"
            /(\d+(?:\.\d+)?)\s*gram/,        // "25 gram", "25.5 gram"
            /(\d+(?:\.\d+)?)\s*grams/,       // "25 grams", "25.5 grams"
            /(\d+(?:\.\d+)?)\s*ml/,          // "25ml", "25.5ml"
            /(\d+(?:\.\d+)?)\s*milliliter/,  // "25 milliliter"
            /(\d+(?:\.\d+)?)\s*milliliters/, // "25 milliliters"
            /(\d+(?:\.\d+)?)\s*oz/,          // "1 oz"
            /(\d+(?:\.\d+)?)\s*ounce/,       // "1 ounce"
            /(\d+(?:\.\d+)?)\s*ounces/,      // "1 ounces"
            /(\d+(?:\.\d+)?)\s*lb/,          // "1 lb"
            /(\d+(?:\.\d+)?)\s*pound/,       // "1 pound"
            /(\d+(?:\.\d+)?)\s*pounds/,      // "1 pounds"
            /(\d+(?:\.\d+)?)\s*kg/,          // "1 kg"
            /(\d+(?:\.\d+)?)\s*kilogram/,    // "1 kilogram"
            /(\d+(?:\.\d+)?)\s*kilograms/,   // "1 kilograms"
            /(\d+(?:\.\d+)?)\s*/,            // Just a number (assume grams)
          ];
          
          for (const pattern of patterns) {
            const m = txt.match(pattern);
            if (m) {
              const val = parseFloat(m[1]);
              if (!isNaN(val) && val > 0) {
                // Convert to grams if needed
                let grams = val;
                if (pattern.source.includes('oz') || pattern.source.includes('ounce')) {
                  grams = val * 28.35; // oz to grams
                } else if (pattern.source.includes('lb') || pattern.source.includes('pound')) {
                  grams = val * 453.59; // lb to grams
                } else if (pattern.source.includes('kg') || pattern.source.includes('kilogram')) {
                  grams = val * 1000; // kg to grams
                }
                
                console.log('Parsed serving size:', { txt, val, grams, pattern: pattern.source });
                return Math.round(grams);
              }
            }
          }
          
          console.log('No serving size found:', { txt, serving_size: product.serving_size, serving_quantity: product.serving_quantity });
          return null;
        };

        return {
          id: `api-${product.code || Date.now()}-${Math.random()}`,
          name: product.product_name,
          brand: product.brands || '',
          category: product.categories ? product.categories.split(',')[0] : 'Food',
          calories: product.nutriments?.['energy-kcal_100g'] || product.nutriments?.['energy-kcal'] || 0, // per 100g
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
      .filter(food => food.calories > 0); // Only include foods with calorie data

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
      // Try to salvage by wrapping
      suggestions = [];
    }
    if (!Array.isArray(suggestions)) suggestions = [];

    // Normalize output
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
  const prompt = `Categorize each item below into a food category (e.g. dairy, meat, fish, vegetables, fruits, bread, canned-goods, dry-goods, beverages, frozen, snacks, condiments, bakery, household, other).\nReturn a JSON array with objects: {\"name\": string, \"category\": string}.\nItems:\n${lineItems.map(i => i.description || i.name || '').join('\n')}`;
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
      // Map categories back to lineItems
      return lineItems.map((item, idx) => ({ ...item, category: categories[idx]?.category || 'other' }));
    }
  } catch (e) {
    console.error('AI categorization failed:', e);
  }
  // Fallback: assign 'other'
  return lineItems.map(item => ({ ...item, category: 'other' }));
}

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
    console.log(`📊 Image size: ${(cleanBase64.length * 0.75 / 1024 / 1024).toFixed(2)}MB`);

    // --- OCR.space API Request ---
    const formData = new FormData();
    formData.append('apikey', OCR_SPACE_API_KEY);
    formData.append('language', 'eng');
    formData.append('isOverlayRequired', 'false');
    formData.append('detectOrientation', 'true');
    formData.append('scale', 'true');
    formData.append('OCREngine', '2'); // Use OCR Engine 2 for better accuracy

    // Convert base64 to buffer and append as file
    const imageBuffer = Buffer.from(cleanBase64, 'base64');
    const blob = new Blob([imageBuffer], { type: mimeType });
    formData.append('file', blob, 'receipt.jpg');

    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`OCR.space API error: ${response.status} ${response.statusText}`);
    }

    const ocrResult = await response.json();

    if (!ocrResult.IsErroredOnProcessing && ocrResult.ParsedResults && ocrResult.ParsedResults.length > 0) {
      const text = ocrResult.ParsedResults[0].ParsedText || '';
      console.log('✅ OCR successful, extracted text length:', text.length);

      // Parse line items from OCR text using rule-based parser
      let lineItems = [];
      try {
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        lineItems = parseReceiptLinesRuleBased(lines);
        console.log('Parsed lineItems:', lineItems);
        // AI categorization
        lineItems = await categorizeLineItemsWithAI(lineItems);
      } catch (e) {
        console.error('❌ Parsing failed:', e);
        // Fallback to rule-based parser
        const priceRegex = /[£€$]?\s?(\d+\.\d{2})/;
        const ignoreKeywords = [
          'TOTAL', 'SUBTOTAL', 'BALANCE', 'DISCOUNT', 'CHANGE', 'CARD', 'PAYMENT', 'CASH', 'OFFER', 'DUE', 'VAT', 'TAX', 'AMOUNT', 'PAID', 'REFUND', 'CHARGE', 'RECEIVED', 'ROUNDING', 'LOYALTY', 'POINTS', 'REDEEM', 'COUPON', 'VISA', 'MASTERCARD', 'CONTACTLESS', 'CREDIT', 'DEBIT', 'GRAND', 'NET', 'GROSS', 'SUM', 'TENDER', 'RECEIPT', 'THANK', 'BALANCE', 'TOTALS', 'SUB-TOTAL', 'SUB TOTAL', 'CHANGE DUE', 'CASHBACK', 'CASH BACK', 'LESS', 'MORE', 'REMAINING', 'OWED', 'DUE', 'PAID', 'PAYMENT', 'CARD NO', 'AUTH', 'APPROVED', 'DECLINED', 'MERCHANT', 'CUSTOMER', 'BANK', 'ACCOUNT', 'INVOICE', 'BILL', 'ORDER', 'DATE', 'TIME', 'NO.', 'NUMBER', 'REF', 'REFERENCE', 'TRANSACTION', 'TERMINAL', 'CASHIER', 'CLERK', 'REGISTER', 'TILL', 'SHIFT', 'DRAWER', 'OPERATOR', 'SUPERVISOR', 'MANAGER', 'STORE', 'BRANCH', 'LOCATION', 'ADDRESS', 'TEL', 'PHONE', 'EMAIL', 'WEB', 'WWW', 'URL', 'SITE', 'SHOP', 'MARKET', 'SUPERMARKET', 'GROCERY', 'FOOD', 'DRINK', 'BEVERAGE', 'ALCOHOL', 'TOBACCO', 'LOTTERY', 'GAMBLING', 'BETTING', 'GIFT', 'CARD', 'VOUCHER', 'COUPON', 'PROMO', 'PROMOTION', 'OFFER', 'DEAL', 'DISCOUNT', 'SAVINGS', 'BONUS', 'REWARD', 'LOYALTY', 'POINTS', 'MEMBER', 'CLUB', 'SCHEME', 'PROGRAM', 'PLAN', 'SUBSCRIPTION', 'FEE', 'CHARGE', 'SERVICE', 'DELIVERY', 'SHIPPING', 'POSTAGE', 'PACKAGING', 'HANDLING', 'PROCESSING', 'ADMIN', 'ADMINISTRATION', 'BOOKING', 'RESERVATION', 'CANCELLATION', 'REFUND', 'RETURN', 'EXCHANGE', 'REPLACEMENT', 'WARRANTY', 'GUARANTEE', 'INSURANCE', 'PROTECTION', 'COVER', 'ASSISTANCE', 'SUPPORT', 'HELP', 'ENQUIRY', 'QUERY', 'COMPLAINT', 'FEEDBACK', 'SURVEY', 'REVIEW', 'RATING', 'COMMENT', 'SUGGESTION', 'RECOMMENDATION', 'THANK', 'WELCOME', 'GOODBYE', 'BYE', 'SEE YOU', 'SOON', 'AGAIN', 'LATER', 'NEXT', 'TIME', 'VISIT', 'CALL', 'CONTACT', 'EMAIL', 'WRITE', 'MESSAGE', 'NOTE', 'MEMO', 'REMINDER', 'ALERT', 'WARNING', 'NOTICE', 'ANNOUNCEMENT', 'NEWS', 'UPDATE', 'INFORMATION', 'DETAILS', 'SUMMARY', 'REPORT', 'STATEMENT'];
        const hasNameAndPrice = line => priceRegex.test(line) && /[A-Za-z]/.test(line) && !ignoreKeywords.some(k => line.toUpperCase().includes(k));
        const filteredLines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0 && hasNameAndPrice(l));
        lineItems = parseReceiptLinesRuleBased(filteredLines);
        lineItems = await categorizeLineItemsWithAI(lineItems);
      }

      res.json({
        success: true,
        text,
        lineItems,
        confidence: ocrResult.ParsedResults[0].TextOverlay ? 0.8 : 0.7 // Estimate confidence
      });
    } else {
      throw new Error(ocrResult.ErrorMessage ? ocrResult.ErrorMessage[0] : 'OCR processing failed');
    }

  } catch (err) {
    console.error('❌ OCR.space error:', err.message);
    res.status(500).json({
      error: 'OCR processing failed',
      details: err.message
    });
  }
});

// --- START SERVER ---
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT} with OCR.space`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
console.log(`📄 Parse endpoint: http://localhost:${PORT}/api/parse-receipt`);
});

async function parseReceiptWithLLM(ocrText) {
  const prompt = `Extract all line items from this receipt text. For each, return a JSON object with "quantity", "name", and "price". Only include real purchased items, not totals or discounts. Example output:\n[\n  {"quantity": 2, "name": "SKATE HADDOCK", "price": 3.00},\n  {"quantity": 1, "name": "CHICKEN FILLET", "price": 6.00}\n]\nReceipt text:\n${ocrText}`;
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
  });
  const content = response.choices[0].message.content;
  const match = content.match(/\[.*\]/s);
  if (match) {
    return JSON.parse(match[0]);
  }
  throw new Error('Could not parse LLM response');
}

function parseReceiptLinesRuleBased(lines) {
  const items = [];
  const priceRegex = /[£€$]\s?(\d+\.\d{2})/; // Only valid currency symbols
  const quantityRegex = /^(\d+)\s*M?\s+/; // Handle "2M" or "2 M" patterns

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
        // Remove OCR artifacts but keep currency symbols in names
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
