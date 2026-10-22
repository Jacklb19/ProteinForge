import { LAB_CONFIG as C } from './config';

export function downloadLabFile(contents: BlobPart, filename: string, type: string): void {
  const url=URL.createObjectURL(new Blob([contents],{type})); const link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>{URL.revokeObjectURL(url);},C.revokeUrlMs);
}
