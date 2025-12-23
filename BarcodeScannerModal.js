import React, { useState, useEffect, useRef, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, Dimensions, Alert, TextInput, Keyboard, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, Camera } from 'expo-camera';
import { getTheme } from './theme';
import { ShoppingListContext } from './App';
import { predictExpiryDate } from './food-scanner-app/utils';
import { API_BASE_URL } from './config';

// Parse expiry date from OCR text (same logic as backend)
function parseExpiryDate(ocrText) {
  if (!ocrText || typeof ocrText !== 'string') return null;

  // Clean and normalize the text
  const cleanText = ocrText.replace(/\s+/g, ' ').toLowerCase().trim();

  // Common expiry date patterns
  const patterns = [
    // DD/MM/YY or DD/MM/YYYY
    /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/g,
    // MM/DD/YY or MM/DD/YYYY
    /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/g,
    // YY/MM/DD or YYYY/MM/DD
    /\b(\d{2,4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/g,
    // DD.MM.YY or DD.MM.YYYY
    /\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/g,
    // MM.DD.YY or MM.DD.YYYY
    /\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/g,
    // YY.MM.DD or YYYY.MM.DD
    /\b(\d{2,4})\.(\d{1,2})\.(\d{1,2})\b/g,
    // DD MMM YY or DD MMM YYYY (e.g., 15 JAN 23)
    /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{2,4})\b/gi,
    // MMM DD YY or MMM DD YYYY (e.g., JAN 15 23)
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})\s+(\d{2,4})\b/gi,
    // DD Month YY or DD Month YYYY (e.g., 15 January 2023)
    /\b(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{2,4})\b/gi,
    // Month DD YY or Month DD YYYY (e.g., January 15 2023)
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})\s+(\d{2,4})\b/gi,
    // Just numbers like 151223 (DDMMYY)
    /\b(\d{2})(\d{2})(\d{2})\b/g,
    // Just numbers like 15122023 (DDMMYYYY)
    /\b(\d{2})(\d{2})(\d{4})\b/g,
  ];

  const monthNames = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
  };

  let bestMatch = null;
  let bestScore = 0;

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(cleanText)) !== null) {
      try {
        let day, month, year;

        if (pattern.source.includes('jan|feb|mar') || pattern.source.includes('january|february')) {
          // Text month patterns
          if (match[1] && isNaN(match[1])) {
            // Month DD YY
            month = monthNames[match[1].toLowerCase()];
            day = parseInt(match[2]);
            year = parseInt(match[3]);
          } else {
            // DD Month YY
            day = parseInt(match[1]);
            month = monthNames[match[2].toLowerCase()];
            year = parseInt(match[3]);
          }
        } else if (pattern.source.includes('151223') || pattern.source.includes('15122023')) {
          // DDMMYY or DDMMYYYY
          day = parseInt(match[1]);
          month = parseInt(match[2]) - 1; // JS months are 0-based
          year = parseInt(match[3]);
        } else {
          // Numeric patterns
          const num1 = parseInt(match[1]);
          const num2 = parseInt(match[2]);
          const num3 = parseInt(match[3]);

          // Heuristics to determine DD/MM/YY vs MM/DD/YY vs YY/MM/DD
          if (num3 >= 1000) {
            // YYYY format
            if (num1 > 31 && num2 <= 12) {
              // Likely YY/MM/DD
              year = num1;
              month = num2 - 1;
              day = num3;
            } else if (num1 <= 12 && num2 <= 31) {
              // Could be MM/DD/YYYY or DD/MM/YYYY
              // Assume DD/MM/YYYY for international format
              day = num1;
              month = num2 - 1;
              year = num3;
            } else {
              day = num1;
              month = num2 - 1;
              year = num3;
            }
          } else {
            // YY format - assume 2000s
            year = num3 >= 50 ? 1900 + num3 : 2000 + num3;

            if (num1 > 12) {
              // Likely DD/MM/YY
              day = num1;
              month = num2 - 1;
            } else if (num2 > 12) {
              // Likely MM/DD/YY
              month = num1 - 1;
              day = num2;
            } else {
              // Ambiguous, assume DD/MM/YY
              day = num1;
              month = num2 - 1;
            }
          }
        }

        // Validate date components
        if (day < 1 || day > 31 || month < 0 || month > 11 || year < 1900 || year > 2100) {
          continue;
        }

        // Create date object
        const date = new Date(year, month, day);
        if (isNaN(date.getTime())) continue;

        // Score the match based on context (prefer dates near current date)
        const now = new Date();
        const daysDiff = Math.abs((date - now) / (1000 * 60 * 60 * 24));
        let score = 1000 - daysDiff; // Prefer dates closer to today

        // Boost score for dates in the future (expiry dates are usually future)
        if (date > now) score += 500;

        // Boost score for reasonable expiry periods (not too far in future)
        if (daysDiff < 365 * 5) score += 200; // Within 5 years

        if (score > bestScore) {
          bestScore = score;
          bestMatch = date.toISOString().split('T')[0]; // YYYY-MM-DD format
        }
      } catch (e) {
        // Skip invalid date parsing
        continue;
      }
    }
  }

  return bestMatch;
}

// Simple date extraction from text (prioritizing UK format DD/MM/YYYY)
const extractDateFromText = (text) => {
  // Common date patterns: DD/MM/YYYY, MM/DD/YYYY, DD/MM/YY, MM/DD/YY, etc.
  const datePatterns = [
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/g,  // DD/MM/YYYY or MM/DD/YYYY
  ];

  const currentYear = new Date().getFullYear();
  const currentYearShort = currentYear % 100;

  for (const pattern of datePatterns) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        const parts = match.split(/[\/\-]/).map(p => parseInt(p));
        if (parts.length === 3) {
          let [first, second, third] = parts;

          // Try different interpretations, prioritizing DD/MM/YYYY for UK
          const possibleDates = [];

          // First try DD/MM/YYYY (UK format)
          if (second >= 1 && second <= 12 && first >= 1 && first <= 31) {
            const year = third < 100 ? (third <= currentYearShort ? 2000 + third : 1900 + third) : third;
            if (year >= currentYear - 1) { // Only future or recent dates
              possibleDates.push({ month: second, day: first, year });
            }
          }

          // Then try MM/DD/YYYY (US format)
          if (first >= 1 && first <= 12 && second >= 1 && second <= 31) {
            const year = third < 100 ? (third <= currentYearShort ? 2000 + third : 1900 + third) : third;
            if (year >= currentYear - 1) {
              possibleDates.push({ month: first, day: second, year });
            }
          }

          // Return the first valid date found
          for (const date of possibleDates) {
            try {
              const testDate = new Date(date.year, date.month - 1, date.day);
              if (testDate.getFullYear() === date.year &&
                  testDate.getMonth() === date.month - 1 &&
                  testDate.getDate() === date.day) {
                return `${date.month.toString().padStart(2, '0')}/${date.day.toString().padStart(2, '0')}/${date.year}`;
              }
            } catch (e) {
              continue;
            }
          }
        }
      }
    }
  }

  // Also try to match common text patterns like "BEST BY 15/12/2024" or "EXPIRES 15 DEC 2024"
  const textPatterns = [
    /best\s+by\s+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i,
    /expires?\s+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i,
    /exp\s+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i,
    /use\s+by\s+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i,
  ];

  for (const pattern of textPatterns) {
    const match = text.match(pattern);
    if (match) {
      const [, day, month, year] = match.map(p => parseInt(p));
      const fullYear = year < 100 ? (year <= currentYearShort ? 2000 + year : 1900 + year) : year;
      try {
        const testDate = new Date(fullYear, month - 1, day);
        if (testDate.getFullYear() === fullYear &&
            testDate.getMonth() === month - 1 &&
            testDate.getDate() === day) {
          return `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${fullYear}`;
        }
      } catch (e) {
        continue;
      }
    }
  }

  return null;
};

const { width, height } = Dimensions.get('window');

export default function BarcodeScannerModal({ visible, onClose, onProductScanned, accentKey, darkMode }) {
  const theme = getTheme(accentKey, darkMode);
  const [hasPermission, setHasPermission] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [torch, setTorch] = useState(false);
  const cameraRef = useRef(null);
  const scanLockRef = useRef(false);
  const lastScanDataRef = useRef(null);
  const lastScanTimeRef = useRef(0);

  // UI mode and price input state
  const [mode, setMode] = useState('camera'); // 'camera' | 'price' | 'confirm' | 'expiry'
  const [pendingProduct, setPendingProduct] = useState(null);
  const [priceValue, setPriceValue] = useState('');
  const [quantityValue, setQuantityValue] = useState(1);
  const [expiryValue, setExpiryValue] = useState('');
  const [scannedExpiryText, setScannedExpiryText] = useState('');

  useEffect(() => {
    if (visible) {
      getCameraPermissions();
      setScanned(false);
      scanLockRef.current = false;
      lastScanDataRef.current = null;
      lastScanTimeRef.current = 0;
      setMode('camera');
      setPendingProduct(null);
      setPriceValue('');
      setExpiryValue('');
      setScannedExpiryText('');
    }
  }, [visible]);

  const getCameraPermissions = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === 'granted');
  };

  // Fetch product info from Open Food Facts
  const fetchProductInfo = async (barcode) => {
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      const data = await response.json();
      if (data.status === 1 && data.product) {
        const product = data.product;
        
        // Parse serving size using the same logic as search functionality
        let serving_size_g = null;
        const serving_size_text = product.serving_size || '';
        
        // First try serving_quantity field (common in Open Food Facts)
        if (product.serving_quantity && !isNaN(parseFloat(product.serving_quantity))) {
          serving_size_g = Math.round(parseFloat(product.serving_quantity));
        } else {
          // Then try serving_size field with improved parsing
          const txt = serving_size_text.toLowerCase();
          
          // Try multiple patterns to catch different formats
          const patterns = [
            /(\d+(?:\.\d+)?)\s*g(?:ram)?s?/,  // 25g, 25.5g, 25 gram, 25 grams
            /(\d+(?:\.\d+)?)\s*ml/,           // 25ml
            /(\d+(?:\.\d+)?)\s*milliliter/,   // 25 milliliter
            /(\d+(?:\.\d+)?)\s*oz/,           // 1 oz
            /(\d+(?:\.\d+)?)\s*ounce/,        // 1 ounce
            /(\d+(?:\.\d+)?)\s*lb/,           // 1 lb
            /(\d+(?:\.\d+)?)\s*pound/,        // 1 pound
            /(\d+(?:\.\d+)?)\s*kg/,           // 1 kg
            /(\d+(?:\.\d+)?)\s*kilogram/,     // 1 kilogram
            /(\d+(?:\.\d+)?)/                 // Just numbers (assumes grams)
          ];
          
          for (const pattern of patterns) {
            const match = txt.match(pattern);
            if (match) {
              let val = parseFloat(match[1]);
              if (!isNaN(val)) {
                // Convert units to grams
                if (txt.includes('oz') || txt.includes('ounce')) {
                  val *= 28.35; // oz to grams
                } else if (txt.includes('lb') || txt.includes('pound')) {
                  val *= 453.59; // lb to grams
                } else if (txt.includes('kg') || txt.includes('kilogram')) {
                  val *= 1000; // kg to grams
                }
                serving_size_g = Math.round(val);
                break;
              }
            }
          }
        }
        
        return {
          id: Date.now().toString(),
          name: product.product_name || 'Unknown Product',
          brand: product.brands || '',
          category: product.categories || '',
          expiry: predictExpiryDate(product.categories || ''),
          barcode: barcode,
          quantity: 1,
          dateAdded: new Date().toISOString().split('T')[0],
          imageUrl: product.image_url || null,
          nutrition: product.nutriments || {},
          ingredients: product.ingredients_text || '',
          // Add nutritional data for portion calorie calculation
          calories: product.nutriments?.['energy-kcal_100g'] || product.nutriments?.['energy_100g'] || 0,
          protein: product.nutriments?.['proteins_100g'] || 0,
          carbs: product.nutriments?.['carbohydrates_100g'] || 0,
          fat: product.nutriments?.['fat_100g'] || 0,
          fiber: product.nutriments?.['fiber_100g'] || 0,
          serving: '100g',
          serving_size_g: serving_size_g,
          serving_size_text: serving_size_text,
          isApiResult: true,
          source: 'api'
        };
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  // Fetch price from UPCitemdb
  const fetchProductPrice = async (barcode) => {
    try {
      const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`);
      const data = await response.json();
      if (data.items && data.items.length > 0) {
        const offers = data.items[0].offers || [];
        const prices = offers.map(offer => parseFloat(offer.price)).filter(Boolean);
        if (prices.length > 0) {
          return Math.min(...prices);
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  // Helper to handle adding product, prompting for expiry then price if needed
  const handleAddProductWithPrice = (product) => {
    // Always close camera view and show expiry scanning step
    setPendingProduct(product);
    setExpiryValue('');
    setScannedExpiryText('');
    setMode('expiry');
  };

  const handleBarcodeScanned = async ({ type, data }) => {
    // Guard against rapid multiple triggers from camera callback
    if (scanLockRef.current) return;

    // Debounce duplicate scans of the same data within 1500ms
    const now = Date.now();
    if (lastScanDataRef.current === data && now - lastScanTimeRef.current < 1500) {
      return;
    }
    lastScanDataRef.current = data;
    lastScanTimeRef.current = now;

    scanLockRef.current = true;
    setScanned(true);
    setLoading(true);
    try {
      let product = await fetchProductInfo(data);
      if (!product) {
        product = {
          id: Date.now().toString(),
          name: 'Unknown Product',
          barcode: data,
          expiry: predictExpiryDate(null), // No category available from barcode scan
          quantity: 1,
          dateAdded: new Date().toISOString().split('T')[0],
        };
      }
      if (!product.price) {
        const fetchedPrice = await fetchProductPrice(data);
        if (fetchedPrice) {
          product.price = fetchedPrice;
        }
      }
      // reset quantity to 1 for each scan
      setQuantityValue(1);
      handleAddProductWithPrice(product);
    } finally {
      setLoading(false);
    }
  };

  // Handle expiry photo capture and OCR
  const handleExpiryPhotoCapture = async () => {
    if (!cameraRef.current) return;

    try {
      setLoading(true);
      setScannedExpiryText('Processing...');

      // Take photo
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
        exif: false,
      });

      // Send to backend OCR using centralized config (same as receipt scanner)
      const response = await fetch(`${API_BASE_URL}/api/parse-receipt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          base64Image: photo.base64,
          mimeType: 'image/jpeg',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const ocrText = data.text || '';

      // Parse expiry date from OCR text using the same logic as backend
      const expiryDate = parseExpiryDate(ocrText);

      if (expiryDate) {
        setExpiryValue(expiryDate);
        setScannedExpiryText(`✓ Date found: ${expiryDate}`);
        // Auto-advance to next step after successful scan
        setTimeout(() => {
          if (!pendingProduct.price) {
            setPriceValue('');
            setMode('price');
          } else {
            setMode('confirm');
          }
        }, 1500);
      } else {
        setScannedExpiryText(ocrText ? `No date found in: ${ocrText.substring(0, 50)}...` : 'No date detected - try again');
      }
    } catch (error) {
      console.error('Expiry OCR failed:', error);
      setScannedExpiryText('Failed to process image - try again');
      Alert.alert('Error', 'Failed to scan expiry date. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Manual barcode entry logic
  const handleManualBarcodeEntry = async (barcode) => {
    if (barcode && barcode.trim()) {
      setLoading(true);
      let product = await fetchProductInfo(barcode.trim());
      if (!product) {
        product = {
          id: Date.now().toString(),
          name: 'Unknown Product',
          barcode: barcode.trim(),
          expiry: predictExpiryDate(null), // No category available from manual entry
          quantity: 1,
          dateAdded: new Date().toISOString().split('T')[0],
        };
      }
      if (!product.price) {
        const fetchedPrice = await fetchProductPrice(barcode.trim());
        if (fetchedPrice) {
          product.price = fetchedPrice;
        }
      }
      setLoading(false);
      // reset quantity to 1 for manual entry
      setQuantityValue(1);
      handleAddProductWithPrice(product);
    } else {
      Alert.alert('Error', 'Please enter a valid barcode.');
      onClose();
    }
  };

  // Replace Alert.prompt for manual entry with our handler
  const enterBarcodeManually = () => {
    Alert.prompt(
      'Enter Barcode',
      'Please enter the barcode number:',
      [
        { text: 'Cancel', style: 'cancel', onPress: onClose },
        { 
          text: 'Add', 
          onPress: handleManualBarcodeEntry
        }
      ],
      'plain-text'
    );
  };

  const toggleTorch = () => {
    setTorch(!torch);
  };

  if (!visible) return null;

  if (hasPermission === null) {
    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.container}>
          <View style={styles.permissionContainer}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.permissionText}>Requesting camera permission...</Text>
          </View>
        </View>
      </Modal>
    );
  }

  if (hasPermission === false) {
    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.container}>
          <View style={styles.permissionContainer}>
            <MaterialCommunityIcons name="camera-off" size={80} color="#fff" />
            <Text style={styles.permissionText}>No access to camera</Text>
            <TouchableOpacity 
              style={[styles.button, { backgroundColor: theme.primary }]} 
              onPress={getCameraPermissions}
            >
              <Text style={styles.buttonText}>Request Permission</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, { backgroundColor: theme.error, marginTop: 12 }]} onPress={onClose}>
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {mode === 'camera' ? (
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="back"
            flash={torch ? 'torch' : 'off'}
            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: [
                'qr', 'pdf417', 'aztec', 'ean13', 'ean8', 'upc_e', 'code39', 'code93', 'code128', 'codabar', 'itf14', 'upc_a'
              ],
            }}
          >
            <View style={styles.cameraOverlay}>
              <View style={styles.cameraHeader}>
                <TouchableOpacity 
                  style={styles.cameraButton} 
                  onPress={onClose}
                >
                  <MaterialCommunityIcons name="close" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.cameraTitle}>Scan Barcode</Text>
                <TouchableOpacity 
                  style={[styles.cameraButton, torch && styles.cameraButtonActive]} 
                  onPress={toggleTorch}
                >
                  <MaterialCommunityIcons 
                    name={torch ? "flashlight" : "flashlight-off"} 
                    size={24} 
                    color={torch ? "#FFD700" : "#fff"} 
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.scanArea}>
                <View style={styles.scanFrame}>
                  <View style={[styles.corner, styles.topLeft]} />
                  <View style={[styles.corner, styles.topRight]} />
                  <View style={[styles.corner, styles.bottomLeft]} />
                  <View style={[styles.corner, styles.bottomRight]} />
                </View>
                <Text style={styles.scanText}>
                  {scanned ? 'Barcode scanned!' : 'Point camera at barcode'}
                </Text>
              </View>
              <View style={styles.cameraFooter}>
                <TouchableOpacity 
                  style={[styles.footerButton, { backgroundColor: theme.secondary }]} 
                  onPress={() => { setScanned(false); scanLockRef.current = false; lastScanDataRef.current = null; }}
                  disabled={!scanned}
                >
                  <MaterialCommunityIcons name="refresh" size={20} color="#fff" />
                  <Text style={styles.footerButtonText}>Scan Again</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.button, { backgroundColor: theme.accent }]} 
                  onPress={enterBarcodeManually}
                  disabled={loading}
                >
                  <MaterialCommunityIcons name="pencil" size={24} color="#fff" />
                  <Text style={styles.buttonText}>Enter Manually</Text>
                </TouchableOpacity>
              </View>
            </View>
          </CameraView>
        ) : mode === 'expiry' ? (
          // Expiry scanning/input view (camera closed)
          <KeyboardAvoidingView
            style={styles.priceContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
          >
            <ScrollView contentContainerStyle={styles.scrollContent}>
              <View style={styles.priceCard}>
              <Text style={styles.priceTitle}>Scan Expiry Date</Text>
              <Text style={styles.priceSubtitle}>
                {pendingProduct?.name ? `Scan the expiry date for ${pendingProduct.name}` : 'Scan expiry date:'}
              </Text>

              {/* Camera for expiry photo capture */}
              <CameraView
                ref={cameraRef}
                style={styles.expiryScanArea}
                facing="back"
                flash={torch ? 'torch' : 'off'}
              >
                <View style={styles.expiryScanFrame}>
                  <View style={[styles.expiryCorner, styles.expiryTopLeft]} />
                  <View style={[styles.expiryCorner, styles.expiryTopRight]} />
                  <View style={[styles.expiryCorner, styles.expiryBottomLeft]} />
                  <View style={[styles.expiryCorner, styles.expiryBottomRight]} />
                </View>
                <Text style={styles.expiryScanText}>
                  Point camera at expiry date and tap "Take Photo"
                </Text>
                {scannedExpiryText ? (
                  <View style={styles.scannedTextContainer}>
                    <Text style={styles.scannedTextLabel}>Result:</Text>
                    <Text style={styles.scannedText}>{scannedExpiryText}</Text>
                    {expiryValue ? (
                      <Text style={styles.extractedDateText}>✓ Date found: {expiryValue}</Text>
                    ) : (
                      <Text style={styles.noDateText}>No date detected - try again</Text>
                    )}
                  </View>
                ) : null}
              </CameraView>

              {/* Take Photo button */}
              <TouchableOpacity
                style={[styles.takePhotoButton, loading && styles.takePhotoButtonDisabled]}
                onPress={handleExpiryPhotoCapture}
                disabled={loading}
              >
                <MaterialCommunityIcons name="camera" size={24} color="#fff" />
                <Text style={styles.takePhotoButtonText}>
                  {loading ? 'Processing...' : 'Take Photo'}
                </Text>
              </TouchableOpacity>

              {/* Manual expiry input */}
              <View style={[styles.priceInputRow, { marginTop: 20 }]}>
                <Text style={styles.priceCurrency}>Expiry</Text>
                <TextInput
                  value={expiryValue}
                  onChangeText={(txt) => {
                    // Allow flexible date formats: DD/MM, DD/MM/YY, DD/MM/YYYY
                    let sanitized = txt.replace(/[^0-9]/g, '');
                    if (sanitized.length >= 2 && sanitized.length <= 4) {
                      // DD/MM or DD/MMYY -> DD/MM or DD/MMYY
                      sanitized = sanitized.slice(0, 2) + '/' + sanitized.slice(2);
                    } else if (sanitized.length >= 4) {
                      // DDMMYY or DDMMYYYY -> DD/MM/YY or DD/MM/YYYY
                      sanitized = sanitized.slice(0, 2) + '/' + sanitized.slice(2, 4) + '/' + sanitized.slice(4, 8);
                    }
                    setExpiryValue(sanitized);
                  }}
                  placeholder="DD/MM or DD/MM/YY"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  maxLength={10}
                  style={styles.priceInput}
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    // Validate date format when done is pressed
                    if (expiryValue && expiryValue.length > 0) {
                      const parts = expiryValue.split('/').filter(p => p.length > 0);
                      if (parts.length === 2 || parts.length === 3) {
                        const [day, month, year] = parts.map(p => parseInt(p));
                        const currentYear = new Date().getFullYear();
                        const fullYear = parts.length === 2 ? currentYear : (year < 100 ? 2000 + year : year);

                        const date = new Date(fullYear, month - 1, day);
                        if (date.getFullYear() !== fullYear || date.getMonth() !== month - 1 || date.getDate() !== day) {
                          Alert.alert('Invalid Date', 'Please enter a valid date.');
                          setExpiryValue('');
                        } else {
                          // Valid date - dismiss keyboard
                          Keyboard.dismiss();
                        }
                      } else {
                        Alert.alert('Invalid Format', 'Please enter date as DD/MM or DD/MM/YY.');
                        setExpiryValue('');
                      }
                    } else {
                      // Empty input - just dismiss keyboard
                      Keyboard.dismiss();
                    }
                  }}
                  blurOnSubmit={true}
                />
              </View>

              <View style={styles.priceActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnOutline]}
                  onPress={() => {
                    // Skip expiry scanning, proceed to price
                    if (!pendingProduct.price) {
                      setPriceValue('');
                      setMode('price');
                    } else {
                      setMode('confirm');
                    }
                  }}
                >
                  <Text style={[styles.modalBtnText, styles.modalBtnOutlineText]}>Skip Scan</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnFilled]}
                  onPress={() => {
                    // Process expiry date and proceed to price input
                    let processedExpiry = null;
                    if (expiryValue.trim()) {
                      // Try to parse the expiry date (DD/MM or DD/MM/YY format)
                      const parts = expiryValue.split('/').filter(p => p.length > 0);
                      if (parts.length === 2 || parts.length === 3) {
                        const [day, month, year] = parts.map(p => parseInt(p));
                        if (!isNaN(day) && !isNaN(month)) {
                          const currentYear = new Date().getFullYear();
                          const fullYear = parts.length === 2 ? currentYear : (year < 100 ? 2000 + year : year);
                          processedExpiry = new Date(fullYear, month - 1, day).toISOString().split('T')[0];
                        }
                      }
                    }

                    // Update product with processed expiry
                    if (processedExpiry) {
                      setPendingProduct(prev => ({ ...prev, expiry: processedExpiry }));
                    }

                    // Proceed to price input
                    if (!pendingProduct.price) {
                      setPriceValue('');
                      setMode('price');
                    } else {
                      setMode('confirm');
                    }
                  }}
                >
                  <Text style={[styles.modalBtnText, styles.modalBtnFilledText]}>Continue</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        ) : mode === 'price' ? (
          // Price input view (camera closed)
          <KeyboardAvoidingView
            style={styles.priceContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
          >
            <ScrollView contentContainerStyle={styles.scrollContent}>
              <View style={styles.priceCard}>
                <Text style={styles.priceTitle}>Enter Price</Text>
                <Text style={styles.priceSubtitle}>
                  {pendingProduct?.name ? `No price found for ${pendingProduct.name}.` : 'Enter price:'}
                </Text>
                <View style={styles.priceInputRow}>
                  <Text style={styles.priceCurrency}>£</Text>
                  <TextInput
                    value={priceValue}
                    onChangeText={(txt) => {
                      // allow only digits and a single dot
                      const sanitized = txt.replace(/[^0-9.]/g, '')
                                           .replace(/(\..*)\./g, '$1');
                      setPriceValue(sanitized);
                    }}
                    placeholder="0.00"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="decimal-pad"
                    autoFocus
                    style={styles.priceInput}
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      // Validate price when done is pressed
                      const parsed = parseFloat(priceValue);
                      if (!isNaN(parsed) && parsed > 0) {
                        Keyboard.dismiss();
                      } else if (priceValue.trim() !== '') {
                        Alert.alert('Invalid Price', 'Please enter a valid positive number.');
                      } else {
                        Keyboard.dismiss();
                      }
                    }}
                    blurOnSubmit={true}
                  />
                </View>
                <View style={[styles.priceInputRow, { marginTop: 10 }]}
                >
                  <Text style={styles.priceCurrency}>Qty</Text>
                  <TextInput
                    value={String(quantityValue)}
                    onChangeText={(txt) => {
                      const sanitized = txt.replace(/[^0-9]/g, '');
                      const num = sanitized === '' ? 1 : Math.max(1, parseInt(sanitized, 10));
                      setQuantityValue(num);
                    }}
                    placeholder="1"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    style={styles.priceInput}
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      Keyboard.dismiss();
                    }}
                    blurOnSubmit={true}
                  />
                </View>
                <View style={styles.priceActions}>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.modalBtnOutline]}
                    onPress={() => {
                      // Skip entering price, proceed without price
                      const qty = Math.max(1, Number(quantityValue) || 1);
                      const product = { ...pendingProduct, quantity: qty };
                      setPendingProduct(null);
                      setPriceValue('');
                      onProductScanned(product);
                      onClose();
                    }}
                  >
                    <Text style={[styles.modalBtnText, styles.modalBtnOutlineText]}>Skip</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.modalBtnFilled]}
                    onPress={() => {
                      const parsed = parseFloat(priceValue);
                      if (!isNaN(parsed) && parsed > 0) {
                        const qty = Math.max(1, Number(quantityValue) || 1);
                        const product = { ...pendingProduct, price: parsed, quantity: qty };
                        setPendingProduct(null);
                        setPriceValue('');
                        onProductScanned(product);
                        onClose();
                      } else {
                        Alert.alert('Invalid Price', 'Please enter a valid positive number.');
                      }
                    }}
                  >
                    <Text style={[styles.modalBtnText, styles.modalBtnFilledText]}>OK</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        ) : (
          // Confirm view when price is available
          <View style={styles.priceContainer}>
            <View style={styles.priceCard}>
              <Text style={styles.priceTitle}>Confirm Item</Text>
              <Text style={styles.priceSubtitle}>
                {pendingProduct?.name}
              </Text>
              {typeof pendingProduct?.price === 'number' && (
                <Text style={[styles.priceSubtitle, { marginTop: 8 }]}>Price: ${Number(pendingProduct.price).toFixed(2)}</Text>
              )}
              {pendingProduct?.expiry && (
                <Text style={[styles.priceSubtitle, { marginTop: 8 }]}>Expiry: {pendingProduct.expiry}</Text>
              )}
              <View style={[styles.priceActions, { marginTop: 16 }]}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnOutline]}
                  onPress={() => {
                    // Skip adding item
                    setPendingProduct(null);
                    setPriceValue('');
                    onClose();
                  }}
                >
                  <Text style={[styles.modalBtnText, styles.modalBtnOutlineText]}>Skip</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnFilled]}
                  onPress={() => {
                    const qty = Math.max(1, Number(quantityValue) || 1);
                    const product = { ...pendingProduct, quantity: qty };
                    setPendingProduct(null);
                    setPriceValue('');
                    onProductScanned(product);
                    // Don't call onClose() here - let parent component handle closing
                  }}
                >
                  <Text style={[styles.modalBtnText, styles.modalBtnFilledText]}>OK</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Processing...</Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  priceContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  priceCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#333333',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  priceTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  priceSubtitle: {
    color: '#a0a0a0',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#404040',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  priceCurrency: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
  priceInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '500',
    paddingVertical: 4,
  },
  priceActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
  },
  camera: {
    width: width,
    height: height,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  cameraButton: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 28,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  cameraButtonActive: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  cameraTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  scanArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 280,
    height: 280,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 35,
    height: 35,
    borderColor: '#ffffff',
    borderWidth: 5,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  scanText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 32,
    paddingHorizontal: 24,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  cameraFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 50,
    gap: 16,
  },
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  footerButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  permissionText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  modalBtnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#555555',
  },
  modalBtnFilled: {
    backgroundColor: '#007AFF',
    shadowColor: '#007AFF',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modalBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalBtnOutlineText: {
    color: '#ffffff',
  },
  modalBtnFilledText: {
    color: '#ffffff',
  },
  expiryScanArea: {
    width: '100%',
    height: 200,
    backgroundColor: '#000',
    borderRadius: 12,
    marginTop: 16,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  expiryScanFrame: {
    width: 200,
    height: 100,
    position: 'relative',
  },
  expiryCorner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#ffffff',
    borderWidth: 3,
  },
  expiryTopLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  expiryTopRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  expiryBottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  expiryBottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  expiryScanText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
  },
  scannedTextContainer: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 8,
    padding: 8,
  },
  scannedTextLabel: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  scannedText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'monospace',
  },
  extractedDateText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  noDateText: {
    color: '#FFC107',
    fontSize: 12,
    marginTop: 4,
  },
  takePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 16,
    gap: 10,
    shadowColor: '#007AFF',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  takePhotoButtonDisabled: {
    backgroundColor: '#666666',
    shadowOpacity: 0,
  },
  takePhotoButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
