import React, { useState, useContext, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Dimensions, Modal, TextInput } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { ShoppingListContext } from './App';
import { getTheme } from './theme';
import { predictExpiryDate } from './food-scanner-app/utils';

const { width, height } = Dimensions.get('window');

export default function ScannerScreen(props) {
  // Ensure navigation is available even if not passed as a prop (e.g., when rendered via children)
  const navigation = props?.navigation ?? useNavigation();
  const context = useContext(ShoppingListContext);
  const darkMode = context?.darkMode || false;
  const accentKey = context?.accentKey || 'default';
  const theme = getTheme(accentKey, darkMode);
  
  const [hasPermission, setHasPermission] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [torch, setTorch] = useState(false);
  const cameraRef = useRef(null);
  const scanLockRef = useRef(false);
  const lastScanDataRef = useRef(null);
  const lastScanTimeRef = useRef(0);
  const { setFoodInventory } = context;

  // Cross-platform input modal state
  const [inputModalVisible, setInputModalVisible] = useState(false);
  const [inputModalTitle, setInputModalTitle] = useState('');
  const [inputModalMessage, setInputModalMessage] = useState('');
  const [inputModalValue, setInputModalValue] = useState('');
  const [inputModalKeyboard, setInputModalKeyboard] = useState('default');
  const inputSubmitRef = useRef(null);

  useEffect(() => {
    getCameraPermissions();
  }, []);

  const getCameraPermissions = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === 'granted');
  };

  const requestImagePermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant photo library permissions to select images.');
      return false;
    }
    return true;
  };

  const startScanning = () => {
    if (hasPermission) {
      setShowCamera(true);
      setScanned(false);
      // reset scan lock and debounce when starting camera
      scanLockRef.current = false;
      lastScanDataRef.current = null;
      lastScanTimeRef.current = 0;
    } else {
      Alert.alert('Permission needed', 'Please grant camera permissions to scan barcodes.');
    }
  };

  // Fetch product info from Open Food Facts
  const fetchProductInfo = async (barcode) => {
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      const data = await response.json();
      if (data.status === 1 && data.product) {
        return {
          id: Date.now().toString(),
          name: data.product.product_name || 'Unknown Product',
          brand: data.product.brands || '',
          category: data.product.categories || '',
          expiry: predictExpiryDate(data.product.categories || ''),
          barcode: barcode,
          quantity: 1,
          dateAdded: new Date().toISOString().split('T')[0],
          imageUrl: data.product.image_url || null,
          nutrition: data.product.nutriments || {},
          ingredients: data.product.ingredients_text || '',
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

  // Cross-platform input modal helper
  const openInputModal = ({ title, message, keyboardType = 'default', initialValue = '', onSubmit }) => {
    setInputModalTitle(title || '');
    setInputModalMessage(message || '');
    setInputModalValue(initialValue);
    setInputModalKeyboard(keyboardType);
    inputSubmitRef.current = onSubmit;
    setInputModalVisible(true);
  };

  const closeInputModal = () => {
    setInputModalVisible(false);
    setInputModalValue('');
    inputSubmitRef.current = null;
  };

  // Helper to handle adding product, prompting for price if needed
  const handleAddProductWithPrice = (product, setFoodInventory, navigation, onClose) => {
    if (!product.price) {
      openInputModal({
        title: 'Enter Price',
        message: `No price found for ${product.name}. Please enter the price:`,
        keyboardType: 'decimal-pad',
        initialValue: '',
        onSubmit: (price) => {
          const parsed = parseFloat(String(price).replace(/[^0-9.]/g, ''));
          if (!isNaN(parsed) && parsed > 0) {
            product.price = parsed;
            setFoodInventory(prev => [...prev, product]);
            closeInputModal();
            navigation.goBack();
          } else {
            Alert.alert('Invalid Price', 'Please enter a valid positive number.');
          }
          if (onClose) onClose();
        }
      });
    } else {
      setFoodInventory(prev => [
        ...prev,
        product
      ]);
      navigation.goBack();
    }
  };

  const handleBarcodeScanned = async ({ type, data }) => {
    // Prevent rapid duplicate triggers from camera callback
    if (scanLockRef.current) return;

    // Debounce same barcode within 1500ms
    const now = Date.now();
    if (lastScanDataRef.current === data && now - lastScanTimeRef.current < 1500) {
      return;
    }
    lastScanDataRef.current = data;
    lastScanTimeRef.current = now;

    scanLockRef.current = true;
    setScanned(true);
    let product = await fetchProductInfo(data);
    if (!product) {
      product = {
        id: Date.now().toString(),
        name: 'Unknown Product',
        barcode: data,
        expiry: predictExpiryDate(''), // Fallback to empty category
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
    handleAddProductWithPrice(product, setFoodInventory, navigation);
  };

  const pickImage = async () => {
    const hasImagePermission = await requestImagePermissions();
    if (!hasImagePermission) return;

    setLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType.Image,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        // Try to extract barcode from image filename (simulate), else fallback
        let barcode = 'image-' + Date.now();
        // Optionally, you could use a barcode detection API here
        let product = await fetchProductInfo(barcode);
        if (!product) {
          product = {
            id: Date.now().toString(),
            name: 'Unknown Product',
            barcode: barcode,
            expiry: predictExpiryDate(''), // Fallback to empty category
            quantity: 1,
            dateAdded: new Date().toISOString().split('T')[0],
          };
        }
        if (!product.price) {
          const fetchedPrice = await fetchProductPrice(barcode);
          if (fetchedPrice) {
            product.price = fetchedPrice;
          }
        }
        setFoodInventory(prev => [
          ...prev,
          product
        ]);
        await processImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const processImage = async (imageUri) => {
    setLoading(true);
    try {
      // For now, we'll simulate barcode detection from image
      // In a real app, you'd send the image to a barcode detection API
      const mockBarcode = generateMockBarcode();
      
      Alert.alert(
        'Barcode Detected!',
        `Barcode: ${mockBarcode}\n\nThis is a simulated result from image. In a real app, this would use image processing to detect barcodes.`,
        [
          { 
            text: 'Add to Inventory', 
            onPress: () => {
              Alert.alert('Success', 'Product added to inventory!');
              navigation.goBack();
            }
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to detect barcode. Please try a clearer image.');
    } finally {
      setLoading(false);
    }
  };

  const generateMockBarcode = () => {
    const barcodes = [
      '1234567890123',
      '9876543210987',
      '4567891234567',
      '7891234567890',
      '3210987654321'
    ];
    return barcodes[Math.floor(Math.random() * barcodes.length)];
  };

  const handleManualBarcodeEntry = async (barcode) => {
    if (barcode && barcode.trim()) {
      let product = await fetchProductInfo(barcode.trim());
      if (!product) {
        product = {
          id: Date.now().toString(),
          name: 'Unknown Product',
          barcode: barcode.trim(),
          expiry: predictExpiryDate(''), // Fallback to empty category
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
      handleAddProductWithPrice(product, setFoodInventory, navigation);
    } else {
      Alert.alert('Error', 'Please enter a valid barcode.');
    }
  };

  const enterBarcodeManually = () => {
    openInputModal({
      title: 'Enter Barcode',
      message: 'Please enter the barcode number:',
      keyboardType: 'number-pad',
      initialValue: '',
      onSubmit: (val) => handleManualBarcodeEntry(val)
    });
  };

  const toggleTorch = () => {
    setTorch(!torch);
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.permissionText}>Requesting camera permission...</Text>
        </View>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
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
        </View>
      </View>
    );
  }

  if (showCamera) {
    return (
      <View style={styles.container}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          flash={torch ? 'torch' : 'off'}
          onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: [
              'qr',
              'pdf417',
              'aztec',
              'ean13',
              'ean8',
              'upc_e',
              'code39',
              'code93',
              'code128',
              'codabar',
              'itf14',
              'upc_a'
            ],
          }}
        >
          <View style={styles.cameraOverlay}>
            <View style={styles.cameraHeader}>
              <TouchableOpacity 
                style={styles.cameraButton} 
                onPress={() => setShowCamera(false)}
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
                onPress={() => { setScanned(false); scanLockRef.current = false; lastScanDataRef.current = null; lastScanTimeRef.current = 0; }}
                disabled={!scanned}
              >
                <MaterialCommunityIcons name="refresh" size={20} color="#fff" />
                <Text style={styles.footerButtonText}>Scan Again</Text>
              </TouchableOpacity>
            </View>
          </View>
        </CameraView>

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Processing...</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="close" size={32} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Barcode Scanner</Text>
      </View>

      <View style={styles.content}>
        <MaterialCommunityIcons name="barcode-scan" size={120} color="#fff" />
        <Text style={styles.subtitle}>Scan Barcode</Text>
        <Text style={styles.description}>
          Scan barcodes in real-time, select from photo library, or enter manually
        </Text>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Processing...</Text>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: theme.primary }]} 
          onPress={startScanning}
          disabled={loading}
        >
          <MaterialCommunityIcons name="camera" size={24} color="#fff" />
          <Text style={styles.buttonText}>Start Scanning</Text>
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

      {/* Cross-platform input modal */}
      <Modal
        visible={inputModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeInputModal}
      >
        <View style={styles.modalOverlay}> 
          <View style={styles.inputModalContent}>
            <Text style={styles.inputModalTitle}>{inputModalTitle}</Text>
            {!!inputModalMessage && (
              <Text style={styles.inputModalMessage}>{inputModalMessage}</Text>
            )}
            <TextInput
              value={inputModalValue}
              onChangeText={setInputModalValue}
              placeholder="Type here"
              placeholderTextColor="#9CA3AF"
              keyboardType={inputModalKeyboard}
              autoFocus
              style={styles.inputModalField}
            />
            <View style={styles.inputModalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnOutline]} onPress={closeInputModal}>
                <Text style={[styles.modalBtnText, styles.modalBtnOutlineText]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnFilled]}
                onPress={() => {
                  const submit = inputSubmitRef.current;
                  const val = inputModalValue;
                  closeInputModal();
                  try { submit && submit(val); } catch {}
                }}
              >
                <Text style={[styles.modalBtnText, styles.modalBtnFilledText]}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 50,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  closeButton: {
    position: 'absolute',
    left: 24,
    top: 50,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 28,
    padding: 12,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  subtitle: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 16,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  description: {
    color: '#b0b0b0',
    fontSize: 17,
    textAlign: 'center',
    lineHeight: 26,
    fontWeight: '400',
  },
  buttonContainer: {
    padding: 24,
    gap: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 17,
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
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  inputModalContent: {
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
  inputModalTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  inputModalMessage: {
    color: '#a0a0a0',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  inputModalField: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#404040',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '500',
  },
  inputModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
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
    borderWidth: 1.5,
    borderColor: '#555555',
    backgroundColor: 'transparent',
  },
  modalBtnOutlineText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
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
  modalBtnFilledText: {
    color: '#ffffff',
    fontSize: 16,
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
  camera: {
    flex: 1,
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
});