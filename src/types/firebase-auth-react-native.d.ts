import 'firebase/auth';
import type { Persistence } from 'firebase/auth';

type ReactNativeAsyncStorageLike = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

declare module 'firebase/auth' {
  export function getReactNativePersistence(
    storage: ReactNativeAsyncStorageLike
  ): Persistence;
}
