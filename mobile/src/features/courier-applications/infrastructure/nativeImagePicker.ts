import {NativeModules} from 'react-native';
import type {ImageMimeType} from '../domain/courierApplication';

export interface PickedImagePayload {
  readonly base64: string;
  readonly contentType: ImageMimeType;
  readonly sizeBytes: number;
  readonly fileName: string;
}

interface NativeDocumentImagePicker {
  pickImage: () => Promise<PickedImagePayload | null>;
}

const nativeModule = NativeModules.DocumentImagePicker as NativeDocumentImagePicker | undefined;

export function hasNativeImagePicker(): boolean {
  return nativeModule !== undefined && typeof nativeModule.pickImage === 'function';
}

export async function pickDocumentImage(): Promise<PickedImagePayload | null> {
  if (!hasNativeImagePicker()) {
    throw new Error(
      'El selector nativo de galería solo está disponible dentro de la compilación Android.',
    );
  }
  return nativeModule!.pickImage();
}
