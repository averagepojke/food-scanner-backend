import React, { useState, useRef } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ActivityIndicator, Image, ScrollView, Alert, TextInput } from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { API_BASE_URL } from './config';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getTheme } from './theme';
import Svg, { Rect } from 'react-native-svg';

// Debug: Log the API_BASE_URL
console.log('ReceiptScannerModal: API_BASE_URL =', API_BASE_URL);

// Removed noisy camera debug logs

// Significantly improved parseReceiptText function
function parseReceiptText(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const items = [];
  
  // Enhanced ignore patterns - more specific to avoid false positives
  const ignorePatterns = [
    /^total\s*[£€$]/i, /^subtotal\s*[£€$]/i, /^balance\s*[£€$]/i, 
    /^discount\s*[£€$]/i, /^change\s*[£€$]/i, /^payment\s*[£€$]/i, 
    /^cash\s*[£€$]/i, /^card\s*[£€$]/i, /^visa\s*[£€$]/i, /^mastercard\s*[£€$]/i,
    /^contactless/i, /^chip & pin/i, /^thank you/i, /^thanks/i,
    /^receipt/i, /^customer copy/i, /^merchant copy/i, /^vat\s*[£€$]/i, 
    /^tax\s*[£€$]/i, /^service charge/i, /^tip/i, /^gratuity/i,
    /^www\./i, /\.com/i, /\.co\.uk/i, /^tel:/i, /^phone:/i,
    /^store\s*#/i, /^branch/i, /^location/i, /^address/i,
    /^since/i, /^plc/i, /^ltd/i, /^limited/i,
    /^delivery/i, /^takeaway/i, /^collection/i,
    /^offer/i, /^promotion/i, /^loyalty/i, /^points/i, /^rewards/i,
    /^cashier/i, /^operator/i, /^till/i, /^terminal/i, /^ref/i,
    /^order\s*#/i, /^transaction/i, /^auth\s*code/i,
    /^\d{2}\/\d{2}\/\d{2,4}/, /^\d{2}:\d{2}/, /^\d{4}-\d{2}-\d{2}/,
    /^[0-9\s\-\(\)]+$/, // Pure number/punctuation lines
    /^[A-Z\s]{8,}$/, // Long uppercase-only lines (usually headers)
    /^[*\-=_\s]+$/, // Decoration lines
    /^amount/i, /^quantity/i, /^price/i, /^item/i, /^description/i,
    /^opening/i, /^closing/i, /^balance/i, /^account/i
  ];
  
  // More flexible price regex that handles various formats
  const priceRegex = /(?:^|\s)[£€$]\s*(\d+(?:\.\d{2})?)|(\d+\.\d{2})\s*[£€$]?(?:\s|$)/;
  
  // Enhanced quantity patterns
  const quantityPatterns = [
    /^(\d+)\s*x\s*(.+)/i,        // "2 x Item Name"
    /^(\d+)\s+(.+)/,             // "2 Item Name"
    /(.+)\s*x\s*(\d+)/i,         // "Item Name x 2"
    /(.+)\s+qty\s*(\d+)/i        // "Item Name qty 2"
  ];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip obviously non-item lines
    if (ignorePatterns.some(pattern => pattern.test(line))) {
      continue;
    }
    
    // Skip very short lines (likely not items)
    if (line.length < 3) {
      continue;
    }
    
    // Pattern 1: Line contains both item name and price
    const priceMatch = line.match(priceRegex);
    if (priceMatch) {
      const price = parseFloat(priceMatch[1] || priceMatch[2]);
      
      // Extract item name by removing price and cleaning up
      let itemName = line.replace(priceRegex, '').trim();
      
      // Remove leading/trailing non-letter characters
      itemName = itemName.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '');
      
      let quantity = 1;
      
      // Check for quantity patterns
      for (const pattern of quantityPatterns) {
        const qtyMatch = itemName.match(pattern);
        if (qtyMatch) {
          if (pattern.source.includes('(.+)\\s*x\\s*(\\d+)')) {
            // Item name comes first
            itemName = qtyMatch[1].trim();
            quantity = parseInt(qtyMatch[2], 10) || 1;
          } else {
            // Quantity comes first
            quantity = parseInt(qtyMatch[1], 10) || 1;
            itemName = qtyMatch[2].trim();
          }
          break;
        }
      }
      
      // --- Ignore product codes as quantity ---
      // If the first word is a number > 1000, treat as product code, not quantity
      const firstWord = line.split(/\s+/)[0];
      if (/^\d{4,}$/.test(firstWord) && parseInt(firstWord, 10) > 1000) {
        quantity = 1;
      }
      // Clean up item name further
      itemName = itemName.replace(/^\d+\s*x\s*/i, '').trim();
      itemName = itemName.replace(/\s+/g, ' ').trim();
      
      // Validate item name
      if (itemName.length > 1 && /[a-zA-Z]/.test(itemName) && price > 0) {
        items.push({
          name: itemName,
          quantity: quantity,
          price: price
        });
      }
    }
    
    // Pattern 2: Item name on one line, price on next line
    else if (i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      const nextPriceMatch = nextLine.match(priceRegex);
      
      if (nextPriceMatch && /[a-zA-Z]/.test(line)) {
        const price = parseFloat(nextPriceMatch[1] || nextPriceMatch[2]);
        let itemName = line.trim();
        let quantity = 1;
        
        // Check for quantity patterns
        for (const pattern of quantityPatterns) {
          const qtyMatch = itemName.match(pattern);
          if (qtyMatch) {
            if (pattern.source.includes('(.+)\\s*x\\s*(\\d+)')) {
              itemName = qtyMatch[1].trim();
              quantity = parseInt(qtyMatch[2], 10) || 1;
            } else {
              quantity = parseInt(qtyMatch[1], 10) || 1;
              itemName = qtyMatch[2].trim();
            }
            break;
          }
        }
        
        // Clean up item name
        itemName = itemName.replace(/^\d+\s*x\s*/i, '').trim();
        itemName = itemName.replace(/\s+/g, ' ').trim();
        
        // Validate item name
        if (itemName.length > 1 && /[a-zA-Z]/.test(itemName) && price > 0) {
          items.push({
            name: itemName,
            quantity: quantity,
            price: price
          });
          i++; // Skip the price line
        }
      }
    }
    
    // Pattern 3: Item name without price (we'll assign 0 for manual entry)
    else if (/[a-zA-Z]/.test(line) && line.length > 2) {
      let itemName = line.trim();
      let quantity = 1;
      
      // Check for quantity patterns
      for (const pattern of quantityPatterns) {
        const qtyMatch = itemName.match(pattern);
        if (qtyMatch) {
          if (pattern.source.includes('(.+)\\s*x\\s*(\\d+)')) {
            itemName = qtyMatch[1].trim();
            quantity = parseInt(qtyMatch[2], 10) || 1;
          } else {
            quantity = parseInt(qtyMatch[1], 10) || 1;
            itemName = qtyMatch[2].trim();
          }
          break;
        }
      }
      
      // Clean up item name
      itemName = itemName.replace(/^\d+\s*x\s*/i, '').trim();
      itemName = itemName.replace(/\s+/g, ' ').trim();
      
      // Only add if it looks like a real item name (not just numbers or symbols)
      if (itemName.length > 2 && /[a-zA-Z]{2,}/.test(itemName) && !/^\d+$/.test(itemName)) {
        items.push({
          name: itemName,
          quantity: quantity,
          price: 0 // Will need manual entry
        });
      }
    }
  }
  
  // Remove duplicates more intelligently
  const unique = [];
  const seen = new Set();
  
  for (const item of items) {
    // Create a normalized key for deduplication
    const normalizedName = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const key = `${normalizedName}-${item.price.toFixed(2)}`;
    
    if (!seen.has(key)) {
      unique.push(item);
      seen.add(key);
    }
  }
  
  return unique;
}

// Enhanced line filtering function
function filterReceiptLines(lines) {
  const priceRegex = /(?:^|\s)[£€$]\s*(\d+(?:\.\d{2})?)|(\d+\.\d{2})\s*[£€$]?(?:\s|$)/;
  const ignorePatterns = [
    /^total\s*[£€$]/i, /^subtotal\s*[£€$]/i, /^balance\s*[£€$]/i, 
    /^discount\s*[£€$]/i, /^change\s*[£€$]/i, /^payment\s*[£€$]/i, 
    /^cash\s*[£€$]/i, /^card\s*[£€$]/i, /^visa\s*[£€$]/i, /^mastercard\s*[£€$]/i,
    /^contactless/i, /^chip & pin/i, /^thank you/i, /^thanks/i,
    /^receipt/i, /^customer copy/i, /^merchant copy/i, /^vat\s*[£€$]/i, 
    /^tax\s*[£€$]/i, /^service charge/i, /^tip/i, /^gratuity/i,
    /^www\./i, /\.com/i, /\.co\.uk/i, /^tel:/i, /^phone:/i,
    /^store\s*#/i, /^branch/i, /^location/i, /^address/i,
    /^since/i, /^plc/i, /^ltd/i, /^limited/i,
    /^delivery/i, /^takeaway/i, /^collection/i,
    /^offer/i, /^promotion/i, /^loyalty/i, /^points/i, /^rewards/i,
    /^cashier/i, /^operator/i, /^till/i, /^terminal/i, /^ref/i,
    /^order\s*#/i, /^transaction/i, /^auth\s*code/i,
    /^\d{2}\/\d{2}\/\d{2,4}/, /^\d{2}:\d{2}/, /^\d{4}-\d{2}-\d{2}/,
    /^[0-9\s\-\(\)]+$/, // Pure number/punctuation lines
    /^[A-Z\s]{8,}$/, // Long uppercase-only lines
    /^[*\-=_\s]+$/, // Decoration lines
    /^amount/i, /^quantity/i, /^price/i, /^item/i, /^description/i
  ];
  
  return lines.filter(line => {
    // Skip if matches ignore patterns
    if (ignorePatterns.some(pattern => pattern.test(line))) {
      return false;
    }
    
    // Skip very short lines
    if (line.length < 3) {
      return false;
    }
    
    // Include lines that have meaningful text
    const hasText = /[a-zA-Z]{2,}/.test(line);
    const hasPrice = priceRegex.test(line);
    
    // Include if it has meaningful text (either with or without price)
    return hasText || hasPrice;
  });
}

const ReceiptScannerModal = ({ visible, onClose, onItemsParsed, accentKey, darkMode }) => {
  const [mode, setMode] = useState(null);
  const [hasPermission, setHasPermission] = useState(null);
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ocrText, setOcrText] = useState('');
  const [allLines, setAllLines] = useState([]);
  const [selectedLines, setSelectedLines] = useState({});
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editItems, setEditItems] = useState([]);
  const [ocrBoxes, setOcrBoxes] = useState([]);
  const [imageLayout, setImageLayout] = useState(null);
  const [detectedTotal, setDetectedTotal] = useState(null);
  const [autoDetectedItems, setAutoDetectedItems] = useState([]);
  const [highQtyWarning, setHighQtyWarning] = useState(false);
  const [highQtyIndexes, setHighQtyIndexes] = useState([]);
  const cameraRef = useRef(null);

  const theme = getTheme(accentKey, darkMode);

  React.useEffect(() => {
    if (visible) {
      resetState();
    }
  }, [visible]);

  React.useEffect(() => {
    if (editModalVisible && editItems.length > 0) {
      const highIndexes = editItems.map((item, idx) => (item.quantity > 20 ? idx : -1)).filter(idx => idx !== -1);
      if (highIndexes.length > 0) {
        setHighQtyWarning(true);
        setHighQtyIndexes(highIndexes);
      } else {
        setHighQtyWarning(false);
        setHighQtyIndexes([]);
      }
    } else {
      setHighQtyWarning(false);
      setHighQtyIndexes([]);
    }
  }, [editModalVisible, editItems]);

  const resetState = () => {
    setMode(null);
    setImage(null);
    setOcrText('');
    setAllLines([]);
    setSelectedLines({});
    setEditItems([]);
    setEditModalVisible(false);
    setOcrBoxes([]);
    setImageLayout(null);
    setDetectedTotal(null);
    setAutoDetectedItems([]);
    setHighQtyWarning(false);
    setHighQtyIndexes([]);
  };

  const requestCamera = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === 'granted');
    if (status === 'granted') {
      setMode('camera');
    } else {
      Alert.alert('Camera permission is required!');
    }
  };

  const setImageWithDimensions = (img) => {
    if (img && img.width && img.height) {
      setImage(img);
    } else if (img && img.uri) {
      Image.getSize(img.uri, (width, height) => {
        setImage({ ...img, width, height });
      }, () => setImage(img));
    } else {
      setImage(img);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets && result.assets[0]) {
      setImageWithDimensions(result.assets[0]);
      processImage(result.assets[0]);
    }
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.7 });
      setImageWithDimensions(photo);
      processImage(photo);
    }
  };

  const processImage = async (img) => {
    setLoading(true);
    resetState();
    
    try {
      let mimeType = 'image/jpeg';
      if (img.uri && img.uri.toLowerCase().endsWith('.png')) {
        mimeType = 'image/png';
      }
      
      // Optional preflight health check
      try {
        const health = await fetch(`${API_BASE_URL}/health`, { method: 'GET' });
        if (!health.ok) {
          throw new Error(`Backend health check failed (${health.status})`);
        }
      } catch (e) {
        setLoading(false);
        Alert.alert('Service unavailable', 'We could not connect right now. Please check your internet connection and try again in a moment.');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/parse-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Image: img.base64, mimeType }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Backend error ${response.status}: ${text}`);
      }
      const data = await response.json();
      
      if (data && data.text) {
        setOcrText(data.text);
        const lines = data.text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        
        // Detect total with improved pattern
        const priceRegex = /(?:^|\s)[£€$]\s*(\d+(?:\.\d{2})?)|(\d+\.\d{2})\s*[£€$]?(?:\s|$)/;
        for (const line of lines) {
          if (/total/i.test(line) && priceRegex.test(line)) {
            const match = priceRegex.exec(line);
            if (match) {
              setDetectedTotal(parseFloat(match[1] || match[2]));
              break;
            }
          }
        }
        
        // Filter lines for selection
        const filteredLines = filterReceiptLines(lines);
        setAllLines(filteredLines);
        
        // Auto-detect items using improved parser
        const autoItems = parseReceiptText(data.text);
        setAutoDetectedItems(autoItems);
        
        
        // If we have good auto-detected items, show them for editing
        if (autoItems.length > 0) {
          setEditItems(autoItems.map(item => ({
            line: item.price > 0 ? `${item.quantity} × ${item.name} - £${item.price.toFixed(2)}` : `${item.quantity} × ${item.name}`,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            category: item.category || '',
          })));
          setEditModalVisible(true);
        } else {
          // If no auto-detection, show manual selection
          const initialSelection = {};
          filteredLines.forEach((line, index) => {
            if (priceRegex.test(line)) {
              initialSelection[index] = true;
            }
          });
          setSelectedLines(initialSelection);
        }
        
      } else if (data.lineItems && Array.isArray(data.lineItems) && data.lineItems.length > 0) {
        setEditItems(data.lineItems.map(item => ({
          line: `${item.quantity} × ${item.name}`,
          name: item.name,
          quantity: item.quantity || 1,
          price: item.price || 0,
          category: item.category || '',
        })));
        setEditModalVisible(true);
      } else {
        Alert.alert('OCR Failed', 'Could not extract meaningful text from the image. Please try a clearer photo.');
      }
    } catch (e) {
      Alert.alert('OCR Error', e.message || 'Failed to process image.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    const selectedLineTexts = allLines
      .map((line, i) => selectedLines[i] ? line : null)
      .filter(Boolean);
      
    if (selectedLineTexts.length === 0) {
      Alert.alert('No Items Selected', 'Please select at least one line.');
      return;
    }
    
    // Parse selected lines into items using improved parser
    const combinedText = selectedLineTexts.join('\n');
    const parsedItems = parseReceiptText(combinedText);
    
    // If parsing didn't work well, fall back to basic parsing
    if (parsedItems.length === 0) {
      const priceRegex = /(?:^|\s)[£€$]\s*(\d+(?:\.\d{2})?)|(\d+\.\d{2})\s*[£€$]?(?:\s|$)/;
      const quantityRegex = /^(\d+)\s+(.+)/;
      
      const items = selectedLineTexts.map(line => {
        const priceMatch = priceRegex.exec(line);
        const quantityMatch = quantityRegex.exec(line);
        
        let itemName = line.replace(priceRegex, '').trim();
        let quantity = 1;
        let price = 0;
        
        if (quantityMatch) {
          quantity = parseInt(quantityMatch[1], 10) || 1;
          itemName = quantityMatch[2].trim();
        }
        
        if (priceMatch) {
          price = parseFloat(priceMatch[1] || priceMatch[2]);
        }
        
        // Clean up item name
        itemName = itemName.replace(/^\d+\s*x\s*/i, '').trim();
        itemName = itemName.replace(/\s+/g, ' ').trim();
        
        return {
          line: line,
          name: itemName || 'Unknown Item',
          quantity: quantity,
          price: price,
        };
      });
      
      setEditItems(items);
    } else {
      setEditItems(parsedItems.map(item => ({
        line: item.price > 0 ? `${item.quantity} × ${item.name} - £${item.price.toFixed(2)}` : `${item.quantity} × ${item.name}`,
        name: item.name,
        quantity: item.quantity,
        price: item.price
      })));
    }
    
    setEditModalVisible(true);
  };

  const handleFinalConfirm = () => {
    const finalItems = editItems.map(item => ({
      name: item.name || item.line,
      quantity: item.quantity,
      price: item.price
    }));
    
    const sum = finalItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    
    if (detectedTotal && sum > 0 && Math.abs(sum - detectedTotal) > Math.max(0.01, detectedTotal * 0.02)) {
      Alert.alert(
        'Total Mismatch',
        `The sum of selected items (£${sum.toFixed(2)}) does not match the detected total (£${detectedTotal.toFixed(2)}).\n\nThis could be due to discounts, taxes, or missed items.`,
        [
          { text: 'Go Back', style: 'cancel' },
          { text: 'Continue Anyway', onPress: () => {
            onItemsParsed(finalItems);
            setEditModalVisible(false);
            onClose();
          }}
        ]
      );
      return;
    }
    
    onItemsParsed(finalItems);
    setEditModalVisible(false);
    onClose();
  };

  const updateItemName = (index, newName) => {
    const newItems = [...editItems];
    newItems[index].name = newName;
    setEditItems(newItems);
  };

  const updateItemQuantity = (index, newQuantity) => {
    const newItems = [...editItems];
    newItems[index].quantity = parseInt(newQuantity) || 1;
    setEditItems(newItems);
  };

  const updateItemPrice = (index, newPrice) => {
    const newItems = [...editItems];
    newItems[index].price = parseFloat(newPrice) || 0;
    setEditItems(newItems);
  };

  const removeItem = (index) => {
    const newItems = editItems.filter((_, i) => i !== index);
    setEditItems(newItems);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {loading && (
        <View style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: theme.overlay,
          zIndex: 100,
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <View style={{
            backgroundColor: theme.surface,
            padding: 32,
            borderRadius: 16,
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.12,
            shadowRadius: 18,
            elevation: 18
          }}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={{ color: theme.text, marginTop: 18, fontSize: 17, fontWeight: '600' }}>
              Scanning receipt...
            </Text>
            <Text style={{ color: theme.textSecondary, marginTop: 8, fontSize: 14, textAlign: 'center' }}>
              This may take a few seconds. Please wait.
            </Text>
          </View>
        </View>
      )}
      <View style={[styles.overlay, { backgroundColor: theme.overlay }]}>
        <View style={[styles.modal, { backgroundColor: theme.surface }]}>
          <Text style={[styles.title, { color: theme.text }]}>Scan Receipt</Text>
          
          {!mode && (
            <View style={styles.buttonRow}>
              <TouchableOpacity style={[styles.button, { backgroundColor: theme.primary }]} onPress={requestCamera}>
                <MaterialCommunityIcons name="camera" size={22} color="#fff" />
                <Text style={styles.buttonText}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, { backgroundColor: theme.accent }]} onPress={pickImage}>
                <MaterialCommunityIcons name="image" size={22} color="#fff" />
                <Text style={styles.buttonText}>Upload Image</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {mode === 'camera' && hasPermission && (
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing="back"
            >
              <View style={styles.cameraControls}>
                <TouchableOpacity
                  style={styles.captureButton}
                  onPress={async () => {
                    if (cameraRef.current) {
                      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.7 });
                      setImageWithDimensions(photo);
                      setMode(null);
                      processImage(photo);
                    }
                  }}
                />
                <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                  <MaterialCommunityIcons name="close" size={28} color="#fff" />
                </TouchableOpacity>
              </View>
            </CameraView>
          )}
          
          {loading && (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={{ color: theme.text, marginTop: 12 }}>Processing receipt...</Text>
            </View>
          )}
          
          {image && !loading && !editModalVisible && allLines.length > 0 && (
            <View style={{ flexDirection: 'row', maxHeight: 400 }}>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Image
                  source={{ uri: image.uri }}
                  style={[styles.receiptImage, { width: 180, height: 320 }]}
                  resizeMode="contain"
                />
              </View>
              
              <View style={{ flex: 1, paddingLeft: 12 }}>
                <Text style={[styles.ocrText, { color: theme.textSecondary }]}>
                  Select lines to add as items:
                </Text>
                {detectedTotal && (
                  <Text style={[styles.ocrText, { color: theme.accent, fontSize: 13 }]}>
                    Receipt Total: £{detectedTotal.toFixed(2)}
                  </Text>
                )}
                
                {highQtyWarning && (
                  <View style={{ backgroundColor: theme.warning + '22', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                    <Text style={{ color: theme.warning, fontWeight: 'bold', fontSize: 15 }}>
                      Some quantities seem unusually high.
                    </Text>
                    <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 6 }}>
                      Please review and correct if needed.
                    </Text>
                  </View>
                )}
                
                <ScrollView style={{ maxHeight: 280 }}>
                  {allLines.map((line, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[
                        styles.itemRow,
                        { backgroundColor: selectedLines[i] ? theme.success + '22' : 'transparent' }
                      ]}
                      onPress={() => setSelectedLines(s => ({ ...s, [i]: !s[i] }))}
                    >
                      <MaterialCommunityIcons
                        name={selectedLines[i] ? 'checkbox-marked' : 'checkbox-blank-outline'}
                        size={20}
                        color={theme.success}
                      />
                      <Text style={[styles.itemText, { color: theme.text }]}>{line}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          )}
          
          {!loading && !editModalVisible && (
            <View style={styles.footerRow}>
              <TouchableOpacity style={[styles.footerButton, { backgroundColor: theme.border }]} onPress={onClose}>
                <Text style={{ color: theme.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.footerButton, { backgroundColor: theme.success }]}
                onPress={handleConfirm}
                disabled={allLines.length === 0}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Add Items</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
      
      {/* Enhanced Edit Modal */}
      {editModalVisible && (
        <Modal visible={editModalVisible} transparent animationType="slide" onRequestClose={() => setEditModalVisible(false)}>
          <View style={[styles.overlay, { backgroundColor: theme.overlay }]}>
            <View style={[styles.modal, { backgroundColor: theme.surface, maxWidth: 450, maxHeight: '90%' }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.title, { color: theme.text }]}>Confirm Items</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                  {editItems.length} item{editItems.length !== 1 ? 's' : ''} detected
                </Text>
              </View>
              {highQtyWarning && (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.warning + '22', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                  <MaterialCommunityIcons name="alert-circle" size={22} color={theme.warning} style={{ marginRight: 8 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.warning, fontWeight: 'bold', fontSize: 15 }}>
                      Some quantities seem unusually high.
                    </Text>
                    <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 2 }}>
                      Please review and correct if needed.
                    </Text>
                  </View>
                </View>
              )}
              
              <ScrollView style={{ maxHeight: 350 }}>
                {editItems.map((item, idx) => (
                  <View key={idx} style={[styles.editItemRow, { borderColor: item.quantity > 20 ? theme.error : theme.border }]}>
                    <View style={styles.editItemHeader}>
                      <Text style={[styles.editItemTitle, { color: theme.text }]}>
                        Item {idx + 1}
                        {item.category ? `  (${item.category})` : ''}
                      </Text>
                      <TouchableOpacity onPress={() => removeItem(idx)}>
                        <MaterialCommunityIcons name="close" size={20} color={theme.error} />
                      </TouchableOpacity>
                    </View>
                    
                    <View style={styles.editField}>
                      <Text style={[styles.editLabel, { color: theme.textSecondary }]}>Name:</Text>
                      <TextInput
                        style={[styles.editNameInput, { 
                          backgroundColor: theme.background, 
                          color: theme.text, 
                          borderColor: theme.border 
                        }]}
                        value={item.name}
                        onChangeText={(text) => updateItemName(idx, text)}
                        placeholder="Enter item name"
                        placeholderTextColor={theme.textSecondary}
                      />
                    </View>
                    
                    <View style={styles.editRowFields}>
                      <View style={styles.editField}>
                        <Text style={[styles.editLabel, { color: theme.textSecondary }]}>Qty:</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <TouchableOpacity
                            style={{ padding: 4, marginRight: 6, backgroundColor: theme.border, borderRadius: 6 }}
                            onPress={() => {
                              if (item.quantity > 1) updateItemQuantity(idx, (item.quantity - 1).toString());
                            }}
                          >
                            <Text style={{ fontSize: 18, color: theme.textSecondary }}>-</Text>
                          </TouchableOpacity>
                          <TextInput
                            style={[
                              styles.editInput,
                              {
                                backgroundColor: theme.background,
                                color: theme.text,
                                borderColor: item.quantity > 20 ? theme.error : theme.border, // Highlight input if high qty
                                width: 60,
                                textAlign: 'center',
                                marginHorizontal: 2,
                              }
                            ]}
                            value={item.quantity.toString()}
                            onChangeText={text => {
                              // Only allow positive integers
                              const num = parseInt(text.replace(/[^0-9]/g, ''), 10);
                              updateItemQuantity(idx, isNaN(num) ? 1 : num);
                            }}
                            keyboardType="number-pad"
                            maxLength={8}
                          />
                          <TouchableOpacity
                            style={{ padding: 4, marginLeft: 6, backgroundColor: theme.border, borderRadius: 6 }}
                            onPress={() => updateItemQuantity(idx, (item.quantity + 1).toString())}
                          >
                            <Text style={{ fontSize: 18, color: theme.textSecondary }}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      
                      <View style={styles.editField}>
                        <Text style={[styles.editLabel, { color: theme.textSecondary }]}>Price:</Text>
                        <TextInput
                          style={[styles.editInput, { 
                            backgroundColor: theme.background, 
                            color: theme.text, 
                            borderColor: theme.border,
                            width: 80
                          }]}
                          keyboardType="decimal-pad"
                          value={item.price.toFixed(2)}
                          onChangeText={(text) => updateItemPrice(idx, text)}
                          placeholder="0.00"
                          placeholderTextColor={theme.textSecondary}
                        />
                      </View>
                    </View>
                    
                    <Text style={[styles.editSubtotal, { color: theme.textSecondary }]}>
                      Subtotal: £{(item.quantity * item.price).toFixed(2)}
                    </Text>
                  </View>
                ))}
              </ScrollView>
              
              <View style={styles.totalRow}>
                <Text style={[styles.totalText, { color: theme.text }]}>
                  Total: £{editItems.reduce((sum, item) => sum + (item.quantity * item.price), 0).toFixed(2)}
                </Text>
                {detectedTotal && (
                  <Text style={[styles.detectedTotal, { color: theme.accent }]}>
                    Receipt Total: £{detectedTotal.toFixed(2)}
                  </Text>
                )}
              </View>
              
              <View style={styles.footerRow}>
                <TouchableOpacity
                  style={[styles.footerButton, { backgroundColor: theme.border }]}
                  onPress={() => setEditModalVisible(false)}
                >
                  <Text style={{ color: theme.textSecondary }}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.footerButton, { backgroundColor: theme.success }]}
                  onPress={handleFinalConfirm}
                  disabled={editItems.length === 0}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Add Items</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 16 
  },
  modal: { 
    width: '100%', 
    maxWidth: 420, 
    borderRadius: 18, 
    padding: 20, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 8 }, 
    shadowOpacity: 0.10, 
    shadowRadius: 18, 
    elevation: 18 
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    marginBottom: 4, 
    textAlign: 'center' 
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    marginBottom: 16,
  },
  buttonRow: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    gap: 12, 
    marginBottom: 18 
  },
  button: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 14, 
    borderRadius: 12, 
    marginHorizontal: 6 
  },
  buttonText: { 
    color: '#fff', 
    fontWeight: '600', 
    marginLeft: 8, 
    fontSize: 16 
  },
  camera: { 
    width: 320, 
    height: 240, 
    borderRadius: 12, 
    overflow: 'hidden', 
    alignSelf: 'center', 
    marginBottom: 12 
  },
  cameraControls: { 
    position: 'absolute', 
    bottom: 16, 
    left: 0, 
    right: 0, 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  captureButton: { 
    width: 60, 
    height: 60, 
    borderRadius: 30, 
    backgroundColor: '#fff', 
    borderWidth: 4, 
    borderColor: '#6366F1', 
    marginHorizontal: 24 
  },
  cancelButton: { 
    position: 'absolute', 
    right: 24, 
    top: 8, 
    backgroundColor: 'rgba(0,0,0,0.4)', 
    borderRadius: 20, 
    padding: 4 
  },
  loadingBox: { 
    alignItems: 'center', 
    marginVertical: 24 
  },
  receiptImage: { 
    alignSelf: 'center', 
    marginVertical: 12, 
    borderRadius: 8 
  },
  ocrText: { 
    fontSize: 15, 
    fontWeight: '600', 
    marginTop: 10, 
    marginBottom: 6 
  },
  itemRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 10, 
    borderRadius: 8, 
    marginBottom: 4 
  },
  itemText: { 
    marginLeft: 10, 
    fontSize: 14, 
    flex: 1 
  },
  editItemRow: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  editItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  editItemTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  editField: {
    marginBottom: 12,
  },
  editLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  editNameInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  editRowFields: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 16,
  },
  editInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    textAlign: 'center',
    fontSize: 16,
    width: 60,
  },
  editSubtotal: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'right',
    marginTop: 8,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 16,
    marginTop: 16,
    alignItems: 'center',
  },
  totalText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  detectedTotal: {
    fontSize: 14,
    fontWeight: '500',
  },
  footerRow: { 
    flexDirection: 'row', 
    gap: 12, 
    marginTop: 18 
  },
  footerButton: { 
    flex: 1, 
    padding: 14, 
    borderRadius: 12, 
    alignItems: 'center' 
  },
});

export default ReceiptScannerModal;