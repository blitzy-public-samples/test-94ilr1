/**
 * @fileoverview Enterprise-grade browser storage utilities with encryption, type safety,
 * and comprehensive error handling for the AI Email Management Platform.
 * @version 1.0.0
 * @license MIT
 */

import CryptoJS from 'crypto-js'; // ^4.1.1
import { APP_CONFIG } from '../constants/app.constants';
import { ApiResponse } from '../types/api.types';

/**
 * Storage-related error types for granular error handling
 */
export enum StorageErrorType {
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',
  INVALID_DATA = 'INVALID_DATA',
  STORAGE_UNAVAILABLE = 'STORAGE_UNAVAILABLE',
  KEY_NOT_FOUND = 'KEY_NOT_FOUND',
}

/**
 * Custom error class for storage operations
 */
export class StorageError extends Error {
  constructor(
    public type: StorageErrorType,
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * Storage configuration constants
 */
const STORAGE_CONFIG = {
  PREFIX: `${APP_CONFIG.APP_NAME.toLowerCase()}_${APP_CONFIG.APP_VERSION}_`,
  ENCRYPTION_KEY: process.env.REACT_APP_STORAGE_ENCRYPTION_KEY || '',
  MAX_SIZE: 5 * 1024 * 1024, // 5MB storage limit
  ENCRYPTION_ALGORITHM: 'AES-256-CBC',
} as const;

/**
 * Type guard to validate stored data structure
 */
function isValidStoredData<T>(data: unknown): data is T {
  return data !== null && data !== undefined;
}

/**
 * Validates storage key format and content
 */
function validateStorageKey(key: string): void {
  if (!key || typeof key !== 'string') {
    throw new StorageError(
      StorageErrorType.INVALID_DATA,
      'Storage key must be a non-empty string'
    );
  }
  
  if (key.length > 128) {
    throw new StorageError(
      StorageErrorType.INVALID_DATA,
      'Storage key exceeds maximum length of 128 characters'
    );
  }
}

/**
 * Checks available storage quota
 */
function checkStorageQuota(dataSize: number): void {
  if (dataSize > STORAGE_CONFIG.MAX_SIZE) {
    throw new StorageError(
      StorageErrorType.QUOTA_EXCEEDED,
      `Data size ${dataSize} bytes exceeds maximum storage quota of ${STORAGE_CONFIG.MAX_SIZE} bytes`
    );
  }
}

/**
 * Encrypts data using AES-256
 */
function encryptData(data: string): string {
  try {
    return CryptoJS.AES.encrypt(
      data,
      STORAGE_CONFIG.ENCRYPTION_KEY,
      {
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      }
    ).toString();
  } catch (error) {
    throw new StorageError(
      StorageErrorType.ENCRYPTION_FAILED,
      'Failed to encrypt data',
      error as Error
    );
  }
}

/**
 * Decrypts AES-256 encrypted data
 */
function decryptData(encryptedData: string): string {
  try {
    const bytes = CryptoJS.AES.decrypt(
      encryptedData,
      STORAGE_CONFIG.ENCRYPTION_KEY,
      {
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      }
    );
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    throw new StorageError(
      StorageErrorType.DECRYPTION_FAILED,
      'Failed to decrypt data',
      error as Error
    );
  }
}

/**
 * Stores data in localStorage with optional encryption and type safety
 * @template T - Type of value being stored
 * @param key - Storage key
 * @param value - Value to store
 * @param encrypt - Whether to encrypt the data
 * @throws {StorageError} If storage operation fails
 */
export function setItem<T>(key: string, value: T, encrypt = false): void {
  try {
    validateStorageKey(key);
    
    const serializedValue = JSON.stringify(value);
    checkStorageQuota(serializedValue.length);
    
    const storageKey = STORAGE_CONFIG.PREFIX + key;
    const dataToStore = encrypt ? encryptData(serializedValue) : serializedValue;
    
    localStorage.setItem(storageKey, dataToStore);
    
    // Emit storage event for monitoring
    window.dispatchEvent(new StorageEvent('storage', {
      key: storageKey,
      newValue: dataToStore,
      storageArea: localStorage,
    }));
  } catch (error) {
    if (error instanceof StorageError) {
      throw error;
    }
    throw new StorageError(
      StorageErrorType.STORAGE_UNAVAILABLE,
      'Failed to store data in localStorage',
      error as Error
    );
  }
}

/**
 * Retrieves and optionally decrypts data from localStorage with type safety
 * @template T - Expected type of stored value
 * @param key - Storage key
 * @param encrypted - Whether the data is encrypted
 * @returns Retrieved value or null if not found
 * @throws {StorageError} If retrieval operation fails
 */
export function getItem<T>(key: string, encrypted = false): T | null {
  try {
    validateStorageKey(key);
    
    const storageKey = STORAGE_CONFIG.PREFIX + key;
    const storedValue = localStorage.getItem(storageKey);
    
    if (!storedValue) {
      return null;
    }
    
    const decodedValue = encrypted ? decryptData(storedValue) : storedValue;
    const parsedValue = JSON.parse(decodedValue) as unknown;
    
    if (!isValidStoredData<T>(parsedValue)) {
      throw new StorageError(
        StorageErrorType.INVALID_DATA,
        'Retrieved data failed type validation'
      );
    }
    
    return parsedValue;
  } catch (error) {
    if (error instanceof StorageError) {
      throw error;
    }
    throw new StorageError(
      StorageErrorType.STORAGE_UNAVAILABLE,
      'Failed to retrieve data from localStorage',
      error as Error
    );
  }
}

/**
 * Securely removes item from localStorage
 * @param key - Storage key
 * @throws {StorageError} If removal operation fails
 */
export function removeItem(key: string): void {
  try {
    validateStorageKey(key);
    const storageKey = STORAGE_CONFIG.PREFIX + key;
    localStorage.removeItem(storageKey);
    
    // Emit storage event for monitoring
    window.dispatchEvent(new StorageEvent('storage', {
      key: storageKey,
      newValue: null,
      storageArea: localStorage,
    }));
  } catch (error) {
    throw new StorageError(
      StorageErrorType.STORAGE_UNAVAILABLE,
      'Failed to remove item from localStorage',
      error as Error
    );
  }
}

/**
 * Clears all app-specific items from localStorage
 * @throws {StorageError} If clear operation fails
 */
export function clear(): void {
  try {
    const keys = Object.keys(localStorage);
    const appKeys = keys.filter(key => key.startsWith(STORAGE_CONFIG.PREFIX));
    
    appKeys.forEach(key => {
      localStorage.removeItem(key);
    });
    
    // Emit storage event for monitoring
    window.dispatchEvent(new StorageEvent('storage', {
      key: null,
      newValue: null,
      storageArea: localStorage,
    }));
  } catch (error) {
    throw new StorageError(
      StorageErrorType.STORAGE_UNAVAILABLE,
      'Failed to clear localStorage',
      error as Error
    );
  }
}

/**
 * Type-safe storage in sessionStorage
 * @template T - Type of value being stored
 * @param key - Storage key
 * @param value - Value to store
 * @throws {StorageError} If storage operation fails
 */
export function setSessionItem<T>(key: string, value: T): void {
  try {
    validateStorageKey(key);
    
    const serializedValue = JSON.stringify(value);
    checkStorageQuota(serializedValue.length);
    
    const storageKey = STORAGE_CONFIG.PREFIX + key;
    sessionStorage.setItem(storageKey, serializedValue);
  } catch (error) {
    throw new StorageError(
      StorageErrorType.STORAGE_UNAVAILABLE,
      'Failed to store data in sessionStorage',
      error as Error
    );
  }
}

/**
 * Type-safe retrieval from sessionStorage
 * @template T - Expected type of stored value
 * @param key - Storage key
 * @returns Retrieved value or null if not found
 * @throws {StorageError} If retrieval operation fails
 */
export function getSessionItem<T>(key: string): T | null {
  try {
    validateStorageKey(key);
    
    const storageKey = STORAGE_CONFIG.PREFIX + key;
    const storedValue = sessionStorage.getItem(storageKey);
    
    if (!storedValue) {
      return null;
    }
    
    const parsedValue = JSON.parse(storedValue) as unknown;
    
    if (!isValidStoredData<T>(parsedValue)) {
      throw new StorageError(
        StorageErrorType.INVALID_DATA,
        'Retrieved data failed type validation'
      );
    }
    
    return parsedValue;
  } catch (error) {
    throw new StorageError(
      StorageErrorType.STORAGE_UNAVAILABLE,
      'Failed to retrieve data from sessionStorage',
      error as Error
    );
  }
}